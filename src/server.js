// server.js — punto de entrada de la app.
//
// Monta Express, sirve el frontend estático, conecta las rutas /api,
// arranca el generador de noticias y pone a escuchar en 0.0.0.0 (para que
// sea accesible por localhost Y por Tailscale).

import express from 'express';
import { config } from './config.js';
import './db/index.js'; // abre la DB y aplica el esquema (efecto al importar)
import { ensureCategories } from './db/seed.js';
import { setState, getState } from './db/queries.js';
import {
  generateInitialIfEmpty,
  topUpIfNeeded,
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

// Asegura el set fijo de categorías en la base de datos.
ensureCategories();

// Arranca el servidor.
app.listen(config.port, config.host, () => {
  console.log(`\n  LearnForTheGoodStuf escuchando:`);
  console.log(`    Local:    http://localhost:${config.port}`);
  console.log(`    Red/Tailscale: http://<tu-host>:${config.port}\n`);

  // Genera noticias iniciales si la base está vacía (no bloquea el arranque).
  generateInitialIfEmpty().catch((err) =>
    console.error('[server] generación inicial:', err.message)
  );

  // Intervalo de fondo: repone noticias SOLO si el usuario estuvo activo hace poco.
  if (generationEnabled()) {
    setInterval(() => {
      const lastActive = Number(getState('last_active_at', '0'));
      const idleMs = Date.now() - lastActive;
      if (idleMs < config.activeWindowMs) {
        topUpIfNeeded().catch((err) =>
          console.error('[server] topUp de fondo:', err.message)
        );
      }
    }, config.backgroundIntervalMs);
  }
});
