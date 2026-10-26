import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reportPayment, PaymentUploadError } from '../src/lib/payment-upload.ts';
const file = new File(['%PDF-test'], 'recibo.pdf', { type: 'application/pdf' });
const authorization = () => new Response(JSON.stringify({ token: 'one-use-secret', url: 'https://upload.test/api/portal/pagos/subidas', tipo: 'application/pdf', maxBytes: 10485760 }));

test('report payment authorizes JSON then uploads raw file once with bearer token, never query or cookies', async () => {
  const calls: any[] = []; const progress: string[] = [];
  const fakeFetch = (async (url: any, init: any) => { calls.push({ url, init }); return calls.length === 1 ? authorization() : new Response(JSON.stringify({ pagoId: 19, estado: 'REGISTRADO' }), { status: 202 }); }) as any;
  assert.deepEqual(await reportPayment({ nombreArchivo: 'recibo.pdf', tipo: 'application/pdf', tamano: 9 }, file, { fetch: fakeFetch, onProgress: message => progress.push(message) }), { pagoId: 19, estado: 'REGISTRADO' });
  assert.equal(calls.length, 2); assert.equal(progress.length, 2);
  assert.equal(calls[0].url, '/api/portal/pagos/subida'); assert.equal(calls[0].init.headers['X-FGREC-Portal'], '1');
  assert.equal(calls[1].init.body, file); assert.equal(calls[1].init.credentials, 'omit'); assert.equal(calls[1].init.redirect, 'error');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer one-use-secret');
  assert.equal(calls[1].init.headers['Content-Length'], undefined, 'browser computes content length');
  assert.deepEqual(JSON.parse(calls[0].init.body), { nombreArchivo: 'recibo.pdf', tipo: 'application/pdf', tamano: 9 });
});

test('authorization session, level and rate errors never upload a receipt', async () => {
  for (const [status, code] of [[401, 'SESSION_INVALID'], [403, 'LEVEL_REQUIRED'], [429, 'RATE_LIMITED']] as const) {
    let calls = 0;
    const fakeFetch = (async () => { calls++; return new Response(JSON.stringify({ code, message: 'Seguro' }), { status }); }) as any;
    await assert.rejects(reportPayment({}, file, { fetch: fakeFetch }), (error: any) => error instanceof PaymentUploadError && error.status === status && !error.ambiguous);
    assert.equal(calls, 1);
  }
});

test('uncertain upload timeout or server failure never retries authorization or upload', async () => {
  for (const behavior of ['timeout', 'server', 'malformed-success']) {
    let calls = 0;
    const fakeFetch = (async () => { calls++; if (calls === 1) return authorization(); if (behavior === 'timeout') throw new Error('AbortError'); return behavior === 'server' ? new Response('{}', { status: 503 }) : new Response('{}', { status: 202 }); }) as any;
    await assert.rejects(reportPayment({}, file, { fetch: fakeFetch }), (error: any) => error instanceof PaymentUploadError && error.ambiguous);
    assert.equal(calls, 2);
  }
});

test('invalid type, token, size and scan failures remain errors without retry', async () => {
  for (const [status, code] of [[401, 'UPLOAD_TOKEN_INVALID'], [413, 'TOO_LARGE'], [415, 'UNSUPPORTED_TYPE'], [422, 'INVALID_FILE']] as const) {
    let calls = 0;
    const fakeFetch = (async () => { calls++; return calls === 1 ? authorization() : new Response(JSON.stringify({ code, message: 'Comprobante rechazado' }), { status }); }) as any;
    await assert.rejects(reportPayment({}, file, { fetch: fakeFetch }), (error: any) => error.status === status && error.code === code && !error.ambiguous);
    assert.equal(calls, 2);
  }
});

test('authorization errors surface the portal message for each eligibility code', async () => {
  for (const [status, code, pattern] of [[409, 'NO_ELIGIBLE_QUOTE', /Todavía no tienes un plan de pagos/], [422, 'QUOTE_REPLACED', /asesora/], [422, 'QUOTE_EXPIRED', /asesora/], [409, 'LEAD_HAS_OTHER_ACCEPTED_QUOTE', /asesora/], [429, 'RATE_LIMITED', /Espera unos minutos/], [503, 'PORTAL_DISABLED', /no está disponible/]] as const) {
    let calls = 0;
    const fakeFetch = (async () => { calls++; return new Response(JSON.stringify({ code, message: 'Mensaje del servidor' }), { status }); }) as any;
    await assert.rejects(reportPayment({}, file, { fetch: fakeFetch }), (error: any) => pattern.test(error.message) && error.code === code && !error.ambiguous);
    assert.equal(calls, 1);
  }
});

test('upload 413 and UPLOAD_NOT_ALLOWED show clear messages and ask for a refresh', async () => {
  for (const [status, code, pattern] of [[413, 'TOO_LARGE', /10 MB/], [409, 'UPLOAD_NOT_ALLOWED', /Actualiza la página/]] as const) {
    const fakeFetch = (async (_url: any, init: any) => init.body === file ? new Response(JSON.stringify({ code, message: 'x' }), { status }) : authorization()) as any;
    await assert.rejects(reportPayment({}, file, { fetch: fakeFetch }), (error: any) => pattern.test(error.message) && error.requiresRefresh && !error.ambiguous);
  }
});
