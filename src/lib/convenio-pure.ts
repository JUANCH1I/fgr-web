// Módulo puro del convenio de corresponsabilidad en el portal: lectura tolerante de lo que responde FGREC, reglas de la
// aceptación, textos de error y filas del resumen. Sin efectos colaterales, 100% testeable.
//
// El sitio no calcula ni escribe nada del convenio: los importes, el porcentaje y el cronograma los calcula FGREC y llegan
// ya formateados. El sitio solo muestra, reenvía el PDF y confirma lo que el postulante aceptó.

export const DECLARACION_ACEPTACION = 'Leí y acepto el Convenio de Corresponsabilidad';
/** Ruta del sitio que reenvía el PDF de FGREC (con sesión; el navegador no habla con FGREC). */
export const RUTA_PDF_CONVENIO = '/api/portal/convenio-pdf';
/** Ruta del sitio a la que se confirma la aceptación. */
export const RUTA_ACEPTAR_CONVENIO = '/api/portal/convenio-aceptar';
/** Ruta del sitio que pide el código de aceptación (convenio con clickwrap). */
export const RUTA_CODIGO_CONVENIO = '/api/portal/convenio-codigo';
/** Segundos antes de poder pedir otro código (el servidor aplica el mismo mínimo). */
export const ESPERA_REENVIO_SEGUNDOS = 60;
export const VIGENCIA_CODIGO_MINUTOS = 5;
export const RUTA_PAGINA_CONVENIO = '/mi-postulacion/convenio';

export type EstadoConvenio = 'SIN_GENERAR' | 'GENERADO' | 'ACEPTADO' | 'NO_APLICA';

interface Dinero {
  cents: number;
  formatted: string;
}

export interface ResumenConvenio {
  beneficiario: string;
  pais: string;
  carrera: string;
  modalidad: string | null;
  cohorte: string;
  incorporacion: string | null;
  plan: string;
  pvp: Dinero;
  valorMensualPais: Dinero;
  beneficio: { etiqueta: string; porcentaje: string };
  total: Dinero;
  cantidadPagos: number;
  mesesDeEstudio: number;
  resumenPagos: string;
}

/** Textos que FGREC manda para el convenio con código: el sitio los muestra tal cual, nunca los escribe. */
export interface ClickwrapUI {
  consentimientoElectronico: string;
  consentimientoContractual: string;
  avisoElectronico: string;
}

export interface ConvenioUI {
  estado: EstadoConvenio;
  version: number | null;
  titulo: string;
  /** El texto todavía es un borrador pendiente de revisión de la Fundación. */
  textoEnBorrador: boolean;
  aceptadoEn: string | null;
  puedeAceptar: boolean;
  declaracion: string;
  resumen: ResumenConvenio | null;
  sha256: string | null;
  nombreArchivo: string | null;
  /** Presente solo si el convenio se acepta con dos consentimientos y un código; `null` es el flujo de una casilla. */
  clickwrap: ClickwrapUI | null;
}

const ESTADOS: readonly string[] = ['SIN_GENERAR', 'GENERADO', 'ACEPTADO', 'NO_APLICA'];
const esDinero = (v: any): v is Dinero => v && typeof v.formatted === 'string' && Number.isSafeInteger(v.cents);
const esHash = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);

/** Lee la respuesta de GET convenio. Cualquier cosa que no sea un convenio completo se trata como "sin generar". */
export function leerConvenio(data: any): ConvenioUI {
  const vacio: ConvenioUI = {
    estado: 'SIN_GENERAR', version: null, titulo: 'Convenio de Corresponsabilidad', textoEnBorrador: false, aceptadoEn: null,
    puedeAceptar: false, declaracion: DECLARACION_ACEPTACION, resumen: null, sha256: null, nombreArchivo: null, clickwrap: null
  };
  if (!data || typeof data !== 'object' || !ESTADOS.includes(data.estado)) return vacio;
  if (data.estado === 'NO_APLICA') return { ...vacio, estado: 'NO_APLICA' };
  if (data.estado === 'SIN_GENERAR') return vacio;

  const r = data.resumen;
  const completo =
    Number.isSafeInteger(data.version) && esHash(data.pdf?.sha256) && r && typeof r.carrera === 'string' &&
    esDinero(r.total) && esDinero(r.pvp) && esDinero(r.valorMensualPais) && typeof r.beneficio?.porcentaje === 'string';
  if (!completo) return vacio;

  const clickwrap = leerClickwrap(data.clickwrap);
  // Un convenio pendiente que pide código pero trae textos incompletos no se ofrece: no se inventan los consentimientos.
  if (data.estado === 'GENERADO' && data.clickwrap != null && clickwrap === null) return vacio;

  return {
    estado: data.estado,
    version: data.version,
    titulo: typeof data.titulo === 'string' && data.titulo ? data.titulo : vacio.titulo,
    textoEnBorrador: data.textoEnBorrador === true,
    aceptadoEn: typeof data.aceptadoEn === 'string' ? data.aceptadoEn : null,
    // Solo se puede aceptar un convenio generado que el servidor ofrece para aceptar.
    puedeAceptar: data.estado === 'GENERADO' && data.puedeAceptar === true,
    declaracion: typeof data.declaracion === 'string' && data.declaracion ? data.declaracion : DECLARACION_ACEPTACION,
    resumen: {
      beneficiario: String(r.beneficiario ?? ''),
      pais: String(r.pais ?? ''),
      carrera: r.carrera,
      modalidad: typeof r.modalidad === 'string' ? r.modalidad : null,
      cohorte: String(r.cohorte ?? ''),
      incorporacion: typeof r.incorporacion === 'string' ? r.incorporacion : null,
      plan: String(r.plan ?? ''),
      pvp: r.pvp,
      valorMensualPais: r.valorMensualPais,
      beneficio: { etiqueta: String(r.beneficio.etiqueta ?? 'Beneficio Institucional FGREC'), porcentaje: r.beneficio.porcentaje },
      total: r.total,
      cantidadPagos: Number(r.cantidadPagos) || 0,
      mesesDeEstudio: Number(r.mesesDeEstudio) || 0,
      resumenPagos: String(r.resumenPagos ?? '')
    },
    sha256: data.pdf.sha256,
    nombreArchivo: typeof data.pdf.nombreArchivo === 'string' ? data.pdf.nombreArchivo : null,
    clickwrap: data.estado === 'GENERADO' ? clickwrap : null
  };
}

const esTexto = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

function leerClickwrap(v: any): ClickwrapUI | null {
  if (!v || typeof v !== 'object' || v.requiereCodigo !== true) return null;
  if (!esTexto(v.consentimientoElectronico) || !esTexto(v.consentimientoContractual) || !esTexto(v.avisoElectronico)) return null;
  return {
    consentimientoElectronico: v.consentimientoElectronico,
    consentimientoContractual: v.consentimientoContractual,
    avisoElectronico: v.avisoElectronico
  };
}

export const esCodigo = (v: unknown): v is string => typeof v === 'string' && /^[0-9]{6}$/.test(v);

/** Las dos casillas separadas del clickwrap: el consentimiento de medios electrónicos y la aceptación del convenio. */
export function validarConsentimientos(c: { medios: boolean; convenio: boolean }): { ok: true } | { ok: false; message: string } {
  if (!c.medios) return { ok: false, message: 'Para continuar, marca que consientes usar medios electrónicos.' };
  if (!c.convenio) return { ok: false, message: 'Para continuar, marca que leíste y aceptas el convenio.' };
  return { ok: true };
}

export interface CuerpoCodigo {
  version: number;
  sha256: string;
  aceptoMediosElectronicos: true;
  aceptoConvenio: true;
}

/** El documento que tiene delante y las dos casillas marcadas (las que el postulante confirmó antes de pedir el código). */
export const cuerpoClickwrap = (version: number, sha256: string): CuerpoCodigo =>
  ({ version, sha256, aceptoMediosElectronicos: true, aceptoConvenio: true });

/** Lo que se envía a pedir el código. */
export function cuerpoSolicitudCodigo(convenio: ConvenioUI): CuerpoCodigo | null {
  if (!convenio.clickwrap || !convenio.puedeAceptar || convenio.version === null || convenio.sha256 === null) return null;
  return cuerpoClickwrap(convenio.version, convenio.sha256);
}

/** Lo que se envía al aceptar con código. Un código que no son 6 dígitos no se envía. */
export function cuerpoAceptacionConCodigo(convenio: ConvenioUI, codigo: string): (CuerpoCodigo & { codigo: string }) | null {
  const base = cuerpoSolicitudCodigo(convenio);
  return base && esCodigo(codigo) ? { ...base, codigo } : null;
}

/** Valida lo que llega del navegador a la ruta del código y devuelve lo que se reenvía (nada más). */
export function prepararCuerpoCodigo(body: any):
  | { ok: true; cuerpo: CuerpoCodigo }
  | { ok: false; message: string; field: string } {
  if (body?.aceptoMediosElectronicos !== true) {
    return { ok: false, field: 'aceptoMediosElectronicos', message: 'Para continuar, marca que consientes usar medios electrónicos.' };
  }
  if (body.aceptoConvenio !== true) {
    return { ok: false, field: 'aceptoConvenio', message: 'Para continuar, marca que leíste y aceptas el convenio.' };
  }
  if (!Number.isSafeInteger(body.version) || body.version < 1) {
    return { ok: false, field: 'version', message: 'Falta la versión del convenio que se acepta.' };
  }
  if (!esHash(body.sha256)) {
    return { ok: false, field: 'sha256', message: 'Falta la huella del documento que se acepta.' };
  }
  return { ok: true, cuerpo: { version: body.version, sha256: body.sha256, aceptoMediosElectronicos: true, aceptoConvenio: true } };
}

/** Segundos que faltan para poder pedir otro código (entero, nunca negativo). */
export function segundosParaReenvio(pedidoEnMs: number, ahoraMs: number, espera = ESPERA_REENVIO_SEGUNDOS): number {
  const transcurrido = Math.max(0, ahoraMs - pedidoEnMs);
  return Math.max(0, Math.ceil(espera - transcurrido / 1000));
}

export function mensajeCodigoEnviado(enviadoA: unknown): string {
  const destino = esTexto(enviadoA) ? enviadoA : 'tu correo';
  return `Te enviamos un código a ${destino}. Vence en ${VIGENCIA_CODIGO_MINUTOS} minutos.`;
}

/** Las filas del resumen, en el orden en que se leen. Los importes ya vienen formateados por FGREC. */
export function filasResumen(resumen: ResumenConvenio): Array<{ etiqueta: string; valor: string; destacado?: boolean }> {
  const usd = (d: Dinero) => `USD ${d.formatted}`;
  return [
    { etiqueta: 'Persona beneficiaria', valor: resumen.beneficiario },
    { etiqueta: 'País de residencia', valor: resumen.pais },
    { etiqueta: 'Carrera', valor: resumen.carrera },
    ...(resumen.modalidad ? [{ etiqueta: 'Modalidad', valor: resumen.modalidad }] : []),
    { etiqueta: 'Cohorte', valor: resumen.cohorte },
    ...(resumen.incorporacion ? [{ etiqueta: 'Mes de incorporación', valor: resumen.incorporacion }] : []),
    { etiqueta: 'Plan de pago', valor: resumen.plan },
    { etiqueta: 'PVP Internacional UGR', valor: `${usd(resumen.pvp)} mensuales` },
    { etiqueta: `Valor mensual para ${resumen.pais}`, valor: `${usd(resumen.valorMensualPais)} mensuales` },
    { etiqueta: resumen.beneficio.etiqueta, valor: resumen.beneficio.porcentaje, destacado: true },
    { etiqueta: 'Total del plan', valor: usd(resumen.total), destacado: true },
    { etiqueta: 'Número de pagos', valor: String(resumen.cantidadPagos) },
    { etiqueta: 'Pagos', valor: resumen.resumenPagos },
    { etiqueta: 'Meses de estudio', valor: String(resumen.mesesDeEstudio) }
  ].filter((fila) => fila.valor !== '');
}

/** Fecha y hora de Ecuador para "Aceptado el …". Devuelve '' si la fecha no es válida. */
export function formatearFechaConvenio(iso?: string | null): string {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return new Intl.DateTimeFormat('es', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Guayaquil' }).format(fecha);
}

/** Lo que el sitio envía a FGREC al aceptar: la versión y la huella del documento que el postulante tiene delante. */
export function cuerpoAceptacion(convenio: ConvenioUI): { acepto: true; version: number; sha256: string } | null {
  if (!convenio.puedeAceptar || convenio.version === null || convenio.sha256 === null) return null;
  return { acepto: true, version: convenio.version, sha256: convenio.sha256 };
}

/** Valida el cuerpo que llega del navegador a la ruta del sitio y devuelve lo que se reenvía (nada más). */
export function prepararCuerpoAceptacion(body: any):
  | { ok: true; cuerpo: { acepto: true; version: number; sha256: string } | (CuerpoCodigo & { codigo: string }) }
  | { ok: false; message: string; field: string } {
  // Con casillas o código en el cuerpo es el convenio con clickwrap; sin ellos, el cuerpo de una casilla no cambia.
  if (body && (body.aceptoMediosElectronicos !== undefined || body.aceptoConvenio !== undefined || body.codigo !== undefined)) {
    const documento = prepararCuerpoCodigo(body);
    if (!documento.ok) return documento;
    if (!esCodigo(body.codigo)) {
      return { ok: false, field: 'codigo', message: 'Ingresa el código de 6 dígitos que te enviamos por correo.' };
    }
    return { ok: true, cuerpo: { ...documento.cuerpo, codigo: body.codigo } };
  }
  if (body?.acepto !== true) {
    return { ok: false, field: 'acepto', message: 'Para continuar, marca que leíste y aceptas el convenio.' };
  }
  if (!Number.isSafeInteger(body.version) || body.version < 1) {
    return { ok: false, field: 'version', message: 'Falta la versión del convenio que se acepta.' };
  }
  if (!esHash(body.sha256)) {
    return { ok: false, field: 'sha256', message: 'Falta la huella del documento que se acepta.' };
  }
  return { ok: true, cuerpo: { acepto: true, version: body.version, sha256: body.sha256 } };
}

export interface ErrorConvenioUI {
  mensaje: string;
  /** El convenio vigente es otro: hay que volver a leerlo. */
  cambio: boolean;
  sesionVencida: boolean;
  /** Ya estaba aceptado: recargar muestra la vista de solo lectura. */
  yaAceptado: boolean;
  /** El código actual ya no sirve: hay que pedir otro. */
  nuevoCodigo: boolean;
}

export function interpretarErrorConvenio(status: number, code?: string, message?: string, intentosRestantes?: number): ErrorConvenioUI {
  const base = { cambio: false, sesionVencida: false, yaAceptado: false, nuevoCodigo: false };
  if (status === 401) {
    return { ...base, sesionVencida: true, mensaje: 'Tu sesión venció. Vuelve a ingresar para aceptar tu convenio.' };
  }
  if (code === 'CONVENIO_CHANGED') {
    return { ...base, cambio: true, mensaje: 'El convenio cambió mientras lo leías. Vuelve a abrirlo para leer la versión vigente.' };
  }
  if (code === 'CONVENIO_UNAVAILABLE') {
    return { ...base, cambio: true, mensaje: 'Por ahora no hay un convenio para aceptar. Si crees que es un error, consulta con tu asesora.' };
  }
  if (code === 'CODE_INVALID') {
    if (intentosRestantes === 0) return { ...base, nuevoCodigo: true, mensaje: 'El código no es correcto y ya no te quedan intentos. Pide un código nuevo.' };
    const quedan = Number.isSafeInteger(intentosRestantes) && (intentosRestantes as number) > 0
      ? ` Te quedan ${intentosRestantes} ${intentosRestantes === 1 ? 'intento' : 'intentos'}.`
      : '';
    return { ...base, mensaje: `El código no es correcto. Revísalo e inténtalo de nuevo.${quedan}` };
  }
  if (code === 'CODE_EXPIRED') return { ...base, nuevoCodigo: true, mensaje: 'El código venció. Pide un código nuevo para continuar.' };
  if (code === 'CODE_REQUIRED') return { ...base, nuevoCodigo: true, mensaje: 'Primero pide un código nuevo: te lo enviamos por correo.' };
  if (code === 'CODE_UNAVAILABLE') {
    return { ...base, nuevoCodigo: true, mensaje: 'No pudimos procesar el código en este momento. No se registró ninguna aceptación; pide un código nuevo en unos minutos.' };
  }
  if (code === 'EMAIL_REQUIRED') {
    return { ...base, mensaje: 'No tenemos un correo cargado para enviarte el código. Pídele a tu asesora que lo cargue.' };
  }
  if (code === 'CONVENIO_ACCEPTED') return { ...base, yaAceptado: true, mensaje: 'Este convenio ya fue aceptado.' };
  if (code === 'CODE_NOT_REQUIRED') {
    return { ...base, cambio: true, mensaje: 'Este convenio se acepta sin código. Vuelve a abrirlo para ver la versión vigente.' };
  }
  if (code === 'RATE_LIMITED') {
    return { ...base, mensaje: 'Pediste varios códigos seguidos. Espera unos minutos antes de pedir otro código.' };
  }
  if (status === 429) {
    return { ...base, mensaje: 'Hay muchas solicitudes en este momento. Espera unos minutos e inténtalo de nuevo.' };
  }
  if (code === 'INVALID_INPUT') {
    return { ...base, mensaje: message || 'Para continuar, marca que leíste y aceptas el convenio.' };
  }
  if (code === 'PDF_INTEGRITY') {
    return { ...base, mensaje: 'No pudimos verificar el documento. No se registró ninguna aceptación; consulta con tu asesora.' };
  }
  return { ...base, mensaje: message || 'No se pudo registrar tu aceptación. Inténtalo de nuevo en unos minutos.' };
}

/** Un nombre de archivo seguro para Content-Disposition (solo letras, números, punto, guion y guion bajo). */
export function nombreArchivoSeguro(nombre: string | null | undefined, porDefecto = 'convenio.pdf'): string {
  const limpio = String(nombre ?? '').replace(/[^A-Za-z0-9._-]/g, '');
  return /\.pdf$/i.test(limpio) && limpio.length > 4 ? limpio.slice(0, 120) : porDefecto;
}

/** Cabeceras de la respuesta que reenvía el PDF: privado, embebible solo desde el propio sitio. */
export function cabecerasPdf(opciones: { nombreArchivo: string; sha256: string; descargar: boolean }): Record<string, string> {
  return {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${opciones.descargar ? 'attachment' : 'inline'}; filename="${nombreArchivoSeguro(opciones.nombreArchivo)}"`,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    // El portal prohíbe que lo embeban (DENY); el PDF solo puede verse dentro de una página del mismo sitio.
    'X-Frame-Options': 'SAMEORIGIN',
    'Content-Security-Policy': "frame-ancestors 'self'",
    ...(opciones.sha256 ? { 'X-Content-SHA256': opciones.sha256 } : {})
  };
}
