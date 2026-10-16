import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmountCents, formatPaymentAmount, validatePaymentBody, publicPaymentContext, registrationUnavailable } from '../src/lib/payment-pure.ts';

const body = { cotizacionId: 1, medioPagoId: 2, cuentaReceptoraId: 3, importeBrutoCentavos: 12345, moneda: 'USD', fechaPago: '2026-10-10', referencia: 'OP-123', nombreArchivo: 'recibo.pdf', tipo: 'application/pdf', tamano: 300 };

test('payment amounts parse exact cents with comma or dot, never rounding', () => {
  for (const [text, cents] of [['0,01', 1], ['0.29', 29], ['125,50', 12550], ['1', 100], ['1.1', 110], ['10000000000', 1000000000000], [' 12.34 ', 1234]] as const) assert.equal(parseAmountCents(text), cents);
  for (const text of ['', '0', '-1', '1.001', '1,000.00', '1.000,00', '1e3', 'Infinity', '10000000000.01', '.5']) assert.equal(parseAmountCents(text), null, text);
  assert.equal(formatPaymentAmount(123456789, 'USD'), 'USD 1.234.567,89');
});

test('payment body validates real dates, integer cents and exact field allowlist', () => {
  assert.equal(validatePaymentBody(body, '2026-10-16').ok, true);
  for (const patch of [{ fechaPago: '2026-02-30' }, { fechaPago: '2026-10-17' }, { fechaPago: 'invalid' }, { importeBrutoCentavos: 1.5 }, { importeBrutoCentavos: 0 }, { importeBrutoCentavos: 1000000000001 }, { cotizacionId: -1 }, { cuentaReceptoraId: '3' }, { moneda: 'usd' }, { referencia: ' ' }, { referencia: 'x'.repeat(101) }, { estado: 'CONFIRMADO' }, { registrado_por: 99 }]) assert.equal(validatePaymentBody({ ...body, ...patch }, '2026-10-16').ok, false, JSON.stringify(patch));
  assert.equal(validatePaymentBody(null).ok, false);
  assert.equal(validatePaymentBody([]).ok, false);
  const leap = { ...body, fechaPago: '2024-02-29' };
  assert.equal(validatePaymentBody(leap, '2026-10-16').ok, true);
});

test('receipt metadata accepts only supported MIME types and bounded sizes', () => {
  for (const tipo of ['application/pdf', 'image/jpeg', 'image/png']) assert.equal(validatePaymentBody({ ...body, nombreArchivo: 'recibo', tipo }, '2026-10-16').ok, true);
  for (const patch of [{ tipo: 'text/html' }, { tipo: 'image/heic' }, { tamano: 0 }, { tamano: 10485761 }, { tamano: 1.5 }, { nombreArchivo: '' }]) assert.equal(validatePaymentBody({ ...body, ...patch }, '2026-10-16').ok, false);
  assert.equal(validatePaymentBody({ ...body, tamano: 10485760 }, '2026-10-16').ok, true);
});

test('public context exposes only payment and catalog contract fields', () => {
  const context: any = { pagos: [{ id: 1, cotizacion: 'Q-1', estado: 'REGISTRADO', estadoTexto: 'Pendiente de confirmación', importeCentavos: 12345, moneda: 'USD', fechaPago: '2026-10-10', referencia: 'OP-123', medioPago: 'Transferencia', registradoEn: '2026-10-10', comprobanteRecibido: true, motivo: 'INTERNAL', fee: 999, staff: 'Private' }], cotizaciones: [{ id: 1, codigo: 'Q-1', neto: 99 }], medios: [{ id: 2, nombre: 'Transferencia', moneda: 'USD', comision: 1 }], cuentas: [{ id: 3, nombre: 'Cuenta', banco: 'Banco', moneda: 'USD', numero: 'private' }], puedeRegistrar: true, maxBytes: 999999999, margen: 99 };
  const result = publicPaymentContext(context);
  assert.equal(result.pagos[0].motivo, null);
  assert.equal(result.maxBytes, 10485760);
  for (const secret of ['INTERNAL', 'Private', 'fee', 'staff', 'neto', 'comision', 'numero', 'margen']) assert.equal(JSON.stringify(result).includes(secret), false, secret);
  context.pagos[0].estado = 'RECHAZADO'; context.pagos[0].motivo = 'No fue posible validar el comprobante.';
  assert.equal(publicPaymentContext(context).pagos[0].motivo, context.pagos[0].motivo);
  assert.equal(registrationUnavailable(result), null);
  assert.match(registrationUnavailable({ ...result, cotizaciones: [] })!, /cotización/);
  assert.match(registrationUnavailable({ ...result, cuentas: [] })!, /medios y cuentas/);
  assert.match(registrationUnavailable({ ...result, puedeRegistrar: false })!, /no está habilitada/);
});
