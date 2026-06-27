// api.js — envoltorios finos sobre fetch() para hablar con el backend /api.
// Mantener todas las llamadas aquí hace que el resto del frontend sea más limpio.

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('GET ' + url + ' -> ' + res.status);
  return res.json();
}

async function sendJSON(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(method + ' ' + url + ' -> ' + res.status);
  return res.json();
}

export const api = {
  feed: (before) =>
    getJSON('/api/feed?limit=8' + (before ? '&before=' + before : '')),

  markRead: (id) => sendJSON(`/api/posts/${id}/read`, 'POST'),

  like: (id) => sendJSON(`/api/posts/${id}/like`, 'POST'),
  unlike: (id) => sendJSON(`/api/posts/${id}/like`, 'DELETE'),

  getComments: (id) => getJSON(`/api/posts/${id}/comments`),
  addComment: (id, kind, body) =>
    sendJSON(`/api/posts/${id}/comments`, 'POST', { kind, body }),

  categories: () => getJSON('/api/categories'),
  stats: () => getJSON('/api/stats'),
  generate: () => sendJSON('/api/generate', 'POST'),

  // URLs directas para compartir (se abren/descargan en el navegador).
  shareTextUrl: (id) => `/api/posts/${id}/share/text`,
  sharePdfUrl: (id) => `/api/posts/${id}/share/pdf`,
};
