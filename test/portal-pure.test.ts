import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  presentarEstadoDocumento,
  mensajeResultadoPrecalificador,
  validarArchivoCliente,
  validarUrlSubida,
  normalizarContacto,
  deducirTipoMime,
  mensajeErrorSubida,
  cartaEnviadaEnPanel
} from '../src/lib/portal-pure.ts';

test('presentarEstadoDocumento maneja los 5 estados del Anexo §42', () => {
  assert.equal(presentarEstadoDocumento({
    codigo: 'TITULO',
    nombre: 'Título de bachiller',
    obligatorio: true,
    estado: 'PENDIENTE'
  }).textoBoton, 'Cargar');

  const recibido = presentarEstadoDocumento({
    codigo: 'TITULO',
    nombre: 'Título de bachiller',
    obligatorio: true,
    estado: 'RECIBIDO'
  });
  assert.equal(recibido.etiqueta, 'Recibido, en revisión');
  assert.equal(recibido.permiteSubida, false);
  assert.equal(recibido.textoBoton, null);

  const validado = presentarEstadoDocumento({
    codigo: 'TITULO',
    nombre: 'Título de bachiller',
    obligatorio: true,
    estado: 'VALIDADO'
  });
  assert.equal(validado.etiqueta, 'Validado');
  assert.equal(validado.permiteSubida, false);

  const observado = presentarEstadoDocumento({
    codigo: 'TITULO',
    nombre: 'Título de bachiller',
    obligatorio: true,
    estado: 'OBSERVADO',
    motivo: { texto: 'Falta sello del ministerio' }
  });
  assert.equal(observado.etiqueta, 'Observado');
  assert.match(observado.detalle || '', /Falta sello/);
  assert.equal(observado.textoBoton, 'Reemplazar');

  const reemplazo = presentarEstadoDocumento({
    codigo: 'TITULO',
    nombre: 'Título de bachiller',
    obligatorio: true,
    estado: 'REEMPLAZO_SOLICITADO',
    motivo: { texto: 'Documento ilegible' }
  });
  assert.equal(reemplazo.etiqueta, 'Reemplazo solicitado');
  assert.match(reemplazo.detalle || '', /ilegible/);
  assert.equal(reemplazo.textoBoton, 'Reemplazar');
});

test('mensajeResultadoPrecalificador adapta textos según vía y nombre', () => {
  const lic = mensajeResultadoPrecalificador('LICENCIATURA_COMPLETA', 'Martín');
  assert.match(lic.mensaje, /Martín/);
  assert.match(lic.mensaje, /licenciatura completa/);
  assert.match(lic.advertencia, /Universidad del Gran Rosario/);

  const ccc = mensajeResultadoPrecalificador('CCC', null);
  assert.match(ccc.mensaje, /evaluados por la Universidad/);
});

test('deducirTipoMime infiere MIME según extensión si type está vacío', () => {
  assert.equal(deducirTipoMime({ name: 'documento.pdf', type: '' }), 'application/pdf');
  assert.equal(deducirTipoMime({ name: 'foto.jpg', type: '' }), 'image/jpeg');
  assert.equal(deducirTipoMime({ name: 'foto.png', type: '' }), 'image/png');
  assert.equal(deducirTipoMime({ name: 'archivo.xyz', type: '' }), null);
});

test('validarArchivoCliente detecta tipos, límites y HEIC', () => {
  const pdfValido = validarArchivoCliente({ name: 'titulo.pdf', size: 1024 * 500, type: 'application/pdf' });
  assert.equal(pdfValido.valido, true);
  assert.equal(pdfValido.tipoMime, 'application/pdf');

  const pdfSinMime = validarArchivoCliente({ name: 'titulo.pdf', size: 1024 * 500, type: '' });
  assert.equal(pdfSinMime.valido, true);
  assert.equal(pdfSinMime.tipoMime, 'application/pdf');

  const heic = validarArchivoCliente({ name: 'foto.heic', size: 1024 * 500, type: 'image/heic' });
  assert.equal(heic.valido, false);
  assert.equal(heic.esHeic, true);

  const pesado = validarArchivoCliente({ name: 'scan.pdf', size: 11 * 1024 * 1024, type: 'application/pdf' });
  assert.equal(pesado.valido, false);
  assert.match(pesado.error || '', /supera el tamaño máximo/);

  const zip = validarArchivoCliente({ name: 'docs.zip', size: 1024, type: 'application/zip' });
  assert.equal(zip.valido, false);
  assert.match(zip.error || '', /Formato no admitido/);
});

test('mensajeErrorSubida explica causas de rechazo de FGREC', () => {
  const msg401 = mensajeErrorSubida(401);
  assert.match(msg401, /autorización de carga venció o ya fue utilizada/);
  assert.match(msg401, /volver a seleccionar el archivo/);

  const msg415 = mensajeErrorSubida(415);
  assert.match(msg415, /Formato no soportado/);

  const msg422 = mensajeErrorSubida(422, 'ACTIVE_CONTENT', 'PDF con scripts');
  assert.match(msg422, /PDF con scripts/);
});

test('validarUrlSubida verifica origen exacto', () => {
  assert.equal(validarUrlSubida('http://127.0.0.1:3410/subidas', 'http://127.0.0.1:3410'), true);
  assert.equal(validarUrlSubida('https://subidas.fgrec.org/subidas', 'https://subidas.fgrec.org'), true);
  assert.equal(validarUrlSubida('https://malicioso.com/subidas', 'https://subidas.fgrec.org'), false);
  assert.equal(validarUrlSubida('invalid-url', 'https://subidas.fgrec.org'), false);
});

test('normalizarContacto valida emails y telefonos E.164', () => {
  const email = normalizarContacto('  Postulante@ejemplo.org ');
  assert.equal(email.valido, true);
  assert.equal(email.normalizado, 'postulante@ejemplo.org');
  assert.equal(email.esEmail, true);

  const tel = normalizarContacto('+593 99 123-4567');
  assert.equal(tel.valido, true);
  assert.equal(tel.normalizado, '+593991234567');
  assert.equal(tel.esEmail, false);

  const telInvalido = normalizarContacto('0991234567');
  assert.equal(telInvalido.valido, false);
});

test('cartaEnviadaEnPanel usa expediente.cartaEnviada y, sin el campo (backend anterior), cae a la inferencia por revisión', () => {
  assert.equal(cartaEnviadaEnPanel({ expediente: { cartaEnviada: true } }, false), true);
  assert.equal(cartaEnviadaEnPanel({ expediente: { cartaEnviada: false } }, true), false);
  assert.equal(cartaEnviadaEnPanel({}, true), true);
  assert.equal(cartaEnviadaEnPanel({}, false), false);
  assert.equal(cartaEnviadaEnPanel({ expediente: {} }, false), false);
  assert.equal(cartaEnviadaEnPanel(null, true), true);
  assert.equal(cartaEnviadaEnPanel({ expediente: { cartaEnviada: 'true' } }, false), false);
});
