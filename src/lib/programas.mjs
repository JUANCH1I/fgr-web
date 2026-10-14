// Fondos del PCEA, cursos de Formación continua y Microcertificaciones.
import { esc, img, urlImagen, boton, enlaceFlecha, aSlug, fechaDeInicio } from './util.mjs';

// ---------- Fondos ----------

export function tarjetasFondos(fondos) {
  return `<div class="grilla grilla--3 fondos">
  ${fondos.map((f) => `<article class="tarjeta-imagen">
    <div class="tarjeta-imagen__foto">${img(f.imagenTarjeta, { ancho: 700, alt: '' })}</div>
    <div class="tarjeta-imagen__cuerpo">
      <p class="antetitulo">Fondo</p>
      <h3><a href="/fondos/${esc(f.slug)}/">${esc(f.antetitulo)} ${esc(f.titulo)}</a></h3>
      <p>${esc(f.resumen)}</p>
      <span class="enlace-flecha" aria-hidden="true">Ver el fondo <span>→</span></span>
    </div>
  </article>`).join('\n  ')}
</div>`;
}

export function preguntasFrecuentes() {
  return `<div class="preguntas">
  <details>
    <summary>¿Qué tipo de apoyo es el PCEA?</summary>
    <p>Es una asignación de fondos para tus estudios, basada en mérito, propósito y proyección futura.</p>
  </details>
  <details>
    <summary>¿Cualquier persona puede recibir el fondo?</summary>
    <p>No. Cada postulación pasa por una evaluación previa del Comité de Evaluación y Otorgamiento de Fondos. Los fondos se otorgan a estudiantes y profesionales con excelentes resultados académicos.</p>
  </details>
  <details>
    <summary>¿El beneficio implica un compromiso posterior?</summary>
    <p>Sí. Quien recibe el Beneficio Institucional FGREC firma un acuerdo de co-responsabilidad y se compromete con su continuidad académica.</p>
  </details>
</div>`;
}

function tarjetaOferta(item, carrerasPorSlug, asesor) {
  const c = carrerasPorSlug.get(item.carrera);
  const texto = item.texto || (c ? primeraOracion(c.perfil) : '');
  const destino = c ? '/carreras/' + c.slug + '/' : asesor;
  const enlace = c ? 'Ver la ficha' : 'Consultar con un asesor';
  return `<article class="tarjeta-imagen tarjeta-imagen--compacta">
    <div class="tarjeta-imagen__foto">${img(item.imagen, { ancho: 600, alt: '' })}</div>
    <div class="tarjeta-imagen__cuerpo">
      <h4>${esc(item.nombre)}</h4>
      <p>${esc(texto)}</p>
      ${enlaceFlecha(enlace, destino)}
    </div>
  </article>`;
}

function primeraOracion(texto) {
  const t = String(texto || '').trim();
  const m = t.match(/^(.+?[.])\s/);
  return m ? m[1] : t;
}

export function paginaFondo(sitio, f, carrerasPorSlug) {
  const tieneFundamento = f.finalidad || (f.objetivos && f.objetivos.length) || f.usoEstrategico;
  const fundamento = tieneFundamento ? `<section class="seccion">
  <div class="contenedor dos-columnas">
    <div>
      <p class="antetitulo">Fundamento del fondo</p>
      <h2>Finalidad y objetivos</h2>
      ${f.finalidad ? '<p class="entrada-oscura">' + esc(f.finalidad) + '</p>' : ''}
      ${f.usoEstrategico ? '<p class="nota-destacada"><strong>Uso estratégico:</strong> ' + esc(f.usoEstrategico) + '</p>' : ''}
    </div>
    <ol class="objetivos">
      ${(f.objetivos || []).map((o) => '<li><h3>' + esc(o.titulo) + '</h3><p>' + esc(o.texto) + '</p></li>').join('\n      ')}
    </ol>
  </div>
</section>` : '';

  const oferta = `<section class="seccion seccion--crema" aria-labelledby="oferta-titulo">
  <div class="contenedor">
    <p class="antetitulo">Propuesta académica</p>
    <h2 id="oferta-titulo">Carreras disponibles</h2>
    ${f.oferta.map((g) => `<div class="oferta-grupo">
      <h3 class="oferta-grupo__titulo">${esc(g.grupo)} <span>${esc(g.nivel)}</span></h3>
      <div class="grilla grilla--3">
        ${g.carreras.map((x) => tarjetaOferta(x, carrerasPorSlug, sitio.enlaces.asesor)).join('\n        ')}
      </div>
    </div>`).join('\n    ')}
  </div>
</section>`;

  const contenido = `<section class="cabecera cabecera--foto" style="--foto: url('${esc(urlImagen(f.imagenCabecera, 1920))}')">
  <div class="contenedor">
    <nav class="migas migas--clara" aria-label="Ruta"><a href="/programa-de-cooperacion-y-excelencia-academica/">Programa de Cooperación y Excelencia Académica</a> <span aria-hidden="true">/</span> Fondos</nav>
    <p class="antetitulo">${esc(f.antetitulo)}</p>
    <h1>${esc(f.titulo)}</h1>
    <p class="entrada">${esc(f.entrada)}</p>
    <div class="botones">
      ${boton('Evaluar mis estudios', '/continuidad-academica/#evaluar', 'acento')}
      ${boton('Conocer el programa', '/programa-de-cooperacion-y-excelencia-academica/', 'claro')}
    </div>
  </div>
</section>
${fundamento}
${oferta}
<section class="seccion" aria-labelledby="preguntas-titulo">
  <div class="contenedor angosto">
    <h2 id="preguntas-titulo">Preguntas frecuentes</h2>
    ${preguntasFrecuentes()}
  </div>
</section>`;

  return {
    ruta: '/fondos/' + f.slug + '/',
    titulo: f.titulo,
    descripcion: 'Fondo ' + f.antetitulo + ' ' + f.titulo + ' del Programa de Cooperación y Excelencia Académica: finalidad, objetivos y carreras disponibles.',
    imagen: f.imagenCabecera,
    contenido,
    cierre: f.cierre
  };
}

// ---------- Cursos (Formación continua) ----------

// Si la fecha de inicio ya pasó, no se muestra una fecha vencida.
function inicioVigente(texto) {
  const fecha = fechaDeInicio(texto);
  return fecha && fecha < new Date() ? 'Próxima edición a confirmar' : texto;
}

export function listadoCursos(sitio, cursos) {
  const visibles = cursos.filter((c) => c.visible !== false);
  const categorias = [...new Set(visibles.map((c) => c.categoria))];
  return `<div class="filtros filtros--simple" data-filtro-cursos hidden>
  <fieldset class="filtro">
    <legend>Tipo de formación</legend>
    <div class="filtro__opciones">
      <button type="button" class="chip" data-valor="" aria-pressed="true">Todas</button>
      ${categorias.map((c) => '<button type="button" class="chip" data-valor="' + esc(aSlug(c)) + '" aria-pressed="false">' + esc(c) + '</button>').join('\n      ')}
    </div>
  </fieldset>
</div>
<div class="grilla grilla--3" data-cursos>
  ${visibles.map((c) => `<article class="tarjeta-imagen" data-categoria="${esc(aSlug(c.categoria))}">
    <div class="tarjeta-imagen__foto">${img(c.imagen, { ancho: 700, alt: '' })}</div>
    <div class="tarjeta-imagen__cuerpo">
      <p class="antetitulo">${esc(c.categoria)}</p>
      <h3>${esc(c.titulo)}</h3>
      ${c.texto ? '<p>' + esc(c.texto) + '</p>' : ''}
      <dl class="datos-chicos">
        <div><dt>Duración</dt><dd>${esc(c.duracion)}</dd></div>
        <div><dt>Inicio</dt><dd>${esc(inicioVigente(c.inicio))}</dd></div>
      </dl>
      ${enlaceFlecha('Consultar por este curso', sitio.enlaces.asesor)}
    </div>
  </article>`).join('\n  ')}
</div>`;
}

// ---------- Microcertificaciones ----------

export function tarjetasMaestrias(maestrias) {
  return `<div class="grilla grilla--3">
  ${maestrias.map((m) => `<article class="tarjeta-imagen">
    <div class="tarjeta-imagen__foto">${img(m.imagen, { ancho: 700, alt: '' })}</div>
    <div class="tarjeta-imagen__cuerpo">
      <p class="antetitulo">Maestría</p>
      <h3><a href="/microcertificaciones/${esc(m.slug)}/">${esc(m.titulo.replace(/^Maestría en /, ''))}</a></h3>
      <p>${esc(m.resumen)}</p>
      <span class="enlace-flecha" aria-hidden="true">Ver seminarios <span>→</span></span>
    </div>
  </article>`).join('\n  ')}
</div>`;
}

export function paginaMaestria(sitio, m, carrerasPorSlug) {
  const c = carrerasPorSlug.get(m.carrera);
  const datos = [
    ['Plan de estudios', c ? c.duracion : m.duracion],
    ['Modalidad', m.modalidad],
    ['Título de la maestría', m.tituloObtenido],
    ['Campo', m.campo],
    ['Dirigida a', 'Profesionales'],
    ['Universidad', c ? c.universidad + ', ' + c.pais : '']
  ].filter(([, v]) => v);
  const totalSeminarios = m.areas.reduce((n, a) => n + a.seminarios.length, 0);

  const contenido = `<section class="cabecera cabecera--foto" style="--foto: url('${esc(urlImagen(m.imagen, 1920))}')">
  <div class="contenedor">
    <nav class="migas migas--clara" aria-label="Ruta"><a href="/microcertificaciones/">Microcertificaciones</a> <span aria-hidden="true">/</span> Maestrías</nav>
    <p class="antetitulo">Microcertificaciones académicas</p>
    <h1>${esc(m.titulo)}</h1>
    <p class="entrada">Conoce la estructura completa de la maestría, sus áreas de conocimiento y los ${totalSeminarios} seminarios que conforman el recorrido académico. Cada seminario puede cursarse de manera individual.</p>
  </div>
</section>
<section class="seccion">
  <div class="contenedor ficha">
    <div class="ficha__principal">
      ${m.areas.map((a) => `<div class="area-seminarios">
        <h2>${esc(a.nombre)}</h2>
        <div class="seminarios">
          ${a.seminarios.map((s) => `<article class="seminario">
            <h3>${esc(s.nombre)}</h3>
            <p>${esc(s.texto)}</p>
            <p class="seminario__dato">${s.horas ? esc(s.horas) + ' horas' : esc(s.tipo || 'Seminario')}</p>
          </article>`).join('\n          ')}
        </div>
      </div>`).join('\n      ')}
    </div>
    <aside class="ficha__lateral" aria-label="Datos de la maestría">
      <dl class="datos">
        ${datos.map(([k, v]) => '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>').join('\n        ')}
      </dl>
      <div class="botones botones--columna">
        ${boton('Consultar por un seminario', sitio.enlaces.asesor, 'oscuro')}
        ${c ? boton('Ver la ficha de la maestría', '/carreras/' + c.slug + '/', 'contorno') : ''}
        ${boton('Agendar entrevista', sitio.enlaces.agenda, 'contorno')}
      </div>
      <p class="nota">Un asesor te indica cuándo abre cada seminario y cómo se articula con la maestría.</p>
    </aside>
  </div>
</section>`;

  return {
    ruta: '/microcertificaciones/' + m.slug + '/',
    titulo: m.titulo.replace(/^Maestría en /, '') + ' · Microcertificaciones',
    descripcion: 'Seminarios de la ' + m.titulo + ' que puedes cursar como microcertificación: áreas de conocimiento, contenidos y carga horaria.',
    imagen: m.imagen,
    contenido
  };
}
