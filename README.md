# LearnForTheGoodStuf 📰

App web estilo **Instagram**, pero en vez de fotos son **noticias cortas** que se
leen en 1–2 minutos. Proyecto personal para **aprender cómo funciona cada capa**:
servidor, base de datos, frontend e integración con IA. Accesible en **local** y por
**Tailscale**.

## ¿Qué hace?

- **Feed vertical** de noticias cortas (scroll infinito, estilo Instagram).
- **Likes**, **comentarios** y **mejoras** en cada noticia.
- **Compartir** cada noticia como **texto** (copiar / Web Share) o como **PDF**.
- **Generación con IA** (Claude): crea 30 noticias iniciales y **repone** cuando
  quedan menos de 20 sin leer.
- **Mezcla de contenido**: noticias **reales** vía búsqueda web (mundo, tecnología,
  deportes) + artículos **generados por IA** sobre temas atemporales (ciencia,
  cultura, curiosidades, historia).
- **Recomendación**: cuando das like a una categoría, se genera **más** de esa
  categoría (con algo de variedad para no encerrarse en un solo tema).

## Stack

- **Node.js + Express** (servidor, mismo stack del proyecto original).
- **SQLite** integrado en Node (`node:sqlite`) — un solo archivo, sin instalar nada.
- **`@anthropic-ai/sdk`** con `claude-sonnet-4-6` para generar/curar noticias.
- **HTML + CSS + JS plano** en el frontend (sin frameworks, sin build).
- **`pdfkit`** para los PDFs.

## Puesta en marcha

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar la clave de IA (opcional pero necesaria para generar noticias)
cp .env.example .env
#   edita .env y pon tu ANTHROPIC_API_KEY (consíguela en https://console.anthropic.com/)

# 3. (Opcional) Sembrar 3 noticias de ejemplo SIN usar la API, para probar la interfaz
npm run seed

# 4. Arrancar
npm run dev      # con recarga automática (nodemon)
#   o
npm start
```

Abre **http://localhost:3001**.

> Sin `ANTHROPIC_API_KEY` la app funciona igual, pero **no genera** noticias nuevas.
> Usa `npm run seed` para ver el feed con datos de ejemplo.

## Acceso por Tailscale

El servidor escucha en `0.0.0.0`, así que es accesible desde cualquier dispositivo
de tu tailnet:

- Local: `http://localhost:3001`
- Tailscale: `http://<ip-o-nombre-tailscale>:3001` (por ejemplo con MagicDNS)

⚠️ La app **no tiene autenticación** (es personal). **Tailscale es la frontera de
acceso**: no expongas el puerto públicamente ni uses `tailscale funnel` sin añadir
antes algún tipo de login.

## Estructura del proyecto

```
src/
  server.js            Punto de entrada: Express, estático, rutas, arranque
  config.js            Configuración central (puerto, claves, números del inventario)
  db/
    schema.sql         Definición de las tablas
    index.js           Abre la base de datos y aplica el esquema
    queries.js         Funciones con nombre para todas las consultas SQL
    seed.js            Categorías por defecto + posts de ejemplo (npm run seed)
  routes/
    feed.js            GET /api/feed, POST /api/posts/:id/read
    posts.js           like, comentarios, compartir (texto y PDF)
    generate.js        categorías, estadísticas, generación manual
  services/
    generation.js      Llamadas a Claude + lógica "mantener 30 / reponer < 20"
    recommend.js       Pesos por like + muestreo ponderado de categorías
    pdf.js             Construcción del PDF con pdfkit
    share.js           Versión en texto plano para compartir
public/
  index.html           Estructura de la página
  css/styles.css       Estilos del feed
  js/                  api.js, feed.js, post.js, share.js
data/
  app.db               Base de datos SQLite (se crea sola, no se sube al repo)
```

## Cómo funciona por dentro (para aprender)

- **No-leído** = un post que **no** tiene fila en la tabla `reads`. Así no hay
  contadores que mantener sincronizados.
- **Like** = presencia de una fila en `likes` (app de un solo usuario).
- **Recomendación** = cada categoría tiene un *peso* (empieza en 1.0); un like le
  suma. Al generar, se eligen categorías por *muestreo ponderado* + un 20% al azar.
- **Reposición** = al leer (y por un intervalo de fondo, solo si estuviste activo
  hace poco) se revisa el inventario y se generan más noticias si bajan de 20.
- Mira `GET /api/stats` para ver el estado y los pesos en vivo.

## Endpoints principales

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/feed?limit=&before=` | Página del feed |
| POST | `/api/posts/:id/read` | Marca leído + repone si hace falta |
| POST/DELETE | `/api/posts/:id/like` | Like / quitar like |
| GET/POST | `/api/posts/:id/comments` | Ver / añadir comentario o mejora |
| GET | `/api/posts/:id/share/text` | Texto plano para compartir |
| GET | `/api/posts/:id/share/pdf` | Descargar PDF |
| GET | `/api/categories` | Lista de categorías |
| GET | `/api/stats` | Estado e info del recomendador |
| POST | `/api/generate` | Forzar una generación ahora |

## Ideas para seguir (siguientes pasos)

1. Pantalla "Estás al día" más rica mientras se generan noticias.
2. Guardados / favoritos.
3. Búsqueda y páginas por hashtag (SQLite FTS5).
4. Resumen diario en un solo PDF.
5. Panel de estadísticas de lectura (rachas, top categorías).
