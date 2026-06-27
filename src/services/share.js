// services/share.js — versión en TEXTO PLANO de un post, para compartir.
//
// Sirve para copiar al portapapeles o enviar por cualquier app (WhatsApp,
// Telegram, correo...). No depende de ninguna plataforma concreta.

export function postToText(post) {
  const lines = [];
  lines.push(post.title);
  lines.push('');
  lines.push(post.body);
  lines.push('');

  if (post.hashtags && post.hashtags.length) {
    lines.push(post.hashtags.map((t) => '#' + t).join(' '));
  }

  // Pie: fuente (si es real) o aviso de IA.
  if (post.source_url) {
    lines.push('');
    lines.push('Fuente: ' + post.source_url);
  } else if (post.source_note) {
    lines.push('');
    lines.push('(' + post.source_note + ')');
  }

  return lines.join('\n');
}
