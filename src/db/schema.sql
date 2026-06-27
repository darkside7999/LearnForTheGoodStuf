-- schema.sql — definición de todas las tablas.
-- Se aplica al arrancar con "CREATE TABLE IF NOT EXISTS", así que es seguro
-- ejecutarlo varias veces: solo crea lo que falte.
--
-- Es una app de UN SOLO usuario (tú), por eso NO hay tabla de usuarios:
-- existe un único "yo" implícito.

PRAGMA foreign_keys = ON;

-- Categorías (tecnología, ciencia, ...). slug = identificador corto sin espacios.
CREATE TABLE IF NOT EXISTS categories (
  id    INTEGER PRIMARY KEY,
  slug  TEXT UNIQUE NOT NULL,
  name  TEXT NOT NULL
);

-- Cada "post" es una noticia/artículo corto (lectura de 1-2 min).
CREATE TABLE IF NOT EXISTS posts (
  id               INTEGER PRIMARY KEY,
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  category_id      INTEGER NOT NULL REFERENCES categories(id),
  read_minutes     REAL NOT NULL DEFAULT 1.5,
  kind             TEXT NOT NULL DEFAULT 'generado',  -- 'real' (web) | 'generado' (IA)
  source_note      TEXT,                              -- ej. "Generado por IA"
  source_url       TEXT,                              -- fuente, si es noticia real
  created_at       TEXT NOT NULL,                     -- ISO timestamp
  generation_batch TEXT                               -- id de la tanda (para depurar)
);

-- Hashtags. Guardamos el tag en minúsculas y sin el '#'.
CREATE TABLE IF NOT EXISTS hashtags (
  id   INTEGER PRIMARY KEY,
  tag  TEXT UNIQUE NOT NULL
);

-- Relación muchos-a-muchos entre posts y hashtags.
CREATE TABLE IF NOT EXISTS post_hashtags (
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  hashtag_id INTEGER NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, hashtag_id)
);

-- Likes. Como hay un solo usuario, la PRESENCIA de la fila = "me gusta".
-- Dar like = insertar; quitar like = borrar.
CREATE TABLE IF NOT EXISTS likes (
  post_id    INTEGER PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

-- Comentarios Y "mejoras" en la misma tabla, distinguidos por "kind".
CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'comentario', -- 'comentario' | 'mejora'
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Estado de lectura. "No leído" = post SIN fila aquí.
CREATE TABLE IF NOT EXISTS reads (
  post_id  INTEGER PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  read_at  TEXT NOT NULL
);

-- Pesos del recomendador. Suben cuando das like a esa categoría/hashtag.
CREATE TABLE IF NOT EXISTS category_weights (
  category_id INTEGER PRIMARY KEY REFERENCES categories(id) ON DELETE CASCADE,
  weight      REAL NOT NULL DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS hashtag_weights (
  hashtag_id INTEGER PRIMARY KEY REFERENCES hashtags(id) ON DELETE CASCADE,
  weight     REAL NOT NULL DEFAULT 1.0
);

-- Pequeño almacén clave/valor para banderas varias
-- (last_active_at, generating, contador diario de generaciones, ...).
CREATE TABLE IF NOT EXISTS app_state (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Índices para que las consultas del feed sean rápidas.
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_posts_category   ON posts(category_id);
CREATE INDEX IF NOT EXISTS idx_comments_post    ON comments(post_id);
