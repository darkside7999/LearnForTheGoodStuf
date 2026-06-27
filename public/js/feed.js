// feed.js — arma el feed: carga páginas, scroll infinito, marca leído y filtra.

import { api } from './api.js';
import { renderPost } from './post.js';

const feedEl = document.getElementById('feed');
const sentinel = document.getElementById('sentinel');
const statusEl = document.getElementById('status');
const statsBadge = document.getElementById('stats-badge');
const categoryBar = document.getElementById('category-bar');
const filterToggle = document.getElementById('filter-toggle');

// Estado del feed.
const state = {
  nextBefore: null, // cursor para la siguiente página
  loading: false,
  done: false, // ya no hay más posts
  activeCategory: null, // slug activo o null = todas
};

// ---------------------------------------------------------------------------
// Cargar más posts (una página)
// ---------------------------------------------------------------------------
async function loadMore() {
  if (state.loading || state.done) return;
  state.loading = true;
  setStatus('Cargando…');

  try {
    const { posts, nextBefore } = await api.feed(state.nextBefore);

    for (const post of posts) {
      const card = renderPost(post);
      applyFilterToCard(card, post);
      feedEl.insertBefore(card, sentinel); // las noticias van ANTES del centinela
      readObserver.observe(card); // empezar a vigilar si se lee
    }

    state.nextBefore = nextBefore;
    if (!nextBefore || posts.length === 0) state.done = true;

    refreshStatus();
  } catch (err) {
    console.error(err);
    setStatus('Error al cargar. Reintentando al hacer scroll…');
  } finally {
    state.loading = false;
  }
}

// ---------------------------------------------------------------------------
// Scroll infinito: cuando el centinela entra en pantalla, cargar más.
// ---------------------------------------------------------------------------
const sentinelObserver = new IntersectionObserver(
  (entries) => {
    if (entries.some((e) => e.isIntersecting)) loadMore();
  },
  // root = #feed (es quien scrollea). rootMargin grande para precargar la
  // siguiente noticia mientras estás leyendo la actual, sin pantallas en blanco.
  { root: feedEl, rootMargin: '1500px' }
);
sentinelObserver.observe(sentinel);

// ---------------------------------------------------------------------------
// Marcar como leído: cuando una tarjeta está visible ≥1.2s, se marca leída.
// ---------------------------------------------------------------------------
const readTimers = new Map();
const readObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const card = entry.target;
      const id = Number(card.dataset.id);
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        // Visible: arranca un temporizador. Si sigue visible 1.2s, leído.
        if (!readTimers.has(id)) {
          readTimers.set(
            id,
            setTimeout(() => markRead(card, id), 1200)
          );
        }
      } else {
        // Dejó de estar visible: cancela el temporizador.
        clearTimeout(readTimers.get(id));
        readTimers.delete(id);
      }
    }
  },
  // root = #feed (el contenedor que scrollea). Cuando una noticia ocupa la
  // pantalla (ratio alto) y se mantiene, la marcamos leída.
  { root: feedEl, threshold: [0, 0.5, 1] }
);

async function markRead(card, id) {
  readObserver.unobserve(card);
  readTimers.delete(id);
  if (card.classList.contains('read')) return;
  card.classList.add('read');
  try {
    await api.markRead(id);
    refreshStatus(); // el contador de "sin leer" baja
  } catch (err) {
    console.error(err);
  }
}

// ---------------------------------------------------------------------------
// Estado / "estás al día" / contador
// ---------------------------------------------------------------------------
function setStatus(html) {
  statusEl.innerHTML = html;
}

async function refreshStatus() {
  try {
    const stats = await api.stats();
    statsBadge.textContent = `${stats.unread} sin leer · ${stats.total} total`;

    const postCount = feedEl.querySelectorAll('.post').length;
    if (state.done && postCount === 0) {
      setStatus(
        '<span class="big">📭</span>No hay noticias todavía.' +
          (stats.generationEnabled
            ? ' Generando las primeras…'
            : ' Configura tu ANTHROPIC_API_KEY o ejecuta <code>npm run seed</code>.')
      );
    } else if (state.done) {
      setStatus(
        stats.generating
          ? '<span class="big">⏳</span>Estás al día. Generando más noticias…'
          : '<span class="big">✅</span>¡Estás al día!'
      );
    } else {
      setStatus('');
    }
  } catch (err) {
    console.error(err);
  }
}

// ---------------------------------------------------------------------------
// Filtro por categoría (lado cliente, sobre los posts ya cargados)
// ---------------------------------------------------------------------------
async function buildCategoryBar() {
  try {
    const { categories } = await api.categories();
    const chips = [{ slug: '', name: 'Todas' }, ...categories];
    for (const cat of chips) {
      const chip = document.createElement('button');
      chip.className = 'cat-chip' + (cat.slug === '' ? ' active' : '');
      chip.textContent = cat.name;
      chip.dataset.slug = cat.slug; // '' = todas
      chip.addEventListener('click', () => setCategory(cat.slug || null));
      categoryBar.appendChild(chip);
    }
  } catch (err) {
    console.error(err);
  }
}

function setCategory(slug) {
  state.activeCategory = slug;
  // Resalta el chip activo (slug '' representa "Todas").
  for (const chip of categoryBar.children) {
    chip.classList.toggle('active', (chip.dataset.slug || null) === slug);
  }
  // Re-aplica el filtro a todas las noticias ya cargadas.
  for (const card of feedEl.querySelectorAll('.post')) {
    const cardSlug = card.dataset.category;
    card.classList.toggle('hidden', slug !== null && cardSlug !== slug);
  }
}

function applyFilterToCard(card, post) {
  card.dataset.category = post.category_slug;
  if (state.activeCategory && post.category_slug !== state.activeCategory) {
    card.classList.add('hidden');
  }
}

filterToggle.addEventListener('click', () => {
  categoryBar.classList.toggle('hidden');
});

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------
buildCategoryBar();
loadMore();
refreshStatus();

// Refresca el contador cada 20s (por si la generación de fondo añadió noticias).
setInterval(refreshStatus, 20000);
