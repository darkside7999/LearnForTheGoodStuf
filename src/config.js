// config.js — toda la configuración en un solo lugar.
// Lee variables de entorno desde .env (gracias a dotenv) y define constantes
// del comportamiento de la app. Tener esto centralizado hace fácil ajustar
// números (cuántas noticias mantener, cada cuánto generar, etc.) sin buscar
// por todo el código.

import 'dotenv/config'; // carga el archivo .env en process.env
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// __dirname no existe en módulos ESM; lo reconstruimos a partir de import.meta.url.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Raíz del proyecto (un nivel arriba de /src).
export const ROOT_DIR = path.resolve(__dirname, '..');

export const config = {
  // --- Servidor ---
  port: Number(process.env.PORT) || 3001,
  // 0.0.0.0 = escucha en todas las interfaces -> accesible por localhost Y por Tailscale.
  host: '0.0.0.0',

  // --- Rutas de archivos ---
  // En Vercel (serverless) el único sitio escribible es /tmp, y es temporal
  // (se reinicia entre arranques): perfecto para una demo. En local usamos data/.
  dbPath: process.env.VERCEL
    ? '/tmp/app.db'
    : path.join(ROOT_DIR, 'data', 'app.db'),
  publicDir: path.join(ROOT_DIR, 'public'),

  // --- IA ---
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  claudeModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',

  // --- Inventario de noticias ---
  targetUnread: 30, // queremos ~30 noticias sin leer disponibles
  refillThreshold: 20, // cuando bajan de 20, generamos más
  maxPerBatch: 12, // cuántas generar como máximo por tanda

  // --- Actividad / generación ---
  // Ventana para considerar que el usuario "está leyendo activamente" (ms).
  activeWindowMs: 10 * 60 * 1000, // 10 minutos
  // Cada cuánto revisa el intervalo de fondo si hace falta reponer (ms).
  backgroundIntervalMs: 3 * 60 * 1000, // 3 minutos
  // Tope diario de llamadas de generación, para acotar el gasto.
  maxGenerationsPerDay: 50,
};

// Aviso útil al arrancar si falta la clave (la app funciona pero no genera noticias).
if (!config.anthropicApiKey) {
  console.warn(
    '[config] No hay ANTHROPIC_API_KEY en .env — la generación de noticias estará desactivada. ' +
      'Copia .env.example a .env y pon tu clave.'
  );
}
