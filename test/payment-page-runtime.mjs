// Run after npm run build. Tests the compiled Astro/Vercel application, not source strings.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.FGREC_PORTAL_URL = 'https://payments-runtime.test/api/portal';
process.env.FGREC_PORTAL_SECRET = 'runtime-test-not-a-production-secret';
process.env.FGREC_UPLOAD_ORIGIN = 'https://payments-upload.test';
const { default: app } = await import('../.vercel/output/_functions/entry.mjs');
const originalFetch = globalThis.fetch;
const context = {
  pagos: [{ id: 15, cotizacion: 'Q-1', estado: 'REGISTRADO', estadoTexto: 'Pendiente de confirmación', importeCentavos: 12345, moneda: 'USD', fechaPago: '2026-10-10', referencia: '<img src=x onerror=alert(1)>', medioPago: 'Transferencia', registradoEn: '2026-10-16T12:00:00Z', comprobanteRecibido: true, motivo: null, staff: 'PRIVATE-STAFF', fee: 'PRIVATE-FEE' }],
  cotizaciones: [{ id: 7, codigo: 'Q-1' }, { id: 8, codigo: 'Q-2' }],
  medios: [{ id: 2, nombre: 'Transferencia', moneda: 'USD' }, { id: 4, nombre: 'Otro medio', moneda: 'EUR' }],
  cuentas: [{ id: 3, nombre: 'Cuenta institucional', banco: 'Banco', moneda: 'USD', numero: 'PRIVATE-ACCOUNT' }],
  puedeRegistrar: true, maxBytes: 10485760
};
const sessionHeaders = { cookie: '__Host-fgrec_sesion=runtime-session', 'x-forwarded-for': '192.0.2.10' };
const pageRequest = (headers = sessionHeaders) => new Request('https://www.fgrec.org/mi-postulacion/pagos/', { headers });
let backendStatus = 200;
let backendData = context;
const signedCalls = [];
globalThis.fetch = async (url, init) => {
  assert.match(String(url), /^https:\/\/payments-runtime\.test\/api\/portal\//);
  signedCalls.push({ url: String(url), init });
  assert.equal(init.headers['X-FGREC-Session'], 'runtime-session');
  assert.ok(Object.keys(init.headers).some(key => /signature/i.test(key)));
  return new Response(JSON.stringify(backendData), { status: backendStatus, headers: { 'content-type': 'application/json' } });
};

test('compiled payments page and API routes preserve portal authentication, presentation and privacy', async t => {
  try {
    await t.test('anonymous page redirects before backend access', async () => {
      const result = await app.fetch(pageRequest({}));
      assert.equal(result.status, 302); assert.equal(result.headers.get('location'), '/mi-postulacion/ingresar');
      assert.equal(signedCalls.length, 0);
    });
    await t.test('level-two page renders accessible Spanish form, exact amount and escaped receipt metadata', async () => {
      const result = await app.fetch(pageRequest());
      const html = await result.text();
      assert.equal(result.status, 200); assert.match(result.headers.get('cache-control'), /no-store/);
      assert.match(html, /<h1[^>]*>Mis pagos<\/h1>/); assert.match(html, /USD 123,45/); assert.match(html, /Pendiente de confirmación/);
      for (const id of ['payment-quote', 'payment-method', 'payment-account', 'payment-amount', 'payment-currency', 'payment-date', 'payment-reference', 'payment-receipt']) {
        assert.ok(html.includes(`for="${id}"`), `explicit label ${id}`); assert.ok(html.includes(`id="${id}"`));
      }
      assert.match(html, /role="status"/); assert.match(html, /role="alert"/); assert.match(html, /inputmode="decimal"/);
      assert.match(html, /Selecciona la cotización/); assert.ok(!html.includes('Otro medio'), 'hide methods with no compatible receiving account');
      assert.ok(!html.includes('<img src=x onerror=alert(1)>')); assert.ok(html.includes('&lt;img'));
      for (const secret of ['PRIVATE-STAFF', 'PRIVATE-FEE', 'PRIVATE-ACCOUNT']) assert.ok(!html.includes(secret));
      assert.match(html, /<script type="module"[^>]*src=/);
    });
    await t.test('missing eligible quote and missing catalog keep history without a dead form', async () => {
      for (const patch of [{ cotizaciones: [] }, { cuentas: [] }, { puedeRegistrar: false }]) {
        backendData = { ...context, ...patch };
        const html = await (await app.fetch(pageRequest())).text();
        assert.ok(html.includes('payment-list')); assert.ok(!html.includes('id="payment-form"'));
        assert.match(html, /asesora institucional/);
      }
      backendData = context;
    });
    await t.test('expired session clears secure cookie and insufficient level redirects to verification', async () => {
      backendStatus = 401; backendData = { code: 'SESSION_INVALID', message: 'Sesión vencida' };
      const expired = await app.fetch(pageRequest());
      assert.equal(expired.status, 302); assert.equal(expired.headers.get('location'), '/mi-postulacion/ingresar');
      assert.match(expired.headers.get('set-cookie'), /Secure/); assert.match(expired.headers.get('set-cookie'), /Max-Age=0/);
      backendStatus = 403; backendData = { code: 'LEVEL_REQUIRED', message: 'Verifica tu acceso' };
      const level = await app.fetch(pageRequest());
      assert.equal(level.status, 302); assert.equal(level.headers.get('location'), '/mi-postulacion/codigo');
    });
    await t.test('rate limit and service outages render actionable states, not an empty report form', async () => {
      for (const [status, title] of [[429, 'Demasiados intentos'], [503, 'Servicio no disponible']]) {
        backendStatus = status; backendData = { code: 'UNAVAILABLE', message: 'Seguro' };
        const html = await (await app.fetch(pageRequest())).text();
        assert.ok(html.includes(title)); assert.ok(!html.includes('id="payment-form"'));
      }
    });
    await t.test('compiled GET proxy returns only public fields and POST enforces CSRF', async () => {
      backendStatus = 200; backendData = context;
      const result = await app.fetch(new Request('https://www.fgrec.org/api/portal/pagos/', { headers: sessionHeaders }));
      assert.equal(result.status, 200); assert.match(result.headers.get('cache-control'), /no-store/);
      assert.ok(!(await result.text()).includes('PRIVATE-'));
      const blocked = await app.fetch(new Request('https://www.fgrec.org/api/portal/pagos/subida/', { method: 'POST', headers: sessionHeaders, body: '{}' }));
      assert.equal(blocked.status, 403);
      assert.equal((await blocked.json()).code, 'CSRF_INVALID');
    });
  } finally { globalThis.fetch = originalFetch; }
});
