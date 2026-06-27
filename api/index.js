// api/index.js — punto de entrada para Vercel (función serverless).
//
// Vercel trata cada archivo en /api como una función. Una app de Express es,
// en el fondo, una función (req, res), así que basta con exportarla.
//
// IMPORTANTE: aquí NO llamamos app.listen(). En serverless es Vercel quien
// recibe cada petición y se la pasa a la app. El servidor "siempre encendido"
// (src/server.js) solo se usa en local.

import app from '../src/app.js';

export default app;
