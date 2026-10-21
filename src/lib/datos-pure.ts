// "Mis datos" del portal: lectura del contrato de FGREC (GET/POST datos, POST datos/nombre), armado del cuerpo con
// solo lo que cambió, validación previa del proxy y traducción de errores a frases para el postulante.

export const LARGO_MAX_DOCUMENTO = 40;
export const LARGO_MAX_COMENTARIO = 500;

export interface DatosPostulante {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  documento: string;
  /** 'YYYY-MM-DD' o vacío. */
  fechaNacimiento: string;
  documentoEditable: boolean;
}

const texto = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Normaliza la respuesta de FGREC: los campos que pueden venir null llegan como texto vacío. */
export function leerDatos(data: any): DatosPostulante {
  return {
    nombre: texto(data?.nombre),
    apellido: texto(data?.apellido),
    email: texto(data?.email),
    telefono: texto(data?.telefono),
    documento: texto(data?.documento),
    fechaNacimiento: texto(data?.fechaNacimiento),
    // Ante la duda no se deja cambiar el número: FGREC lo vuelve a validar de todos modos.
    documentoEditable: data?.documentoEditable === true
  };
}

/** Solo viajan los campos que el postulante cambió (el número, únicamente si todavía se puede editar). */
export function construirCambios(
  actual: { documento: string; fechaNacimiento: string },
  nuevo: { documento?: string; fechaNacimiento?: string },
  documentoEditable: boolean
): { documento?: string; fechaNacimiento?: string } {
  const out: { documento?: string; fechaNacimiento?: string } = {};
  const documento = (nuevo.documento ?? '').trim();
  const fecha = (nuevo.fechaNacimiento ?? '').trim();
  if (documentoEditable && documento !== actual.documento.trim()) out.documento = documento;
  if (fecha !== actual.fechaNacimiento) out.fechaNacimiento = fecha;
  return out;
}

/** Fecha local del navegador en 'YYYY-MM-DD' (para el `max` del campo de fecha). */
export function fechaLocalIso(d: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export type CuerpoPreparado<T> = { ok: true; cuerpo: T } | { ok: false; field: string; message: string };

/** Valida lo mínimo antes de molestar a FGREC; el detalle (formato del número, edad) lo decide FGREC. */
export function prepararCuerpoDatos(body: any): CuerpoPreparado<{ documento?: string; fechaNacimiento?: string }> {
  const cuerpo: { documento?: string; fechaNacimiento?: string } = {};
  if (body?.documento !== undefined) {
    const documento = typeof body.documento === 'string' ? body.documento.trim() : '';
    if (!documento) return { ok: false, field: 'documento', message: 'Escribe tu número de documento.' };
    if (documento.length > LARGO_MAX_DOCUMENTO) {
      return { ok: false, field: 'documento', message: `El número de documento no puede superar ${LARGO_MAX_DOCUMENTO} caracteres.` };
    }
    cuerpo.documento = documento;
  }
  if (body?.fechaNacimiento !== undefined) {
    const fecha = typeof body.fechaNacimiento === 'string' ? body.fechaNacimiento.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, field: 'fechaNacimiento', message: 'Indica una fecha de nacimiento válida.' };
    cuerpo.fechaNacimiento = fecha;
  }
  if (cuerpo.documento === undefined && cuerpo.fechaNacimiento === undefined) {
    return { ok: false, field: 'datos', message: 'Indica al menos un dato para guardar.' };
  }
  return { ok: true, cuerpo };
}

/** El comentario del aviso de nombre es opcional: sin texto, el cuerpo viaja vacío. */
export function prepararCuerpoNombre(body: any): CuerpoPreparado<{ comentario?: string }> {
  const bruto = body?.comentario;
  if (bruto === undefined || bruto === null) return { ok: true, cuerpo: {} };
  if (typeof bruto !== 'string') return { ok: false, field: 'comentario', message: 'El comentario no es válido.' };
  const comentario = bruto.trim();
  if (comentario.length > LARGO_MAX_COMENTARIO) {
    return { ok: false, field: 'comentario', message: `El comentario no puede superar ${LARGO_MAX_COMENTARIO} caracteres.` };
  }
  return { ok: true, cuerpo: comentario ? { comentario } : {} };
}

export interface ErrorDatos {
  /** Campo junto al que se muestra el mensaje; null cuando va en la alerta general. */
  campo: 'documento' | 'fechaNacimiento' | 'comentario' | null;
  mensaje: string;
}

/** Traduce un error de FGREC (o del proxy) a una frase para el postulante. */
export function mensajeErrorDatos(status: number, data: { code?: string; message?: string; field?: string } | null | undefined): ErrorDatos {
  if (status === 429) return { campo: null, mensaje: 'Realizaste muchas solicitudes en poco tiempo. Espera unos minutos e inténtalo de nuevo.' };
  if (status >= 500) return { campo: null, mensaje: 'El servicio no está disponible por ahora. Inténtalo de nuevo en unos minutos.' };
  const mensaje = typeof data?.message === 'string' ? data.message.trim() : '';
  if (status === 400) {
    const campo = data?.field === 'documento' || data?.field === 'fechaNacimiento' || data?.field === 'comentario' ? data.field : null;
    return { campo, mensaje: mensaje || 'No pudimos procesar esos datos. Revisa lo que escribiste e inténtalo de nuevo.' };
  }
  if (status === 409) return { campo: null, mensaje: mensaje || 'No pudimos guardar el número de documento. Escríbele a tu asesora.' };
  return { campo: null, mensaje: mensaje || 'No pudimos guardar tus datos. Inténtalo de nuevo en unos minutos.' };
}
