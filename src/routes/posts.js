// routes/posts.js — interacciones con un post: like, comentarios y compartir.

import express from 'express';
import {
  getPost,
  likePost,
  unlikePost,
  listComments,
  addComment,
} from '../db/queries.js';
import { reinforceFromLike } from '../services/recommend.js';
import { postToText } from '../services/share.js';
import { streamPostPdf } from '../services/pdf.js';

export const postsRouter = express.Router();

// Pequeño ayudante: busca el post o responde 404.
function findPostOr404(req, res) {
  const post = getPost(Number(req.params.id));
  if (!post) {
    res.status(404).json({ error: 'post no encontrado' });
    return null;
  }
  return post;
}

// POST /api/posts/:id/like — dar like (y reforzar el recomendador).
postsRouter.post('/posts/:id/like', (req, res) => {
  const post = findPostOr404(req, res);
  if (!post) return;
  likePost(post.id);
  reinforceFromLike(post.id); // sube pesos de su categoría y hashtags
  res.json({ ok: true, liked: true });
});

// DELETE /api/posts/:id/like — quitar like (no baja pesos: los likes solo suman).
postsRouter.delete('/posts/:id/like', (req, res) => {
  const post = findPostOr404(req, res);
  if (!post) return;
  unlikePost(post.id);
  res.json({ ok: true, liked: false });
});

// GET /api/posts/:id/comments — lista comentarios y mejoras.
postsRouter.get('/posts/:id/comments', (req, res) => {
  const post = findPostOr404(req, res);
  if (!post) return;
  res.json({ comments: listComments(post.id) });
});

// POST /api/posts/:id/comments — agrega { kind: 'comentario'|'mejora', body }.
postsRouter.post('/posts/:id/comments', (req, res) => {
  const post = findPostOr404(req, res);
  if (!post) return;
  const body = (req.body?.body || '').trim();
  const kind = req.body?.kind === 'mejora' ? 'mejora' : 'comentario';
  if (!body) return res.status(400).json({ error: 'el comentario está vacío' });
  const comment = addComment(post.id, kind, body);
  res.status(201).json({ comment });
});

// GET /api/posts/:id/share/text — versión en texto plano (para copiar/compartir).
postsRouter.get('/posts/:id/share/text', (req, res) => {
  const post = findPostOr404(req, res);
  if (!post) return;
  res.type('text/plain; charset=utf-8').send(postToText(post));
});

// GET /api/posts/:id/share/pdf — descarga un PDF del post.
postsRouter.get('/posts/:id/share/pdf', (req, res) => {
  const post = findPostOr404(req, res);
  if (!post) return;
  streamPostPdf(post, res);
});
