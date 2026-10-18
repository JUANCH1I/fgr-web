import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handlePaymentProxy } from '../src/lib/payment-proxy.ts';
import { COOKIE_SESION_NOMBRE } from '../src/lib/fgrec-portal.ts';
import { GET } from '../src/pages/api/portal/pagos/index.ts';
import { POST } from '../src/pages/api/portal/pagos/subida.ts';

const body = { cotizacionId: 1, medioPagoId: 2, cuentaReceptoraId: 3, importeBrutoCentavos: 12345, moneda: 'USD', fechaPago: '2026-10-10', referencia: 'OP-123', nombreArchivo: 'recibo.pdf', tipo: 'application/pdf', tamano: 300 };
const catalog = { pagos: [], cotizaciones: [], medios: [], cuentas: [], puedeRegistrar: false, maxBytes: 10485760 };
function cookies(session = 'session-test') {
  const cleared: any[] = [];
  return { cleared, get: (name: string) => name === COOKIE_SESION_NOMBRE && session ? { value: session } : undefined, delete: (...args: any[]) => { cleared.push(args); }, set: (...args: any[]) => { cleared.push(args); } };
}
function request(payload: unknown = body, headers: Record<string, string> = {}) {
  return new Request('https://www.fgrec.org/api/portal/pagos/subida', { method: 'POST', headers: { 'content-type': 'application/json', 'x-fgrec-portal': '1', origin: 'https://www.fgrec.org', 'x-forwarded-for': '192.0.2.5, 192.0.2.9', 'user-agent': 'PaymentTest/1', ...headers }, body: typeof payload === 'string' ? payload : JSON.stringify(payload) });
}

test('payment proxy requires cookie session and mutation CSRF before contacting backend', async () => {
  let calls = 0;
  const call = (async () => { calls++; throw new Error('unexpected'); }) as any;
  for (const opts of [ { request: request(body, { origin: 'https://evil.test' }), cookies: cookies(), authorize: true }, { request: request(body, { 'x-fgrec-portal': '' }), cookies: cookies(), authorize: true } ]) assert.equal((await handlePaymentProxy({ ...opts, call })).status, 403);
  assert.equal((await handlePaymentProxy({ request: request(), cookies: cookies(''), authorize: true, call })).status, 401);
  assert.equal((await GET({ request: new Request('https://www.fgrec.org/api/portal/pagos'), cookies: cookies('') } as any)).status, 401);
  assert.equal(calls, 0);
});

test('payment proxy validates JSON, file metadata, extra fields and body size locally', async () => {
  let calls = 0;
  const call = (async () => { calls++; throw new Error('unexpected'); }) as any;
  for (const payload of ['{', ' '.repeat(8193), { ...body, tamano: 10485761 }, { ...body, tipo: 'text/html' }, { ...body, estado: 'CONFIRMADO' }]) {
    const result = await handlePaymentProxy({ request: request(payload), cookies: cookies(), authorize: true, call, uploadOrigin: 'https://upload.test' });
    assert.equal(result.status, 400);
  }
  assert.equal(calls, 0);
});

test('payment proxy forwards signed context, selected IDs and exact cents to authorization', async () => {
  let received: any;
  const call = (async (options: any) => { received = options; return { ok: true, status: 200, data: { token: 'secret', url: 'https://upload.test/fgrec/api/portal/pagos/subidas', tipo: 'application/pdf', expira: '2026-10-16T23:00:00Z', maxBytes: 10485760, internal: 'never' } }; }) as any;
  const response = await handlePaymentProxy({ request: request(), cookies: cookies(), authorize: true, call, uploadOrigin: 'https://upload.test' });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store, no-cache, must-revalidate');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.deepEqual(received, { metodo: 'POST', rutaRelativa: 'pagos/subida', cuerpo: body, sesion: 'session-test', contexto: { ip: '192.0.2.5', ua: 'PaymentTest/1' } });
  assert.equal((await response.json()).internal, undefined);
});

test('payment authorization rejects unapproved origin, credentials, query tokens and wrong upload path', async () => {
  for (const url of ['https://evil.test/fgrec/api/portal/pagos/subidas', 'https://upload.test/other', 'https://user:pass@upload.test/api/portal/pagos/subidas', 'https://upload.test/api/portal/pagos/subidas?token=secret', 'http://upload.test/api/portal/pagos/subidas']) {
    const call = (async () => ({ ok: true, status: 200, data: { url, token: 'secret' } })) as any;
    const response = await handlePaymentProxy({ request: request(), cookies: cookies(), authorize: true, call, uploadOrigin: 'https://upload.test' });
    assert.equal(response.status, 502, url);
    assert.equal((await response.text()).includes('secret'), false);
  }
});

test('payment proxy preserves level, validation, conflict, rate and scanner errors; revokes cookie on session expiry', async () => {
  for (const [status, code] of [[401, 'SESSION_INVALID'], [403, 'LEVEL_REQUIRED'], [404, 'NOT_FOUND'], [409, 'ALREADY_PROCESSED'], [422, 'INVALID_INPUT'], [429, 'RATE_LIMITED'], [503, 'SCAN_UNAVAILABLE']] as const) {
    const jar = cookies();
    const call = (async () => ({ ok: false, status, error: { code, message: 'Mensaje seguro' } })) as any;
    const response = await handlePaymentProxy({ request: request(), cookies: jar, authorize: true, call, uploadOrigin: 'https://upload.test' });
    assert.equal(response.status, status); assert.equal((await response.json()).code, code);
    assert.equal(jar.cleared.length > 0, status === 401);
  }
});

test('payment endpoint wrappers call real signed client with session, HMAC, IP and new idempotency key', async () => {
  const env = { ...process.env };
  const original = globalThis.fetch;
  process.env.FGREC_PORTAL_URL = 'https://backend.test/fgrec/api/portal'; process.env.FGREC_PORTAL_SECRET = 'test-secret-payment-0123456789'; process.env.FGREC_UPLOAD_ORIGIN = 'https://upload.test';
  const calls: { url: string; init: any }[] = [];
  globalThis.fetch = (async (url: any, init: any) => { calls.push({ url: String(url), init }); return new Response(JSON.stringify(init.method === 'GET' ? catalog : { token: 'secret', url: 'https://upload.test/api/portal/pagos/subidas', tipo: 'application/pdf', maxBytes: 10485760 }), { headers: { 'content-type': 'application/json' } }); }) as any;
  try {
    assert.equal((await GET({ request: request(), cookies: cookies() } as any)).status, 200);
    assert.equal((await POST({ request: request(), cookies: cookies() } as any)).status, 200);
    assert.equal((await POST({ request: request(), cookies: cookies() } as any)).status, 200);
    assert.equal(calls[0].url, 'https://backend.test/fgrec/api/portal/pagos');
    assert.equal(calls[1].url, 'https://backend.test/fgrec/api/portal/pagos/subida');
    assert.equal(calls[1].init.headers['X-FGREC-Session'], 'session-test');
    assert.ok(Object.keys(calls[1].init.headers).some(key => /signature/i.test(key)));
    assert.match(calls[1].init.headers['Idempotency-Key'], /^[0-9a-f-]{36}$/);
    assert.notEqual(calls[1].init.headers['Idempotency-Key'], calls[2].init.headers['Idempotency-Key']);
    assert.deepEqual(JSON.parse(calls[1].init.body), body);
  } finally { globalThis.fetch = original; process.env = env; }
});
