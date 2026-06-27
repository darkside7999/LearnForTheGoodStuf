// share.js — construye el menú de "Compartir" de cada post.
//
// Tres opciones:
//  1) Compartir (Web Share API) -> abre el diálogo nativo del sistema/móvil,
//     que reenvía a WhatsApp, Telegram, correo, etc. (si el navegador lo soporta).
//  2) Copiar texto -> copia el texto plano al portapapeles.
//  3) Descargar PDF -> abre el endpoint que genera el PDF.

import { api } from './api.js';

export function buildShareMenu(post) {
  const menu = document.createElement('div');
  menu.className = 'share-menu';

  // 1) Web Share API (solo si el navegador la tiene).
  if (navigator.share) {
    const btn = document.createElement('button');
    btn.textContent = '📤 Compartir';
    btn.addEventListener('click', async () => {
      try {
        const text = await fetch(api.shareTextUrl(post.id)).then((r) => r.text());
        await navigator.share({ title: post.title, text });
      } catch (_) {
        /* el usuario canceló: no pasa nada */
      }
    });
    menu.appendChild(btn);
  }

  // 2) Copiar texto al portapapeles.
  const copyBtn = document.createElement('button');
  copyBtn.textContent = '📋 Copiar texto';
  copyBtn.addEventListener('click', async () => {
    try {
      const text = await fetch(api.shareTextUrl(post.id)).then((r) => r.text());
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = '✅ Copiado';
      setTimeout(() => (copyBtn.textContent = '📋 Copiar texto'), 1500);
    } catch (_) {
      copyBtn.textContent = '❌ Error al copiar';
    }
  });
  menu.appendChild(copyBtn);

  // 3) Descargar PDF (un enlace normal al endpoint).
  const pdfLink = document.createElement('a');
  pdfLink.textContent = '📄 Descargar PDF';
  pdfLink.href = api.sharePdfUrl(post.id);
  menu.appendChild(pdfLink);

  return menu;
}
