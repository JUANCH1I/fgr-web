// Módulo puro de lógica, contratos de UI y validaciones para el Portal del Postulante
// Sin efectos colaterales, 100% testeable.

export const ESTADOS_DOCUMENTO = {
  PENDIENTE: 'PENDIENTE',
  RECIBIDO: 'RECIBIDO',
  VALIDADO: 'VALIDADO',
  OBSERVADO: 'OBSERVADO',
  REEMPLAZO_SOLICITADO: 'REEMPLAZO_SOLICITADO',
  REEMPLAZADO: 'REEMPLAZADO'
} as const;

export type EstadoDocumento = keyof typeof ESTADOS_DOCUMENTO;

export interface MotivoObservacion {
  codigo?: string;
  texto: string;
}

export interface RequisitoUI {
  codigo: string;
  nombre: string;
  obligatorio: boolean;
  estado: EstadoDocumento;
  motivo?: MotivoObservacion | null;
  accion?: 'CARGAR' | 'REEMPLAZAR' | null;
  documentoId?: string | null;
  cargadoEn?: string | null;
}

export interface PresentacionEstadoDoc {
  etiqueta: string;
  detalle: string | null;
  icono: 'pendiente' | 'revision' | 'validado' | 'observado' | 'reemplazo';
  permiteSubida: boolean;
  textoBoton: 'Cargar' | 'Reemplazar' | null;
}

/**
 * Presentación de cada estado documental para el postulante según Anexo §42 y spec §4.2.
 */
export function presentarEstadoDocumento(requisito: RequisitoUI): PresentacionEstadoDoc {
  switch (requisito.estado) {
    case 'PENDIENTE':
      return {
        etiqueta: 'Pendiente',
        detalle: requisito.obligatorio
          ? 'Aún no has cargado este documento requerido.'
          : 'Este documento es opcional; puedes cargarlo si lo tienes disponible.',
        icono: 'pendiente',
        permiteSubida: true,
        textoBoton: 'Cargar'
      };
    case 'RECIBIDO':
      return {
        etiqueta: 'Recibido, en revisión',
        detalle: 'Archivo cargado en verificación preliminar. No equivale aún a documento validado.',
        icono: 'revision',
        permiteSubida: false,
        textoBoton: null
      };
    case 'VALIDADO':
      return {
        etiqueta: 'Validado',
        detalle: 'Documento validado conforme a los requisitos.',
        icono: 'validado',
        permiteSubida: false,
        textoBoton: null
      };
    case 'OBSERVADO':
      return {
        etiqueta: 'Observado',
        detalle: requisito.motivo?.texto
          ? `Observación: ${requisito.motivo.texto}`
          : 'Se requiere una aclaración sobre este documento.',
        icono: 'observado',
        permiteSubida: true,
        textoBoton: 'Reemplazar'
      };
    case 'REEMPLAZO_SOLICITADO':
      return {
        etiqueta: 'Reemplazo solicitado',
        detalle: requisito.motivo?.texto
          ? `Necesitamos un archivo nuevo: ${requisito.motivo.texto}`
          : 'Necesitamos que cargues un archivo nuevo.',
        icono: 'reemplazo',
        permiteSubida: true,
        textoBoton: 'Reemplazar'
      };
    case 'REEMPLAZADO':
      return {
        etiqueta: 'Reemplazado',
        detalle: 'Archivo sustituido por una versión posterior.',
        icono: 'revision',
        permiteSubida: false,
        textoBoton: null
      };
    default:
      return {
        etiqueta: 'Pendiente',
        detalle: null,
        icono: 'pendiente',
        permiteSubida: true,
        textoBoton: 'Cargar'
      };
  }
}

/**
 * Mensaje institucional tras el precalificador según Brief §4.7.
 * Siempre en condicional y recordando que la confirmación formal es de la Universidad.
 */
export function mensajeResultadoPrecalificador(via: string, nombre?: string | null): { titulo: string; mensaje: string; advertencia: string } {
  const nombreStr = nombre ? `¡Gracias, ${nombre}!` : '¡Gracias!';
  // FGREC responde LICENCIATURA; LICENCIATURA_COMPLETA se conserva por compatibilidad.
  if (via === 'LICENCIATURA' || via === 'LICENCIATURA_COMPLETA') {
    return {
      titulo: 'Licenciatura completa',
      mensaje: `${nombreStr} Con los antecedentes que nos indicaste, puedes avanzar por la vía de una licenciatura completa.`,
      advertencia: 'Ten en cuenta que la confirmación académica final es emitida por la Universidad del Gran Rosario.'
    };
  }

  return {
    titulo: 'Vía en evaluación académica',
    mensaje: `${nombreStr} Tus antecedentes pueden ser evaluados por la Universidad para determinar qué reconocimiento de trayecto o ciclo corresponde.`,
    advertencia: 'La resolución académica final sobre equivalencias y materias corresponde exclusivamente a la Universidad del Gran Rosario.'
  };
}

export interface ResumenDocumentosPanel {
  completos: boolean;
  etiqueta: string;
}

/**
 * Estado de los documentos para el panel "Mi postulación". `documentos.pendientes` cuenta solo obligatorios sin
 * archivo y `total` incluye los opcionales, así que el panel habla de "obligatorios": nunca llama "completos" al
 * conjunto mientras haya uno opcional sin cargar. La regla de completitud es del servidor (`expediente`).
 */
export function resumirDocumentosPanel(
  documentos: { pendientes?: number; observados?: number; total?: number } | null | undefined,
  expediente?: { documentosCompletos?: boolean } | null
): ResumenDocumentosPanel {
  const pendientes = Number(documentos?.pendientes ?? 0);
  const observados = Number(documentos?.observados ?? 0);
  const total = Number(documentos?.total ?? 0);
  const completos = typeof expediente?.documentosCompletos === 'boolean'
    ? expediente.documentosCompletos
    : pendientes === 0 && observados === 0 && total > 0;
  if (completos) return { completos: true, etiqueta: 'Obligatorios completos' };
  if (pendientes > 0) {
    return { completos: false, etiqueta: pendientes === 1 ? 'Falta 1 obligatorio' : `Faltan ${pendientes} obligatorios` };
  }
  if (observados > 0) {
    return { completos: false, etiqueta: observados === 1 ? '1 documento con observaciones' : `${observados} documentos con observaciones` };
  }
  return { completos: false, etiqueta: 'Pendiente de carga' };
}

export const LIMITE_MAX_BYTES_ARCHIVO = 10 * 1024 * 1024; // 10 MB
export const TIPOS_MIME_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export type TipoMimePermitido = typeof TIPOS_MIME_PERMITIDOS[number];

/**
 * Deduce el tipo MIME permitido a partir del mime informado o de la extensión del archivo.
 * Si no corresponde a PDF, JPG o PNG, retorna null.
 */
export function deducirTipoMime(archivo: { name: string; type?: string }): TipoMimePermitido | null {
  const mime = (archivo.type || '').toLowerCase().trim();
  if ((TIPOS_MIME_PERMITIDOS as readonly string[]).includes(mime)) {
    return mime as TipoMimePermitido;
  }
  const ext = archivo.name.toLowerCase().split('.').pop() || '';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  return null;
}

/**
 * Valida si un archivo cumple tipo y tamaño en cliente antes de pedir token.
 */
export function validarArchivoCliente(archivo: { name: string; size: number; type: string }): { valido: boolean; tipoMime?: TipoMimePermitido; error?: string; esHeic?: boolean } {
  const ext = archivo.name.toLowerCase().split('.').pop() || '';
  const esHeic = archivo.type === 'image/heic' || archivo.type === 'image/heif' || ext === 'heic' || ext === 'heif';

  if (esHeic) {
    return {
      valido: false,
      esHeic: true,
      error: 'Las imágenes HEIC deben convertirse a JPEG antes de subir. Si usas iPhone, puedes seleccionar la foto desde el carrete o capturarla en formato compatible.'
    };
  }

  if (archivo.size <= 0) {
    return { valido: false, error: 'El archivo está vacío.' };
  }

  if (archivo.size > LIMITE_MAX_BYTES_ARCHIVO) {
    return { valido: false, error: 'El archivo supera el tamaño máximo permitido de 10 MB.' };
  }

  const tipoDeducido = deducirTipoMime(archivo);
  if (!tipoDeducido) {
    return { valido: false, error: 'Formato no admitido. Solo se aceptan archivos PDF, JPG y PNG.' };
  }

  return { valido: true, tipoMime: tipoDeducido };
}

/**
 * Mensaje explicativo ante rechazos de subida en la ruta directa de FGREC.
 * Aclara siempre que cualquier rechazo gasta el token y hay que volver a elegir el archivo.
 */
export function mensajeErrorSubida(status: number, code?: string, serverMessage?: string): string {
  let detalle = 'El archivo fue rechazado por el servidor.';
  if (status === 401 || code === 'UPLOAD_TOKEN_INVALID') {
    detalle = 'La autorización de carga venció o ya fue utilizada.';
  } else if (status === 409 || code === 'UPLOAD_NOT_ALLOWED' || code === 'CONSENT_REQUIRED') {
    detalle = 'No está habilitada la carga o se requiere aceptar el consentimiento primero.';
  } else if (status === 413 || code === 'TOO_LARGE') {
    detalle = 'El archivo excede el tamaño máximo permitido (10 MB).';
  } else if (status === 415 || code === 'UNSUPPORTED_TYPE') {
    detalle = 'Formato no soportado. Asegúrate de subir un archivo PDF, JPG o PNG.';
  } else if (status === 422 || code === 'INVALID_FILE' || code === 'ACTIVE_CONTENT') {
    detalle = serverMessage || 'El contenido del archivo no es válido (los PDFs con scripts o contenido activo no están permitidos).';
  } else if (serverMessage) {
    detalle = serverMessage;
  }
  return `${detalle} Debes volver a seleccionar el archivo para solicitar una nueva autorización de carga (cada autorización es de un solo uso).`;
}

/**
 * Sanea y valida si una URL de subida emitida por FGREC coincide con el host configurado.
 */
export function validarUrlSubida(urlEmitida: string, origenPermitido: string): boolean {
  try {
    const emitida = new URL(urlEmitida);
    const permitido = new URL(origenPermitido);
    return emitida.protocol === permitido.protocol && emitida.host === permitido.host;
  } catch {
    return false;
  }
}

/**
 * Valida un contacto ingresado en "Ingresar" (correo o teléfono con +).
 */
export function normalizarContacto(contacto: string): { valido: boolean; normalizado: string; esEmail: boolean } {
  const limpio = contacto.trim();
  if (!limpio) return { valido: false, normalizado: '', esEmail: false };

  if (limpio.includes('@')) {
    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio);
    return { valido: emailValido, normalizado: limpio.toLowerCase(), esEmail: true };
  }

  // Teléfono: debe incluir código de país con '+'
  const telLimpio = limpio.replace(/[\s\-()]/g, '');
  const esTelValido = /^\+[1-9]\d{6,14}$/.test(telLimpio);
  return { valido: esTelValido, normalizado: telLimpio, esEmail: false };
}

/**
 * Whether the dashboard shows the letter as sent. The server's `expediente.cartaEnviada` (GET postulacion) is the
 * source; an older backend without the field falls back to the previous inference (the dossier is in review, which
 * requires the letter to be sent).
 */
export function cartaEnviadaEnPanel(postulacion: unknown, enRevision: boolean): boolean {
  const expediente = (postulacion as { expediente?: { cartaEnviada?: unknown } } | null | undefined)?.expediente;
  return typeof expediente?.cartaEnviada === 'boolean' ? expediente.cartaEnviada : enRevision;
}
