import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manejarEscrituraCarta, prepararCuerpoCarta } from '../src/lib/carta-proxy.ts';
import { llamarFGRECPortal, COOKIE_SESION_NOMBRE } from '../src/lib/fgrec-portal.ts';

function cookiesFalsas(sesion?: string) {
  const llamadas: any[] = [];
  return {
    llamadas,
    get: (n: string) => (n === COOKIE_SESION_NOMBRE && sesion ? { value: sesion } : undefined),
    delete: (name: string, opts: any) => llamadas.push({ m: 'delete', name, opts }),
    set: (name: string, val: string, opts: any) => llamadas.push({ m: 'set', name, val, opts })
  };
}

function peticion(cuerpo: unknown, headers: Record<string, string> = {}) {
  return new Request('https://www.fgrec.org/api/portal/carta-borrador', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-fgrec-portal': '1', origin: 'https://www.fgrec.org', 'x-forwarded-for': '1.2.3.4', 'user-agent': 'UA/1', ...headers },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)
  });
}

test('prepararCuerpoCarta: borrador admite vacío; envío lo rechaza; ambos topan en 100.000', () => {
  assert.deepEqual(prepararCuerpoCarta('carta/borrador', { texto: '' }), { ok: true, cuerpo: { texto: '' } });
  assert.equal(prepararCuerpoCarta('carta/borrador', {}).ok, false);
  assert.equal(prepararCuerpoCarta('carta/borrador', { texto: 'a'.repeat(100_001) }).ok, false);
  assert.equal(prepararCuerpoCarta('carta/borrador', { texto: 'a'.repeat(100_000) }).ok, true);
  assert.equal(prepararCuerpoCarta('carta/enviar', { texto: '  \n ' }).ok, false);
  assert.equal(prepararCuerpoCarta('carta/enviar', {}).ok, false);
  assert.equal(prepararCuerpoCarta('carta/enviar', { texto: 'Hola\nmundo' }).ok, true);
});

test('proxy: rechaza sin cabecera CSRF, sin sesión y con JSON inválido, sin llamar a FGREC', async () => {
  let llamadas = 0;
  const llamar = (async () => { llamadas++; return { ok: true, status: 200, data: {} }; }) as any;

  const sinCsrf = await manejarEscrituraCarta({ ruta: 'carta/borrador', request: peticion({ texto: 'a' }, { 'x-fgrec-portal': '0' }), cookies: cookiesFalsas('s'), llamar });
  assert.equal(sinCsrf.status, 403);

  const sinSesion = await manejarEscrituraCarta({ ruta: 'carta/borrador', request: peticion({ texto: 'a' }), cookies: cookiesFalsas(), llamar });
  assert.equal(sinSesion.status, 401);

  const malJson = await manejarEscrituraCarta({ ruta: 'carta/borrador', request: peticion('{no'), cookies: cookiesFalsas('s'), llamar });
  assert.equal(malJson.status, 400);

  const vacia = await manejarEscrituraCarta({ ruta: 'carta/enviar', request: peticion({ texto: '   ' }), cookies: cookiesFalsas('s'), llamar });
  assert.equal(vacia.status, 400);
  assert.equal((await vacia.json()).field, 'texto');

  assert.equal(llamadas, 0);
  assert.equal(sinCsrf.headers.get('cache-control')?.includes('no-store'), true);
});

test('proxy: reenvía solo el texto, con sesión y contexto del visitante', async () => {
  let recibido: any;
  const llamar = (async (o: any) => { recibido = o; return { ok: true, status: 200, data: { version: 1, estado: 'BORRADOR', caracteres: 4 } }; }) as any;
  const res = await manejarEscrituraCarta({ ruta: 'carta/borrador', request: peticion({ texto: 'hola', extra: 'x' }), cookies: cookiesFalsas('tok-123'), llamar });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { version: 1, estado: 'BORRADOR', caracteres: 4 });
  assert.equal(recibido.metodo, 'POST');
  assert.equal(recibido.rutaRelativa, 'carta/borrador');
  assert.deepEqual(recibido.cuerpo, { texto: 'hola' });
  assert.equal(recibido.sesion, 'tok-123');
  assert.deepEqual(recibido.contexto, { ip: '1.2.3.4', ua: 'UA/1' });
});

test('proxy: mapea errores de FGREC conservando status y código; 401 borra la cookie', async () => {
  const casos: Array<[number, string]> = [[409, 'LETTER_SENT'], [409, 'COUNTRY_REQUIRED'], [429, 'RATE_LIMITED'], [413, 'PAYLOAD_TOO_LARGE'], [503, 'PORTAL_DISABLED']];
  for (const [status, code] of casos) {
    const llamar = (async () => ({ ok: false, status, error: { code, message: 'msg' } })) as any;
    const c = cookiesFalsas('s');
    const res = await manejarEscrituraCarta({ ruta: 'carta/enviar', request: peticion({ texto: 'Mi carta' }), cookies: c, llamar });
    assert.equal(res.status, status);
    assert.equal((await res.json()).code, code);
    assert.equal(c.llamadas.length, 0);
  }

  const c401 = cookiesFalsas('s');
  const llamar401 = (async () => ({ ok: false, status: 401, error: { code: 'SESSION_INVALID', message: 'x' } })) as any;
  const res = await manejarEscrituraCarta({ ruta: 'carta/borrador', request: peticion({ texto: 'a' }), cookies: c401, llamar: llamar401 });
  assert.equal(res.status, 401);
  assert.ok(c401.llamadas.some((l) => l.m === 'set' && l.opts.maxAge === 0));
});

test('proxy: la llamada real va firmada (sesión, ruta y Idempotency-Key) hacia FGREC', async () => {
  process.env.FGREC_PORTAL_URL = 'http://fgrec.test/fgrec/api/portal';
  process.env.FGREC_PORTAL_SECRET = 'secreto-de-prueba-0123456789';
  const original = globalThis.fetch;
  let url = '';
  let init: any;
  globalThis.fetch = (async (u: any, i: any) => {
    url = String(u);
    init = i;
    return new Response(JSON.stringify({ version: 1, estado: 'ENVIADA', enviadaEn: '2026-10-16T12:00:00.000Z' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as any;
  try {
    const res = await manejarEscrituraCarta({ ruta: 'carta/enviar', request: peticion({ texto: 'Mi carta' }), cookies: cookiesFalsas('sesion-xyz'), llamar: llamarFGRECPortal });
    assert.equal(res.status, 200);
    assert.equal(url, 'http://fgrec.test/fgrec/api/portal/carta/enviar');
    assert.equal(init.method, 'POST');
    assert.equal(init.body, JSON.stringify({ texto: 'Mi carta' }));
    const h = init.headers;
    assert.match(h['Idempotency-Key'], /^[0-9a-f-]{36}$/);
    assert.equal(h['X-FGREC-Session'], 'sesion-xyz');
    assert.ok(Object.keys(h).some((k) => /signature/i.test(k)), 'debe llevar cabecera de firma');
  } finally {
    globalThis.fetch = original;
  }
});
