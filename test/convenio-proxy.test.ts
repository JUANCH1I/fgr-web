import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manejarAceptacionConvenio, manejarPdfConvenio } from '../src/lib/convenio-proxy.ts';
import { llamarFGRECPortal, COOKIE_SESION_NOMBRE } from '../src/lib/fgrec-portal.ts';

const HASH = 'cd'.repeat(32);

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
  return new Request('https://www.fgrec.org/api/portal/convenio-aceptar', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-fgrec-portal': '1', origin: 'https://www.fgrec.org', 'x-forwarded-for': '1.2.3.4', 'user-agent': 'UA/1', ...headers },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)
  });
}

const peticionPdf = (query = '') =>
  new Request(`https://www.fgrec.org/api/portal/convenio-pdf${query}`, { method: 'GET', headers: { 'x-forwarded-for': '1.2.3.4', 'user-agent': 'UA/1' } });

test('aceptación: rechaza sin cabecera CSRF, sin sesión, con JSON inválido y con cuerpo incompleto, sin llamar a FGREC', async () => {
  let llamadas = 0;
  const llamar = (async () => { llamadas++; return { ok: true, status: 201, data: {} }; }) as any;
  const valido = { acepto: true, version: 1, sha256: HASH };

  const sinCsrf = await manejarAceptacionConvenio({ request: peticion(valido, { 'x-fgrec-portal': '0' }), cookies: cookiesFalsas('s'), llamar });
  assert.equal(sinCsrf.status, 403);
  const cruzado = await manejarAceptacionConvenio({ request: peticion(valido, { origin: 'https://otro.example' }), cookies: cookiesFalsas('s'), llamar });
  assert.equal(cruzado.status, 403);
  const sinSesion = await manejarAceptacionConvenio({ request: peticion(valido), cookies: cookiesFalsas(), llamar });
  assert.equal(sinSesion.status, 401);
  const malJson = await manejarAceptacionConvenio({ request: peticion('{no'), cookies: cookiesFalsas('s'), llamar });
  assert.equal(malJson.status, 400);
  for (const [cuerpo, campo] of [[{ version: 1, sha256: HASH }, 'acepto'], [{ acepto: false, version: 1, sha256: HASH }, 'acepto'], [{ acepto: true, sha256: HASH }, 'version'], [{ acepto: true, version: 1 }, 'sha256']] as const) {
    const res = await manejarAceptacionConvenio({ request: peticion(cuerpo), cookies: cookiesFalsas('s'), llamar });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).field, campo);
  }

  assert.equal(llamadas, 0);
  assert.equal(sinCsrf.headers.get('cache-control')?.includes('no-store'), true);
});

test('aceptación: reenvía solo acepto, versión y huella, con la sesión y el contexto del visitante', async () => {
  let recibido: any;
  const llamar = (async (o: any) => { recibido = o; return { ok: true, status: 201, data: { version: 1, estado: 'ACEPTADO', aceptadoEn: '2026-10-16T18:00:00.000Z' } }; }) as any;
  const res = await manejarAceptacionConvenio({ request: peticion({ acepto: true, version: 1, sha256: HASH, ip: '9.9.9.9', ua: 'otro' }), cookies: cookiesFalsas('tok-123'), llamar });
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { version: 1, estado: 'ACEPTADO', aceptadoEn: '2026-10-16T18:00:00.000Z' });
  assert.equal(recibido.metodo, 'POST');
  assert.equal(recibido.rutaRelativa, 'convenio/aceptar');
  assert.deepEqual(recibido.cuerpo, { acepto: true, version: 1, sha256: HASH });
  assert.equal(recibido.sesion, 'tok-123');
  // La IP y el navegador salen de la petición real, firmados por el sitio, nunca del cuerpo.
  assert.deepEqual(recibido.contexto, { ip: '1.2.3.4', ua: 'UA/1' });
});

test('aceptación: conserva status y código de FGREC; 401 borra la cookie', async () => {
  const casos: Array<[number, string]> = [[409, 'CONVENIO_CHANGED'], [409, 'CONVENIO_UNAVAILABLE'], [429, 'RATE_LIMITED'], [500, 'PDF_INTEGRITY'], [503, 'PORTAL_DISABLED'], [403, 'LEVEL_REQUIRED']];
  for (const [status, code] of casos) {
    const llamar = (async () => ({ ok: false, status, error: { code, message: 'msg' } })) as any;
    const c = cookiesFalsas('s');
    const res = await manejarAceptacionConvenio({ request: peticion({ acepto: true, version: 1, sha256: HASH }), cookies: c, llamar });
    assert.equal(res.status, status);
    assert.equal((await res.json()).code, code);
    assert.equal(c.llamadas.length, 0);
  }
  const c401 = cookiesFalsas('s');
  const llamar401 = (async () => ({ ok: false, status: 401, error: { code: 'SESSION_INVALID', message: 'x' } })) as any;
  const res = await manejarAceptacionConvenio({ request: peticion({ acepto: true, version: 1, sha256: HASH }), cookies: c401, llamar: llamar401 });
  assert.equal(res.status, 401);
  assert.ok(c401.llamadas.some((l) => l.m === 'set' && l.opts.maxAge === 0));
});

test('PDF: sin sesión es 401 y no llama a FGREC; con sesión reenvía los bytes tal cual, con sus cabeceras privadas', async () => {
  let llamadas = 0;
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]);
  const llamar = (async (o: any) => {
    llamadas++;
    assert.equal(o.metodo, 'GET');
    assert.equal(o.rutaRelativa, 'convenio/pdf');
    assert.equal(o.sesion, 'tok');
    return { ok: true, status: 200, archivo: { bytes, tipo: 'application/pdf', sha256: HASH, nombreArchivo: 'convenio-FGREC-UY-PSICOM-2026-000001-v1.pdf' } };
  }) as any;

  const sinSesion = await manejarPdfConvenio({ request: peticionPdf(), cookies: cookiesFalsas(), llamar });
  assert.equal(sinSesion.status, 401);
  assert.equal(llamadas, 0);

  const res = await manejarPdfConvenio({ request: peticionPdf(), cookies: cookiesFalsas('tok'), llamar });
  assert.equal(res.status, 200);
  assert.deepEqual(new Uint8Array(await res.arrayBuffer()), bytes);
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  assert.equal(res.headers.get('content-disposition'), 'inline; filename="convenio-FGREC-UY-PSICOM-2026-000001-v1.pdf"');
  assert.equal(res.headers.get('x-content-sha256'), HASH);
  assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.match(res.headers.get('cache-control') || '', /no-store/);

  const descarga = await manejarPdfConvenio({ request: peticionPdf('?descargar=1'), cookies: cookiesFalsas('tok'), llamar });
  assert.match(descarga.headers.get('content-disposition') || '', /^attachment;/);
});

test('PDF: los errores de FGREC llegan como JSON con su status; 401 borra la cookie', async () => {
  const c = cookiesFalsas('s');
  const noHay = (async () => ({ ok: false, status: 404, error: { code: 'CONVENIO_UNAVAILABLE', message: 'Todavía no hay un convenio.' } })) as any;
  const res = await manejarPdfConvenio({ request: peticionPdf(), cookies: c, llamar: noHay });
  assert.equal(res.status, 404);
  assert.equal((await res.json()).code, 'CONVENIO_UNAVAILABLE');
  assert.match(res.headers.get('content-type') || '', /json/);

  const c401 = cookiesFalsas('s');
  const vencida = (async () => ({ ok: false, status: 401, error: { code: 'SESSION_INVALID', message: 'x' } })) as any;
  assert.equal((await manejarPdfConvenio({ request: peticionPdf(), cookies: c401, llamar: vencida })).status, 401);
  assert.ok(c401.llamadas.some((l) => l.m === 'set' && l.opts.maxAge === 0));

  const sinArchivo = (async () => ({ ok: true, status: 200, data: {} })) as any;
  assert.equal((await manejarPdfConvenio({ request: peticionPdf(), cookies: cookiesFalsas('s'), llamar: sinArchivo })).status, 502);
});

test('las llamadas reales van firmadas hacia FGREC y el PDF vuelve como archivo', async () => {
  process.env.FGREC_PORTAL_URL = 'http://fgrec.test/fgrec/api/portal';
  process.env.FGREC_PORTAL_SECRET = 'secreto-de-prueba-0123456789';
  const original = globalThis.fetch;
  const llamadas: Array<{ url: string; init: any }> = [];
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 9]);
  globalThis.fetch = (async (u: any, i: any) => {
    llamadas.push({ url: String(u), init: i });
    if (String(u).endsWith('/convenio/pdf')) {
      return new Response(pdf, { status: 200, headers: { 'content-type': 'application/pdf', 'x-content-sha256': HASH, 'content-disposition': 'attachment; filename="convenio-v1.pdf"' } });
    }
    return new Response(JSON.stringify({ version: 1, estado: 'ACEPTADO', aceptadoEn: '2026-10-16T18:00:00.000Z' }), { status: 201, headers: { 'content-type': 'application/json' } });
  }) as any;
  try {
    const aceptada = await manejarAceptacionConvenio({ request: peticion({ acepto: true, version: 1, sha256: HASH }), cookies: cookiesFalsas('sesion-xyz'), llamar: llamarFGRECPortal });
    assert.equal(aceptada.status, 201);
    assert.equal(llamadas[0].url, 'http://fgrec.test/fgrec/api/portal/convenio/aceptar');
    assert.equal(llamadas[0].init.method, 'POST');
    assert.equal(llamadas[0].init.body, JSON.stringify({ acepto: true, version: 1, sha256: HASH }));
    assert.match(llamadas[0].init.headers['Idempotency-Key'], /^[0-9a-f-]{36}$/);
    assert.equal(llamadas[0].init.headers['X-FGREC-Session'], 'sesion-xyz');
    assert.ok(Object.keys(llamadas[0].init.headers).some((k) => /signature/i.test(k)), 'debe llevar cabecera de firma');

    const descargada = await manejarPdfConvenio({ request: peticionPdf(), cookies: cookiesFalsas('sesion-xyz'), llamar: llamarFGRECPortal });
    assert.equal(descargada.status, 200);
    assert.equal(llamadas[1].url, 'http://fgrec.test/fgrec/api/portal/convenio/pdf');
    assert.equal(llamadas[1].init.method, 'GET');
    assert.equal(llamadas[1].init.headers['Idempotency-Key'], undefined);
    assert.deepEqual(new Uint8Array(await descargada.arrayBuffer()), pdf);
    assert.equal(descargada.headers.get('x-content-sha256'), HASH);
    assert.equal(descargada.headers.get('content-disposition'), 'inline; filename="convenio-v1.pdf"');
  } finally {
    globalThis.fetch = original;
  }
});
