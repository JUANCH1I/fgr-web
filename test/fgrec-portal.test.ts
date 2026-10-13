import { test } from 'node:test';
import assert from 'node:assert/strict';
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
