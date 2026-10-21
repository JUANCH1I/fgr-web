import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manejarLecturaDatos, manejarGuardadoDatos, manejarAvisoNombre } from '../src/lib/datos-proxy.ts';
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

function peticion(ruta: string, cuerpo: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://www.fgrec.org/api/portal/${ruta}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-fgrec-portal': '1', origin: 'https://www.fgrec.org', 'x-forwarded-for': '1.2.3.4', 'user-agent': 'UA/1', ...headers },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)
  });
}

const lectura = () => new Request('https://www.fgrec.org/api/portal/datos', { method: 'GET', headers: { 'x-forwarded-for': '1.2.3.4', 'user-agent': 'UA/1' } });

const DATOS = { nombre: 'Ana', apellido: 'Paz', email: 'a@x.ec', telefono: '+593999', documento: '0912345678', fechaNacimiento: '1990-05-01', documentoEditable: true };

test('guardar: rechaza sin CSRF, sin sesión, con JSON inválido y con cuerpo vacío o inválido, sin llamar a FGREC', async () => {
  let llamadas = 0;
  const llamar = (async () => { llamadas++; return { ok: true, status: 200, data: DATOS }; }) as any;
  const valido = { documento: '0912345678' };

  assert.equal((await manejarGuardadoDatos({ request: peticion('datos', valido, { 'x-fgrec-portal': '0' }), cookies: cookiesFalsas('s'), llamar })).status, 403);
  assert.equal((await manejarGuardadoDatos({ request: peticion('datos', valido, { origin: 'https://otro.example' }), cookies: cookiesFalsas('s'), llamar })).status, 403);
  assert.equal((await manejarGuardadoDatos({ request: peticion('datos', valido), cookies: cookiesFalsas(), llamar })).status, 401);
  assert.equal((await manejarGuardadoDatos({ request: peticion('datos', '{no'), cookies: cookiesFalsas('s'), llamar })).status, 400);
  const vacio = await manejarGuardadoDatos({ request: peticion('datos', {}), cookies: cookiesFalsas('s'), llamar });
  assert.equal(vacio.status, 400);
  const mala = await manejarGuardadoDatos({ request: peticion('datos', { fechaNacimiento: 'ayer' }), cookies: cookiesFalsas('s'), llamar });
  assert.equal(mala.status, 400);
  assert.equal((await mala.json()).field, 'fechaNacimiento');

  assert.equal(llamadas, 0);
});

test('guardar: reenvía solo documento y fecha, con la sesión y el contexto del visitante; devuelve el cuerpo de FGREC', async () => {
  let recibido: any;
  const llamar = (async (o: any) => { recibido = o; return { ok: true, status: 200, data: DATOS }; }) as any;
  const res = await manejarGuardadoDatos({ request: peticion('datos', { documento: ' 0912345678 ', fechaNacimiento: '1990-05-01', pais: 'EC' }), cookies: cookiesFalsas('tok-1'), llamar });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), DATOS);
  assert.equal(recibido.metodo, 'POST');
  assert.equal(recibido.rutaRelativa, 'datos');
  assert.deepEqual(recibido.cuerpo, { documento: '0912345678', fechaNacimiento: '1990-05-01' });
  assert.equal(recibido.sesion, 'tok-1');
  assert.deepEqual(recibido.contexto, { ip: '1.2.3.4', ua: 'UA/1' });
});

test('guardar y aviso: conservan status y código de FGREC; 401 borra la cookie', async () => {
  const casos: Array<[number, string]> = [[409, 'DOCUMENT_LOCKED'], [409, 'COUNTRY_REQUIRED'], [409, 'DOCUMENT_REVIEW'], [400, 'INVALID_INPUT'], [429, 'RATE_LIMITED']];
  for (const [status, code] of casos) {
    const llamar = (async () => ({ ok: false, status, error: { code, message: 'msg', field: 'documento' } })) as any;
    const c = cookiesFalsas('s');
    const res = await manejarGuardadoDatos({ request: peticion('datos', { documento: '1' }), cookies: c, llamar });
    assert.equal(res.status, status);
    const cuerpo = await res.json();
    assert.equal(cuerpo.code, code);
    assert.equal(cuerpo.message, 'msg');
    assert.equal(c.llamadas.length, 0);
  }
  const llamar401 = (async () => ({ ok: false, status: 401, error: { code: 'SESSION_INVALID', message: 'x' } })) as any;
  for (const [fn, ruta, cuerpo] of [[manejarGuardadoDatos, 'datos', { documento: '1' }], [manejarAvisoNombre, 'datos/nombre', {}]] as const) {
    const c = cookiesFalsas('s');
    assert.equal((await fn({ request: peticion(ruta, cuerpo), cookies: c, llamar: llamar401 })).status, 401);
    assert.ok(c.llamadas.some((l) => l.m === 'set' && l.opts.maxAge === 0));
  }
});

test('aviso de nombre: CSRF y sesión obligatorios; reenvía solo el comentario recortado y valida el tope de 500', async () => {
  let llamadas = 0;
  let recibido: any;
  const llamar = (async (o: any) => { llamadas++; recibido = o; return { ok: true, status: 200, data: { avisado: true } }; }) as any;

  assert.equal((await manejarAvisoNombre({ request: peticion('datos/nombre', {}, { 'x-fgrec-portal': '0' }), cookies: cookiesFalsas('s'), llamar })).status, 403);
  assert.equal((await manejarAvisoNombre({ request: peticion('datos/nombre', {}), cookies: cookiesFalsas(), llamar })).status, 401);
  const largo = await manejarAvisoNombre({ request: peticion('datos/nombre', { comentario: 'x'.repeat(501) }), cookies: cookiesFalsas('s'), llamar });
  assert.equal(largo.status, 400);
  assert.equal((await largo.json()).field, 'comentario');
  assert.equal(llamadas, 0);

  const res = await manejarAvisoNombre({ request: peticion('datos/nombre', { comentario: '  Es con v  ', otro: 1 }), cookies: cookiesFalsas('tok-2'), llamar });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { avisado: true });
  assert.equal(recibido.metodo, 'POST');
  assert.equal(recibido.rutaRelativa, 'datos/nombre');
  assert.deepEqual(recibido.cuerpo, { comentario: 'Es con v' });
  assert.equal(recibido.sesion, 'tok-2');

  await manejarAvisoNombre({ request: peticion('datos/nombre', {}), cookies: cookiesFalsas('tok-2'), llamar });
  assert.deepEqual(recibido.cuerpo, {});
});

test('lectura: sin sesión es 401 sin llamar a FGREC; con sesión hace GET datos y no exige CSRF', async () => {
  let llamadas = 0;
  let recibido: any;
  const llamar = (async (o: any) => { llamadas++; recibido = o; return { ok: true, status: 200, data: DATOS }; }) as any;
  assert.equal((await manejarLecturaDatos({ request: lectura(), cookies: cookiesFalsas(), llamar })).status, 401);
  assert.equal(llamadas, 0);
  const res = await manejarLecturaDatos({ request: lectura(), cookies: cookiesFalsas('tok'), llamar });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), DATOS);
  assert.equal(recibido.metodo, 'GET');
  assert.equal(recibido.rutaRelativa, 'datos');
  assert.equal(recibido.cuerpo, undefined);
  assert.match(res.headers.get('cache-control') || '', /no-store/);
});

test('las llamadas reales van firmadas hacia FGREC con el método, la ruta y el cuerpo correctos', async () => {
  process.env.FGREC_PORTAL_URL = 'http://fgrec.test/fgrec/api/portal';
  process.env.FGREC_PORTAL_SECRET = 'secreto-de-prueba-0123456789';
  const original = globalThis.fetch;
  const llamadas: Array<{ url: string; init: any }> = [];
  globalThis.fetch = (async (u: any, i: any) => {
    llamadas.push({ url: String(u), init: i });
    const cuerpo = String(u).endsWith('/datos/nombre') ? { avisado: true } : DATOS;
    return new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as any;
  try {
    const guardado = await manejarGuardadoDatos({ request: peticion('datos', { documento: '0912345678' }), cookies: cookiesFalsas('sesion-xyz'), llamar: llamarFGRECPortal });
    assert.equal(guardado.status, 200);
    assert.equal(llamadas[0].url, 'http://fgrec.test/fgrec/api/portal/datos');
    assert.equal(llamadas[0].init.method, 'POST');
    assert.equal(llamadas[0].init.body, JSON.stringify({ documento: '0912345678' }));
    assert.equal(llamadas[0].init.headers['X-FGREC-Session'], 'sesion-xyz');
    assert.ok(Object.keys(llamadas[0].init.headers).some((k) => /signature/i.test(k)), 'debe llevar cabecera de firma');

    const leido = await manejarLecturaDatos({ request: lectura(), cookies: cookiesFalsas('sesion-xyz'), llamar: llamarFGRECPortal });
    assert.deepEqual(await leido.json(), DATOS);
    assert.equal(llamadas[1].url, 'http://fgrec.test/fgrec/api/portal/datos');
    assert.equal(llamadas[1].init.method, 'GET');

    const aviso = await manejarAvisoNombre({ request: peticion('datos/nombre', { comentario: 'hola' }), cookies: cookiesFalsas('sesion-xyz'), llamar: llamarFGRECPortal });
    assert.deepEqual(await aviso.json(), { avisado: true });
    assert.equal(llamadas[2].url, 'http://fgrec.test/fgrec/api/portal/datos/nombre');
    assert.equal(llamadas[2].init.body, JSON.stringify({ comentario: 'hola' }));
  } finally {
    globalThis.fetch = original;
  }
});
