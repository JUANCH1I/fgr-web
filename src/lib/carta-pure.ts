// Lógica pura de la carta de interés del portal (sin DOM ni red): conteo, respaldo local,
// resumen del expediente, mensajes de error y el controlador de autoguardado.
// Contrato: docs/integracion-web.md §4.5 del repositorio fgrec-sistema.

export const MAXIMO_CARACTERES_CARTA = 100_000;
export const UMBRAL_CONTADOR_CARTA = 90_000;
export const RETRASO_AUTOGUARDADO_MS = 2000;
export const ESPERAS_REINTENTO_MS = [4000, 8000, 16000, 30000] as const;

/** El servidor cuenta puntos de código (no unidades UTF-16): se cuenta igual. */
export function contarCaracteres(texto: string): number {
  let n = 0;
  for (const _ of texto) n++;
  return n;
}

export function debeMostrarContador(caracteres: number, umbral: number = UMBRAL_CONTADOR_CARTA): boolean {
  return caracteres >= umbral;
}

export function superaMaximo(caracteres: number, maximo: number = MAXIMO_CARACTERES_CARTA): boolean {
  return caracteres > maximo;
}

export function textoEnviable(texto: string): boolean {
  return texto.trim().length > 0;
}

/** Fecha larga en español para "Enviada el …". Devuelve '' si la fecha no es válida. */
export function formatearFechaCarta(iso?: string | null): string {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return new Intl.DateTimeFormat('es', { dateStyle: 'long', timeZone: 'America/Guayaquil' }).format(fecha);
}

// --- Respaldo local (localStorage) -------------------------------------------------------------

export interface RespaldoCarta {
  version: number;
  texto: string;
  /** true cuando el servidor confirmó exactamente este texto; false si hay cambios sin confirmar. */
  sincronizado: boolean;
}

export function claveRespaldoCarta(claveSesion: string): string {
  return `fgrec_carta_borrador:${claveSesion}`;
}

export function serializarRespaldo(respaldo: RespaldoCarta): string {
  return JSON.stringify(respaldo);
}

export function leerRespaldo(crudo: string | null | undefined): RespaldoCarta | null {
  if (!crudo) return null;
  try {
    const dato = JSON.parse(crudo);
    if (
      dato &&
      typeof dato.texto === 'string' &&
      typeof dato.version === 'number' &&
      typeof dato.sincronizado === 'boolean'
    ) {
      return { version: dato.version, texto: dato.texto, sincronizado: dato.sincronizado };
    }
  } catch {
    // respaldo corrupto: se ignora
  }
  return null;
}

export interface ResultadoFusion {
  texto: string;
  /** El texto elegido es el respaldo local y el servidor aún no lo tiene: hay que guardarlo. */
  recuperadoDelRespaldo: boolean;
}

/**
 * Decide qué texto mostrar al abrir la carta. El respaldo gana solo si es de la misma versión,
 * quedó con cambios sin confirmar por el servidor y difiere del borrador del servidor.
 * No se comparan relojes: la bandera `sincronizado` evita depender de la hora del teléfono.
 */
export function fusionarBorrador(servidor: { version: number; texto: string }, respaldo: RespaldoCarta | null): ResultadoFusion {
  if (
    respaldo &&
    respaldo.version === servidor.version &&
    !respaldo.sincronizado &&
    respaldo.texto.trim().length > 0 &&
    respaldo.texto !== servidor.texto
  ) {
    return { texto: respaldo.texto, recuperadoDelRespaldo: true };
  }
  return { texto: servidor.texto, recuperadoDelRespaldo: false };
}

// --- Resumen del expediente (documentos + carta) ----------------------------------------------

export interface RequisitoResumen {
  obligatorio?: boolean;
  estado?: string;
}

export interface RequisitoResumen {
  obligatorio?: boolean;
  estado?: string;
}

export type EstadoExpediente = 'EN_PREPARACION' | 'EN_REVISION' | 'REVISADO';

/** Estado oficial del expediente tal como lo devuelve el servidor (GET documentos y GET carta). */
export interface ExpedienteServidor {
  documentosCompletos: boolean;
  cartaEnviada: boolean;
  estado: EstadoExpediente;
}

export interface ResumenExpediente {
  /** Obligatorios con documento recibido o validado (solo para mostrar «X de Y»). */
  obligatoriosTotal: number;
  obligatoriosCompletos: number;
  documentosCompletos: boolean;
  cartaEnviada: boolean;
  listoParaRevision: boolean;
  estado: EstadoExpediente;
  /** El expediente está en revisión o ya fue revisado: ni la carta ni los documentos se editan. */
  soloLectura: boolean;
}

const ESTADOS_EXPEDIENTE: readonly string[] = ['EN_PREPARACION', 'EN_REVISION', 'REVISADO'];

/** Lee `expediente` de una respuesta del servidor; null si falta o no tiene la forma del contrato (servidor anterior). */
export function leerExpediente(crudo: unknown): ExpedienteServidor | null {
  if (!crudo || typeof crudo !== 'object') return null;
  const e = crudo as Record<string, unknown>;
  if (typeof e.documentosCompletos !== 'boolean' || typeof e.cartaEnviada !== 'boolean') return null;
  if (typeof e.estado !== 'string' || !ESTADOS_EXPEDIENTE.includes(e.estado)) return null;
  return { documentosCompletos: e.documentosCompletos, cartaEnviada: e.cartaEnviada, estado: e.estado as EstadoExpediente };
}

/**
 * Resumen para mostrar. La regla de «documentos completos» es del servidor (`expediente`, que descuenta los
 * requisitos que no aplican a la persona): el sitio no la recalcula. Solo si el servidor no la envía (despliegue
 * del sitio antes que el backend) se usa el cálculo local anterior y el estado queda EN_PREPARACION.
 */
export function resumirExpediente(
  requisitos: RequisitoResumen[],
  cartaEnviadaLocal: boolean,
  expediente?: ExpedienteServidor | null
): ResumenExpediente {
  const obligatorios = requisitos.filter((r) => r.obligatorio);
  const recibidos = obligatorios.filter((r) => r.estado === 'RECIBIDO' || r.estado === 'VALIDADO').length;
  const documentosCompletos = expediente ? expediente.documentosCompletos : recibidos === obligatorios.length;
  const cartaEnviada = expediente ? expediente.cartaEnviada : cartaEnviadaLocal;
  const estado = expediente ? expediente.estado : 'EN_PREPARACION';
  return {
    obligatoriosTotal: obligatorios.length,
    obligatoriosCompletos: recibidos,
    documentosCompletos,
    cartaEnviada,
    listoParaRevision: documentosCompletos && cartaEnviada,
    estado,
    soloLectura: estado !== 'EN_PREPARACION'
  };
}

// --- Errores ----------------------------------------------------------------------------------

export interface ErrorCartaUI {
  mensaje: string;
  /** No tiene sentido reintentar: la sesión venció o la carta ya no admite cambios. */
  fatal: boolean;
  /** El navegador debe volver a ingresar. */
  sesionVencida: boolean;
  /** La carta ya fue enviada: recargar muestra la vista de solo lectura. */
  yaEnviada: boolean;
}

export function interpretarErrorCarta(status: number, code?: string, message?: string): ErrorCartaUI {
  if (status === 401) {
    return { mensaje: 'Tu sesión venció. Vuelve a ingresar; tu texto quedó guardado en este dispositivo.', fatal: true, sesionVencida: true, yaEnviada: false };
  }
  if (code === 'LETTER_SENT') {
    return { mensaje: 'Tu carta ya fue enviada y no se puede modificar.', fatal: true, sesionVencida: false, yaEnviada: true };
  }
  if (status === 429) {
    return { mensaje: 'Hay muchas solicitudes en este momento. Reintentaremos en unos instantes.', fatal: false, sesionVencida: false, yaEnviada: false };
  }
  if (status === 413 || code === 'PAYLOAD_TOO_LARGE') {
    return { mensaje: 'La carta es demasiado extensa para guardarla. Reduce el texto e inténtalo de nuevo.', fatal: true, sesionVencida: false, yaEnviada: false };
  }
  if (code === 'INVALID_INPUT' || code === 'LETTER_EMPTY') {
    return { mensaje: message || 'Escribe tu carta antes de enviarla.', fatal: true, sesionVencida: false, yaEnviada: false };
  }
  if (status === 403 || code === 'COUNTRY_REQUIRED' || code === 'GUIDE_UNAVAILABLE') {
    return { mensaje: message || 'La carta no está disponible por ahora.', fatal: true, sesionVencida: false, yaEnviada: false };
  }
  return { mensaje: message || 'No se pudo completar la operación. Inténtalo de nuevo en unos minutos.', fatal: false, sesionVencida: false, yaEnviada: false };
}

// --- Autoguardado -----------------------------------------------------------------------------

export type EstadoAutoguardado = 'inactivo' | 'pendiente' | 'guardando' | 'guardado' | 'error' | 'detenido';

export interface ResultadoGuardado {
  ok: boolean;
  /** Error que no se arregla reintentando (sesión vencida, carta enviada, texto inválido). */
  fatal?: boolean;
  /** Pistas del servidor (p. ej. 429) para alargar la espera. */
  mensaje?: string;
}

export interface OpcionesAutoguardado {
  guardar: (texto: string) => Promise<ResultadoGuardado>;
  alCambiarEstado: (estado: EstadoAutoguardado, detalle?: string) => void;
  /** Se llama tras cada guardado confirmado con el texto exacto que el servidor recibió. */
  alConfirmar?: (texto: string) => void;
  /** Texto que el servidor ya tiene al abrir la carta (no se vuelve a guardar si no cambia). */
  textoInicial?: string;
  retrasoMs?: number;
  esperasReintentoMs?: readonly number[];
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

export interface Autoguardado {
  /** Notifica que el texto cambió; programa un guardado diferido. */
  cambiar(texto: string): void;
  /** Guarda ya (blur, ocultar pestaña) si hay algo pendiente. */
  vaciar(): void;
  /** Cancela todo sin guardar (p. ej. antes de enviar la carta). */
  detener(): void;
  /** Vuelve a habilitar tras `detener()` (p. ej. si el envío falló). */
  reanudar(): void;
  haySinGuardar(): boolean;
  estado(): EstadoAutoguardado;
}

/**
 * Autoguardado con debounce, un solo guardado en vuelo, y reintento con espera creciente.
 * Si el texto cambia mientras se guarda, encadena otro guardado al terminar: nunca se pierde la última versión.
 */
export function crearAutoguardado(opciones: OpcionesAutoguardado): Autoguardado {
  const retraso = opciones.retrasoMs ?? RETRASO_AUTOGUARDADO_MS;
  const esperas = opciones.esperasReintentoMs ?? ESPERAS_REINTENTO_MS;
  const setT = opciones.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearT = opciones.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));

  let estado: EstadoAutoguardado = 'inactivo';
  let ultimoTexto: string | null = opciones.textoInicial ?? null; // último texto observado
  let ultimoConfirmado: string | null = opciones.textoInicial ?? null; // último texto que el servidor confirmó
  let timer: unknown = null;
  let enVuelo = false;
  let detenido = false;
  let fallos = 0;

  function fijar(nuevo: EstadoAutoguardado, detalle?: string) {
    estado = nuevo;
    opciones.alCambiarEstado(nuevo, detalle);
  }

  function limpiarTimer() {
    if (timer !== null) {
      clearT(timer);
      timer = null;
    }
  }

  function programar(ms: number) {
    limpiarTimer();
    timer = setT(() => {
      timer = null;
      void ejecutar();
    }, ms);
  }

  function haySinGuardar(): boolean {
    return ultimoTexto !== null && ultimoTexto !== ultimoConfirmado;
  }

  async function ejecutar(): Promise<void> {
    if (detenido || enVuelo || !haySinGuardar()) return;
    const texto = ultimoTexto as string;
    enVuelo = true;
    fijar('guardando');
    let resultado: ResultadoGuardado;
    try {
      resultado = await opciones.guardar(texto);
    } catch {
      resultado = { ok: false };
    }
    enVuelo = false;
    if (detenido) return;

    if (resultado.ok) {
      fallos = 0;
      ultimoConfirmado = texto;
      opciones.alConfirmar?.(texto);
      if (haySinGuardar()) {
        // Cambió mientras se guardaba: otro guardado inmediato con el texto más nuevo.
        fijar('pendiente');
        programar(retraso);
      } else {
        fijar('guardado');
      }
      return;
    }

    if (resultado.fatal) {
      detenido = true;
      limpiarTimer();
      fijar('detenido', resultado.mensaje);
      return;
    }

    const espera = esperas[Math.min(fallos, esperas.length - 1)];
    fallos++;
    fijar('error', resultado.mensaje);
    programar(espera);
  }

  return {
    cambiar(texto: string) {
      if (detenido) return;
      ultimoTexto = texto;
      if (!haySinGuardar()) {
        // Volvió al texto ya confirmado: no hay nada que guardar.
        limpiarTimer();
        if (!enVuelo) fijar('guardado');
        return;
      }
      if (estado !== 'error') fijar('pendiente');
      if (!enVuelo) programar(retraso);
    },
    vaciar() {
      if (detenido || enVuelo || !haySinGuardar()) return;
      limpiarTimer();
      void ejecutar();
    },
    detener() {
      detenido = true;
      limpiarTimer();
    },
    reanudar() {
      if (!detenido) return;
      detenido = false;
      if (haySinGuardar()) programar(retraso);
    },
    haySinGuardar,
    estado: () => estado
  };
}
