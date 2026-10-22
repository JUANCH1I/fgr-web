import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leerDatos,
  datosFaltantes,
  construirCambios,
  prepararCuerpoDatos,
  prepararCuerpoNombre,
  mensajeErrorDatos
} from '../src/lib/datos-pure.ts';

test('leerDatos: los null llegan como texto vacío y documentoEditable solo es true si FGREC lo dice', () => {
  const d = leerDatos({ nombre: 'Ana', apellido: null, email: 'a@x.ec', telefono: null, documento: null, documentoEditable: true });
  assert.deepEqual(d, { nombre: 'Ana', apellido: '', email: 'a@x.ec', telefono: '', documento: '', documentoEditable: true });
  assert.equal(leerDatos({}).documentoEditable, false);
  assert.equal(leerDatos(null).nombre, '');
});

test('construirCambios: solo viaja el número si cambió', () => {
  const actual = { documento: '0912345678' };
  assert.deepEqual(construirCambios(actual, { documento: ' 0912345678 ' }, true), {});
  assert.deepEqual(construirCambios(actual, { documento: '0999999999' }, true), { documento: '0999999999' });
  assert.deepEqual(construirCambios({ documento: '' }, { documento: ' 123 ' }, true), { documento: '123' });
});

test('construirCambios: con el documento bloqueado nunca viaja el número', () => {
  assert.deepEqual(construirCambios({ documento: '0912345678' }, { documento: '0000' }, false), {});
});

test('prepararCuerpoDatos: exige el documento, valida lo mínimo y descarta claves ajenas (la fecha de nacimiento ya no viaja)', () => {
  assert.deepEqual(prepararCuerpoDatos({ documento: ' 0912345678 ', pais: 'EC', fechaNacimiento: '1990-05-01' }), { ok: true, cuerpo: { documento: '0912345678' } });
  const soloFecha = prepararCuerpoDatos({ fechaNacimiento: '1990-05-01' });
  assert.equal(soloFecha.ok === false && soloFecha.field, 'datos');
  const vacio = prepararCuerpoDatos({});
  assert.equal(vacio.ok, false);
  const largo = prepararCuerpoDatos({ documento: 'x'.repeat(41) });
  assert.equal(largo.ok === false && largo.field, 'documento');
  const sinDoc = prepararCuerpoDatos({ documento: '  ' });
  assert.equal(sinDoc.ok === false && sinDoc.field, 'documento');
});

test('prepararCuerpoNombre: el comentario es opcional y tiene tope de 500', () => {
  assert.deepEqual(prepararCuerpoNombre({}), { ok: true, cuerpo: {} });
  assert.deepEqual(prepararCuerpoNombre({ comentario: '   ' }), { ok: true, cuerpo: {} });
  assert.deepEqual(prepararCuerpoNombre({ comentario: ' Es con "v" ' }), { ok: true, cuerpo: { comentario: 'Es con "v"' } });
  assert.deepEqual(prepararCuerpoNombre({ comentario: 'x'.repeat(500) }).ok, true);
  const largo = prepararCuerpoNombre({ comentario: 'x'.repeat(501) });
  assert.equal(largo.ok === false && largo.field, 'comentario');
  assert.equal(prepararCuerpoNombre({ comentario: 5 }).ok, false);
});

test('mensajeErrorDatos: el campo y el texto salen del error de FGREC; 409 y 5xx van a la alerta general', () => {
  assert.deepEqual(mensajeErrorDatos(400, { field: 'documento', message: 'Número no válido.' }), { campo: 'documento', mensaje: 'Número no válido.' });
  assert.equal(mensajeErrorDatos(400, { field: 'comentario', message: 'Muy largo.' }).campo, 'comentario');
  const otro = mensajeErrorDatos(400, { field: 'otro' });
  assert.equal(otro.campo, null);
  assert.match(otro.mensaje, /Revisa/);
  assert.deepEqual(mensajeErrorDatos(409, { code: 'DOCUMENT_REVIEW', message: 'Tu asesora lo va a revisar.' }), { campo: null, mensaje: 'Tu asesora lo va a revisar.' });
  assert.match(mensajeErrorDatos(409, { code: 'DOCUMENT_LOCKED' }).mensaje, /asesora/);
  assert.match(mensajeErrorDatos(429, null).mensaje, /muchas solicitudes/);
  // The daily cap of document numbers (FGREC TOO_MANY_ATTEMPTS) keeps its own message, next to the field.
  assert.deepEqual(mensajeErrorDatos(429, { code: 'TOO_MANY_ATTEMPTS', field: 'documento', message: 'Probaste varios números de documento. Vuelve a intentarlo mañana o escríbele a tu asesora.' }),
    { campo: 'documento', mensaje: 'Probaste varios números de documento. Vuelve a intentarlo mañana o escríbele a tu asesora.' });
  assert.match(mensajeErrorDatos(503, null).mensaje, /no está disponible/);
});

test('datosFaltantes names what FGREC still lacks, in plain words, and nothing when all is there', () => {
  assert.deepEqual(datosFaltantes(leerDatos({ documento: null })), ['tu número de documento']);
  assert.deepEqual(datosFaltantes(leerDatos({ documento: '0912345678' })), []);
});
