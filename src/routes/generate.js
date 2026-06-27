// routes/generate.js — categorías, estadísticas y disparo manual de generación.

import express from 'express';
import {
  listCategories,
  countPosts,
  countUnread,
  getCategoryWeights,
  getState,
} from '../db/queries.js';
import {
  topUpIfNeeded,
  generateBatch,
  generationEnabled,
} from '../services/generation.js';
import { config } from '../config.js';

export const generateRouter = express.Router();

// GET /api/categories — lista de categorías (para los chips/filtros).
generateRouter.get('/categories', (_req, res) => {
  res.json({ categories: listCategories() });
});

// GET /api/stats — estado general: para "ver" cómo funciona la app por dentro.
generateRouter.get('/stats', (_req, res) => {
  res.json({
    total: countPosts(),
    unread: countUnread(),
    target: config.targetUnread,
    refillThreshold: config.refillThreshold,
    generating: getState('generating') === 'true',
    generationEnabled: generationEnabled(),
    generationsToday: Number(getState('gen_count', '0')),
    maxGenerationsPerDay: config.maxGenerationsPerDay,
    categoryWeights: getCategoryWeights(),
  });
});

// POST /api/generate — fuerza una tanda de generación ahora mismo.
// Body opcional: { n: 12 } para pedir una cantidad concreta.
generateRouter.post('/generate', async (req, res) => {
  if (!generationEnabled()) {
    return res
      .status(503)
      .json({ error: 'generación desactivada: falta ANTHROPIC_API_KEY en .env' });
  }
  try {
    const n = Number(req.body?.n);
    let result;
    if (n && n > 0) {
      result = { generated: await generateBatch(Math.min(n, config.maxPerBatch)) };
    } else {
      result = await topUpIfNeeded();
    }
    res.json({ ok: true, ...result, unread: countUnread() });
  } catch (err) {
    console.error('[generate] error:', err);
    res.status(500).json({ error: err.message });
  }
});
