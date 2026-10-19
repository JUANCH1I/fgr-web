/* Fundación del Gran Rosario Ecuador — comportamiento del sitio.
   Sin dependencias. Cada bloque se activa solo si la página tiene el elemento. */
window.iniciarSitio = function () {
  'use strict';

  function $(selector, raiz) { return (raiz || document).querySelector(selector); }
  function $$(selector, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(selector)); }
  function normalizar(texto) {
    return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function leerDatos(id) {
    var el = document.getElementById(id);
    if (!el) { return null; }
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }

  // ---------- Menú ----------
  (function () {
    var boton = $('.boton-menu');
    var menu = $('#menu-principal');
    if (boton && menu && !boton._iniciado) { boton._iniciado = true;
      boton.addEventListener('click', function () {
        var abierto = boton.getAttribute('aria-expanded') === 'true';
        boton.setAttribute('aria-expanded', String(!abierto));
        menu.classList.toggle('abierto', !abierto);
      });
    }
    var grupos = $$('.menu__grupo');
    function cerrarTodos(excepto) {
      grupos.forEach(function (g) {
        if (g === excepto) { return; }
        g.classList.remove('abierto');
        var b = $('.menu__desplegar', g);
        if (b) { b.setAttribute('aria-expanded', 'false'); }
      });
    }
    grupos.forEach(function (grupo) {
      var b = $('.menu__desplegar', grupo);
      if (!b._iniciado) { b._iniciado = true; b.addEventListener('click', function () {
        var abierto = grupo.classList.toggle('abierto');
        b.setAttribute('aria-expanded', String(abierto));
        cerrarTodos(grupo);
      }); }
    });
    if (!document._menuEventsIniciados) { document._menuEventsIniciados = true; document.addEventListener('click', function (e) {
      if (!e.target.closest('.menu__grupo')) { cerrarTodos(null); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var abierto = $('.menu__grupo.abierto');
        cerrarTodos(null);
        if (abierto) { $('.menu__desplegar', abierto).focus(); }
      }
    }); }
  })();

  // ---------- Buscador de la portada ----------
  (function () {
    var form = $('[data-buscador-portada]');
    var carreras = leerDatos('datos-carreras');
    if (!form || !carreras) { return; }
    var campo = $('input', form);
    var lista = $('.sugerencias', form);
    var elegida = -1;

    function pintar() {
      var q = normalizar(campo.value.trim());
      lista.textContent = '';
      elegida = -1;
      if (q.length < 2) { lista.hidden = true; campo.setAttribute('aria-expanded', 'false'); return; }
      var hallazgos = carreras.filter(function (c) { return normalizar(c.n + ' ' + c.a).indexOf(q) !== -1; }).slice(0, 6);
      hallazgos.forEach(function (c, i) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = '/carreras/' + c.s + '/';
        a.textContent = c.n;
        a.id = 'sugerencia-' + i;
        a.setAttribute('role', 'option');
        li.appendChild(a);
        lista.appendChild(li);
      });
      var todas = document.createElement('li');
      todas.className = 'sugerencias__todas';
      var enlace = document.createElement('a');
      enlace.href = '/carreras/?q=' + encodeURIComponent(campo.value.trim());
      enlace.textContent = hallazgos.length ? 'Ver todos los resultados →' : 'Sin coincidencias. Ver las ' + carreras.length + ' carreras →';
      todas.appendChild(enlace);
      lista.appendChild(todas);
      lista.hidden = false;
      campo.setAttribute('aria-expanded', 'true');
    }
    campo.addEventListener('input', pintar);
    campo.addEventListener('keydown', function (e) {
      var opciones = $$('a', lista);
      if (!opciones.length || lista.hidden) { return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        elegida = (elegida + (e.key === 'ArrowDown' ? 1 : -1) + opciones.length) % opciones.length;
        opciones.forEach(function (o, i) { o.setAttribute('aria-selected', String(i === elegida)); });
        campo.setAttribute('aria-activedescendant', opciones[elegida].id || '');
      } else if (e.key === 'Enter' && elegida >= 0) {
        e.preventDefault();
        window.location.href = opciones[elegida].href;
      } else if (e.key === 'Escape') {
        lista.hidden = true;
      }
    });
    document.addEventListener('click', function (e) {
      if (!form.contains(e.target)) { lista.hidden = true; }
    });
  })();

  // ---------- Filtros del listado de carreras ----------
  (function () {
    var listado = $('[data-listado]');
    if (!listado) { return; }
    var tarjetas = $$('.tarjeta-carrera', listado);
    var campo = $('#buscar-carrera');
    var filtros = $('[data-filtros]');
    var total = $('[data-total]');
    var vacio = $('[data-vacio]');
    var limpiar = $('[data-limpiar]');
    var estado = { area: '', nivel: '', modalidad: '' };
    filtros.hidden = false;

    var params = new URLSearchParams(window.location.search);
    if (params.get('q')) { campo.value = params.get('q'); }
    Object.keys(estado).forEach(function (k) { if (params.get(k)) { estado[k] = params.get(k); } });

    function marcar() {
      $$('[data-filtro]', filtros).forEach(function (grupo) {
        var clave = grupo.getAttribute('data-filtro');
        $$('.chip', grupo).forEach(function (chip) {
          chip.setAttribute('aria-pressed', String(chip.getAttribute('data-valor') === estado[clave]));
        });
        var sel = $('select', grupo);
        if (sel) { sel.value = estado[clave] || ''; }
      });
    }

    var animandoTimer = null;
    function aplicar(conAnimacion) {
      var q = normalizar(campo.value.trim());
      var visibles = 0;
      var stagger = 0;
      tarjetas.forEach(function (t) {
        var ok = (!q || t.getAttribute('data-texto').indexOf(q) !== -1) &&
          (!estado.area || t.getAttribute('data-area') === estado.area) &&
          (!estado.nivel || t.getAttribute('data-nivel') === estado.nivel) &&
          (!estado.modalidad || t.getAttribute('data-modalidad') === estado.modalidad);
        
        var estabaOculto = t.hidden;
        t.hidden = !ok;
        if (ok) {
          visibles++;
          if (conAnimacion) {
            t.classList.remove('tarjeta-animada');
            t.style.animationDelay = '';
            // Trigger reflow
            void t.offsetWidth;
            // Stagger sutil para los primeros 8 elementos visibles
            if (stagger < 8) {
              t.style.animationDelay = (stagger * 35) + 'ms';
              stagger++;
            }
            t.classList.add('tarjeta-animada');
          }
        }
      });

      if (total) {
        if (total.textContent !== String(visibles)) {
          total.textContent = visibles;
          if (conAnimacion) {
            total.classList.remove('cambio');
            void total.offsetWidth;
            total.classList.add('cambio');
            clearTimeout(animandoTimer);
            animandoTimer = setTimeout(function () { total.classList.remove('cambio'); }, 220);
          }
        } else {
          total.textContent = visibles;
        }
      }

      vacio.hidden = visibles > 0;
      limpiar.hidden = !(q || estado.area || estado.nivel || estado.modalidad);
      marcar();
      var url = new URLSearchParams();
      if (campo.value.trim()) { url.set('q', campo.value.trim()); }
      Object.keys(estado).forEach(function (k) { if (estado[k]) { url.set(k, estado[k]); } });
      var nueva = window.location.pathname + (url.toString() ? '?' + url.toString() : '');
      window.history.replaceState(null, '', nueva);
    }

    filtros.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) { return; }
      var clave = chip.closest('[data-filtro]').getAttribute('data-filtro');
      estado[clave] = chip.getAttribute('data-valor');
      aplicar(true);
    });
    filtros.addEventListener('change', function (e) {
      var select = e.target.closest('select');
      if (!select) { return; }
      var clave = select.closest('[data-filtro]').getAttribute('data-filtro');
      estado[clave] = select.value;
      aplicar(true);
    });
    campo.addEventListener('input', function () { aplicar(true); });
    limpiar.addEventListener('click', function () {
      campo.value = '';
      Object.keys(estado).forEach(function (k) { estado[k] = ''; });
      aplicar(true);
      campo.focus();
    });
    aplicar(false);
  })();

  // ---------- Pestañas de la ficha ----------
  (function () {
    var caja = $('[data-pestanas]');
    if (!caja) { return; }
    var lista = $('[role="tablist"]', caja);
    var botones = $$('[role="tab"]', caja);
    var paneles = $$('[role="tabpanel"]', caja);
    lista.hidden = false;
    caja.classList.add('con-pestanas');

    function elegir(indice, enfocar) {
      botones.forEach(function (b, i) {
        var activo = i === indice;
        b.setAttribute('aria-selected', String(activo));
        b.tabIndex = activo ? 0 : -1;
        paneles[i].hidden = !activo;
      });
      if (enfocar) { botones[indice].focus(); }
    }
    botones.forEach(function (b, i) {
      b.addEventListener('click', function () { elegir(i, false); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); elegir((i + 1) % botones.length, true); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); elegir((i - 1 + botones.length) % botones.length, true); }
        if (e.key === 'Home') { e.preventDefault(); elegir(0, true); }
        if (e.key === 'End') { e.preventDefault(); elegir(botones.length - 1, true); }
      });
    });
    var inicial = paneles.map(function (p) { return '#' + p.id; }).indexOf(window.location.hash);
    elegir(inicial > 0 ? inicial : 0, false);
  })();

  // ---------- Filtro de cursos ----------
  (function () {
    var filtro = $('[data-filtro-cursos]');
    var grilla = $('[data-cursos]');
    if (!filtro || !grilla) { return; }
    filtro.hidden = false;
    filtro.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) { return; }
      var valor = chip.getAttribute('data-valor');
      $$('.chip', filtro).forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
      $$('[data-categoria]', grilla).forEach(function (t) {
        t.hidden = Boolean(valor) && t.getAttribute('data-categoria') !== valor;
      });
    });
  })();

  // ---------- Atribución de tráfico (localStorage, 30 días) ----------
  var CLAVE_ATRIBUCION = 'fgrec_attribution';
  var DIAS_VIGENCIA = 30;

  function registrarAtribucion() {
    try {
      var urlParams = new URLSearchParams(window.location.search);
      var ahora = new Date().toISOString();
      var toqueActual = {
        utm_source: urlParams.get('utm_source') || '',
        utm_medium: urlParams.get('utm_medium') || '',
        utm_campaign: urlParams.get('utm_campaign') || '',
        utm_content: urlParams.get('utm_content') || '',
        utm_term: urlParams.get('utm_term') || '',
        gclid: urlParams.get('gclid') || '',
        fbclid: urlParams.get('fbclid') || '',
        referrer: document.referrer || '',
        landing_path: window.location.pathname,
        at: ahora
      };

      var raw = localStorage.getItem(CLAVE_ATRIBUCION);
      var guardado = null;
      if (raw) {
        try {
          guardado = JSON.parse(raw);
          // Verificar expiración de 30 días
          if (guardado.primerToque && guardado.primerToque.at) {
            var diffMs = Date.now() - new Date(guardado.primerToque.at).getTime();
            if (diffMs > DIAS_VIGENCIA * 24 * 60 * 60 * 1000) {
              guardado = null;
            }
          }
        } catch (_) {
          guardado = null;
        }
      }

      var tieneParams = Boolean(
        toqueActual.utm_source || toqueActual.utm_medium || toqueActual.utm_campaign ||
        toqueActual.gclid || toqueActual.fbclid
      );

      if (!guardado) {
        guardado = {
          primerToque: toqueActual,
          ultimoToque: toqueActual
        };
      } else if (tieneParams || (document.referrer && document.referrer.indexOf(window.location.hostname) === -1)) {
        guardado.ultimoToque = toqueActual;
      }

      localStorage.setItem(CLAVE_ATRIBUCION, JSON.stringify(guardado));
    } catch (_) {}
  }

  function obtenerAtribucion() {
    try {
      var raw = localStorage.getItem(CLAVE_ATRIBUCION);
      if (raw) {
        var obj = JSON.parse(raw);
        return {
          pagina: window.location.pathname,
          primerToque: obj.primerToque,
          ultimoToque: obj.ultimoToque
        };
      }
    } catch (_) {}
    return {
      pagina: window.location.pathname,
      primerToque: {
        referrer: document.referrer || '',
        landing_path: window.location.pathname,
        at: new Date().toISOString()
      },
      ultimoToque: {
        referrer: document.referrer || '',
        landing_path: window.location.pathname,
        at: new Date().toISOString()
      }
    };
  }

  registrarAtribucion();

  // ---------- Envío de formularios ----------
  // Si sitio.json tiene un destino, los datos se envían ahí. Si no, se arma un correo.
  function enviar(destino, datos) {
    return fetch(destino, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(datos)
    }).then(function (r) {
      if (!r.ok) {
        return r.json().catch(function () { return null; }).then(function (cuerpo) {
          var err = new Error('Respuesta ' + r.status);
          if (cuerpo) { err.campo = cuerpo.campo; err.mensaje = cuerpo.error; }
          throw err;
        });
      }
      return r.json();
    });
  }
  function enlaceCorreo(correo, asunto, datos) {
    var cuerpo = Object.keys(datos).map(function (k) { return k + ': ' + datos[k]; }).join('\n');
    return 'mailto:' + correo + '?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(cuerpo);
  }
  function correoValido(texto) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto); }

  var PREFIJOS_PAIS = {
    EC: { prefijo: '+593', ejemplo: '+593 99 123 4567' },
    CO: { prefijo: '+57', ejemplo: '+57 300 123 4567' },
    PE: { prefijo: '+51', ejemplo: '+51 912 345 678' },
    BO: { prefijo: '+591', ejemplo: '+591 7123 4567' },
    AR: { prefijo: '+54', ejemplo: '+54 9 11 1234 5678' },
    CL: { prefijo: '+56', ejemplo: '+56 9 1234 5678' },
    MX: { prefijo: '+52', ejemplo: '+52 55 1234 5678' },
    PY: { prefijo: '+595', ejemplo: '+595 981 123456' },
    UY: { prefijo: '+598', ejemplo: '+598 99 123 456' },
    PA: { prefijo: '+507', ejemplo: '+507 6123 4567' },
    CR: { prefijo: '+506', ejemplo: '+506 8123 4567' },
    DO: { prefijo: '+1', ejemplo: '+1 809 123 4567' },
    ES: { prefijo: '+34', ejemplo: '+34 612 345 678' },
    US: { prefijo: '+1', ejemplo: '+1 202 555 0123' },
    OT: { prefijo: '+', ejemplo: '+505 8123 4567' }
  };

  function vincularPaisTelefono(selectPais, inputTel) {
    if (!selectPais || !inputTel) { return; }
    function actualizarPrefijo(soloSiVacio) {
      var codigo = selectPais.value;
      var info = PREFIJOS_PAIS[codigo];
      if (!info) { return; }
      if (info.ejemplo) {
        inputTel.setAttribute('placeholder', info.ejemplo);
      }
      var valorActual = inputTel.value.trim();
      if (!valorActual || valorActual === '+') {
        inputTel.value = info.prefijo + ' ';
        return;
      }
      if (soloSiVacio) { return; }

      var matchPrefijo = valorActual.match(/^\+(\d{1,4})\s*(.*)$/);
      if (matchPrefijo) {
        var resto = matchPrefijo[2];
        inputTel.value = info.prefijo + (resto ? ' ' + resto : ' ');
      } else {
        inputTel.value = info.prefijo + ' ' + valorActual;
      }
    }

    selectPais.addEventListener('change', function () {
      actualizarPrefijo(false);
    });

    inputTel.addEventListener('focus', function () {
      if (/^\+\d{1,4}\s*$/.test(inputTel.value)) {
        var len = inputTel.value.length;
        inputTel.setSelectionRange(len, len);
      }
    });

    if (selectPais.value) {
      actualizarPrefijo(true);
    }
  }

  // ---------- Formulario de contacto ----------
  (function () {
    var form = $('[data-formulario-contacto]');
    if (!form) { return; }
    var error = $('[data-error]', form);
    var exito = $('[data-exito]', form);
    var boton = $('[data-enviar]', form);
    var selectPais = $('select[name="pais"]', form);
    var inputTel = $('input[name="telefono"]', form);
    vincularPaisTelefono(selectPais, inputTel);
    function fallar(texto, campo) {
      error.textContent = texto;
      error.hidden = false;
      if (campo) { campo.focus(); }
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      error.hidden = true;
      exito.hidden = true;
      var f = form.elements;
      if (f.web.value) { return; }
      if (f.nombre.value.trim().length < 3) { return fallar('Escribe tu nombre completo.', f.nombre); }
      if (!correoValido(f.correo.value.trim())) { return fallar('Revisa tu correo: parece incompleto.', f.correo); }
      if (f.pais && !f.pais.value) { return fallar('Por favor selecciona tu país de residencia.', f.pais); }
      if (f.lugar && f.lugar.value.trim().length < 2) { return fallar('Escribe tu ciudad o país.', f.lugar); }
      if (f.telefono.value.replace(/\D/g, '').length < 8) { return fallar('Escribe tu teléfono con el código de país. Ejemplo: +593 99 123 4567', f.telefono); }
      if (!f.acepto.checked) { return fallar('Para enviar, marca la casilla de aceptación.', f.acepto); }
      
      var datos = {
        formulario: 'Contacto',
        nombre: f.nombre.value.trim(),
        correo: f.correo.value.trim(),
        pais: f.pais ? f.pais.value : '',
        ciudad: f.ciudad ? f.ciudad.value.trim() : (f.lugar ? f.lugar.value.trim() : ''),
        telefono: f.telefono.value.trim(),
        mensaje: f.mensaje.value.trim(),
        pagina: window.location.href,
        consentimiento: {
          aceptado: true,
          version: 'proteccion-de-datos-2026-10',
          at: new Date().toISOString()
        },
        origen: obtenerAtribucion()
      };
      var destino = form.getAttribute('data-destino');
      if (!destino) {
        window.location.href = enlaceCorreo(form.getAttribute('data-correo'), 'Consulta desde el sitio', datos);
        exito.textContent = 'Se abrió tu programa de correo con la consulta lista para enviar.';
        exito.hidden = false;
        return;
      }
      boton.disabled = true;
      boton.textContent = 'Enviando…';
      enviar(destino, datos).then(function (res) {
        form.reset();
        var codigo = res && res.fgrec && res.fgrec.codigo;
        if (codigo) {
          exito.textContent = 'Gracias. Ya recibimos tu consulta (Ref. ' + codigo + '). Un asesor te escribirá a la brevedad.';
        } else {
          exito.textContent = 'Gracias. Recibimos tu consulta y un asesor te va a escribir.';
        }
        exito.hidden = false;
      }).catch(function (err) {
        if (err && err.campo === 'telefono') { return fallar(err.mensaje, f.telefono); }
        error.innerHTML = '';
        var p = document.createElement('span');
        p.textContent = 'Tuvimos un inconveniente al registrar tu consulta por este medio. Puedes escribirnos directamente por WhatsApp: ';
        var a = document.createElement('a');
        a.href = 'https://wa.me/593963017631?text=' + encodeURIComponent('Hola, intenté enviar una consulta desde la web pero no pude completarla.');
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.style.textDecoration = 'underline';
        a.style.fontWeight = '700';
        a.textContent = 'Escribir por WhatsApp';
        p.appendChild(a);
        error.appendChild(p);
        error.hidden = false;
      }).then(function () {
        boton.disabled = false;
        boton.textContent = 'Enviar';
      });
    });
  })();

  // ---------- Precalificador "Evaluar mis estudios" ----------
  (function () {
    var caja = $('[data-precalificador]');
    var datos = leerDatos('datos-precalificador');
    if (!caja || !datos) { return; }

    var SITUACIONES = [
      { clave: 'tecnico_tecnologo', texto: 'Tengo un título técnico o tecnológico', niveles: ['Ciclo'] },
      { clave: 'incompleta', texto: 'Empecé una carrera y no la terminé', niveles: ['Licenciatura', 'Tecnicatura'] },
      { clave: 'titulo', texto: 'Tengo un título universitario y quiero otro', niveles: ['Maestr', 'Especializ', 'Doctorado', 'Profesorado'] },
      { clave: 'bachillerato', texto: 'Terminé el bachillerato', niveles: ['Licenciatura', 'Tecnicatura'] }
    ];
    var MAX = 4;
    var estado = { situacion: null, area: null };
    var form = $('[data-formulario]', caja);
    var error = $('[data-error]', caja);
    var boton = $('[data-enviar]', caja);
    var selectPais = $('select[name="pais"]', form);
    var inputWa = $('input[name="whatsapp"]', form);
    vincularPaisTelefono(selectPais, inputWa);

    function mostrar(paso) {
      $$('[data-paso]', caja).forEach(function (s) {
        var activo = Number(s.getAttribute('data-paso')) === paso;
        s.hidden = !activo;
        if (activo) {
          s.style.animation = 'none';
          void s.offsetHeight; // trigger reflow para reiniciar animación
          s.style.animation = '';
        }
      });
      $('[data-paso-texto]', caja).textContent = 'Evaluar mis estudios · ' + (paso === 4 ? 'Enviado' : 'Paso ' + paso + ' de 3');
      var barra = $('[data-barra-progreso]', caja);
      if (barra) {
        var pct = paso === 1 ? '33%' : (paso === 2 ? '66%' : '100%');
        barra.style.width = pct;
      }
      error.hidden = true;
      var titulo = $('[data-paso="' + paso + '"] h3', caja);
      if (titulo) { titulo.focus(); }
    }
    function opcion(texto, alElegir) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'opcion';
      b.textContent = texto;
      b.addEventListener('click', alElegir);
      return b;
    }
    var contSit = $('[data-situaciones]', caja);
    var contAreas = $('[data-areas]', caja);
    if (contSit) contSit.innerHTML = '';
    if (contAreas) contAreas.innerHTML = '';

    SITUACIONES.forEach(function (s, i) {
      if (contSit) contSit.appendChild(opcion(s.texto, function () { estado.situacion = i; mostrar(2); }));
    });
    datos.areas.forEach(function (area) {
      if (contAreas) contAreas.appendChild(opcion(area, function () {
        estado.area = area;
        $('[data-resumen]', caja).textContent = SITUACIONES[estado.situacion].texto + ' · ' + area;
        mostrar(3);
      }));
    });
    caja.addEventListener('click', function (e) {
      var b = e.target.closest('[data-volver]');
      if (b) { mostrar(Number(b.getAttribute('data-volver'))); }
    });

    function sugeridas() {
      var sit = SITUACIONES[estado.situacion];
      var niveles = sit ? sit.niveles : ['Licenciatura', 'Ciclo'];
      var exactas = datos.carreras
        .filter(function (c) { return (!estado.area || c.a === estado.area) && niveles.some(function (n) { return c.v.indexOf(n) === 0; }); })
        .sort(function (a, b) { return a.o - b.o; })
        .slice(0, MAX);
      if (exactas.length > 0) {
        return { lista: exactas, directa: true };
      }
      // Fallback 1: Si no hay cruce exacto de nivel, mostrar carreras del área elegida
      var porArea = datos.carreras
        .filter(function (c) { return (!estado.area || c.a === estado.area); })
        .sort(function (a, b) { return a.o - b.o; })
        .slice(0, MAX);
      if (porArea.length > 0) {
        return { lista: porArea, directa: false };
      }
      // Fallback 2: Carreras afines al nivel en otras áreas
      var porNivel = datos.carreras
        .filter(function (c) { return niveles.some(function (n) { return c.v.indexOf(n) === 0; }); })
        .sort(function (a, b) { return a.o - b.o; })
        .slice(0, MAX);
      return { lista: porNivel, directa: false };
    }

    function resultado(sugerenciasObj, nota, infoFgrec) {
      var carreras = Array.isArray(sugerenciasObj) ? sugerenciasObj : (sugerenciasObj.lista || []);
      var directa = Array.isArray(sugerenciasObj) ? (carreras.length > 0) : sugerenciasObj.directa;
      var lista = $('[data-resultado]', caja);
      lista.textContent = '';
      $('[data-intro]', caja).textContent = directa
        ? 'Según lo que nos contaste, estas carreras aplican a tu perfil:'
        : '¡Registro completado! Las opciones en esta área requieren una revisión individual de tus antecedentes académicos. Un asesor se comunicará contigo para analizar posibilidades. Puedes explorar estas carreras del área:';
      carreras.forEach(function (c) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = '/carreras/' + c.s + '/';
        a.textContent = c.n + ' →';
        li.appendChild(a);
        lista.appendChild(li);
      });

      var notaEl = $('[data-nota-envio]', caja);
      notaEl.textContent = '';
      if (typeof nota === 'string') { notaEl.textContent = nota; } else if (nota) { notaEl.appendChild(nota); }

      // Manejo de dos estados (FGREC conectado vs respaldo)
      var ticketBox = $('[data-ticket-resultado]', caja);
      var ticketCod = $('[data-ticket-codigo]', caja);
      var ticketVia = $('[data-ticket-via]', caja);
      var btnAsesor = $('[data-accion-asesor]', caja);
      var tituloResultado = $('[data-resultado-titulo]', caja);

      var VIAS_TEXTO = {
        'LICENCIATURA': 'Vía sugerida: Licenciatura completa',
        'RECONOCIMIENTO': 'Vía sugerida: Evaluación de estudios previos',
        'CCC': 'Vía sugerida: Ciclo de Licenciatura (CCC)',
        'REVISION_HUMANA': 'Vía sugerida: Un asesor académico revisará tu caso en detalle'
      };

      if (infoFgrec && infoFgrec.conectado && infoFgrec.codigo) {
        if (tituloResultado) tituloResultado.textContent = '¡Ya tenemos tu información!';
        if (ticketBox) ticketBox.hidden = false;
        if (ticketCod) ticketCod.textContent = infoFgrec.codigo;
        if (ticketVia) {
          ticketVia.textContent = VIAS_TEXTO[infoFgrec.via] || (infoFgrec.via ? 'Vía: ' + infoFgrec.via : 'Evaluación preliminar registrada');
        }

        if (btnAsesor) {
          var numWa = (infoFgrec.whatsapp || '593963017631').replace(/\D/g, '');
          var textoWa = encodeURIComponent('Hola, completé el precalificador (ref. ' + infoFgrec.codigo + ') y quiero consultar mis opciones.');
          btnAsesor.href = 'https://wa.me/' + numWa + '?text=' + textoWa;
          btnAsesor.textContent = 'Hablar con un asesor por WhatsApp';
          btnAsesor.target = '_blank';
          btnAsesor.rel = 'noopener noreferrer';
        }
      } else {
        if (tituloResultado) tituloResultado.textContent = '¡Listo! Tu caso ya fue precalificado.';
        if (ticketBox) ticketBox.hidden = true;
        if (btnAsesor) {
          var numWaDef = '593963017631';
          var textoWaDef = encodeURIComponent('Hola, completé la evaluación de mis estudios en la web y quiero consultar con un asesor mis opciones.');
          btnAsesor.href = 'https://wa.me/' + numWaDef + '?text=' + textoWaDef;
          btnAsesor.textContent = 'Hablar con un asesor por WhatsApp';
          btnAsesor.target = '_blank';
          btnAsesor.rel = 'noopener noreferrer';
        }
      }

      mostrar(4);
    }

    function fallar(texto, campo) {
      error.textContent = texto;
      error.hidden = false;
      if (campo) { campo.focus(); }
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements;
      if (f.web.value) { return; }
      var nombre = f.nombre.value.trim();
      var pais = f.pais ? f.pais.value : '';
      var ciudad = f.ciudad ? f.ciudad.value.trim() : '';
      var whatsapp = f.whatsapp.value.trim();
      var correo = f.correo.value.trim();
      if (nombre.length < 3) { return fallar('Escribe tu nombre y apellido.', f.nombre); }
      if (!pais) { return fallar('Por favor selecciona tu país de residencia.', f.pais); }
      if (whatsapp.replace(/\D/g, '').length < 8) { return fallar('Escribe tu WhatsApp con el código de país. Ejemplo: +593 99 123 4567', f.whatsapp); }
      if (!correoValido(correo)) { return fallar('Revisa tu correo: parece incompleto.', f.correo); }
      if (estado.situacion === null || estado.situacion === undefined || !SITUACIONES[estado.situacion]) {
        mostrar(1);
        return fallar('Por favor selecciona primero tu situación académica.', null);
      }
      if (!estado.area) {
        mostrar(2);
        return fallar('Por favor selecciona tu área de interés.', null);
      }

      var sugerencias = sugeridas();
      var lista = sugerencias.lista;
      var situacionSeleccionada = SITUACIONES[estado.situacion];
      var envio = {
        tipo: 'precalificador',
        formulario: 'Evaluar mis estudios',
        nombre: nombre,
        pais: pais,
        ciudad: ciudad,
        whatsapp: whatsapp,
        correo: correo,
        situacion: situacionSeleccionada ? situacionSeleccionada.clave : '',
        situacionTexto: situacionSeleccionada ? situacionSeleccionada.texto : '',
        area: estado.area,
        carrerasSugeridas: lista.map(function (c) { return c.n; }).join(' | ') + (sugerencias.directa ? '' : ' [carreras afines del área]'),
        consentimiento: {
          aceptado: true,
          version: 'proteccion-de-datos-2026-10',
          at: new Date().toISOString()
        },
        origen: obtenerAtribucion()
      };
      var destino = caja.getAttribute('data-destino');
      var notaFinal = 'La universidad confirma el ingreso después de revisar tu documentación oficial. Puedes avanzar ahora con un asesor:';

      if (!destino) {
        var p = document.createElement('span');
        p.appendChild(document.createTextNode('Para que un asesor revise tu caso, envíanos esta consulta: '));
        var a = document.createElement('a');
        a.href = enlaceCorreo(caja.getAttribute('data-correo'), 'Evaluar mis estudios', envio);
        a.textContent = 'enviar mi consulta por correo';
        p.appendChild(a);
        p.appendChild(document.createTextNode('. La universidad confirma el ingreso después de revisar tu documentación.'));
        resultado(sugerencias, p, null);
        return;
      }
      boton.disabled = true;
      boton.textContent = 'Enviando…';
      enviar(destino, envio).then(function (res) {
        resultado(sugerencias, notaFinal, res ? res.fgrec : null);
      }).catch(function (err) {
        if (err && err.campo === 'telefono') { return fallar(err.mensaje, f.whatsapp); }
        error.innerHTML = '';
        var p = document.createElement('span');
        p.textContent = 'Tuvimos un inconveniente al enviar tu evaluación por el formulario. Puedes consultar directamente a un asesor por WhatsApp: ';
        var a = document.createElement('a');
        a.href = 'https://wa.me/593963017631?text=' + encodeURIComponent('Hola, completé mis datos en el precalificador pero tuve un error al enviar el formulario.');
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.style.textDecoration = 'underline';
        a.style.fontWeight = '700';
        a.textContent = 'Hablar por WhatsApp';
        p.appendChild(a);
        error.appendChild(p);
        error.hidden = false;
      }).then(function () {
        boton.disabled = false;
        boton.textContent = 'Enviar y ver mis opciones';
      });
    });
  })();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", window.iniciarSitio);
} else {
  window.iniciarSitio();
}
document.addEventListener("astro:page-load", window.iniciarSitio);
