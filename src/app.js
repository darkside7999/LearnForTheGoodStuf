// app.js — crea y configura la aplicación Express (SIN ponerla a escuchar).
//
// Separamos "construir la app" de "arrancar el servidor" para poder reutilizar
// la misma app en dos sitios:
//   - src/server.js  -> la pone a escuchar en un puerto (uso local/Tailscale).
//   - api/index.js   -> la exporta como función serverless (demo en Vercel).

import express from 'express';
import { config } from './config.js';
import './db/index.js'; // abre la DB y aplica el esquema (efecto al importar)
import { ensureCategories, seedSamplePosts } from './db/seed.js';
import { countPosts } from './db/queries.js';
import {
  generateInitialIfEmpty,
  generationEnabled,
} from './services/generation.js';

import { feedRouter } from './routes/feed.js';
import { postsRouter } from './routes/posts.js';
import { generateRouter } from './routes/generate.js';

const app = express();

// Permite leer JSON en el cuerpo de las peticiones (req.body).
app.use(express.json());

// Sirve el frontend (HTML/CSS/JS) desde public/.
app.use(express.static(config.publicDir));

// Todas las rutas de datos viven bajo /api.
app.use('/api', feedRouter);
app.use('/api', postsRouter);
app.use('/api', generateRouter);

// Asegura el set fijo de categorías.
ensureCategories();

// Asegura que haya algo que ver:
//  - Con clave de IA: genera noticias iniciales (en segundo plano).
//  - Sin clave: siembra noticias de ejemplo al instante (para demos).
if (countPosts() === 0) {
  if (generationEnabled()) {
    generateInitialIfEmpty().catch((err) =>
      console.error('[app] generación inicial:', err.message)
    );
  } else {
    seedSamplePosts();
  }
}

export default app;
