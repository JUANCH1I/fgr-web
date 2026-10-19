// Listado de carreras (/carreras/) y ficha de cada carrera (/carreras/<slug>/).
import { esc, normalizar, aSlug, boton, enlaceFlecha, datosJSON, unir } from './util.mjs';

// Niveles en el orden en que se muestran en los filtros.
export const NIVELES = [
  'Tecnicatura',
  'Ciclo de Licenciatura (CCC)',
  'Licenciatura',
  'Profesorado',
  'Especialización',
  'Maestría',
  'Doctorado'
];

export function esCiclo(c) {
  return /^Ciclo/i.test(c.nivel);
}

function textoModalidad(c) {
  return c.instanciasPresenciales ? 'A distancia, con instancias presenciales' : 'A distancia';
}

function areasDe(carreras) {
  return [...new Set(carreras.map((c) => c.area))].sort((a, b) => a.localeCompare(b, 'es'));
}

function nivelesDe(carreras) {
  const presentes = new Set(carreras.map((c) => c.nivel));
  return NIVELES.filter((n) => presentes.has(n)).concat([...presentes].filter((n) => !NIVELES.includes(n)));
}

export function tarjetaCarrera(c) {
  return `<article class="tarjeta-carrera" data-area="${esc(aSlug(c.area))}" data-nivel="${esc(aSlug(c.nivel))}" data-modalidad="${c.instanciasPresenciales ? 'presencial' : 'distancia'}" data-texto="${esc(normalizar(c.nombre + ' ' + c.area + ' ' + c.titulo))}">
  <p class="etiquetas"><span class="etiqueta">${esc(c.nivel)}</span><span class="etiqueta etiqueta--suave">${esc(c.area)}</span></p>
  <h2 class="tarjeta-carrera__titulo"><a href="/carreras/${esc(c.slug)}/">${esc(c.nombre)}</a></h2>
  <p class="tarjeta-carrera__universidad">${esc(c.universidad)} · ${esc(c.pais)}</p>
  <dl class="tarjeta-carrera__datos">
    <div><dt>Plan de estudios</dt><dd>${esc(c.duracion)}</dd></div>
    <div><dt>Modalidad</dt><dd>${esc(textoModalidad(c))}</dd></div>
    <div><dt>Ingreso</dt><dd>${esc(c.viaIngreso)}</dd></div>
  </dl>
  <span class="enlace-flecha" aria-hidden="true">Ver ficha de la carrera <span>→</span></span>
</article>`;
}

function selectFiltro(etiqueta, clave, placeholder, opciones) {
  return `<div class="filtro-select" data-filtro="${clave}">
  <label for="filtro-${clave}">${esc(etiqueta)}</label>
  <div class="select-envoltorio">
    <select id="filtro-${clave}" data-select-filtro="${clave}">
      <option value="">${esc(placeholder)}</option>
      ${opciones.map((o) => '<option value="' + esc(o.valor) + '">' + esc(o.texto) + '</option>').join('\n      ')}
    </select>
    <svg class="select-icono" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
  </div>
</div>`;
}

export function listadoCarreras(sitio, carreras) {
  const areas = areasDe(carreras).map((a) => ({ valor: aSlug(a), texto: a }));
  const niveles = nivelesDe(carreras).map((n) => ({ valor: aSlug(n), texto: n }));
  const modos = [
    { valor: 'distancia', texto: 'A distancia' },
    { valor: 'presencial', texto: 'Con instancias presenciales' }
  ];
  const contenido = `<section class="cabecera cabecera--clara cabecera--carreras-centrada">
  <div class="contenedor contenedor--centrado-carreras">
    <h1 class="titulo-carreras-grande">Carreras</h1>
    <p class="subtitulo-carreras">¿Ya tienes estudios previos? <a class="enlace-destacado" href="/continuidad-academica/#evaluar">Evaluar mis estudios →</a></p>
    
    <div class="buscador-carreras-caja" data-buscador-carreras>
      <label for="buscar-carrera">Buscar por nombre</label>
      <input id="buscar-carrera" type="search" placeholder="Ej.: seguridad, diseño, kinesiología" autocomplete="off">
    </div>

    <div class="filtros-selects-grilla" data-filtros>
      ${selectFiltro('Filtrar por Área', 'area', 'Seleccionar Área', areas)}
      ${selectFiltro('Filtrar por Nivel', 'nivel', 'Seleccionar Nivel', niveles)}
      ${selectFiltro('Filtrar por Modalidad', 'modalidad', 'Seleccionar Modalidad', modos)}
    </div>
  </div>
</section>
<section class="seccion" aria-labelledby="resultado-carreras">
  <div class="contenedor">
    <div class="listado__barra">
      <p id="resultado-carreras" aria-live="polite"><strong data-total>${carreras.length}</strong> carreras</p>
      <button type="button" class="boton-texto" data-limpiar hidden>Quitar filtros</button>
    </div>
    <div class="grilla grilla--carreras" data-listado>
      ${carreras.map(tarjetaCarrera).join('\n')}
    </div>
    <p class="aviso" data-vacio hidden>No hay carreras con esa combinación. Prueba con otra búsqueda o quita los filtros.</p>
  </div>
</section>
${sigueAqui([
  { antetitulo: '¿Ya tienes estudios previos?', texto: 'Evalúa tu trayectoria y conoce qué vía de ingreso te corresponde.', enlace: 'Evaluar mis estudios', url: '/continuidad-academica/' },
  { antetitulo: 'Beneficio Institucional FGREC', texto: 'Postula a un fondo de la Fundación y conoce cómo decide el Comité de Evaluación y Otorgamiento de Fondos.', enlace: 'Conocer los fondos', url: '/programa-de-cooperacion-y-excelencia-academica/' },
  { antetitulo: '¿No sabes cuál elegir?', texto: 'Un asesor revisa tu caso y te indica qué carreras aplican.', enlace: 'Hablar ahora con un asesor', url: sitio.enlaces.asesor }
])}`;
  return {
    ruta: '/carreras/',
    titulo: 'Carreras',
    descripcion: 'Las ' + carreras.length + ' carreras a distancia de la red de universidades aliadas: tecnicaturas, ciclos de licenciatura, licenciaturas y posgrados. Busca y filtra por área, nivel y modalidad.',
    contenido
  };
}

export function sigueAqui(bloques, titulo = 'Sigue por aquí') {
  return `<section class="seccion seccion--crema" aria-label="${esc(titulo)}">
  <div class="contenedor">
    <h2>${esc(titulo)}</h2>
    <div class="grilla grilla--3">
      ${bloques.filter((b) => b.url).map((b) => `<a class="tarjeta-enlace" href="${esc(b.url)}"${/^https?:/.test(b.url) ? ' target="_blank" rel="noopener"' : ''}>
        <span class="antetitulo">${esc(b.antetitulo)}</span>
        <h3>${esc(b.texto || b.titulo || '')}</h3>
        <span class="enlace-flecha" aria-hidden="true">${esc(b.enlace)} <span>→</span></span>
      </a>`).join('\n      ')}
    </div>
  </div>
</section>`;
}

function pasosPostulacion(c) {
  const primero = esCiclo(c)
    ? '<li><strong>Evalúas tus estudios.</strong> Completas el formulario y envías tu título técnico o tecnológico.</li>'
    : '<li><strong>Consultas con un asesor.</strong> Te orienta sobre la carrera y la vía de ingreso que corresponde a tu caso.</li>';
  const tercero = esCiclo(c)
    ? '<li><strong>La universidad analiza tu caso.</strong> Revisa tu título, tu plan de estudios y su carga horaria, y define si ingresas al ciclo.</li>'
    : '<li><strong>La universidad analiza tu caso.</strong> Admite y fija las condiciones de ingreso.</li>';
  return `<ol class="pasos">
  ${primero}
  <li><strong>La Fundación arma tu expediente.</strong> Un asesor te indica qué documentos hacen falta.</li>
  ${tercero}
  <li><strong>Postulas al Beneficio Institucional FGREC.</strong> El Comité de Evaluación y Otorgamiento de Fondos define el beneficio que se te asigna.</li>
</ol>`;
}

function planDeEstudios(c) {
  if (!c.plan || !c.plan.length) {
    return '<p>El plan de estudios detallado de esta carrera se está actualizando. Un asesor te lo envía con gusto.</p>';
  }
  return '<div class="plan">' + c.plan.map((b) => `<div class="plan__bloque">
    <h3>${esc(b.periodo || b.nombre)}</h3>
    <ul>${(b.materias || []).map((m) => '<li>' + esc(typeof m === 'string' ? m : m.nombre) + '</li>').join('')}</ul>
  </div>`).join('\n') + '</div>';
}

function ingreso(c) {
  const destacado = esCiclo(c)
    ? '<div class="destacado"><p class="destacado__cifra">2½ años</p><p>o más de duración de tu carrera técnica o tecnológica, en un área afín al ciclo.</p></div>'
    : '<div class="destacado"><p class="destacado__texto">' + esc(c.viaIngreso) + '</p></div>';
  return `<p>${esc(c.requisitos)}</p>
${destacado}
<p>El ingreso lo define la universidad después de revisar tu documentación.</p>`;
}

// `campo(nombre)` devuelve el atributo data-tina-field de ese campo (edición visual de Tina);
// por defecto no agrega nada.
export function ficha(sitio, c, { carreras, fondos, maestrias, campo = () => '' }) {
  const afines = carreras.filter((x) => x.area === c.area && x.slug !== c.slug)
    .sort((a, b) => (a.nivel === c.nivel ? -1 : 0) - (b.nivel === c.nivel ? -1 : 0) || a.orden - b.orden)
    .slice(0, 3);
  const fondo = fondos.find((f) => f.oferta.some((g) => g.carreras.some((x) => x.carrera === c.slug)));
  const maestria = maestrias.find((m) => m.carrera === c.slug);
  const modalidad = textoModalidad(c) + (c.detalleModalidad ? '. ' + c.detalleModalidad : '');

  const datos = [
    ['Título', c.titulo, 'titulo'],
    ['Título intermedio', c.tituloIntermedio, 'tituloIntermedio'],
    ['Modalidad', modalidad, 'modalidad'],
    ['Duración', c.duracion, 'duracion'],
    ['Ingreso', c.viaIngreso, 'viaIngreso'],
    ['Resolución', c.resolucion],
    ['Universidad', c.universidad + ' (' + c.pais + ')']
  ].filter(([, v]) => Boolean(v));

  const pestañas = [
    { id: 'plan', titulo: 'Plan de estudios', html: planDeEstudios(c), campo: 'plan' },
    { id: 'ingreso', titulo: 'Requisitos de ingreso', html: ingreso(c), campo: 'requisitos' },
    { id: 'perfil', titulo: 'Perfil del egresado', html: '<p>' + esc(c.perfil) + '</p>', campo: 'perfil' },
    { id: 'postular', titulo: 'Cómo postular', html: pasosPostulacion(c) }
  ];

  const contenido = `<section class="cabecera cabecera--clara cabecera--ficha">
  <div class="contenedor">
    <nav class="migas" aria-label="Ruta"><a href="/carreras/">Carreras</a> <span aria-hidden="true">/</span> ${esc(c.area)} <span aria-hidden="true">/</span> ${esc(c.nivel)}</nav>
    <p class="etiquetas"><span class="etiqueta">${esc(c.nivel)}</span><span class="etiqueta etiqueta--suave">${esc(c.area)}</span><span class="etiqueta etiqueta--suave">${esc(textoModalidad(c))}</span></p>
    <h1${campo('nombre')}>${esc(c.nombre)}</h1>
    <p class="entrada">Carrera de la ${esc(c.universidad)} (${esc(c.pais)}). ${esc(c.viaIngreso)}.</p>
  </div>
</section>
<section class="seccion">
  <div class="contenedor ficha">
    <div class="ficha__principal" data-pestanas>
      <div class="pestanas" role="tablist" aria-label="Secciones de la ficha" hidden>
        ${pestañas.map((p, i) => '<button type="button" role="tab" id="pestana-' + p.id + '" aria-controls="panel-' + p.id + '" aria-selected="' + (i === 0) + '"' + (i ? ' tabindex="-1"' : '') + '>' + esc(p.titulo) + '</button>').join('\n        ')}
      </div>
      ${pestañas.map((p) => '<section class="panel" id="panel-' + p.id + '" role="tabpanel" aria-labelledby="pestana-' + p.id + '"' + (p.campo ? campo(p.campo) : '') + '>\n        <h2 class="panel__titulo">' + esc(p.titulo) + '</h2>\n        ' + p.html + '\n      </section>').join('\n      ')}
    </div>
    <aside class="ficha__lateral" aria-label="Datos de la carrera">
      <dl class="datos">
        ${datos.map(([k, v, f]) => '<div><dt>' + esc(k) + '</dt><dd' + (f ? campo(f) : '') + '>' + esc(v) + '</dd></div>').join('\n        ')}
      </dl>
      <div class="botones botones--columna">
        ${boton('Evaluar mis estudios', '/continuidad-academica/#evaluar', 'oscuro')}
        ${boton('Hablar ahora con un asesor', sitio.enlaces.asesor, 'contorno')}
      </div>
      <p class="nota">¿Dudas sobre la validez del título en tu país? Un asesor te orienta antes de inscribirte.</p>
      ${maestria ? '<p class="nota">' + enlaceFlecha('Seminarios que puedes cursar como microcertificación', '/microcertificaciones/' + maestria.slug + '/') + '</p>' : ''}
    </aside>
  </div>
</section>

${afines.length ? `<section class="seccion seccion--crema" aria-labelledby="afines-titulo">
  <div class="contenedor">
    <h2 id="afines-titulo">Otras carreras de ${esc(c.area)}</h2>
    <div class="grilla grilla--3">
      ${afines.map(tarjetaCarrera).join('\n      ')}
    </div>
  </div>
</section>` : ''}`;

  return {
    ruta: '/carreras/' + c.slug + '/',
    titulo: c.nombre,
    descripcion: c.resumen || c.nombre + ' a distancia en ' + c.universidad + '.',
    contenido
  };
}
