// Modelo de presentación de la página de documentos del portal (sin DOM ni red).
// Decide qué dice la tarjeta de estado, cómo se ve cada fila de documento y cómo se resume cada sección.
// El estado oficial del expediente lo calcula el servidor; aquí solo se traduce a texto y acciones.

import { presentarEstadoDocumento, type RequisitoUI } from './portal-pure.ts';
import type { EstadoExpediente } from './carta-pure.ts';

// --- Filas de documento ------------------------------------------------------------------------

export type IconoFila = 'pendiente' | 'recibido' | 'validado' | 'observado' | 'reemplazo';

export interface FilaDocumento {
  /** Estado en lenguaje llano, una línea (va en la etiqueta de la fila). */
  estadoTexto: string;
  icono: IconoFila;
  /** Color de la etiqueta según los estilos del panel: ok (verde), pendiente (ámbar) o error (rojo). */
  tono: 'ok' | 'pendiente' | 'error';
  /** Solo los opcionales se marcan: la sección ya dice cuántos obligatorios hay. */
  opcional: boolean;
  /** Aviso con el motivo y la acción. Solo existe cuando el postulante tiene algo que hacer o leer. */
  nota: string | null;
  permiteSubida: boolean;
  textoBoton: string | null;
}

/** Agrega el punto final a una frase que no lo trae (los motivos del personal suelen venir sin él). */
export function cerrarFrase(texto: string): string {
  const limpio = texto.trim();
  if (!limpio) return '';
  return /[.!?…]$/.test(limpio) ? limpio : `${limpio}.`;
}

export function presentarFilaDocumento(req: RequisitoUI, soloLectura: boolean): FilaDocumento {
  const base = presentarEstadoDocumento(req);
  const permiteSubida = base.permiteSubida && !soloLectura;
  const opcional = !req.obligatorio;

  switch (req.estado) {
    case 'RECIBIDO':
    case 'REEMPLAZADO':
      return { estadoTexto: 'Recibido', icono: 'recibido', tono: 'ok', opcional, nota: null, permiteSubida: false, textoBoton: null };
    case 'VALIDADO':
      return { estadoTexto: 'Validado', icono: 'validado', tono: 'ok', opcional, nota: null, permiteSubida: false, textoBoton: null };
    case 'OBSERVADO':
    case 'REEMPLAZO_SOLICITADO': {
      const detalle = base.detalle ? cerrarFrase(base.detalle) : '';
      const accion = permiteSubida ? 'Sube un archivo nuevo para reemplazarlo.' : '';
      return {
        estadoTexto: req.estado === 'OBSERVADO' ? 'Observado' : 'Reemplazo solicitado',
        icono: req.estado === 'OBSERVADO' ? 'observado' : 'reemplazo',
        tono: req.estado === 'OBSERVADO' ? 'pendiente' : 'error',
        opcional,
        nota: [detalle, accion].filter(Boolean).join(' ') || null,
        permiteSubida,
        textoBoton: permiteSubida ? 'Subir reemplazo' : null
      };
    }
    default:
      return {
        estadoTexto: 'Pendiente',
        icono: 'pendiente',
        tono: 'pendiente',
        opcional,
        nota: null,
        permiteSubida,
        textoBoton: permiteSubida ? 'Cargar archivo' : null
      };
  }
}

// --- Conteos y resumen de la sección Documentos ------------------------------------------------

export interface ConteoDocumentos {
  obligatoriosTotal: number;
  obligatoriosRecibidos: number;
  /** Obligatorios sin archivo. */
  pendientes: number;
  /** Observados o con reemplazo solicitado (obligatorios u opcionales): piden una acción del postulante. */
  conAccion: number;
  primerPendiente: string | null;
  primerConAccion: string | null;
}

const RECIBIDOS: readonly string[] = ['RECIBIDO', 'VALIDADO', 'REEMPLAZADO'];
const CON_ACCION: readonly string[] = ['OBSERVADO', 'REEMPLAZO_SOLICITADO'];

export function contarDocumentos(requisitos: RequisitoUI[]): ConteoDocumentos {
  const obligatorios = requisitos.filter((r) => r.obligatorio);
  const pendientes = obligatorios.filter((r) => r.estado === 'PENDIENTE');
  const conAccion = requisitos.filter((r) => CON_ACCION.includes(r.estado));
  return {
    obligatoriosTotal: obligatorios.length,
    obligatoriosRecibidos: obligatorios.filter((r) => RECIBIDOS.includes(r.estado)).length,
    pendientes: pendientes.length,
    conAccion: conAccion.length,
    primerPendiente: pendientes[0]?.codigo ?? null,
    primerConAccion: conAccion[0]?.codigo ?? null
  };
}

export function resumirSeccionDocumentos(conteo: ConteoDocumentos): string {
  const partes: string[] = [];
  if (conteo.obligatoriosTotal === 0) {
    partes.push('Sin documentos obligatorios');
  } else if (conteo.obligatoriosTotal === 1) {
    partes.push(conteo.obligatoriosRecibidos === 1 ? '1 obligatorio recibido' : '0 de 1 obligatorio recibido');
  } else {
    partes.push(`${conteo.obligatoriosRecibidos} de ${conteo.obligatoriosTotal} obligatorios recibidos`);
  }
  if (conteo.conAccion > 0) {
    partes.push(conteo.conAccion === 1 ? '1 por revisar' : `${conteo.conAccion} por revisar`);
  }
  return partes.join(' · ');
}

// --- Sección Carta de interés ------------------------------------------------------------------

/** Fecha corta dd/mm/aaaa en hora de Ecuador. Devuelve '' si la fecha no es válida. */
export function formatearFechaCorta(iso?: string | null): string {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Guayaquil',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).formatToParts(fecha);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${valor('day')}/${valor('month')}/${valor('year')}`;
}

export type EstadoCarta = 'ENVIADA' | 'NUEVA_VERSION' | 'BORRADOR' | 'VACIA' | 'BLOQUEADA' | 'NO_DISPONIBLE';

export interface EntradaCarta {
  carta?: { puedeEditar?: boolean; texto?: unknown; version?: unknown; enviadaEn?: string | null } | null;
  soloLectura: boolean;
}

export interface ResumenCarta {
  estado: EstadoCarta;
  /** Una línea para el encabezado de la sección; null cuando la carta no está disponible. */
  linea: string | null;
}

export function resumirCarta({ carta, soloLectura }: EntradaCarta): ResumenCarta {
  if (!carta) return { estado: 'NO_DISPONIBLE', linea: null };
  const tieneTexto = typeof carta.texto === 'string' && carta.texto.trim().length > 0;
  if (carta.puedeEditar === false) {
    const fecha = formatearFechaCorta(carta.enviadaEn);
    return { estado: 'ENVIADA', linea: fecha ? `Enviada el ${fecha}` : 'Enviada' };
  }
  if (soloLectura) {
    return { estado: 'BLOQUEADA', linea: 'No se puede editar mientras dura la revisión' };
  }
  if (Number(carta.version) > 1) {
    return { estado: 'NUEVA_VERSION', linea: 'Tu asesora pidió una versión nueva' };
  }
  return tieneTexto
    ? { estado: 'BORRADOR', linea: 'Borrador guardado, falta enviarla' }
    : { estado: 'VACIA', linea: 'Pendiente de escribir y enviar' };
}

// --- Tarjeta de estado -------------------------------------------------------------------------

export type TonoTarjeta = 'preparacion' | 'revision' | 'revisado';

export interface AccionTarjeta {
  texto: string;
  href: string;
}

export interface TarjetaEstado {
  tono: TonoTarjeta;
  /** Etiqueta corta sobre el título (la «fase en curso» del panel). */
  etiqueta: string;
  titulo: string;
  texto: string | null;
  /** Frase corta que tranquiliza: «No necesitas hacer nada por ahora». */
  aviso: string | null;
  accion: AccionTarjeta | null;
}

export interface EntradaTarjeta {
  estado: EstadoExpediente;
  conteo: ConteoDocumentos;
  documentosCompletos: boolean;
  cartaEnviada: boolean;
  /** La carta existe y se puede editar (no hay error de país ni está enviada). */
  cartaEditable: boolean;
  cartaTieneTexto: boolean;
  cartaNuevaVersion: boolean;
  /** El postulante todavía debe aceptar el consentimiento para poder cargar archivos. */
  consentimientoPendiente: boolean;
  proximoPaso?: { codigo?: string | null; texto?: string | null } | null;
}

const ETIQUETA_PREPARACION = 'Fase 2 en curso';

const PASOS_QUE_YA_NO_APLICAN: readonly string[] = ['CARGAR_DOCUMENTOS', 'SUBSANAR_DOCUMENTOS', 'ESCRIBIR_CARTA'];

function plural(n: number, singular: string, pluralTexto: string): string {
  return n === 1 ? `1 ${singular}` : `${n} ${pluralTexto}`;
}

export function modelarTarjetaEstado(e: EntradaTarjeta): TarjetaEstado {
  if (e.estado === 'EN_REVISION') {
    return {
      tono: 'revision',
      etiqueta: 'En revisión de la Fundación',
      titulo: 'Tu expediente está en revisión',
      texto: 'La Fundación está revisando tus documentos y tu carta.',
      aviso: 'No necesitas hacer nada por ahora; tu asesora te avisará si falta algo.',
      accion: null
    };
  }

  if (e.estado === 'REVISADO') {
    const paso = e.proximoPaso;
    const mostrarPaso = Boolean(paso?.texto) && !PASOS_QUE_YA_NO_APLICAN.includes(paso?.codigo ?? '');
    return {
      tono: 'revisado',
      etiqueta: 'Revisión terminada',
      titulo: 'Tu expediente está completo',
      texto: mostrarPaso
        ? `La revisión terminó. Siguiente paso: ${cerrarFrase(String(paso?.texto))}`
        : 'La revisión terminó. Ya no se pueden cambiar los documentos ni la carta.',
      aviso: null,
      accion: mostrarPaso ? { texto: 'Ver mi siguiente paso', href: '/mi-postulacion' } : null
    };
  }

  // EN_PREPARACION (también es el valor de respaldo cuando el servidor no envía el estado).
  const faltanDocumentos = e.documentosCompletos ? 0 : e.conteo.pendientes;
  const faltaCarta = !e.cartaEnviada && e.cartaEditable;
  const observados = e.conteo.conAccion;
  const explicacion = e.cartaNuevaVersion
    ? 'Tu asesora pidió una versión nueva de tu carta de interés.'
    : 'Tu expediente pasa a revisión cuando tienes los documentos obligatorios y la carta enviada.';

  const faltantes: string[] = [];
  if (faltanDocumentos > 0) faltantes.push(plural(faltanDocumentos, 'documento', 'documentos'));
  if (faltaCarta) faltantes.push('tu carta de interés');
  const variosFaltantes = faltantes.length > 1 || faltanDocumentos > 1;
  const listaFaltantes = faltantes.join(' y ');

  // Destino del botón principal: lo observado primero, después el primer documento pendiente, después la carta.
  let accion: AccionTarjeta | null = null;
  const destinoDocumento = observados > 0 ? e.conteo.primerConAccion : (faltanDocumentos > 0 ? e.conteo.primerPendiente : null);
  if (destinoDocumento) {
    if (e.consentimientoPendiente) {
      accion = { texto: 'Aceptar el consentimiento', href: '#bloqueConsentimiento' };
    } else if (observados > 0) {
      accion = {
        texto: observados === 1 ? 'Revisar el documento observado' : 'Revisar los documentos observados',
        href: `#doc-${destinoDocumento}`
      };
    } else {
      accion = { texto: 'Cargar el primer documento', href: `#doc-${destinoDocumento}` };
    }
  } else if (faltaCarta) {
    accion = { texto: e.cartaTieneTexto ? 'Continuar mi carta' : 'Escribir mi carta', href: '#carta' };
  }
  const textoConsentimiento = e.consentimientoPendiente && faltanDocumentos + observados > 0
    ? 'Antes de cargar documentos necesitas aceptar el consentimiento.'
    : null;

  if (observados > 0) {
    return {
      tono: 'preparacion',
      etiqueta: ETIQUETA_PREPARACION,
      titulo: observados === 1 ? 'Revisa 1 documento observado' : `Revisa ${observados} documentos observados`,
      texto: listaFaltantes
        ? `Después te ${variosFaltantes ? 'faltarán' : 'faltará'} ${listaFaltantes}. ${textoConsentimiento ?? ''}`.trim()
        : (textoConsentimiento ?? 'Con eso tu expediente quedará completo.'),
      aviso: null,
      accion
    };
  }

  if (faltantes.length > 0) {
    return {
      tono: 'preparacion',
      etiqueta: ETIQUETA_PREPARACION,
      titulo: `Te ${variosFaltantes ? 'faltan' : 'falta'} ${listaFaltantes}`,
      texto: textoConsentimiento ?? explicacion,
      aviso: null,
      accion
    };
  }

  if (!e.documentosCompletos) {
    // El servidor dice que faltan documentos pero la lista no muestra ninguno pendiente: no se inventa un número.
    return {
      tono: 'preparacion',
      etiqueta: ETIQUETA_PREPARACION,
      titulo: 'Aún faltan documentos para completar tu expediente',
      texto: explicacion,
      aviso: null,
      accion: { texto: 'Ver mis documentos', href: '#documentos' }
    };
  }

  if (!e.cartaEnviada) {
    // Documentos completos, pero la carta todavía no está habilitada (por ejemplo, sin país asignado).
    return {
      tono: 'preparacion',
      etiqueta: ETIQUETA_PREPARACION,
      titulo: 'Tus documentos están completos',
      texto: 'Tu asesora te avisará cuando puedas escribir tu carta de interés.',
      aviso: null,
      accion: null
    };
  }

  return {
    tono: 'preparacion',
      etiqueta: ETIQUETA_PREPARACION,
    titulo: 'Tu expediente está completo',
    texto: 'Pasará a revisión de la Fundación.',
    aviso: null,
    accion: null
  };
}
