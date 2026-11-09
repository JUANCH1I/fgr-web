import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leerDatos,
  datosFaltantes,
  construirCambios,
  campoEditable,
  prepararCuerpoDatos,
  prepararCuerpoNombre,
  mensajeErrorDatos,
  tocaDatosPersonales
} from '../src/lib/datos-pure.ts';

test('leerDatos: los null llegan como texto vacío y documentoEditable solo es true si FGREC lo dice', () => {
  const d = leerDatos({ nombre: 'Ana', apellido: null, email: 'a@x.ec', telefono: null, documento: null, documentoEditable: true });
  assert.deepEqual(d, {
    nombre: 'Ana', apellido: '', email: 'a@x.ec', telefono: '', documento: '', documentoEditable: true,
    fechaNacimiento: '', nacionalidad: '', paisResidencia: '', calle: '', numero: '', piso: '', depto: '', codigoPostal: '',
    paises: [], datosEditables: false
  });
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

test('prepararCuerpoDatos: acepta cualquier subconjunto no vacío de campos conocidos, recorta y descarta claves ajenas', () => {
  assert.deepEqual(prepararCuerpoDatos({ documento: ' 0912345678 ', pais: 'EC', fechaNacimiento: '1990-05-01' }), { ok: true, cuerpo: { documento: '0912345678', fechaNacimiento: '1990-05-01' } });
  assert.deepEqual(prepararCuerpoDatos({ fechaNacimiento: '1990-05-01' }), { ok: true, cuerpo: { fechaNacimiento: '1990-05-01' } });
  assert.deepEqual(prepararCuerpoDatos({ calle: ' Av. Amazonas ', piso: '' }), { ok: true, cuerpo: { calle: 'Av. Amazonas' } });
  const soloAjena = prepararCuerpoDatos({ pais: 'EC' });
  assert.equal(soloAjena.ok === false && soloAjena.field, 'datos');
  const noTexto = prepararCuerpoDatos({ calle: 5 });
  assert.equal(noTexto.ok === false && noTexto.field, 'calle');
  const calleLarga = prepararCuerpoDatos({ calle: 'x'.repeat(121) });
  assert.equal(calleLarga.ok === false && calleLarga.field, 'calle');
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
  // New fields: the message goes next to the field; a lock on a filled field too.
  assert.deepEqual(mensajeErrorDatos(400, { code: 'INVALID_INPUT', field: 'fechaNacimiento', message: 'Fecha no válida.' }), { campo: 'fechaNacimiento', mensaje: 'Fecha no válida.' });
  assert.deepEqual(mensajeErrorDatos(409, { code: 'DATA_LOCKED', field: 'calle', message: 'Tu expediente ya fue aprobado.' }), { campo: 'calle', mensaje: 'Tu expediente ya fue aprobado.' });
  assert.equal(mensajeErrorDatos(409, { code: 'DATA_LOCKED' }).campo, null);
});

test('construirCambios con los datos nuevos: solo lo que cambió; bloqueados, solo los vacíos; los vacíos nunca viajan', () => {
  const actual = { documento: '1', fechaNacimiento: '1990-05-01', nacionalidad: 'Ecuador', calle: '', codigoPostal: '' };
  const nuevo = { documento: '1', fechaNacimiento: '1990-05-01', nacionalidad: 'Perú', calle: ' Av. Sol ', codigoPostal: '', piso: '  ' };
  assert.deepEqual(construirCambios(actual, nuevo, false, true), { nacionalidad: 'Perú', calle: 'Av. Sol' });
  assert.deepEqual(construirCambios(actual, nuevo, false, false), { calle: 'Av. Sol' });
  assert.deepEqual(construirCambios(actual, { calle: 'X' }, false, true), { calle: 'X' });
});

test('campoEditable: con los datos cerrados solo se llena lo vacío', () => {
  assert.equal(campoEditable({ calle: '' }, 'calle', false), true);
  assert.equal(campoEditable({ calle: 'X' }, 'calle', false), false);
  assert.equal(campoEditable({ calle: 'X' }, 'calle', true), true);
});

test('datosFaltantes names what FGREC still lacks, in plain words, and nothing when all is there', () => {
  assert.deepEqual(datosFaltantes(leerDatos({ documento: null })), [
    'tu número de documento', 'tu fecha de nacimiento', 'tu nacionalidad', 'tu país de residencia', 'tu calle', 'tu código postal'
  ]);
  const completos = { documento: '0912345678', fechaNacimiento: '1990-05-01', nacionalidad: 'Ecuador', paisResidencia: 'Ecuador', calle: 'Av. Sol', codigoPostal: '170150' };
  assert.deepEqual(datosFaltantes(leerDatos(completos)), []);
  // Número, piso y depto son opcionales.
  assert.deepEqual(datosFaltantes(leerDatos({ ...completos, codigoPostal: null, numero: null })), ['tu código postal']);
});

test('tocaDatosPersonales: the consent is needed when a personal datum travels, not for the document number alone', () => {
  assert.equal(tocaDatosPersonales({ documento: '0912345678' }), false);
  assert.equal(tocaDatosPersonales({}), false);
  assert.equal(tocaDatosPersonales({ calle: 'Av. Sol' }), true);
  assert.equal(tocaDatosPersonales({ documento: '0912345678', fechaNacimiento: '1990-05-01' }), true);
});
