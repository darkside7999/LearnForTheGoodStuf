// db/seed.js — datos iniciales.
//
// 1) ensureCategories(): crea el set fijo de categorías si no existen.
//    Se llama siempre al arrancar el servidor.
// 2) Si ejecutas este archivo directo (`npm run seed`), además inserta unos
//    posts de ejemplo para poder ver el feed sin gastar la API de Claude.

import { upsertCategory, insertPost, countPosts } from './queries.js';

// Set fijo de categorías. "actualidad: true" = se busca en la web (noticias
// reales); "actualidad: false" = se genera con IA (temas atemporales).
export const DEFAULT_CATEGORIES = [
  { slug: 'tecnologia', name: 'Tecnología', actualidad: true },
  { slug: 'ciencia', name: 'Ciencia', actualidad: false },
  { slug: 'mundo', name: 'Mundo', actualidad: true },
  { slug: 'deportes', name: 'Deportes', actualidad: true },
  { slug: 'cultura', name: 'Cultura', actualidad: false },
  { slug: 'curiosidades', name: 'Curiosidades', actualidad: false },
  { slug: 'historia', name: 'Historia', actualidad: false },
];

// Mapa rápido slug -> ¿es de actualidad? (lo usa el servicio de generación).
export const CATEGORY_IS_NEWS = Object.fromEntries(
  DEFAULT_CATEGORIES.map((c) => [c.slug, c.actualidad])
);

export function ensureCategories() {
  for (const c of DEFAULT_CATEGORIES) {
    upsertCategory(c.slug, c.name);
  }
}

// Posts de ejemplo para desarrollo (no usan la API).
const SAMPLE_POSTS = [
  {
    title: 'Por qué el cielo es azul (y al atardecer, rojo)',
    body:
      'La luz del sol parece blanca pero es una mezcla de todos los colores. ' +
      'Al entrar en la atmósfera choca con moléculas de aire que dispersan más ' +
      'la luz azul, porque tiene una longitud de onda más corta. Por eso vemos ' +
      'el cielo azul durante el día.\n\nAl atardecer, la luz atraviesa mucho más ' +
      'aire para llegar a tus ojos. Tanto azul se ha dispersado por el camino ' +
      'que sobre todo quedan los rojos y naranjas. El mismo fenómeno, visto desde ' +
      'otro ángulo, pinta dos cielos distintos.',
    category_slug: 'ciencia',
    kind: 'generado',
    source_note: 'Generado por IA',
    read_minutes: 1,
    hashtags: ['ciencia', 'fisica', 'luz'],
  },
  {
    title: 'El truco de memoria de los antiguos griegos',
    body:
      'Los oradores de la antigua Grecia memorizaban discursos larguísimos con ' +
      'una técnica llamada "el palacio de la memoria". Imaginaban un lugar conocido ' +
      '—su casa— y colocaban mentalmente cada idea en una habitación distinta.\n\n' +
      'Para recordar el discurso, daban un paseo imaginario por la casa y recogían ' +
      'cada idea en orden. El cerebro recuerda lugares mucho mejor que listas, así ' +
      'que el truco sigue funcionando hoy: campeones de memoria modernos lo usan ' +
      'para memorizar barajas enteras.',
    category_slug: 'historia',
    kind: 'generado',
    source_note: 'Generado por IA',
    read_minutes: 1.5,
    hashtags: ['historia', 'memoria', 'grecia'],
  },
  {
    title: 'Los pulpos tienen tres corazones',
    body:
      'Dos de sus corazones bombean sangre hacia las branquias para recoger ' +
      'oxígeno; el tercero la envía al resto del cuerpo. Curiosamente, ese tercer ' +
      'corazón deja de latir cuando el pulpo nada, lo que les cansa rápido. Por eso ' +
      'prefieren caminar por el fondo en vez de nadar.\n\nAdemás su sangre es azul, ' +
      'no roja: usa cobre en lugar de hierro para transportar oxígeno, algo más ' +
      'eficiente en aguas frías y con poco oxígeno.',
    category_slug: 'curiosidades',
    kind: 'generado',
    source_note: 'Generado por IA',
    read_minutes: 1,
    hashtags: ['curiosidades', 'animales', 'oceano'],
  },
  {
    title: '¿Por qué bostezamos (y por qué se contagia)?',
    body:
      'Bostezar no sirve solo para "coger aire". Una de las hipótesis con más ' +
      'apoyo es que ayuda a enfriar el cerebro: al abrir mucho la mandíbula y ' +
      'tomar aire, refrescamos la sangre que llega a la cabeza.\n\nLo más curioso ' +
      'es el contagio. Ver, oír o incluso leer sobre bostezos puede provocarlo ' +
      '(¿ya te dieron ganas?). Se cree que está ligado a la empatía: cuanto más ' +
      'cercana te resulta una persona, más fácil es que su bostezo te "salte".',
    category_slug: 'ciencia',
    kind: 'generado',
    source_note: 'Generado por IA',
    read_minutes: 1,
    hashtags: ['ciencia', 'cuerpo', 'cerebro'],
  },
  {
    title: 'La contraseña más usada del mundo sigue siendo "123456"',
    body:
      'Año tras año, los análisis de filtraciones de datos coinciden: millones ' +
      'de personas siguen usando "123456", "password" o "qwerty". Un atacante ' +
      'prueba estas primero, así que una cuenta con esa clave cae en segundos.\n\n' +
      'El mejor truco no es inventar algo "raro", sino algo LARGO: una frase de ' +
      'cuatro palabras al azar ("caballo-grapa-batería-correcta") es más difícil ' +
      'de romper que "P@ssw0rd!" y más fácil de recordar. Y usar un gestor de ' +
      'contraseñas evita repetirlas.',
    category_slug: 'tecnologia',
    kind: 'generado',
    source_note: 'Generado por IA',
    read_minutes: 1.5,
    hashtags: ['tecnologia', 'seguridad', 'internet'],
  },
  {
    title: 'El origen de la palabra "salario" está en la sal',
    body:
      'En la antigua Roma, la sal era tan valiosa que servía para conservar la ' +
      'comida cuando no había neveras. Existe la idea popular de que a los ' +
      'soldados se les pagaba en sal, o se les daba dinero para comprarla: ese ' +
      '"salarium" habría dado origen a nuestra palabra "salario".\n\nLos ' +
      'historiadores discuten los detalles, pero el vínculo entre la sal y el ' +
      'valor quedó en el idioma: por eso decimos que alguien "se gana el pan" ' +
      '—o la sal— con su trabajo.',
    category_slug: 'historia',
    kind: 'generado',
    source_note: 'Generado por IA',
    read_minutes: 1,
    hashtags: ['historia', 'roma', 'lenguaje'],
  },
  {
    title: 'Por qué un penalti es tan difícil de parar',
    body:
      'El balón tarda unos 0,4 segundos en viajar desde el punto de penalti hasta ' +
      'la portería. El portero necesita más tiempo que eso solo para reaccionar y ' +
      'lanzarse, así que casi siempre tiene que ADIVINAR el lado antes de que el ' +
      'jugador chute.\n\nPor eso muchos porteros estudian vídeos: buscan pistas en ' +
      'la carrera, la cadera o el pie de apoyo del lanzador. Y por eso un penalti ' +
      'bien colocado, pegado al palo, es prácticamente imparable aunque el portero ' +
      'acierte el lado.',
    category_slug: 'deportes',
    kind: 'generado',
    source_note: 'Generado por IA',
    read_minutes: 1,
    hashtags: ['deportes', 'futbol', 'ciencia'],
  },
  {
    title: 'El cuadro que se hizo famoso por ser robado',
    body:
      '"La Gioconda" de Leonardo da Vinci no siempre fue la pintura más famosa del ' +
      'mundo. Su salto a la fama mundial llegó en 1911, cuando un empleado del ' +
      'Louvre la robó y estuvo desaparecida dos años.\n\nLos periódicos de medio ' +
      'planeta publicaron su imagen, la gente hacía cola para ver el hueco vacío ' +
      'en la pared, y cuando apareció se convirtió en un icono. A veces la fama no ' +
      'viene solo del talento, sino de una buena historia.',
    category_slug: 'cultura',
    kind: 'generado',
    source_note: 'Generado por IA',
    read_minutes: 1.5,
    hashtags: ['cultura', 'arte', 'historia'],
  },
  {
    title: 'Hay más estrellas que granos de arena en la Tierra',
    body:
      'Suena a exageración, pero los cálculos coinciden: el número de estrellas en ' +
      'el universo observable supera al de todos los granos de arena de todas las ' +
      'playas y desiertos del planeta.\n\nSolo nuestra galaxia, la Vía Láctea, ' +
      'tiene cientos de miles de millones de estrellas, y hay billones de galaxias. ' +
      'Cuando miras el cielo nocturno, apenas ves unas pocas miles a simple vista: ' +
      'una mínima esquina de un número casi imposible de imaginar.',
    category_slug: 'ciencia',
    kind: 'generado',
    source_note: 'Generado por IA',
    read_minutes: 1,
    hashtags: ['ciencia', 'espacio', 'astronomia'],
  },
  {
    title: 'El primer "ordenador" tenía engranajes y 2000 años',
    body:
      'En 1901, unos buzos encontraron en un naufragio cerca de la isla griega de ' +
      'Anticitera una masa de bronce corroído. Décadas después se descubrió que era ' +
      'una máquina con decenas de engranajes de precisión.\n\nEl "mecanismo de ' +
      'Anticitera" servía para predecir posiciones del Sol, la Luna y los planetas, ' +
      'e incluso eclipses. Nadie volvió a fabricar algo tan complejo hasta más de ' +
      'mil años después: una pieza de tecnología adelantada a su tiempo.',
    category_slug: 'historia',
    kind: 'generado',
    source_note: 'Generado por IA',
    read_minutes: 1.5,
    hashtags: ['historia', 'tecnologia', 'grecia'],
  },
  {
    title: 'Los plátanos son ligeramente radiactivos (y no pasa nada)',
    body:
      'Los plátanos contienen mucho potasio, y una pequeña parte de ese potasio es ' +
      'un isótopo naturalmente radiactivo. De ahí viene una unidad informal y ' +
      'simpática: la "dosis equivalente de plátano".\n\nNo te preocupes: tu cuerpo ' +
      'regula el potasio constantemente, y tendrías que comer millones de plátanos ' +
      'de golpe para que importara. Sirve para entender que la radiación está en ' +
      'todas partes, en dosis diminutas e inofensivas.',
    category_slug: 'curiosidades',
    kind: 'generado',
    source_note: 'Generado por IA',
    read_minutes: 1,
    hashtags: ['curiosidades', 'ciencia', 'comida'],
  },
];

export function seedSamplePosts() {
  ensureCategories();
  for (const p of SAMPLE_POSTS) insertPost(p, 'seed');
  console.log(`[seed] Insertados ${SAMPLE_POSTS.length} posts de ejemplo.`);
}

// Si se ejecuta directamente con `npm run seed`.
if (import.meta.url === `file://${process.argv[1]}`) {
  const before = countPosts();
  seedSamplePosts();
  console.log(`[seed] Posts en total: ${countPosts()} (antes había ${before}).`);
  process.exit(0);
}
