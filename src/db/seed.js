// db/seed.js — datos iniciales.
//
// 1) ensureCategories(): crea el set fijo de categorías si no existen.
//    Se llama siempre al arrancar el servidor.
// 2) Si ejecutas este archivo directo (`npm run seed`), además inserta unos
//    posts de ejemplo para poder ver el feed sin gastar la API de Claude.

import { upsertCategory, insertPost, countPosts } from './queries.js';

// Set fijo de categorías. "actualidad: true" = se busca en la web (noticias
// reales); "actualidad: false" = se genera con IA (temas atemporales).
export const DEFAULT_CATEGORIES = [
  { slug: 'tecnologia', name: 'Tecnología', actualidad: true },
  { slug: 'ciencia', name: 'Ciencia', actualidad: false },
  { slug: 'mundo', name: 'Mundo', actualidad: true },
  { slug: 'deportes', name: 'Deportes', actualidad: true },
  { slug: 'cultura', name: 'Cultura', actualidad: false },
  { slug: 'curiosidades', name: 'Curiosidades', actualidad: false },
  { slug: 'historia', name: 'Historia', actualidad: false },
];

// Mapa rápido slug -> ¿es de actualidad? (lo usa el servicio de generación).
export const CATEGORY_IS_NEWS = Object.fromEntries(
  DEFAULT_CATEGORIES.map((c) => [c.slug, c.actualidad])
);

export function ensureCategories() {
  for (const c of DEFAULT_CATEGORIES) {
    upsertCategory(c.slug, c.name);
  }
}

// Posts de ejemplo para desarrollo (no usan la API).
const SAMPLE_POSTS = [
  {
    title: 'Por qué el cielo es azul (y al atardecer, rojo)',
    body:
      'La luz del sol parece blanca pero es una mezcla de todos los colores. ' +
      'Al entrar en la atmósfera choca con moléculas de aire que dispersan más ' +
      'la luz azul, porque tiene una longitud de onda más corta. Por eso vemos ' +
      'el cielo azul durante el día.\n\nAl atardecer, la luz atraviesa mucho más ' +
      'aire para llegar a tus ojos. Tanto azul se ha dispersado por el camino ' +
      'que sobre todo quedan los rojos y naranjas. El mismo fenómeno, visto desde ' +
      'otro ángulo, pinta dos cielos distintos.',
    category_slug: 'ciencia',
    kind: 'generado',
    source_note: 'Generado por IA',
    read_minutes: 1,
    hashtags: ['ciencia', 'fisica', 'luz'],
  },
  {
    title: 'El truco de memoria de los antiguos griegos',
    body:
      'Los oradores de la antigua Grecia memorizaban discursos larguísimos con ' +
      'una técnica llamada "el palacio de la memoria". Imaginaban un lugar conocido ' +
      '—su casa— y colocaban mentalmente cada idea en una habitación distinta.\n\n' +
      'Para recordar el discurso, daban un paseo imaginario por la casa y recogían ' +
      'cada idea en orden. El cerebro recuerda lugares mucho mejor que listas, así ' +
      'que el truco sigue funcionando hoy: campeones de memoria modernos lo usan ' +
      'para memorizar barajas enteras.',
    category_slug: 'historia',
    kind: 'generado',
    source_note: 'Generado por IA',
    read_minutes: 1.5,
    hashtags: ['historia', 'memoria', 'grecia'],
  },
  {
    title: 'Los pulpos tienen tres corazones',
    body:
      'Dos de sus corazones bombean sangre hacia las branquias para recoger ' +
      'oxígeno; el tercero la envía al resto del cuerpo. Curiosamente, ese tercer ' +
      'corazón deja de latir cuando el pulpo nada, lo que les cansa rápido. Por eso ' +
      'prefieren caminar por el fondo en vez de nadar.\n\nAdemás su sangre es azul, ' +
      'no roja: usa cobre en lugar de hierro para transportar oxígeno, algo más ' +
      'eficiente en aguas frías y con poco oxígeno.',
    category_slug: 'curiosidades',
    kind: 'generado',
    source_note: 'Generado por IA',
    read_minutes: 1,
    hashtags: ['curiosidades', 'animales', 'oceano'],
  },
];

export function seedSamplePosts() {
  ensureCategories();
  for (const p of SAMPLE_POSTS) insertPost(p, 'seed');
  console.log(`[seed] Insertados ${SAMPLE_POSTS.length} posts de ejemplo.`);
}

// Si se ejecuta directamente con `npm run seed`.
if (import.meta.url === `file://${process.argv[1]}`) {
  const before = countPosts();
  seedSamplePosts();
  console.log(`[seed] Posts en total: ${countPosts()} (antes había ${before}).`);
  process.exit(0);
}
