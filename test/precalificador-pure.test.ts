import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SITUACIONES,
  construirPrecalificacion,
  mensajeErrorPrecalificador
} from '../src/lib/precalificador-pure.ts';
import { mensajeResultadoPrecalificador } from '../src/lib/portal-pure.ts';

test('las situaciones son exactamente las del contrato de FGREC', () => {
  assert.deepEqual(SITUACIONES.map((s) => s.clave).sort(), ['bachillerato', 'incompleta', 'tecnico_tecnologo', 'titulo']);
});

test('construirPrecalificacion descarta valores fuera del contrato', () => {
  const out = construirPrecalificacion({ situacion: 'ESTUDIANTE_SECUNDARIA', bachillerato: 'TAL_VEZ' });
  assert.equal('situacion' in out, false);
  assert.equal('bachillerato' in out, false);
});

test('con estudios previos viaja todo el detalle con tipos del contrato', () => {
  const out = construirPrecalificacion({
    situacion: 'incompleta', bachillerato: 'SI', estudiosPrevios: 'true',
    carreraPrevia: ' Ingeniería Comercial ', finalizada: 'false', duracionAnios: '4', areaInteres: 'Administración'
  });
  assert.deepEqual(out, {
    situacion: 'incompleta', bachillerato: 'SI', estudiosPrevios: true,
    carreraPrevia: 'Ingeniería Comercial', finalizada: false, duracionAnios: 4, areaInteres: 'Administración'
  });
});

test('sin estudios previos no viaja el detalle aunque el navegador lo conserve', () => {
  const out = construirPrecalificacion({ bachillerato: 'EN_CURSO', estudiosPrevios: 'false', carreraPrevia: 'x', finalizada: 'true', duracionAnios: '3' });
  assert.deepEqual(out, { bachillerato: 'EN_CURSO', estudiosPrevios: false });
});

test('mensajeErrorPrecalificador no muestra rutas de campo', () => {
  const msg = mensajeErrorPrecalificador(400, { code: 'INVALID_INPUT', field: 'precalificacion.situacion', message: 'El campo precalificacion.situacion es inválido' });
  assert.doesNotMatch(msg, /precalificacion|situacion\b/);
  assert.match(msg, /situación académica/);
  assert.doesNotMatch(mensajeErrorPrecalificador(400, { field: 'precalificacion.carreraPrevia' }), /precalificacion/);
  assert.match(mensajeErrorPrecalificador(400, {}), /Revisa/);
  assert.match(mensajeErrorPrecalificador(429, null), /minutos/);
});

test('la vía LICENCIATURA de FGREC muestra el mensaje de licenciatura', () => {
  assert.match(mensajeResultadoPrecalificador('LICENCIATURA', null).titulo, /Licenciatura/);
});
