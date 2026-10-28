import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cerrarFrase,
  contarDocumentos,
  formatearFechaCorta,
  leerAdicionales,
  presentarAdicionales,
  modelarTarjetaEstado,
  presentarFilaDocumento,
  resumirCarta,
  resumirSeccionDocumentos,
  type EntradaTarjeta
} from '../src/lib/documentos-pure.ts';
import type { RequisitoUI } from '../src/lib/portal-pure.ts';

const req = (codigo: string, estado: RequisitoUI['estado'], extra: Partial<RequisitoUI> = {}): RequisitoUI => ({
  codigo,
  nombre: `Documento ${codigo}`,
  obligatorio: true,
  estado,
  ...extra
});

function entrada(requisitos: RequisitoUI[], extra: Partial<EntradaTarjeta> = {}): EntradaTarjeta {
  const conteo = contarDocumentos(requisitos);
  return {
    estado: 'EN_PREPARACION',
    conteo,
    documentosCompletos: conteo.pendientes === 0 && conteo.conAccion === 0,
    cartaEnviada: false,
    cartaEditable: true,
    cartaTieneTexto: false,
    cartaNuevaVersion: false,
    consentimientoPendiente: false,
    proximoPaso: null,
    ...extra
  };
}

// --- Filas ---

test('fila: un documento recibido no lleva nota ni subida (se quita la "verificación preliminar")', () => {
  const f = presentarFilaDocumento(req('A', 'RECIBIDO'), false);
  assert.equal(f.estadoTexto, 'Recibido');
  assert.equal(f.tono, 'ok');
  assert.equal(f.nota, null);
  assert.equal(f.permiteSubida, false);
  assert.equal(f.textoBoton, null);
});

test('fila: pendiente solo muestra el botón de carga, sin nota', () => {
  const f = presentarFilaDocumento(req('A', 'PENDIENTE'), false);
  assert.equal(f.estadoTexto, 'Pendiente');
  assert.equal(f.nota, null);
  assert.equal(f.permiteSubida, true);
  assert.equal(f.textoBoton, 'Cargar archivo');
});

test('fila: solo los opcionales se marcan', () => {
  assert.equal(presentarFilaDocumento(req('A', 'PENDIENTE', { obligatorio: false }), false).opcional, true);
  assert.equal(presentarFilaDocumento(req('A', 'PENDIENTE'), false).opcional, false);
});

test('fila: observado trae el motivo y la acción', () => {
  const f = presentarFilaDocumento(req('A', 'OBSERVADO', { motivo: { texto: 'La foto está cortada' } }), false);
  assert.equal(f.estadoTexto, 'Observado');
  assert.equal(f.icono, 'observado');
  assert.equal(f.tono, 'pendiente');
  assert.equal(f.nota, 'Observación: La foto está cortada. Sube un archivo nuevo para reemplazarlo.');
  assert.equal(f.permiteSubida, true);
  assert.equal(f.textoBoton, 'Subir reemplazo');
});

test('fila: reemplazo solicitado trae el motivo y la acción', () => {
  const f = presentarFilaDocumento(req('A', 'REEMPLAZO_SOLICITADO', { motivo: { texto: 'Está vencido.' } }), false);
  assert.equal(f.estadoTexto, 'Reemplazo solicitado');
  assert.equal(f.tono, 'error');
  assert.equal(f.nota, 'Necesitamos un archivo nuevo: Está vencido. Sube un archivo nuevo para reemplazarlo.');
});

test('fila: en solo lectura no hay subida ni acción, pero se conserva el motivo', () => {
  const f = presentarFilaDocumento(req('A', 'OBSERVADO', { motivo: { texto: 'Falta firma' } }), true);
  assert.equal(f.permiteSubida, false);
  assert.equal(f.textoBoton, null);
  assert.equal(f.nota, 'Observación: Falta firma.');
  assert.equal(presentarFilaDocumento(req('B', 'PENDIENTE'), true).permiteSubida, false);
});

test('cerrarFrase agrega el punto solo cuando falta', () => {
  assert.equal(cerrarFrase('Hola'), 'Hola.');
  assert.equal(cerrarFrase('Hola?'), 'Hola?');
  assert.equal(cerrarFrase('  '), '');
});

// --- Conteos y resúmenes ---

test('contarDocumentos separa pendientes, recibidos y los que piden acción', () => {
  const c = contarDocumentos([
    req('A', 'VALIDADO'),
    req('B', 'RECIBIDO'),
    req('C', 'PENDIENTE'),
    req('D', 'OBSERVADO'),
    req('E', 'PENDIENTE', { obligatorio: false })
  ]);
  assert.equal(c.obligatoriosTotal, 4);
  assert.equal(c.obligatoriosRecibidos, 2);
  assert.equal(c.pendientes, 1);
  assert.equal(c.conAccion, 1);
  assert.equal(c.primerPendiente, 'C');
  assert.equal(c.primerConAccion, 'D');
});

test('resumen de documentos: «X de Y obligatorios recibidos» y lo que hay por revisar', () => {
  assert.equal(resumirSeccionDocumentos(contarDocumentos([req('A', 'RECIBIDO'), req('B', 'VALIDADO'), req('C', 'RECIBIDO')])), '3 de 3 obligatorios recibidos');
  assert.equal(resumirSeccionDocumentos(contarDocumentos([req('A', 'RECIBIDO'), req('B', 'OBSERVADO')])), '1 de 2 obligatorios recibidos · 1 por revisar');
  assert.equal(resumirSeccionDocumentos(contarDocumentos([req('A', 'PENDIENTE', { obligatorio: false })])), 'Sin documentos obligatorios');
});

test('formatearFechaCorta usa dd/mm/aaaa en hora de Ecuador', () => {
  assert.equal(formatearFechaCorta('2026-10-18T15:00:00Z'), '18/10/2026');
  // 02:00 UTC del 19 es todavía el 18 en Ecuador (UTC-5)
  assert.equal(formatearFechaCorta('2026-10-19T02:00:00Z'), '18/10/2026');
  assert.equal(formatearFechaCorta('no es fecha'), '');
  assert.equal(formatearFechaCorta(null), '');
});

test('resumen de la carta según su estado', () => {
  assert.deepEqual(resumirCarta({ carta: null, soloLectura: false }), { estado: 'NO_DISPONIBLE', linea: null });
  assert.deepEqual(resumirCarta({ carta: { puedeEditar: false, enviadaEn: '2026-10-18T15:00:00Z' }, soloLectura: true }), { estado: 'ENVIADA', linea: 'Enviada el 18/10/2026' });
  assert.equal(resumirCarta({ carta: { puedeEditar: false }, soloLectura: true }).linea, 'Enviada');
  assert.equal(resumirCarta({ carta: { puedeEditar: true, texto: '' }, soloLectura: false }).estado, 'VACIA');
  assert.equal(resumirCarta({ carta: { puedeEditar: true, texto: 'Hola' }, soloLectura: false }).estado, 'BORRADOR');
  assert.equal(resumirCarta({ carta: { puedeEditar: true, texto: 'Hola', version: 2 }, soloLectura: false }).estado, 'NUEVA_VERSION');
  assert.equal(resumirCarta({ carta: { puedeEditar: true, texto: 'Hola' }, soloLectura: true }).estado, 'BLOQUEADA');
});

// --- Tarjeta de estado ---

test('tarjeta EN_PREPARACION: dice qué falta y lleva al primer pendiente', () => {
  const t = modelarTarjetaEstado(entrada([req('A', 'RECIBIDO'), req('B', 'PENDIENTE'), req('C', 'PENDIENTE')]));
  assert.equal(t.tono, 'preparacion');
  assert.equal(t.etiqueta, 'Fase 2 en curso');
  assert.equal(t.titulo, 'Te faltan 2 documentos y tu carta de interés');
  assert.deepEqual(t.accion, { texto: 'Cargar el primer documento', href: '#doc-B' });
});

test('tarjeta EN_PREPARACION: singular, solo documentos o solo carta', () => {
  assert.equal(modelarTarjetaEstado(entrada([req('A', 'PENDIENTE')], { cartaEnviada: true })).titulo, 'Te falta 1 documento');
  assert.equal(modelarTarjetaEstado(entrada([req('A', 'PENDIENTE'), req('B', 'PENDIENTE')], { cartaEnviada: true })).titulo, 'Te faltan 2 documentos');
  const soloCarta = modelarTarjetaEstado(entrada([req('A', 'RECIBIDO')]));
  assert.equal(soloCarta.titulo, 'Te falta tu carta de interés');
  assert.deepEqual(soloCarta.accion, { texto: 'Escribir mi carta', href: '#carta' });
  const conBorrador = modelarTarjetaEstado(entrada([req('A', 'RECIBIDO')], { cartaTieneTexto: true }));
  assert.equal(conBorrador.accion?.texto, 'Continuar mi carta');
});

test('tarjeta EN_PREPARACION: lo observado va primero', () => {
  const t = modelarTarjetaEstado(entrada([req('A', 'OBSERVADO'), req('B', 'PENDIENTE')]));
  assert.equal(t.titulo, 'Revisa 1 documento observado');
  assert.deepEqual(t.accion, { texto: 'Revisar el documento observado', href: '#doc-A' });
  assert.match(t.texto ?? '', /Después te faltarán 1 documento y tu carta de interés/);
  const varios = modelarTarjetaEstado(entrada([req('A', 'OBSERVADO'), req('B', 'REEMPLAZO_SOLICITADO')], { cartaEnviada: true }));
  assert.equal(varios.titulo, 'Revisa 2 documentos observados');
  assert.match(varios.texto ?? '', /quedará completo/);
});

test('tarjeta EN_PREPARACION: con el consentimiento pendiente el botón lleva al consentimiento', () => {
  const t = modelarTarjetaEstado(entrada([req('A', 'PENDIENTE')], { consentimientoPendiente: true }));
  assert.deepEqual(t.accion, { texto: 'Aceptar el consentimiento', href: '#bloqueConsentimiento' });
  assert.match(t.texto ?? '', /consentimiento/);
});

test('tarjeta EN_PREPARACION: si el servidor dice que faltan documentos y la lista no muestra ninguno, no inventa un número', () => {
  const t = modelarTarjetaEstado(entrada([req('A', 'RECIBIDO')], { documentosCompletos: false, cartaEnviada: true }));
  assert.equal(t.titulo, 'Aún faltan documentos para completar tu expediente');
});

test('tarjeta EN_PREPARACION: el servidor manda sobre el conteo local de documentos', () => {
  const t = modelarTarjetaEstado(entrada([req('A', 'PENDIENTE')], { documentosCompletos: true }));
  assert.equal(t.titulo, 'Te falta tu carta de interés');
});

test('tarjeta EN_PREPARACION: carta no habilitada o nueva versión pedida', () => {
  const sinCarta = modelarTarjetaEstado(entrada([req('A', 'RECIBIDO')], { cartaEditable: false }));
  assert.equal(sinCarta.titulo, 'Tus documentos están completos');
  assert.equal(sinCarta.accion, null);
  const nueva = modelarTarjetaEstado(entrada([req('A', 'RECIBIDO')], { cartaNuevaVersion: true }));
  assert.match(nueva.texto ?? '', /versión nueva/);
});

test('tarjeta EN_REVISION: tranquiliza y no ofrece acciones', () => {
  const t = modelarTarjetaEstado(entrada([req('A', 'RECIBIDO')], { estado: 'EN_REVISION', cartaEnviada: true, cartaEditable: false }));
  assert.equal(t.tono, 'revision');
  assert.equal(t.titulo, 'Tu expediente está en revisión');
  assert.equal(t.etiqueta, 'En revisión de la Fundación');
  assert.equal(t.aviso, 'No necesitas hacer nada por ahora; tu asesora te avisará si falta algo.');
  assert.equal(t.accion, null);
});

test('tarjeta REVISADO: muestra el próximo paso solo si no contradice (no pide cargar ni escribir)', () => {
  const base = entrada([req('A', 'VALIDADO')], { estado: 'REVISADO', cartaEnviada: true, cartaEditable: false });
  const sin = modelarTarjetaEstado(base);
  assert.equal(sin.titulo, 'Tu expediente está completo');
  assert.equal(sin.accion, null);
  const con = modelarTarjetaEstado({ ...base, proximoPaso: { codigo: 'ACEPTAR_CONVENIO', texto: 'Lee y acepta tu convenio' } });
  assert.match(con.texto ?? '', /Siguiente paso: Lee y acepta tu convenio\./);
  assert.deepEqual(con.accion, { texto: 'Ver mi siguiente paso', href: '/mi-postulacion' });
  const viejo = modelarTarjetaEstado({ ...base, proximoPaso: { codigo: 'CARGAR_DOCUMENTOS', texto: 'Carga los documentos' } });
  assert.equal(viejo.accion, null);
});

// --- Documentos adicionales --------------------------------------------------------------------

const CATEGORIAS = [
  { codigo: 'CV', nombre: 'Currículum vitae' },
  { codigo: 'CURSOS', nombre: 'Certificados de cursos o capacitaciones' },
  { codigo: 'CONSTANCIA_LABORAL', nombre: 'Constancia o certificado laboral' },
  { codigo: 'TRAYECTORIA_LABORAL', nombre: 'Trayectoria laboral' },
  { codigo: 'OTRO', nombre: 'Otro documento' }
];

const adicional = (id: number, estado: string, extra: Record<string, unknown> = {}) => ({
  id,
  categoria: 'CV',
  categoriaNombre: 'Currículum vitae',
  nombreArchivo: `cv-${id}.pdf`,
  estado,
  motivo: null,
  cargadoEn: '2026-10-28T12:00:00Z',
  ...extra
});

test('adicionales: un campo ausente, nulo o inválido (backend anterior) no rompe y no muestra la tarjeta', () => {
  assert.equal(leerAdicionales(undefined), null);
  assert.equal(leerAdicionales(null), null);
  assert.equal(leerAdicionales('x'), null);
  assert.equal(presentarAdicionales(leerAdicionales(undefined), false), null);
});

test('adicionales: se conserva el orden de categorías y de documentos que manda el servidor', () => {
  const ad = leerAdicionales({ maximo: 10, categorias: CATEGORIAS, documentos: [adicional(1, 'RECIBIDO'), adicional(2, 'VALIDADO')] });
  assert.deepEqual(ad?.categorias.map((c) => c.codigo), ['CV', 'CURSOS', 'CONSTANCIA_LABORAL', 'TRAYECTORIA_LABORAL', 'OTRO']);
  assert.deepEqual(presentarAdicionales(ad, false)?.filas.map((f) => f.nombreArchivo), ['cv-1.pdf', 'cv-2.pdf']);
});

test('adicionales: cada estado se presenta con su texto y tono; solo el observado trae nota con el motivo', () => {
  const ad = leerAdicionales({
    maximo: 10,
    categorias: CATEGORIAS,
    documentos: [
      adicional(1, 'RECIBIDO'),
      adicional(2, 'VALIDADO'),
      adicional(3, 'OBSERVADO', { motivo: { codigo: 'ILEGIBLE', texto: 'No se lee la segunda página' } })
    ]
  });
  const filas = presentarAdicionales(ad, false)!.filas;
  assert.deepEqual(filas.map((f) => [f.estadoTexto, f.tono, f.nota]), [
    ['Recibido', 'ok', null],
    ['Validado', 'ok', null],
    ['Observado', 'pendiente', 'No se lee la segunda página.']
  ]);
  assert.equal(filas[0].categoriaNombre, 'Currículum vitae');
});

test('adicionales: un observado sin motivo no inventa nota', () => {
  const ad = leerAdicionales({ maximo: 10, categorias: CATEGORIAS, documentos: [adicional(1, 'OBSERVADO')] });
  assert.equal(presentarAdicionales(ad, false)!.filas[0].nota, null);
});

test('adicionales: con cupo se puede cargar; al llegar al máximo se oculta el control y se avisa', () => {
  const docs = (n: number) => Array.from({ length: n }, (_, i) => adicional(i + 1, 'RECIBIDO'));
  const conCupo = presentarAdicionales(leerAdicionales({ maximo: 10, categorias: CATEGORIAS, documentos: docs(9) }), false)!;
  assert.equal(conCupo.puedeCargar, true);
  assert.equal(conCupo.maximoAlcanzado, false);
  const lleno = presentarAdicionales(leerAdicionales({ maximo: 10, categorias: CATEGORIAS, documentos: docs(10) }), false)!;
  assert.equal(lleno.puedeCargar, false);
  assert.equal(lleno.maximoAlcanzado, true);
  assert.equal(lleno.avisoMaximo, 'Llegaste al máximo de 10 documentos adicionales.');
});

test('adicionales: en solo lectura no se carga; sin documentos la tarjeta no aparece', () => {
  const vacio = leerAdicionales({ maximo: 10, categorias: CATEGORIAS, documentos: [] });
  assert.equal(presentarAdicionales(vacio, true), null);
  assert.equal(presentarAdicionales(vacio, false)?.puedeCargar, true);
  const con = presentarAdicionales(leerAdicionales({ maximo: 10, categorias: CATEGORIAS, documentos: [adicional(1, 'RECIBIDO')] }), true)!;
  assert.equal(con.puedeCargar, false);
  assert.equal(con.filas.length, 1);
});

test('adicionales: agregar el bloque no cambia cómo se presenta una fila de requisito', () => {
  assert.deepEqual(presentarFilaDocumento(req('A', 'PENDIENTE'), false), {
    estadoTexto: 'Pendiente',
    icono: 'pendiente',
    tono: 'pendiente',
    opcional: false,
    nota: null,
    permiteSubida: true,
    textoBoton: 'Cargar archivo'
  });
});
