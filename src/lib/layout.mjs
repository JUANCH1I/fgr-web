// Estructura común de todas las páginas: cabecera, menú, cierre con asesor,
// pie y barra fija de celular.
import { esc, urlImagen, boton, unir, mantenerOriginal } from './util.mjs';

function rutaActiva(url, ruta) {
  if (url === '/') return ruta === '/';
  return ruta === url || ruta.startsWith(url);
}

function menu(sitio, ruta) {
  const items = sitio.menu.map((item, i) => {
    const activo = rutaActiva(item.url, ruta) || (item.submenu || []).some((s) => rutaActiva(s.url, ruta));
    if (!item.submenu) {
      return '<li><a class="menu__enlace" href="' + esc(item.url) + '"' + (activo ? ' aria-current="page"' : '') + '>' + esc(item.texto) + '</a></li>';
    }
    const id = 'submenu-' + i;
    return '<li class="menu__grupo">' +
      '<button type="button" class="menu__enlace menu__desplegar" aria-expanded="false" aria-controls="' + id + '"' + (activo ? ' data-activo' : '') + '>' +
      esc(item.texto) + ' <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>' +
      '<ul class="submenu" id="' + id + '">' +
      item.submenu.map((s) => '<li><a href="' + esc(s.url) + '"' + (rutaActiva(s.url, ruta) && s.url === ruta ? ' aria-current="page"' : '') + '>' + esc(s.texto) + '</a></li>').join('') +
      '</ul></li>';
  });
  return '<ul class="menu__lista">' + items.join('') + '</ul>';
}

function cabecera(sitio, ruta) {
  mantenerOriginal(sitio.logo);
  const c = sitio.contacto;
  return `<header class="cabecera-sitio">
  <div class="contenedor cabecera-sitio__fila">
    <a class="marca" href="/">
      <img class="marca__logo" src="${esc(urlImagen(sitio.logo, 600))}" alt="${esc(sitio.nombre)} — inicio" width="204" height="60">
    </a>
    <div class="cabecera-sitio__acciones">
      <a class="cabecera-sitio__dato" href="mailto:${esc(c.correo)}">${esc(c.correo)}</a>
      ${boton('Hablar ahora con un asesor', sitio.enlaces.asesor, 'acento')}
    </div>
    <button type="button" class="boton-menu" aria-expanded="false" aria-controls="menu-principal">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      <span>Menú</span>
    </button>
  </div>
  <nav class="menu" id="menu-principal" aria-label="Principal">
    <div class="contenedor">
      ${menu(sitio, ruta)}
    </div>
  </nav>
</header>`;
}

export function cierreAsesor(sitio, { titulo = '¿Prefieres que lo veamos juntos?', texto = 'Un asesor revisa tu caso y te dice qué opciones tienes. Sin compromiso.' } = {}) {
  return `<section class="cierre" aria-labelledby="cierre-titulo">
  <div class="contenedor cierre__fila">
    <div>
      <h2 id="cierre-titulo">${esc(titulo)}</h2>
      <p>${esc(texto)}</p>
    </div>
    <div class="botones">
      ${boton('Hablar ahora con un asesor', sitio.enlaces.asesor, 'acento')}
      ${boton('Agendar entrevista', sitio.enlaces.agenda, 'claro')}
      ${sitio.enlaces.agenda ? '' : boton('Evaluar mis estudios', '/continuidad-academica/', 'claro')}
    </div>
  </div>
</section>`;
}

function pie(sitio) {
  const c = sitio.contacto;
  const resolucion = sitio.enlaces.resolucion
    ? ' <a href="' + esc(sitio.enlaces.resolucion) + '" target="_blank" rel="noopener">Ver resolución</a>'
    : '';
  return `<footer class="pie">
  <div class="contenedor pie__columnas">
    <div class="pie__datos">
      <p class="pie__nombre">${esc(sitio.nombre)}</p>
      <p>${esc(c.direccion)}. ${esc(c.ciudad)}. Sede y hub internacional.</p>
      <p>${esc(sitio.pie.oficinas)}</p>
      <p><a href="tel:${esc(c.telefono.replace(/[^+\d]/g, ''))}">${esc(c.telefono).replace(/ /g, '&nbsp;')}</a> · <a href="mailto:${esc(c.correo)}">${esc(c.correo)}</a></p>
    </div>
    <nav class="pie__enlaces" aria-label="Sitio">
      <p class="pie__titulo">Sitio</p>
      <ul>${sitio.pie.enlaces.map((e) => '<li><a href="' + esc(e.url) + '">' + esc(e.texto) + '</a></li>').join('')}</ul>
    </nav>
    <nav class="pie__enlaces" aria-label="Información legal">
      <p class="pie__titulo">Información legal</p>
      <ul>${sitio.pie.legales.map((e) => '<li><a href="' + esc(e.url) + '">' + esc(e.texto) + '</a></li>').join('')}</ul>
    </nav>
    <nav class="pie__enlaces" aria-label="Redes sociales">
      <p class="pie__titulo">Redes</p>
      <ul>${sitio.redes.map((r) => '<li><a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.nombre) + '</a></li>').join('')}</ul>
    </nav>
  </div>
  <div class="pie__legal">
    <div class="contenedor">
      <p>${esc(sitio.pie.resolucion)}${resolucion}</p>
    </div>
  </div>
</footer>`;
}

function barraMovil(sitio) {
  return `<nav class="barra-movil" aria-label="Accesos rápidos">
  <a class="boton boton--oscuro" href="/continuidad-academica/#evaluar">Evaluar mis estudios</a>
  <a class="boton boton--contorno" href="${esc(sitio.enlaces.asesor)}"${/^https?:/.test(sitio.enlaces.asesor) ? ' target="_blank" rel="noopener"' : ''}>Hablar con un asesor</a>
</nav>`;
}

// Página completa.
// pagina: { ruta, titulo, descripcion, contenido, cierre (true/false/objeto), clase, imagen, extraHead }
export function layout(sitio, pagina, version) {
  const tituloCompleto = pagina.ruta === '/'
    ? sitio.nombre + ' | Carreras universitarias a distancia'
    : pagina.titulo + ' | ' + sitio.nombre;
  const canonica = sitio.dominio + (pagina.ruta === '/404' ? '/' : pagina.ruta);
  const imagen = urlImagen(pagina.imagen || sitio.imagenCompartir, 1200);
  const imagenAbsoluta = imagen.startsWith('/') ? sitio.dominio + imagen : imagen;
  const cierre = pagina.cierre === false ? '' : cierreAsesor(sitio, typeof pagina.cierre === 'object' ? pagina.cierre : undefined);

  return `<!doctype html>
<html lang="${esc(sitio.idioma)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(tituloCompleto)}</title>
<meta name="description" content="${esc(pagina.descripcion || '')}">
<link rel="canonical" href="${esc(canonica)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_EC">
<meta property="og:site_name" content="${esc(sitio.nombre)}">
<meta property="og:title" content="${esc(pagina.titulo || sitio.nombre)}">
<meta property="og:description" content="${esc(pagina.descripcion || '')}">
<meta property="og:url" content="${esc(canonica)}">
<meta property="og:image" content="${esc(imagenAbsoluta)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0B1B2E">
<link rel="icon" href="/assets/img/icono.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fuentes/figtree-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fuentes/newsreader-latin-opsz-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preconnect" href="https://static.wixstatic.com">
<link rel="stylesheet" href="/assets/css/sitio.css?v=${version}">
${pagina.extraHead || ''}
</head>
<body${pagina.clase ? ' class="' + esc(pagina.clase) + '"' : ''}>
<a class="saltar" href="#contenido">Saltar al contenido</a>
${cabecera(sitio, pagina.ruta)}
<main id="contenido" tabindex="-1">
${pagina.contenido}
</main>
${unir(cierre, pie(sitio), barraMovil(sitio))}
<script src="/assets/js/sitio.js?v=${version}" defer></script>
${pagina.extraScripts || ''}
</body>
</html>
`;
}
