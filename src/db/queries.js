// db/queries.js — funciones con nombre para hablar con la base de datos.
//
// En vez de escribir SQL suelto por toda la app, lo concentramos aquí en
// funciones pequeñas y claras (countUnread, insertPost, toggleLike, ...).
// El resto del código llama a estas funciones y no necesita saber SQL.

import { db } from './index.js';

const now = () => new Date().toISOString();

// ----------------------------------------------------------------------------
// app_state (clave/valor)
// ----------------------------------------------------------------------------

export function getState(key, fallback = null) {
  const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function setState(key, value) {
  db.prepare(
    `INSERT INTO app_state(key, value) VALUES(?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, String(value));
}

// ----------------------------------------------------------------------------
// Categorías
// ----------------------------------------------------------------------------

export function listCategories() {
  return db.prepare('SELECT id, slug, name FROM categories ORDER BY name').all();
}

export function getCategoryBySlug(slug) {
  return db.prepare('SELECT id, slug, name FROM categories WHERE slug = ?').get(slug);
}

// Crea la categoría si no existe y devuelve su fila. También le da un peso
// inicial de 1.0 en el recomendador.
export function upsertCategory(slug, name) {
  let cat = getCategoryBySlug(slug);
  if (!cat) {
    const info = db
      .prepare('INSERT INTO categories(slug, name) VALUES(?, ?)')
      .run(slug, name || slug);
    cat = { id: Number(info.lastInsertRowid), slug, name: name || slug };
    db.prepare(
      'INSERT OR IGNORE INTO category_weights(category_id, weight) VALUES(?, 1.0)'
    ).run(cat.id);
  }
  return cat;
}

// ----------------------------------------------------------------------------
// Hashtags
// ----------------------------------------------------------------------------

export function upsertHashtag(tag) {
  const clean = String(tag).replace(/^#/, '').trim().toLowerCase();
  if (!clean) return null;
  let row = db.prepare('SELECT id, tag FROM hashtags WHERE tag = ?').get(clean);
  if (!row) {
    const info = db.prepare('INSERT INTO hashtags(tag) VALUES(?)').run(clean);
    row = { id: Number(info.lastInsertRowid), tag: clean };
    db.prepare(
      'INSERT OR IGNORE INTO hashtag_weights(hashtag_id, weight) VALUES(?, 1.0)'
    ).run(row.id);
  }
  return row;
}

export function linkHashtag(postId, hashtagId) {
  db.prepare(
    'INSERT OR IGNORE INTO post_hashtags(post_id, hashtag_id) VALUES(?, ?)'
  ).run(postId, hashtagId);
}

export function getPostHashtags(postId) {
  return db
    .prepare(
      `SELECT h.tag FROM hashtags h
       JOIN post_hashtags ph ON ph.hashtag_id = h.id
       WHERE ph.post_id = ?
       ORDER BY h.tag`
    )
    .all(postId)
    .map((r) => r.tag);
}

// ----------------------------------------------------------------------------
// Posts
// ----------------------------------------------------------------------------

// Inserta un post completo (con su categoría y hashtags). Devuelve el id.
// "article" = { title, body, category_slug, category_name?, read_minutes?,
//               kind?, source_note?, source_url?, hashtags?: string[] }
export function insertPost(article, batch = null) {
  const cat = upsertCategory(article.category_slug, article.category_name);
  const info = db
    .prepare(
      `INSERT INTO posts
         (title, body, category_id, read_minutes, kind, source_note, source_url, created_at, generation_batch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      article.title,
      article.body,
      cat.id,
      article.read_minutes ?? estimateReadMinutes(article.body),
      article.kind || 'generado',
      article.source_note || null,
      article.source_url || null,
      now(),
      batch
    );
  const postId = Number(info.lastInsertRowid);

  for (const tag of article.hashtags || []) {
    const h = upsertHashtag(tag);
    if (h) linkHashtag(postId, h.id);
  }
  return postId;
}

// Estimación simple de tiempo de lectura: ~200 palabras por minuto.
export function estimateReadMinutes(text) {
  const words = String(text).trim().split(/\s+/).length;
  return Math.max(0.5, Math.round((words / 200) * 10) / 10);
}

export function countPosts() {
  return db.prepare('SELECT COUNT(*) AS n FROM posts').get().n;
}

export function countUnread() {
  return db
    .prepare(
      `SELECT COUNT(*) AS n FROM posts p
       LEFT JOIN reads r ON r.post_id = p.id
       WHERE r.post_id IS NULL`
    )
    .get().n;
}

// Devuelve una página del feed. Cada post viene "enriquecido" con su categoría,
// hashtags, estado de like/lectura y número de comentarios.
// Paginación por cursor: "before" es el id del último post visto.
export function getFeed({ limit = 10, before = null } = {}) {
  const rows = db
    .prepare(
      `SELECT
         p.id, p.title, p.body, p.read_minutes, p.kind,
         p.source_note, p.source_url, p.created_at,
         c.slug AS category_slug, c.name AS category_name,
         (l.post_id IS NOT NULL) AS liked,
         (r.post_id IS NOT NULL) AS read,
         (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id) AS comment_count
       FROM posts p
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN likes l ON l.post_id = p.id
       LEFT JOIN reads r ON r.post_id = p.id
       WHERE (? IS NULL OR p.id < ?)
       ORDER BY p.id DESC
       LIMIT ?`
    )
    .all(before, before, limit);

  return rows.map(decoratePost);
}

export function getPost(id) {
  const row = db
    .prepare(
      `SELECT
         p.id, p.title, p.body, p.read_minutes, p.kind,
         p.source_note, p.source_url, p.created_at,
         c.slug AS category_slug, c.name AS category_name,
         (l.post_id IS NOT NULL) AS liked,
         (r.post_id IS NOT NULL) AS read,
         (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id) AS comment_count
       FROM posts p
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN likes l ON l.post_id = p.id
       LEFT JOIN reads r ON r.post_id = p.id
       WHERE p.id = ?`
    )
    .get(id);
  return row ? decoratePost(row) : null;
}

// Convierte 0/1 de SQLite en booleanos y añade los hashtags.
function decoratePost(row) {
  return {
    ...row,
    liked: !!row.liked,
    read: !!row.read,
    hashtags: getPostHashtags(row.id),
  };
}

// ----------------------------------------------------------------------------
// Likes (presencia = me gusta)
// ----------------------------------------------------------------------------

export function isLiked(postId) {
  return !!db.prepare('SELECT 1 FROM likes WHERE post_id = ?').get(postId);
}

export function likePost(postId) {
  db.prepare('INSERT OR IGNORE INTO likes(post_id, created_at) VALUES(?, ?)').run(
    postId,
    now()
  );
}

export function unlikePost(postId) {
  db.prepare('DELETE FROM likes WHERE post_id = ?').run(postId);
}

// ----------------------------------------------------------------------------
// Comentarios y mejoras
// ----------------------------------------------------------------------------

export function listComments(postId) {
  return db
    .prepare(
      'SELECT id, kind, body, created_at FROM comments WHERE post_id = ? ORDER BY id'
    )
    .all(postId);
}

export function addComment(postId, kind, body) {
  const safeKind = kind === 'mejora' ? 'mejora' : 'comentario';
  const info = db
    .prepare(
      'INSERT INTO comments(post_id, kind, body, created_at) VALUES(?, ?, ?, ?)'
    )
    .run(postId, safeKind, body, now());
  return db
    .prepare('SELECT id, kind, body, created_at FROM comments WHERE id = ?')
    .get(Number(info.lastInsertRowid));
}

// ----------------------------------------------------------------------------
// Lectura
// ----------------------------------------------------------------------------

export function markRead(postId) {
  db.prepare('INSERT OR IGNORE INTO reads(post_id, read_at) VALUES(?, ?)').run(
    postId,
    now()
  );
}

// ----------------------------------------------------------------------------
// Pesos del recomendador
// ----------------------------------------------------------------------------

export function bumpCategoryWeight(categoryId, delta) {
  db.prepare(
    `INSERT INTO category_weights(category_id, weight) VALUES(?, 1.0 + ?)
     ON CONFLICT(category_id) DO UPDATE SET weight = weight + ?`
  ).run(categoryId, delta, delta);
}

export function bumpHashtagWeight(hashtagId, delta) {
  db.prepare(
    `INSERT INTO hashtag_weights(hashtag_id, weight) VALUES(?, 1.0 + ?)
     ON CONFLICT(hashtag_id) DO UPDATE SET weight = weight + ?`
  ).run(hashtagId, delta, delta);
}

// Devuelve [{ slug, name, weight }] para cada categoría (peso 1.0 si nunca subió).
export function getCategoryWeights() {
  return db
    .prepare(
      `SELECT c.slug, c.name, COALESCE(w.weight, 1.0) AS weight
       FROM categories c
       LEFT JOIN category_weights w ON w.category_id = c.id
       ORDER BY weight DESC, c.name`
    )
    .all();
}

// Para subir pesos a partir de un post (cuando se le da like).
export function getPostCategoryId(postId) {
  const row = db.prepare('SELECT category_id FROM posts WHERE id = ?').get(postId);
  return row ? row.category_id : null;
}

export function getPostHashtagIds(postId) {
  return db
    .prepare('SELECT hashtag_id FROM post_hashtags WHERE post_id = ?')
    .all(postId)
    .map((r) => r.hashtag_id);
}
