// services/recommend.js — el "algoritmo" de recomendación, hecho a mano.
//
// Idea simple y transparente (no es machine learning):
//  - Cada categoría tiene un PESO. Todas empiezan en 1.0.
//  - Cuando das like a un post, sube el peso de su categoría (+1.0) y de sus
//    hashtags (+0.5).
//  - Al generar noticias nuevas, elegimos las categorías del lote por MUESTREO
//    PONDERADO: las de más peso salen más, pero todas conservan una posibilidad
//    (por eso nunca llegan a 0). Además reservamos ~20% del lote para categorías
//    al azar ("exploración"), para que el feed no se encierre en un solo tema.

import {
  bumpCategoryWeight,
  bumpHashtagWeight,
  getPostCategoryId,
  getPostHashtagIds,
  getCategoryWeights,
} from '../db/queries.js';

const EXPLORATION_FRACTION = 0.2; // 20% del lote a categorías al azar

// Llamado cuando el usuario da like: refuerza categoría y hashtags del post.
export function reinforceFromLike(postId) {
  const catId = getPostCategoryId(postId);
  if (catId) bumpCategoryWeight(catId, 1.0);
  for (const hId of getPostHashtagIds(postId)) bumpHashtagWeight(hId, 0.5);
}

// Elige un arreglo de "n" slugs de categoría para el próximo lote.
// Mezcla muestreo ponderado (según pesos) + una fracción de exploración uniforme.
export function chooseBatchCategories(n) {
  const weights = getCategoryWeights(); // [{ slug, name, weight }]
  if (weights.length === 0) return [];

  const exploreCount = Math.round(n * EXPLORATION_FRACTION);
  const weightedCount = n - exploreCount;

  const chosen = [];

  // 1) Parte ponderada: categorías con más peso aparecen más.
  for (let i = 0; i < weightedCount; i++) {
    chosen.push(weightedPick(weights).slug);
  }

  // 2) Parte de exploración: categorías totalmente al azar (uniforme).
  for (let i = 0; i < exploreCount; i++) {
    const rnd = weights[Math.floor(Math.random() * weights.length)];
    chosen.push(rnd.slug);
  }

  return shuffle(chosen);
}

// Elige UNA categoría al azar, con probabilidad proporcional a su peso.
function weightedPick(weights) {
  const total = weights.reduce((sum, w) => sum + w.weight, 0);
  let r = Math.random() * total;
  for (const w of weights) {
    r -= w.weight;
    if (r <= 0) return w;
  }
  return weights[weights.length - 1]; // por seguridad numérica
}

// Cuenta cuántas veces aparece cada slug -> { slug: cantidad }.
// Útil para construir el prompt de generación ("genera 3 de tecnología, 2 de...").
export function countBySlug(slugs) {
  const counts = {};
  for (const s of slugs) counts[s] = (counts[s] || 0) + 1;
  return counts;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
