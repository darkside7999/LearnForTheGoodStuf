// post.js — construye la tarjeta (elemento del DOM) de un post y sus acciones.
//
// renderPost(post) devuelve un <article> listo para insertar en el feed.
// Cada función pequeña arma una parte: cabecera, cuerpo, acciones, comentarios.

import { api } from './api.js';
import { buildShareMenu } from './share.js';

export function renderPost(post) {
  const card = document.createElement('article');
  card.className = 'post' + (post.read ? ' read' : '');
  card.dataset.id = post.id;

  card.appendChild(buildHead(post));
  card.appendChild(el('h2', 'post-title', post.title));
  card.appendChild(el('div', 'post-body', post.body));

  if (post.hashtags?.length) {
    card.appendChild(el('div', 'post-tags', post.hashtags.map((t) => '#' + t).join(' ')));
  }
  if (post.source_url) {
    const src = document.createElement('div');
    src.className = 'post-source';
    src.innerHTML = 'Fuente: <a href="' + escapeAttr(post.source_url) +
      '" target="_blank" rel="noopener">' + escapeHtml(post.source_url) + '</a>';
    card.appendChild(src);
  }

  // Comentarios y menú de compartir (ocultos hasta que se pulsa).
  const comments = buildCommentsPanel(post);
  const shareMenu = buildShareMenu(post);

  card.appendChild(buildActions(post, comments, shareMenu));
  card.appendChild(comments);
  card.appendChild(shareMenu);

  return card;
}

// --- Cabecera: categoría + tipo + tiempo ---
function buildHead(post) {
  const head = document.createElement('div');
  head.className = 'post-head';
  head.appendChild(el('span', 'post-cat', post.category_name || post.category_slug));

  const kind = el('span', 'post-kind' + (post.kind === 'real' ? ' real' : ''),
    post.kind === 'real' ? 'Noticia' : 'IA');
  head.appendChild(kind);

  head.appendChild(el('span', 'post-time', post.read_minutes + ' min'));
  return head;
}

// --- Barra de acciones: like, comentar, compartir ---
function buildActions(post, commentsPanel, shareMenu) {
  const bar = document.createElement('div');
  bar.className = 'post-actions';

  // Like
  const likeBtn = document.createElement('button');
  likeBtn.className = 'action' + (post.liked ? ' liked' : '');
  likeBtn.innerHTML = iconLabel(post.liked ? '❤️' : '🤍', 'Me gusta');
  likeBtn.addEventListener('click', async () => {
    post.liked = !post.liked;
    likeBtn.classList.toggle('liked', post.liked);
    likeBtn.innerHTML = iconLabel(post.liked ? '❤️' : '🤍', 'Me gusta');
    try {
      post.liked ? await api.like(post.id) : await api.unlike(post.id);
    } catch (e) {
      console.error(e);
    }
  });

  // Comentar (abre/cierra el panel)
  const commentBtn = document.createElement('button');
  commentBtn.className = 'action';
  commentBtn.innerHTML = iconLabel('💬', 'Comentar');
  commentBtn.addEventListener('click', () => {
    const opening = !commentsPanel.classList.contains('open');
    commentsPanel.classList.toggle('open');
    shareMenu.classList.remove('open');
    if (opening && !commentsPanel.dataset.loaded) loadComments(post, commentsPanel);
  });

  // Compartir (abre/cierra el menú)
  const shareBtn = document.createElement('button');
  shareBtn.className = 'action';
  shareBtn.innerHTML = iconLabel('🔗', 'Compartir');
  shareBtn.addEventListener('click', () => {
    shareMenu.classList.toggle('open');
    commentsPanel.classList.remove('open');
  });

  bar.append(likeBtn, commentBtn, shareBtn);
  return bar;
}

// --- Panel de comentarios + formulario ---
function buildCommentsPanel(post) {
  const panel = document.createElement('div');
  panel.className = 'comments';

  const list = document.createElement('div');
  list.className = 'comment-list';
  panel.appendChild(list);

  // Formulario para añadir comentario o mejora.
  const form = document.createElement('form');
  form.className = 'comment-form';

  const textarea = document.createElement('textarea');
  textarea.placeholder = 'Escribe un comentario o una mejora...';

  const row = document.createElement('div');
  row.className = 'comment-form-row';

  const select = document.createElement('select');
  select.innerHTML =
    '<option value="comentario">Comentario</option>' +
    '<option value="mejora">Mejora</option>';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Enviar';

  row.append(select, submit);
  form.append(textarea, row);
  panel.appendChild(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = textarea.value.trim();
    if (!body) return;
    try {
      const { comment } = await api.addComment(post.id, select.value, body);
      list.appendChild(renderComment(comment));
      textarea.value = '';
    } catch (err) {
      console.error(err);
    }
  });

  return panel;
}

async function loadComments(post, panel) {
  panel.dataset.loaded = '1';
  const list = panel.querySelector('.comment-list');
  try {
    const { comments } = await api.getComments(post.id);
    list.innerHTML = '';
    if (comments.length === 0) {
      list.appendChild(el('div', 'comment', 'Sé el primero en comentar.'));
    } else {
      for (const c of comments) list.appendChild(renderComment(c));
    }
  } catch (err) {
    console.error(err);
  }
}

function renderComment(c) {
  const div = document.createElement('div');
  div.className = 'comment';
  const tag = el('span', 'tag' + (c.kind === 'mejora' ? ' mejora' : ''), c.kind);
  div.appendChild(tag);
  div.appendChild(document.createTextNode(c.body));
  return div;
}

// --- Pequeños ayudantes del DOM ---
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function iconLabel(icon, label) {
  return `<span class="icon">${icon}</span><span>${label}</span>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
