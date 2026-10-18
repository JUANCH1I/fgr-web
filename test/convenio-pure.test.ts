import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DECLARACION_ACEPTACION,
  cabecerasPdf,
  cuerpoAceptacion,
  filasResumen,
  formatearFechaConvenio,
  interpretarErrorConvenio,
  leerConvenio,
  nombreArchivoSeguro,
  prepararCuerpoAceptacion
} from '../src/lib/convenio-pure.ts';

const HASH = 'ab'.repeat(32);
const dinero = (cents: number, formatted: string) => ({ cents, formatted });

function respuestaFGREC(sobre: Record<string, unknown> = {}) {
  return {
    estado: 'GENERADO',
    version: 2,
    titulo: 'Convenio de Corresponsabilidad',
    textoEnBorrador: true,
    generadoEn: '2026-10-16T15:30:00.000Z',
    aceptadoEn: null,
    puedeAceptar: true,
    declaracion: DECLARACION_ACEPTACION,
    resumen: {
      beneficiario: 'Ana Prueba',
      pais: 'Uruguay',
      carrera: 'Licenciatura en Psicomotricidad',
      modalidad: null,
      cohorte: 'Marzo 2027',
      incorporacion: 'Octubre 2026',
      plan: 'Incorporación anticipada',
      pvp: dinero(35000, '350,00'),
      valorMensualPais: dinero(30500, '305,00'),
      beneficio: { etiqueta: 'Beneficio Institucional FGREC', porcentaje: '5 %' },
      total: dinero(1390800, '13.908,00'),
      cantidadPagos: 53,
      mesesDeEstudio: 48,
      resumenPagos: '52 cuotas de USD 262,42 y una última de USD 262,16'
    },
    pdf: { sha256: HASH, nombreArchivo: 'convenio-FGREC-UY-PSICOM-2026-000001-v2.pdf' },
    ...sobre
  };
}

test('leerConvenio: un convenio generado se lee completo y puede aceptarse', () => {
  const c = leerConvenio(respuestaFGREC());
  assert.equal(c.estado, 'GENERADO');
  assert.equal(c.version, 2);
  assert.equal(c.puedeAceptar, true);
  assert.equal(c.textoEnBorrador, true);
  assert.equal(c.sha256, HASH);
  assert.equal(c.resumen?.carrera, 'Licenciatura en Psicomotricidad');
  assert.equal(c.resumen?.total.formatted, '13.908,00');
  assert.equal(c.declaracion, 'Leí y acepto el Convenio de Corresponsabilidad');
});

test('leerConvenio: sin generar, sin aplicar o cualquier respuesta rara es "sin documento"', () => {
  assert.equal(leerConvenio({ estado: 'SIN_GENERAR' }).estado, 'SIN_GENERAR');
  assert.equal(leerConvenio({ estado: 'NO_APLICA' }).estado, 'NO_APLICA');
  for (const raro of [null, undefined, 'x', 42, {}, { estado: 'OTRO' }, { estado: 'GENERADO' }]) {
    const c = leerConvenio(raro);
    assert.equal(c.estado, 'SIN_GENERAR', String(raro));
    assert.equal(c.resumen, null);
    assert.equal(c.puedeAceptar, false);
  }
});

test('leerConvenio: un convenio sin huella válida, sin versión o sin importes no se puede aceptar', () => {
  assert.equal(leerConvenio(respuestaFGREC({ pdf: { sha256: 'corto' } })).estado, 'SIN_GENERAR');
  assert.equal(leerConvenio(respuestaFGREC({ version: 0.5 })).estado, 'SIN_GENERAR');
  assert.equal(leerConvenio(respuestaFGREC({ version: '2' })).estado, 'SIN_GENERAR');
  const sinTotal = respuestaFGREC();
  (sinTotal.resumen as any).total = { cents: 1 };
  assert.equal(leerConvenio(sinTotal).estado, 'SIN_GENERAR');
});

test('leerConvenio: solo un convenio GENERADO que el servidor ofrece se puede aceptar; uno aceptado es de solo lectura', () => {
  assert.equal(leerConvenio(respuestaFGREC({ puedeAceptar: false })).puedeAceptar, false);
  const aceptado = leerConvenio(respuestaFGREC({ estado: 'ACEPTADO', aceptadoEn: '2026-10-16T18:00:00.000Z', puedeAceptar: true }));
  assert.equal(aceptado.estado, 'ACEPTADO');
  assert.equal(aceptado.puedeAceptar, false);
  assert.equal(aceptado.aceptadoEn, '2026-10-16T18:00:00.000Z');
});

test('cuerpoAceptacion: lleva la versión y la huella del documento que tiene delante, y solo si puede aceptar', () => {
  assert.deepEqual(cuerpoAceptacion(leerConvenio(respuestaFGREC())), { acepto: true, version: 2, sha256: HASH });
  assert.equal(cuerpoAceptacion(leerConvenio(respuestaFGREC({ puedeAceptar: false }))), null);
  assert.equal(cuerpoAceptacion(leerConvenio({ estado: 'SIN_GENERAR' })), null);
});

test('prepararCuerpoAceptacion: exige acepto true, versión entera y huella; reenvía solo eso', () => {
  assert.deepEqual(prepararCuerpoAceptacion({ acepto: true, version: 1, sha256: HASH, extra: 'x', texto: 'otro' }), {
    ok: true,
    cuerpo: { acepto: true, version: 1, sha256: HASH }
  });
  for (const acepto of [undefined, false, 'true', 1, null]) {
    const r: any = prepararCuerpoAceptacion({ acepto, version: 1, sha256: HASH });
    assert.equal(r.ok, false, String(acepto));
    assert.equal(r.field, 'acepto');
  }
  assert.equal((prepararCuerpoAceptacion({ acepto: true, version: '1', sha256: HASH }) as any).field, 'version');
  assert.equal((prepararCuerpoAceptacion({ acepto: true, version: 0, sha256: HASH }) as any).field, 'version');
  assert.equal((prepararCuerpoAceptacion({ acepto: true, version: 1, sha256: 'XYZ' }) as any).field, 'sha256');
  assert.equal((prepararCuerpoAceptacion({ acepto: true, version: 1, sha256: HASH.toUpperCase() }) as any).field, 'sha256');
  assert.equal((prepararCuerpoAceptacion(null) as any).field, 'acepto');
});

test('filasResumen: muestra lo que calcula FGREC, sin recalcular, y omite lo que no hay', () => {
  const filas = filasResumen(leerConvenio(respuestaFGREC()).resumen!);
  const por = Object.fromEntries(filas.map((f) => [f.etiqueta, f]));
  assert.equal(por['Carrera'].valor, 'Licenciatura en Psicomotricidad');
  assert.equal(por['PVP Internacional UGR'].valor, 'USD 350,00 mensuales');
  assert.equal(por['Valor mensual para Uruguay'].valor, 'USD 305,00 mensuales');
  assert.equal(por['Beneficio Institucional FGREC'].valor, '5 %');
  assert.equal(por['Beneficio Institucional FGREC'].destacado, true);
  assert.equal(por['Total del plan'].valor, 'USD 13.908,00');
  assert.equal(por['Número de pagos'].valor, '53');
  assert.equal(por['Mes de incorporación'].valor, 'Octubre 2026');
  assert.equal(por['Modalidad'], undefined);
  const sinIncorporacion = filasResumen({ ...leerConvenio(respuestaFGREC()).resumen!, incorporacion: null, modalidad: 'Virtual' });
  assert.ok(!sinIncorporacion.some((f) => f.etiqueta === 'Mes de incorporación'));
  assert.ok(sinIncorporacion.some((f) => f.etiqueta === 'Modalidad' && f.valor === 'Virtual'));
});

test('el texto que ve el postulante no usa las palabras que la Fundación no usa', () => {
  const todo = JSON.stringify(filasResumen(leerConvenio(respuestaFGREC()).resumen!)) + DECLARACION_ACEPTACION;
  assert.doesNotMatch(todo, /\bbeca|descuento|oferta/i);
});

test('formatearFechaConvenio: fecha y hora de Ecuador en español; vacío si no es válida', () => {
  // 18:00 UTC son las 13:00 en Ecuador
  assert.match(formatearFechaConvenio('2026-10-16T18:00:00.000Z'), /16 de octubre de 2026.*13:00/);
  assert.equal(formatearFechaConvenio(null), '');
  assert.equal(formatearFechaConvenio('no es fecha'), '');
});

test('interpretarErrorConvenio: cada caso dice qué hacer', () => {
  assert.equal(interpretarErrorConvenio(401).sesionVencida, true);
  const cambio = interpretarErrorConvenio(409, 'CONVENIO_CHANGED');
  assert.equal(cambio.cambio, true);
  assert.match(cambio.mensaje, /Vuelve a abrirlo/);
  assert.equal(interpretarErrorConvenio(409, 'CONVENIO_UNAVAILABLE').cambio, true);
  assert.match(interpretarErrorConvenio(429).mensaje, /Espera unos minutos/);
  assert.match(interpretarErrorConvenio(400, 'INVALID_INPUT').mensaje, /marca que leíste/);
  assert.match(interpretarErrorConvenio(500, 'PDF_INTEGRITY').mensaje, /No se registró ninguna aceptación/);
  assert.equal(interpretarErrorConvenio(500, 'OTRO', 'Mensaje del servidor').mensaje, 'Mensaje del servidor');
  assert.match(interpretarErrorConvenio(500).mensaje, /No se pudo registrar/);
});

test('nombreArchivoSeguro: solo caracteres inocuos y siempre .pdf', () => {
  assert.equal(nombreArchivoSeguro('convenio-FGREC-UY-PSICOM-2026-000001-v2.pdf'), 'convenio-FGREC-UY-PSICOM-2026-000001-v2.pdf');
  assert.equal(nombreArchivoSeguro('mi "convenio"\r\nX: y/../../a.pdf'), 'miconvenioXy....a.pdf');
  assert.equal(nombreArchivoSeguro('sin extension'), 'convenio.pdf');
  assert.equal(nombreArchivoSeguro(''), 'convenio.pdf');
  assert.equal(nombreArchivoSeguro(null), 'convenio.pdf');
  assert.equal(nombreArchivoSeguro('.pdf'), 'convenio.pdf');
});

test('cabecerasPdf: privado, no se guarda, se embebe solo desde el propio sitio y lleva la huella', () => {
  const h = cabecerasPdf({ nombreArchivo: 'convenio-v1.pdf', sha256: HASH, descargar: false });
  assert.equal(h['Content-Type'], 'application/pdf');
  assert.equal(h['Content-Disposition'], 'inline; filename="convenio-v1.pdf"');
  assert.match(h['Cache-Control'], /no-store/);
  assert.equal(h['X-Frame-Options'], 'SAMEORIGIN');
  assert.equal(h['Content-Security-Policy'], "frame-ancestors 'self'");
  assert.equal(h['X-Content-Type-Options'], 'nosniff');
  assert.equal(h['X-Content-SHA256'], HASH);
  assert.equal(cabecerasPdf({ nombreArchivo: 'a.pdf', sha256: HASH, descargar: true })['Content-Disposition'], 'attachment; filename="a.pdf"');
  assert.equal('X-Content-SHA256' in cabecerasPdf({ nombreArchivo: 'a.pdf', sha256: '', descargar: false }), false);
});
