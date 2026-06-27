// services/generation.js — generación de noticias con Claude (Sonnet 4.6).
//
// Hace dos cosas:
//  1) Llama a Claude para crear artículos cortos en español.
//     - Categorías ATEMPORALES (ciencia, cultura, historia, curiosidades):
//       se generan con SALIDA ESTRUCTURADA (JSON validado por esquema). kind='generado'.
//     - Categorías de ACTUALIDAD (mundo, tecnología, deportes): se usan la
//       herramienta de BÚSQUEDA WEB para basarse en hechos reales, con fuente. kind='real'.
//  2) Mantiene el inventario: ~30 noticias sin leer, repone cuando bajan de 20.

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { CATEGORY_IS_NEWS, DEFAULT_CATEGORIES } from '../db/seed.js';
import {
  countUnread,
  countPosts,
  insertPost,
  getState,
  setState,
} from '../db/queries.js';
import { chooseBatchCategories, countBySlug } from './recommend.js';

// Cliente de Anthropic (o null si no hay clave -> generación desactivada).
const client = config.anthropicApiKey
  ? new Anthropic({ apiKey: config.anthropicApiKey })
  : null;

export const generationEnabled = () => client !== null;

// Nombre bonito de cada categoría, para los prompts.
const CATEGORY_NAME = Object.fromEntries(
  DEFAULT_CATEGORIES.map((c) => [c.slug, c.name])
);

// ---------------------------------------------------------------------------
// Esquema de salida estructurada (un objeto con un array de artículos).
// ---------------------------------------------------------------------------
function articlesSchema(allowedSlugs) {
  return {
    type: 'object',
    properties: {
      articles: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            body: { type: 'string' },
            category_slug: { type: 'string', enum: allowedSlugs },
            read_minutes: { type: 'number' },
            hashtags: { type: 'array', items: { type: 'string' } },
          },
          required: ['title', 'body', 'category_slug', 'read_minutes', 'hashtags'],
          additionalProperties: false,
        },
      },
    },
    required: ['articles'],
    additionalProperties: false,
  };
}

function describeMix(counts) {
  return Object.entries(counts)
    .map(([slug, n]) => `${n} de "${CATEGORY_NAME[slug] || slug}" (slug: ${slug})`)
    .join(', ');
}

// ---------------------------------------------------------------------------
// Generación de temas ATEMPORALES con salida estructurada (sin web).
// ---------------------------------------------------------------------------
async function generateEvergreen(counts, batchId) {
  const slugs = Object.keys(counts);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return [];

  const prompt =
    `Eres un redactor de una app de noticias cortas en ESPAÑOL. ` +
    `Genera exactamente ${total} artículos breves e interesantes, cada uno de ` +
    `1 a 2 minutos de lectura (130-260 palabras). Reparte así por categoría: ` +
    `${describeMix(counts)}.\n\n` +
    `Cada artículo debe ser atemporal (curiosidades, divulgación, historia, ` +
    `cultura), entretenido y fácil de leer. Usa "category_slug" exactamente como ` +
    `el slug indicado. Incluye 2-4 hashtags relevantes en minúsculas, sin "#". ` +
    `"read_minutes" estimado entre 0.5 y 2. No inventes noticias de actualidad.`;

  const res = await client.messages.create({
    model: config.claudeModel,
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: articlesSchema(slugs) },
    },
    messages: [{ role: 'user', content: prompt }],
  });

  const parsed = parseStructured(res);
  return (parsed?.articles || []).map((a) => ({
    ...a,
    kind: 'generado',
    source_note: 'Generado por IA',
    category_name: CATEGORY_NAME[a.category_slug],
  }));
}

// ---------------------------------------------------------------------------
// Generación de ACTUALIDAD con búsqueda web (devuelve JSON dentro del texto).
// ---------------------------------------------------------------------------
async function generateNews(counts, batchId) {
  const slugs = Object.keys(counts);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return [];

  const prompt =
    `Eres un redactor de una app de noticias cortas en ESPAÑOL. Busca en la web ` +
    `noticias RECIENTES y reales, y escribe ${total} resúmenes breves (1-2 min de ` +
    `lectura, 130-260 palabras). Reparte por categoría: ${describeMix(counts)}.\n\n` +
    `Después de buscar, responde ÚNICAMENTE con un array JSON (sin texto extra, sin ` +
    `bloques de código markdown) con este formato exacto:\n` +
    `[{"title": "...", "body": "...", "category_slug": "uno de: ${slugs.join(', ')}", ` +
    `"read_minutes": 1.5, "hashtags": ["...", "..."], "source_url": "https://..."}]\n\n` +
    `"source_url" debe ser el enlace real de la fuente principal. Hashtags en ` +
    `minúsculas y sin "#".`;

  let messages = [{ role: 'user', content: prompt }];
  let res = await client.messages.create({
    model: config.claudeModel,
    max_tokens: 8000,
    messages,
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }],
  });

  // La búsqueda web puede pausar el turno (pause_turn); reanudamos unas pocas veces.
  let guard = 0;
  while (res.stop_reason === 'pause_turn' && guard++ < 3) {
    messages.push({ role: 'assistant', content: res.content });
    res = await client.messages.create({
      model: config.claudeModel,
      max_tokens: 8000,
      messages,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }],
    });
  }

  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  const arr = extractJsonArray(text);
  return (arr || []).map((a) => ({
    ...a,
    kind: 'real',
    source_note: a.source_url ? 'Fuente: ' + a.source_url : 'Noticia real',
    category_name: CATEGORY_NAME[a.category_slug],
  }));
}

// ---------------------------------------------------------------------------
// Genera un lote de "n" artículos: elige categorías (sesgadas por tus likes),
// separa actualidad vs atemporal, llama a Claude, e inserta en la base de datos.
// Devuelve cuántos insertó.
// ---------------------------------------------------------------------------
export async function generateBatch(n) {
  if (!client) return 0;
  const batchId = 'batch-' + Date.now();
  const slugs = chooseBatchCategories(n);
  const counts = countBySlug(slugs);

  // Separa por tipo de categoría.
  const newsCounts = {};
  const evergreenCounts = {};
  for (const [slug, c] of Object.entries(counts)) {
    if (CATEGORY_IS_NEWS[slug]) newsCounts[slug] = c;
    else evergreenCounts[slug] = c;
  }

  const articles = [];

  // Atemporales: salida estructurada.
  if (Object.keys(evergreenCounts).length) {
    try {
      articles.push(...(await generateEvergreen(evergreenCounts, batchId)));
    } catch (err) {
      console.error('[generation] error en atemporales:', err.message);
    }
  }

  // Actualidad: búsqueda web. Si falla, se generan como atemporales (respaldo).
  if (Object.keys(newsCounts).length) {
    try {
      const news = await generateNews(newsCounts, batchId);
      if (news.length) articles.push(...news);
      else articles.push(...(await generateEvergreen(newsCounts, batchId)));
    } catch (err) {
      console.error('[generation] error en actualidad, uso respaldo:', err.message);
      try {
        articles.push(...(await generateEvergreen(newsCounts, batchId)));
      } catch (e2) {
        console.error('[generation] respaldo también falló:', e2.message);
      }
    }
  }

  // Inserta todo.
  let inserted = 0;
  for (const a of articles) {
    if (!a.title || !a.body || !a.category_slug) continue;
    try {
      insertPost(a, batchId);
      inserted++;
    } catch (err) {
      console.error('[generation] no se pudo insertar un post:', err.message);
    }
  }

  registerGenerationRun();
  console.log(`[generation] Lote ${batchId}: ${inserted} noticias insertadas.`);
  return inserted;
}

// ---------------------------------------------------------------------------
// Mantener el inventario: ~30 sin leer, reponer cuando bajan de 20.
// ---------------------------------------------------------------------------
export async function topUpIfNeeded() {
  if (!client) return { skipped: 'sin-clave' };

  const unread = countUnread();
  if (unread >= config.refillThreshold) return { skipped: 'suficiente', unread };
  if (getState('generating') === 'true') return { skipped: 'ya-generando', unread };
  if (overDailyLimit()) return { skipped: 'tope-diario', unread };

  const want = Math.min(config.maxPerBatch, config.targetUnread - unread);
  if (want <= 0) return { skipped: 'suficiente', unread };

  setState('generating', 'true');
  try {
    const inserted = await generateBatch(want);
    return { generated: inserted, unreadBefore: unread };
  } finally {
    setState('generating', 'false');
  }
}

// Llena la app la primera vez (si está vacía), en tandas hasta llegar a ~30.
export async function generateInitialIfEmpty() {
  if (!client) {
    console.warn('[generation] Sin clave de API: no se generan noticias iniciales.');
    return;
  }
  if (countPosts() > 0) {
    // Ya hay contenido: solo asegura el inventario.
    await topUpIfNeeded();
    return;
  }
  console.log('[generation] Base vacía: generando noticias iniciales...');
  setState('generating', 'true');
  try {
    let safety = 0;
    while (countUnread() < config.targetUnread && safety++ < 5) {
      if (overDailyLimit()) break;
      const want = Math.min(config.maxPerBatch, config.targetUnread - countUnread());
      const inserted = await generateBatch(want);
      if (inserted === 0) break; // evita bucle infinito si algo falla
    }
  } finally {
    setState('generating', 'false');
  }
}

// ---------------------------------------------------------------------------
// Tope diario de generaciones (para acotar gasto).
// ---------------------------------------------------------------------------
function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function overDailyLimit() {
  if (getState('gen_day') !== today()) return false; // día nuevo, contador a cero
  return Number(getState('gen_count', '0')) >= config.maxGenerationsPerDay;
}

function registerGenerationRun() {
  if (getState('gen_day') !== today()) {
    setState('gen_day', today());
    setState('gen_count', '0');
  }
  setState('gen_count', Number(getState('gen_count', '0')) + 1);
}

// ---------------------------------------------------------------------------
// Utilidades de parseo
// ---------------------------------------------------------------------------
function parseStructured(res) {
  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  try {
    return JSON.parse(text);
  } catch {
    // Por si acaso vino envuelto en otra cosa, intenta extraer un objeto.
    const obj = extractJson(text, '{', '}');
    return obj;
  }
}

// Extrae el primer array JSON [...] que aparezca en un texto.
function extractJsonArray(text) {
  const arr = extractJson(text, '[', ']');
  return Array.isArray(arr) ? arr : null;
}

function extractJson(text, open, close) {
  const start = text.indexOf(open);
  const end = text.lastIndexOf(close);
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
