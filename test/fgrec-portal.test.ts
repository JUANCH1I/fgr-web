import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  extraerIpVisitante,
  validarCsrfPortal,
  opcionesCookieSegura,
  borrarCookieSegura,
  maxAgeDesdeIso,
  COOKIE_SESION_NOMBRE,
  llamarFGRECPortal
} from '../src/lib/fgrec-portal.ts';

test('extraerIpVisitante toma primera ip de x-forwarded-for o x-real-ip, o cadena vacia si no existen', () => {
  const headers1 = new Headers();
  headers1.set('x-forwarded-for', '200.10.5.1, 10.0.0.1');
  assert.equal(extraerIpVisitante(headers1), '200.10.5.1');

  const headers2 = new Headers();
  headers2.set('x-real-ip', '190.15.1.20');
  assert.equal(extraerIpVisitante(headers2), '190.15.1.20');

  // Si no hay cabeceras, retorna cadena vacía para no colisionar contadores en FGREC
  const headers3 = new Headers();
  assert.equal(extraerIpVisitante(headers3), '');
});

test('validarCsrfPortal verifica header propio X-FGREC-Portal y Origin', () => {
  const reqValida = new Request('https://www.fgrec.org/api/portal/codigo', {
    headers: {
      'x-fgrec-portal': '1',
      'origin': 'https://www.fgrec.org'
    }
  });
  assert.equal(validarCsrfPortal(reqValida).valido, true);

  const reqSinHeader = new Request('https://www.fgrec.org/api/portal/codigo', {
    headers: {
      'origin': 'https://www.fgrec.org'
    }
  });
  assert.equal(validarCsrfPortal(reqSinHeader).valido, false);

  const reqOrigenCruzado = new Request('https://www.fgrec.org/api/portal/codigo', {
    headers: {
      'x-fgrec-portal': '1',
      'origin': 'https://sitio-malicioso.com'
    }
  });
  assert.equal(validarCsrfPortal(reqOrigenCruzado).valido, false);
});

test('opcionesCookieSegura configura HttpOnly, Secure y SameSite Lax', () => {
  const opts = opcionesCookieSegura(3600);
  assert.equal(opts.httpOnly, true);
  assert.equal(opts.secure, true);
  assert.equal(opts.sameSite, 'lax');
  assert.equal(opts.path, '/');
  assert.equal(opts.maxAge, 3600);
  assert.equal(COOKIE_SESION_NOMBRE, '__Host-fgrec_sesion');
});

test('borrarCookieSegura borra con secure: true, httpOnly: true y sameSite: lax', () => {
  const llamadas: any[] = [];
  const mockCookies = {
    delete(name: string, opts: any) {
      llamadas.push({ metodo: 'delete', name, opts });
    },
    set(name: string, val: string, opts: any) {
      llamadas.push({ metodo: 'set', name, val, opts });
    }
  };

  borrarCookieSegura(mockCookies, COOKIE_SESION_NOMBRE);

  assert.equal(llamadas[0].metodo, 'delete');
  assert.equal(llamadas[0].opts.secure, true);
  assert.equal(llamadas[0].opts.httpOnly, true);
  assert.equal(llamadas[0].opts.path, '/');

  assert.equal(llamadas[1].metodo, 'set');
  assert.equal(llamadas[1].opts.maxAge, 0);
  assert.equal(llamadas[1].opts.secure, true);
});

test('maxAgeDesdeIso calcula segundos positivos', () => {
  const futuro = new Date(Date.now() + 60000).toISOString();
  const seg = maxAgeDesdeIso(futuro);
  assert.ok(seg >= 55 && seg <= 65);

  const pasado = new Date(Date.now() - 10000).toISOString();
  assert.equal(maxAgeDesdeIso(pasado), 0);
});

test('llamarFGRECPortal sin variables de entorno devuelve 503 sin fallbacks hardcodeados', async () => {
  const secretPrev = process.env.FGREC_PORTAL_SECRET;
  const urlPrev = process.env.FGREC_PORTAL_URL;
  try {
    delete process.env.FGREC_PORTAL_SECRET;
    delete process.env.FGREC_PORTAL_URL;

    const res = await llamarFGRECPortal({
      metodo: 'GET',
      rutaRelativa: 'sesion',
      contexto: {}
    });
    assert.equal(res.status, 503);
    assert.equal(res.ok, false);
    assert.equal(res.error?.code, 'PORTAL_DISABLED');
  } finally {
    if (secretPrev) process.env.FGREC_PORTAL_SECRET = secretPrev;
    if (urlPrev) process.env.FGREC_PORTAL_URL = urlPrev;
  }
});

test('destinoDelEnlace: la vista de Dirección entra sin código; el precalificador va directo; el resto pide el código', async () => {
  const { destinoDelEnlace } = await import('../src/lib/fgrec-portal.ts');
  assert.equal(destinoDelEnlace('vista'), '/mi-postulacion');
  assert.equal(destinoDelEnlace('precalificador'), '/mi-postulacion/precalificador');
  for (const proposito of ['documentos', 'carta', 'convenio', 'inicio', '', undefined]) {
    assert.equal(destinoDelEnlace(proposito), '/mi-postulacion/codigo', String(proposito));
    assert.equal(destinoDelEnlace(proposito, 1), '/mi-postulacion/codigo', `${String(proposito)} nivel 1`);
  }
});

test('destinoDelEnlace: con la sesión verificada que FGREC conservó (nivel 2) va directo al destino, sin código', async () => {
  const { destinoDelEnlace } = await import('../src/lib/fgrec-portal.ts');
  assert.equal(destinoDelEnlace('convenio', 2), '/mi-postulacion/convenio');
  assert.equal(destinoDelEnlace('documentos', 2), '/mi-postulacion/documentos');
  assert.equal(destinoDelEnlace('carta', 2), '/mi-postulacion/documentos#carta');
  assert.equal(destinoDelEnlace('precalificador', 2), '/mi-postulacion/precalificador');
  assert.equal(destinoDelEnlace('inicio', 2), '/mi-postulacion');
});

test('entrar manda la sesión del navegador al canjear el enlace y elige el destino con el nivel devuelto', async () => {
  const pagina = await readFile(new URL('../src/pages/mi-postulacion/entrar.astro', import.meta.url), 'utf8');
  const canje = pagina.slice(pagina.indexOf("rutaRelativa: 'acceso/enlace'") - 80, pagina.indexOf('let errorEnlace'));
  assert.match(canje, /sesion: Astro\.cookies\.get\(COOKIE_SESION_NOMBRE\)\?\.value/);
  assert.match(pagina, /destinoDelEnlace\(proposito, nivel\)/);
});

test('borrarSesionYContacto también borra la marca de la vista de Dirección', async () => {
  const { borrarSesionYContacto, COOKIE_VISTA_NOMBRE } = await import('../src/lib/fgrec-portal.ts');
  const borradas: string[] = [];
  borrarSesionYContacto({ delete: (nombre: string) => borradas.push(nombre), set: () => {} });
  assert.ok(borradas.includes(COOKIE_SESION_NOMBRE));
  assert.ok(borradas.includes(COOKIE_VISTA_NOMBRE));
  assert.equal(COOKIE_VISTA_NOMBRE, '__Host-fgrec_vista');
});
