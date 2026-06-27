// routes/feed.js — el feed y marcar como leído.

import express from 'express';
import { getFeed, markRead, getPost, setState } from '../db/queries.js';
import { topUpIfNeeded } from '../services/generation.js';

export const feedRouter = express.Router();

// Marca actividad reciente del usuario (para el generador de fondo).
function markActive() {
  setState('last_active_at', Date.now());
}

// GET /api/feed?limit=10&before=123
// Devuelve una página de posts (más nuevos primero), con cursor "before".
feedRouter.get('/feed', (req, res) => {
  markActive();
  const limit = Math.min(Number(req.query.limit) || 10, 30);
  const before = req.query.before ? Number(req.query.before) : null;
  const posts = getFeed({ limit, before });
  // Cursor para la siguiente página = id del último post devuelto.
  const nextBefore = posts.length === limit ? posts[posts.length - 1].id : null;
  res.json({ posts, nextBefore });
});

// POST /api/posts/:id/read — marca un post como leído.
// Marca actividad y, sin esperar (fire-and-forget), revisa si hay que reponer.
feedRouter.post('/posts/:id/read', (req, res) => {
  const id = Number(req.params.id);
  if (!getPost(id)) return res.status(404).json({ error: 'post no encontrado' });

  markRead(id);
  markActive();

  // No usamos await: la respuesta sale rápida y la generación corre por detrás.
  topUpIfNeeded().catch((err) => console.error('[feed] topUp:', err.message));

  res.json({ ok: true });
});
