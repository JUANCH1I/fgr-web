import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearReportador, cuerpoParaReenviar, reporteDeError, MAX_CUERPO_REPORTE, type ReporteError } from '../src/lib/errores-portal.ts';

const recolector = () => {
  const enviados: ReporteError[] = [];
  return { enviados, reportar: crearReportador(async (reporte) => enviados.push(reporte)) };
};

test('un error se convierte en nombre, mensaje, pila y página; un valor que no es error se envuelve', () => {
  const error = new TypeError('x is undefined');
  assert.deepEqual(reporteDeError(error, '/mi-postulacion/documentos'), {
    name: 'TypeError', message: 'x is undefined', stack: error.stack, page: '/mi-postulacion/documentos'
  });
  assert.equal(reporteDeError('falla').message, 'falla');
  assert.equal(reporteDeError(new Error('a'.repeat(5000))).message.length, 2000);
});

test('no se reportan las solicitudes canceladas ni los valores vacíos', () => {
  const { enviados, reportar } = recolector();
  reportar(new DOMException('cancelada', 'AbortError'));
  reportar(undefined);
  reportar(null);
  assert.equal(enviados.length, 0);
});

test('un error repetido se reporta una vez y una carga de página manda como mucho diez', () => {
  const { enviados, reportar } = recolector();
  const error = new Error('igual');
  reportar(error, '/a');
  reportar(error, '/a');
  assert.equal(enviados.length, 1);
  for (let i = 0; i < 20; i += 1) reportar(new Error(`distinto ${i}`), '/a');
  assert.equal(enviados.length, 10);
});

test('un envío que falla nunca lanza', async () => {
  const reportar = crearReportador(async () => {
    throw new Error('sin conexión');
  });
  assert.doesNotThrow(() => reportar(new Error('x'), '/a'));
  await new Promise((resolve) => setImmediate(resolve));
});

test('la función reenvía solo un objeto JSON de tamaño acotado', () => {
  assert.deepEqual(cuerpoParaReenviar('{"message":"x"}'), { message: 'x' });
  assert.equal(cuerpoParaReenviar('no es json'), null);
  assert.equal(cuerpoParaReenviar('[1]'), null);
  assert.equal(cuerpoParaReenviar('null'), null);
  assert.equal(cuerpoParaReenviar(JSON.stringify({ message: 'x'.repeat(MAX_CUERPO_REPORTE) })), null);
});
