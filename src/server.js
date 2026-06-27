// server.js — arranca la app en un puerto (uso local y por Tailscale).
//
// La configuración de la app vive en app.js; aquí solo la ponemos a escuchar
// y encendemos el generador de fondo (que no existe en el modo serverless).

import app from './app.js';
import { config } from './config.js';
import { setState, getState } from './db/queries.js';
import { topUpIfNeeded, generationEnabled } from './services/generation.js';

// Escucha en 0.0.0.0 -> accesible por localhost Y por Tailscale.
app.listen(config.port, config.host, () => {
  console.log(`\n  LearnForTheGoodStuf escuchando:`);
  console.log(`    Local:    http://localhost:${config.port}`);
  console.log(`    Red/Tailscale: http://<tu-host>:${config.port}\n`);

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
