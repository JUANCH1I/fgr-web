// Bloques que las páginas de src/paginas insertan con <!-- incluir: nombre -->.
import { esc, aSlug, datosJSON, enlaceFlecha, boton } from './util.mjs';
import { esCiclo, datosCarrerasNavegador } from './carreras.mjs';
import { tarjetasFondos, preguntasFrecuentes, listadoCursos, tarjetasMaestrias } from './programas.mjs';

export function componentes(ctx) {
  const { sitio, carreras, fondos, cursos, maestrias } = ctx;

  return {
    // Buscador de carreras de la portada, con sugerencias.
    'buscador': () => `<form class="buscador-portada" action="/carreras/" method="get" role="search" data-buscador-portada>
  <label for="buscar-portada">¿Qué quieres estudiar?</label>
  <div class="buscador-portada__campo">
    <input id="buscar-portada" name="q" type="search" role="combobox" placeholder="Ej.: seguridad, diseño, podología" autocomplete="off" aria-autocomplete="list" aria-controls="sugerencias-portada" aria-expanded="false">
    <button type="submit" class="boton boton--contorno">Buscar</button>
  </div>
  <ul class="sugerencias" id="sugerencias-portada" role="listbox" hidden></ul>
</form>
${datosJSON('datos-carreras', datosCarrerasNavegador(carreras))}`,

    'total-carreras': () => String(carreras.length),

    // Nombres de las instituciones con convenio, en fila.
    'convenios-lista': () => `<ul class="chips-lista">
  ${sitio.convenios.map((c) => '<li>' + esc(c.nombre) + '</li>').join('\n  ')}
</ul>`,

    // Instituciones con convenio, con tipo y país.
    'convenios-detalle': () => `<div class="grilla grilla--2">
  ${sitio.convenios.map((c) => `<article class="tarjeta">
    <p class="antetitulo">${esc(c.tipo)} · ${esc(c.pais)}</p>
    <h3>${esc(c.nombre)}</h3>
  </article>`).join('\n  ')}
</div>`,

    // Ciclos de licenciatura agrupados por área.
    'ciclos-por-area': () => {
      const ciclos = carreras.filter(esCiclo);
      const areas = [...new Set(ciclos.map((c) => c.area))].sort((a, b) => a.localeCompare(b, 'es'));
      return `<div class="grilla grilla--3">
  ${areas.map((a) => `<div class="tarjeta">
    <h3>${esc(a)}</h3>
    <ul class="lista-enlaces">
      ${ciclos.filter((c) => c.area === a).map((c) => '<li><a href="/carreras/' + esc(c.slug) + '/">' + esc(c.nombre.replace(/^Ciclo de Licenciatura en /, '')) + '</a></li>').join('\n      ')}
    </ul>
  </div>`).join('\n  ')}
</div>
<p class="nota">${ciclos.length} ciclos de licenciatura disponibles. ${enlaceFlecha('Ver todos los ciclos', '/carreras/?nivel=' + aSlug('Ciclo de Licenciatura (CCC)'))}</p>`;
    },

    'fondos-tarjetas': () => tarjetasFondos(fondos),
    'preguntas-frecuentes': () => preguntasFrecuentes(),
    'cursos': () => listadoCursos(sitio, cursos),
    'maestrias-tarjetas': () => tarjetasMaestrias(maestrias),

    // Precalificador "Evaluar mis estudios".
    'precalificador': () => {
      const areas = [...new Set(carreras.map((c) => c.area))].sort((a, b) => a.localeCompare(b, 'es'));
      return `<div class="precalificador" data-precalificador data-destino="${esc(sitio.formularios.destino)}" data-correo="${esc(sitio.contacto.correo)}" data-asesor="${esc(sitio.enlaces.asesor)}">
  <p class="precalificador__paso" data-paso-texto>Evaluar mis estudios · Paso 1 de 3</p>

  <section data-paso="1">
    <h3 tabindex="-1">¿Cuál es tu situación hoy?</h3>
    <div class="opciones" data-situaciones></div>
  </section>

  <section data-paso="2" hidden>
    <h3 tabindex="-1">¿En qué área quieres seguir?</h3>
    <div class="opciones" data-areas></div>
    <div class="fila"><button type="button" class="boton-texto" data-volver="1">← Volver</button></div>
  </section>

  <section data-paso="3" hidden>
    <h3 tabindex="-1">¿A dónde te enviamos el resultado?</h3>
    <p class="nota" data-resumen></p>
    <form novalidate data-formulario>
      <div class="campo"><label for="pc-nombre">Nombre y apellido</label><input id="pc-nombre" name="nombre" type="text" autocomplete="name" maxlength="80" required></div>
      <div class="campo"><label for="pc-whatsapp">WhatsApp, con código de país</label><input id="pc-whatsapp" name="whatsapp" type="tel" autocomplete="tel" placeholder="+593 99 123 4567" maxlength="24" required></div>
      <div class="campo"><label for="pc-correo">Correo</label><input id="pc-correo" name="correo" type="email" autocomplete="email" maxlength="100" required></div>
      <div class="campo campo--oculto" aria-hidden="true"><label for="pc-web">No completar</label><input id="pc-web" name="web" type="text" tabindex="-1" autocomplete="off"></div>
      <label class="acepto"><input type="checkbox" name="acepto" required><span>Acepto que la Fundación use estos datos para responder mi consulta. <a href="/proteccion-de-datos/" target="_blank">Ver política de protección de datos</a></span></label>
      <p class="error" role="alert" data-error hidden></p>
      <div class="fila">
        <button type="submit" class="boton boton--oscuro" data-enviar>Enviar y ver mis opciones</button>
        <button type="button" class="boton-texto" data-volver="2">← Volver</button>
      </div>
    </form>
  </section>

  <section data-paso="4" hidden>
    <h3 tabindex="-1">Listo. Ya tenemos tu caso.</h3>
    <p data-intro></p>
    <ul class="lista-enlaces" data-resultado></ul>
    <p class="nota" data-nota-envio></p>
    <div class="fila">
      ${boton('Hablar ahora con un asesor', sitio.enlaces.asesor, 'oscuro')}
      ${boton('Ver carreras', '/carreras/', 'contorno')}
    </div>
    <div class="fila"><button type="button" class="boton-texto" data-volver="1">Empezar de nuevo</button></div>
  </section>
  <noscript><p>Para usar el evaluador necesitas activar JavaScript. También puedes <a href="/contacto/">escribirnos desde Contacto</a>.</p></noscript>
</div>
${datosJSON('datos-precalificador', { areas, carreras: carreras.map((c) => ({ n: c.nombre, s: c.slug, a: c.area, v: c.nivel, o: c.orden })) })}`;
    },

    // Formulario de la página de Contacto.
    'formulario-contacto': () => `<form class="formulario" novalidate data-formulario-contacto data-destino="${esc(sitio.formularios.destino)}" data-correo="${esc(sitio.contacto.correo)}">
  <div class="campo"><label for="ct-nombre">Nombre completo</label><input id="ct-nombre" name="nombre" type="text" autocomplete="name" maxlength="80" required></div>
  <div class="campo"><label for="ct-correo">Correo</label><input id="ct-correo" name="correo" type="email" autocomplete="email" maxlength="100" required></div>
  <div class="campo"><label for="ct-lugar">Ciudad / País</label><input id="ct-lugar" name="lugar" type="text" autocomplete="address-level2" maxlength="80" required></div>
  <div class="campo"><label for="ct-telefono">Teléfono, con código de país</label><input id="ct-telefono" name="telefono" type="tel" autocomplete="tel" placeholder="+593 99 123 4567" maxlength="24" required></div>
  <div class="campo"><label for="ct-mensaje">Mensaje</label><textarea id="ct-mensaje" name="mensaje" rows="5" maxlength="2000"></textarea></div>
  <div class="campo campo--oculto" aria-hidden="true"><label for="ct-web">No completar</label><input id="ct-web" name="web" type="text" tabindex="-1" autocomplete="off"></div>
  <label class="acepto"><input type="checkbox" name="acepto" required><span>Acepto que la Fundación use estos datos para responder mi consulta. <a href="/proteccion-de-datos/" target="_blank">Ver política de protección de datos</a></span></label>
  <p class="error" role="alert" data-error hidden></p>
  <p class="exito" role="status" data-exito hidden></p>
  <button type="submit" class="boton boton--oscuro" data-enviar>Enviar</button>
</form>`,

    // Botones principales del sitio.
    'botones-asesor': () => `<div class="botones">
  ${boton('Hablar ahora con un asesor', sitio.enlaces.asesor, 'oscuro')}
</div>`
  };
}

// Reemplaza {{ruta.del.dato}} por el valor de sitio.json (escapado).
export function interpolar(html, sitio) {
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (todo, ruta) => {
    const valor = ruta.split('.').reduce((o, k) => (o == null ? o : o[k]), sitio);
    if (valor == null) {
      throw new Error('No existe el dato {{' + ruta + '}} en sitio.json');
    }
    return esc(valor);
  });
}
