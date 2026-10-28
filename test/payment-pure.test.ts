import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPaymentAmount, validatePaymentBody, formatPaymentDate, publicPaymentContext, registrationUnavailable, paymentSummary, paymentErrorMessage } from '../src/lib/payment-pure.ts';

const body = { nombreArchivo: 'recibo.pdf', tipo: 'application/pdf', tamano: 300 };

test('payment amounts format exact cents', () => {
  assert.equal(formatPaymentAmount(123456789, 'USD'), 'USD 1.234.567,89');
  assert.equal(formatPaymentAmount(5, 'USD'), 'USD 0,05');
});

test('payment body is exactly the receipt metadata and nothing else', () => {
  const ok = validatePaymentBody(body);
  assert.deepEqual(ok, { ok: true, body });
  for (const extra of [{ cotizacionId: 1 }, { medioPagoId: 2 }, { cuentaReceptoraId: 3 }, { importeBrutoCentavos: 12345 }, { moneda: 'USD' }, { fechaPago: '2026-10-10' }, { referencia: 'OP-1' }, { estado: 'CONFIRMADO' }, { registrado_por: 99 }]) assert.equal(validatePaymentBody({ ...body, ...extra }).ok, false, JSON.stringify(extra));
  for (const missing of ['nombreArchivo', 'tipo', 'tamano']) { const { [missing]: _, ...rest } = body as any; assert.equal(validatePaymentBody(rest).ok, false, missing); }
  assert.equal(validatePaymentBody(null).ok, false);
  assert.equal(validatePaymentBody([]).ok, false);
});

test('receipt metadata accepts only supported MIME types and bounded sizes', () => {
  for (const tipo of ['application/pdf', 'image/jpeg', 'image/png']) assert.equal(validatePaymentBody({ ...body, nombreArchivo: 'recibo', tipo }).ok, true);
  for (const patch of [{ tipo: 'text/html' }, { tipo: 'image/heic' }, { tamano: 0 }, { tamano: 10485761 }, { tamano: 1.5 }, { nombreArchivo: '' }, { nombreArchivo: 'x'.repeat(256) }]) assert.equal(validatePaymentBody({ ...body, ...patch }).ok, false, JSON.stringify(patch));
  assert.equal(validatePaymentBody({ ...body, tamano: 10485760 }).ok, true);
});

test('public context exposes only payments, eligibility and size limit', () => {
  const context: any = { pagos: [{ id: 1, cotizacion: 'Q-1', estado: 'REGISTRADO', estadoTexto: 'Pendiente de revisión', importeCentavos: 12345, moneda: 'USD', fechaPago: '2026-10-10', referencia: 'OP-123', medioPago: 'Transferencia', registradoEn: '2026-10-10', comprobanteRecibido: true, motivo: 'INTERNAL', fee: 999, staff: 'Private' }], cotizaciones: [{ id: 1, codigo: 'Q-1', neto: 99 }], medios: [{ id: 2, nombre: 'Transferencia', moneda: 'USD', comision: 1 }], cuentas: [{ id: 3, nombre: 'Cuenta', banco: 'Banco', moneda: 'USD', numero: 'private' }], puedeRegistrar: true, requiereConvenio: false, maxBytes: 999999999, margen: 99 };
  const result = publicPaymentContext(context);
  assert.equal(result.pagos[0].motivo, null);
  assert.equal(result.maxBytes, 10485760);
  assert.deepEqual(Object.keys(result).sort(), ['maxBytes', 'pagos', 'puedeRegistrar', 'requiereConvenio']);
  for (const secret of ['INTERNAL', 'Private', 'fee', 'staff', 'neto', 'comision', 'numero', 'margen']) assert.equal(JSON.stringify(result).includes(secret), false, secret);
  context.pagos[0].estado = 'RECHAZADO'; context.pagos[0].motivo = 'No fue posible validar el comprobante.';
  assert.equal(publicPaymentContext(context).pagos[0].motivo, context.pagos[0].motivo);
  assert.equal(registrationUnavailable(result), null);
  assert.match(registrationUnavailable({ ...result, puedeRegistrar: false })!, /no está disponible/);
});

test('without an accepted convenio the page asks to accept it before reporting a payment', () => {
  const result = publicPaymentContext({ pagos: [], puedeRegistrar: false, requiereConvenio: true, maxBytes: 10485760 } as any);
  assert.equal(result.requiereConvenio, true);
  assert.equal(registrationUnavailable(result), 'Antes de informar tu pago tienes que aceptar tu convenio de corresponsabilidad.');
  assert.equal(publicPaymentContext({ pagos: [], puedeRegistrar: false, maxBytes: 10485760 } as any).requiereConvenio, false, 'an older backend without the field');
});

test('formatPaymentDate muestra dd/mm/aaaa sin mover el día', () => {
  assert.equal(formatPaymentDate('2026-10-18'), '18/10/2026');
  assert.equal(formatPaymentDate('2026-01-05'), '05/01/2026');
  assert.equal(formatPaymentDate(''), '');
});

const confirmed: any = { id: 1, cotizacion: 'Q-1', estado: 'CONFIRMADO', estadoTexto: 'Confirmado', importeCentavos: 12550, moneda: 'USD', fechaPago: '2026-10-10', referencia: 'OP-123', medioPago: 'Transferencia', registradoEn: '2026-10-11T15:00:00.000Z', comprobanteRecibido: true, motivo: null };

test('confirmed payments still render amount, date, method and reference', () => {
  assert.deepEqual(paymentSummary(confirmed), { title: 'USD 125,50', details: [['Fecha del pago', '10/10/2026'], ['Medio de pago', 'Transferencia'], ['Referencia', 'OP-123'], ['Cotización', 'Q-1']] });
});

test('receipt-only payments render without data, dated in Ecuador time', () => {
  const pending = { ...confirmed, estado: 'REGISTRADO', estadoTexto: 'Pendiente de revisión', importeCentavos: null, moneda: null, fechaPago: null, referencia: null, medioPago: null };
  assert.deepEqual(paymentSummary(pending), { title: 'Comprobante enviado el 11/10/2026', details: [['Cotización', 'Q-1']] });
  // 03:00Z is still the previous day in Guayaquil (UTC-5)
  assert.equal(paymentSummary({ ...pending, registradoEn: '2026-10-12T03:00:00.000Z' }).title, 'Comprobante enviado el 11/10/2026');
  assert.equal(paymentSummary({ ...pending, registradoEn: 'garbage' }).title, 'Comprobante enviado');
  assert.equal(JSON.stringify(paymentSummary(pending)).includes('null'), false);
});

test('error codes map to clear messages, unknown ones return null', () => {
  assert.match(paymentErrorMessage(409, 'NO_ELIGIBLE_QUOTE')!, /^Todavía no tienes un plan de pagos para informar un pago\. Consulta a tu asesora\.$/);
  for (const [status, code] of [[422, 'QUOTE_REPLACED'], [422, 'QUOTE_EXPIRED'], [409, 'LEAD_HAS_OTHER_ACCEPTED_QUOTE']] as const) assert.match(paymentErrorMessage(status, code)!, /asesora/, code);
  assert.match(paymentErrorMessage(413, '')!, /10 MB/);
  assert.match(paymentErrorMessage(429, 'RATE_LIMITED')!, /Espera unos minutos/);
  assert.match(paymentErrorMessage(503, 'SCAN_UNAVAILABLE')!, /no está disponible/);
  assert.match(paymentErrorMessage(409, 'UPLOAD_NOT_ALLOWED')!, /Actualiza la página/);
  assert.equal(paymentErrorMessage(500, 'WHATEVER'), null);
});
