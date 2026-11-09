// "Mis datos" del portal: lectura del contrato de FGREC (GET/POST datos, POST datos/nombre), armado del cuerpo con
// solo lo que cambió, validación previa del proxy y traducción de errores a frases para el postulante.

export const LARGO_MAX_DOCUMENTO = 40;
export const LARGO_MAX_COMENTARIO = 500;

/** Campos de contacto y domicilio que el postulante carga además del documento, con el tope de largo de FGREC. */
export const LARGOS_DATOS = {
  nacionalidad: 60,
  paisResidencia: 60,
  calle: 120,
  numero: 20,
  piso: 20,
  depto: 20,
  codigoPostal: 20
} as const;
export const CAMPOS_DATOS = ['fechaNacimiento', 'nacionalidad', 'paisResidencia', 'calle', 'numero', 'piso', 'depto', 'codigoPostal'] as const;
export type CampoDato = (typeof CAMPOS_DATOS)[number];
type CampoTexto = 'documento' | CampoDato;

export interface DatosPostulante extends Record<CampoTexto, string> {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  documentoEditable: boolean;
  /** Las listas cerradas de nacionalidad y país de residencia salen de FGREC, no se escriben aquí. */
  paises: string[];
  /** false desde que el expediente se aprueba: solo se pueden llenar los campos vacíos. */
  datosEditables: boolean;
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
    // Ante la duda no se deja cambiar el número: FGREC lo vuelve a validar de todos modos.
    documentoEditable: data?.documentoEditable === true,
    fechaNacimiento: texto(data?.fechaNacimiento),
    nacionalidad: texto(data?.nacionalidad),
    paisResidencia: texto(data?.paisResidencia),
    calle: texto(data?.calle),
    numero: texto(data?.numero),
    piso: texto(data?.piso),
    depto: texto(data?.depto),
    codigoPostal: texto(data?.codigoPostal),
    paises: Array.isArray(data?.paises) ? data.paises.filter((p: unknown): p is string => typeof p === 'string') : [],
    datosEditables: data?.datosEditables === true
  };
}

/** Lo que FGREC todavía no tiene del postulante, para avisarle en el inicio del portal. Número, piso y depto son opcionales. */
export function datosFaltantes(datos: DatosPostulante): string[] {
  const requeridos: Array<[CampoTexto, string]> = [
    ['documento', 'tu número de documento'],
    ['fechaNacimiento', 'tu fecha de nacimiento'],
    ['nacionalidad', 'tu nacionalidad'],
    ['paisResidencia', 'tu país de residencia'],
    ['calle', 'tu calle'],
    ['codigoPostal', 'tu código postal']
  ];
  return requeridos.filter(([campo]) => !datos[campo]).map(([, nombre]) => nombre);
}

/** Con los datos cerrados (expediente aprobado) solo se llena lo que está vacío. */
export function campoEditable(actual: Partial<Record<CampoDato, string>>, campo: CampoDato, datosEditables: boolean): boolean {
  return datosEditables || !actual[campo];
}

/** Solo viaja lo que cambió y todavía se puede editar; un campo vacío nunca viaja (FGREC no borra datos desde el portal). */
export function construirCambios(
  actual: Partial<Record<CampoTexto, string>>,
  nuevo: Partial<Record<CampoTexto, string>>,
  documentoEditable: boolean,
  datosEditables = true
): Partial<Record<CampoTexto, string>> {
  const cambios: Partial<Record<CampoTexto, string>> = {};
  const documento = (nuevo.documento ?? '').trim();
  if (documentoEditable && documento !== (actual.documento ?? '').trim()) cambios.documento = documento;
  for (const campo of CAMPOS_DATOS) {
    const valor = (nuevo[campo] ?? '').trim();
    if (valor && valor !== (actual[campo] ?? '').trim() && campoEditable(actual, campo, datosEditables)) cambios[campo] = valor;
  }
  return cambios;
}

/** Los datos personales viajan a la universidad bajo la autorización de documentos; el número de documento solo no la pide. */
export function tocaDatosPersonales(cambios: Partial<Record<CampoTexto, string>>): boolean {
  return CAMPOS_DATOS.some((campo) => cambios[campo] !== undefined);
}

export type CuerpoPreparado<T> = { ok: true; cuerpo: T } | { ok: false; field: string; message: string };

/** Valida lo mínimo antes de molestar a FGREC; el detalle (formato del número, de la fecha, la lista de países) lo decide FGREC. */
export function prepararCuerpoDatos(body: any): CuerpoPreparado<Partial<Record<CampoTexto, string>>> {
  const cuerpo: Partial<Record<CampoTexto, string>> = {};
  if (body?.documento !== undefined) {
    const documento = typeof body.documento === 'string' ? body.documento.trim() : '';
    if (!documento) return { ok: false, field: 'documento', message: 'Escribe tu número de documento.' };
    if (documento.length > LARGO_MAX_DOCUMENTO) {
      return { ok: false, field: 'documento', message: `El número de documento no puede superar ${LARGO_MAX_DOCUMENTO} caracteres.` };
    }
    cuerpo.documento = documento;
  }
  for (const campo of CAMPOS_DATOS) {
    const bruto = body?.[campo];
    if (bruto === undefined || bruto === '') continue;
    if (typeof bruto !== 'string') return { ok: false, field: campo, message: 'El dato no es válido.' };
    const valor = bruto.trim();
    if (!valor) continue;
    const max = campo === 'fechaNacimiento' ? 10 : LARGOS_DATOS[campo];
    if (valor.length > max) return { ok: false, field: campo, message: `Este dato no puede superar ${max} caracteres.` };
    cuerpo[campo] = valor;
  }
  if (!Object.keys(cuerpo).length) return { ok: false, field: 'datos', message: 'Indica al menos un dato para guardar.' };
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
  campo: CampoTexto | 'comentario' | null;
  mensaje: string;
}

const campoConocido = (f: unknown): CampoTexto | null =>
  f === 'documento' || (CAMPOS_DATOS as readonly string[]).includes(f as string) ? (f as CampoTexto) : null;

/** Traduce un error de FGREC (o del proxy) a una frase para el postulante. */
export function mensajeErrorDatos(status: number, data: { code?: string; message?: string; field?: string } | null | undefined): ErrorDatos {
  const mensaje = typeof data?.message === 'string' ? data.message.trim() : '';
  // The daily cap of document numbers: FGREC says when to try again.
  if (status === 429 && data?.code === 'TOO_MANY_ATTEMPTS' && mensaje) return { campo: 'documento', mensaje };
  if (status === 429) return { campo: null, mensaje: 'Realizaste muchas solicitudes en poco tiempo. Espera unos minutos e inténtalo de nuevo.' };
  if (status >= 500) return { campo: null, mensaje: 'El servicio no está disponible por ahora. Inténtalo de nuevo en unos minutos.' };
  if (status === 400) {
    const campo = data?.field === 'comentario' ? 'comentario' : campoConocido(data?.field);
    return { campo, mensaje: mensaje || 'No pudimos procesar esos datos. Revisa lo que escribiste e inténtalo de nuevo.' };
  }
  // A filled field that is already locked: the message goes next to it.
  if (status === 409 && data?.code === 'DATA_LOCKED' && campoConocido(data?.field)) return { campo: campoConocido(data?.field), mensaje: mensaje || 'Este dato ya no se puede cambiar. Escríbele a tu asesora.' };
  if (status === 409) return { campo: null, mensaje: mensaje || 'No pudimos guardar el número de documento. Escríbele a tu asesora.' };
  return { campo: null, mensaje: mensaje || 'No pudimos guardar tus datos. Inténtalo de nuevo en unos minutos.' };
}
