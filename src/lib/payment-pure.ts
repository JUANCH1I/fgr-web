import { LIMITE_MAX_BYTES_ARCHIVO, validarArchivoCliente } from './portal-pure.ts';

export interface Payment {
  id: number;
  cotizacion: string;
  estado: 'REGISTRADO' | 'CONFIRMADO' | 'RECHAZADO' | 'ANULADO';
  estadoTexto: string;
  // null until Administración confirms a receipt-only payment
  importeCentavos: number | null;
  moneda: string | null;
  fechaPago: string | null;
  referencia: string | null;
  medioPago: string | null;
  registradoEn: string;
  comprobanteRecibido: boolean;
  motivo: string | null;
}
export interface PaymentContext {
  pagos: Payment[];
  puedeRegistrar: boolean;
  /** True while the applicant still has to accept the convenio before reporting a payment. */
  requiereConvenio: boolean;
  maxBytes: number;
}

const FIELDS = ['nombreArchivo', 'tipo', 'tamano'];

export function formatPaymentAmount(cents: number, currency: string): string {
  const digits = String(cents).padStart(3, '0');
  return `${currency} ${digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${digits.slice(-2)}`;
}

/** Fecha del pago como dd/mm/aaaa. Reordena el texto AAAA-MM-DD sin pasar por Date, para que la zona horaria no mueva el día. */
export function formatPaymentDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(value ?? '');
}

/** Fecha de registro (instante UTC) como dd/mm/aaaa en hora de Ecuador; vacío si no es una fecha. */
function formatRegisteredDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return formatPaymentDate(new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date));
}

/** Title and detail rows of one payment; receipt-only payments have null data until confirmed. */
export function paymentSummary(payment: Payment): { title: string; details: [string, string][] } {
  const title = payment.importeCentavos !== null && payment.moneda !== null
    ? formatPaymentAmount(payment.importeCentavos, payment.moneda)
    : `Comprobante enviado${formatRegisteredDate(payment.registradoEn) ? ` el ${formatRegisteredDate(payment.registradoEn)}` : ''}`;
  const rows: [string, string | null][] = [['Fecha del pago', payment.fechaPago === null ? null : formatPaymentDate(payment.fechaPago)], ['Medio de pago', payment.medioPago], ['Referencia', payment.referencia], ['Cotización', payment.cotizacion]];
  return { title, details: rows.filter((row): row is [string, string] => row[1] !== null) };
}

export function validatePaymentBody(body: unknown): { ok: true; body: { nombreArchivo: string; tipo: string; tamano: number } } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, message: 'Selecciona un comprobante válido.' };
  const b = body as Record<string, unknown>;
  if (Object.keys(b).length !== FIELDS.length || Object.keys(b).some(key => !FIELDS.includes(key))) return { ok: false, message: 'Los datos del comprobante no son válidos.' };
  if (typeof b.nombreArchivo !== 'string' || !b.nombreArchivo.trim() || b.nombreArchivo.length > 255 || typeof b.tipo !== 'string' || !Number.isSafeInteger(b.tamano)) return { ok: false, message: 'Selecciona un comprobante válido.' };
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(b.tipo)) return { ok: false, message: 'Solo se aceptan comprobantes PDF, JPG o PNG.' };
  const file = validarArchivoCliente({ name: b.nombreArchivo, type: b.tipo, size: Number(b.tamano) });
  if (!file.valido) return { ok: false, message: file.error || 'El comprobante no es válido.' };
  return { ok: true, body: { nombreArchivo: b.nombreArchivo, tipo: b.tipo, tamano: Number(b.tamano) } };
}

const ASK_ADVISOR = 'Consulta a tu asesora.';
const ERROR_BY_CODE: Record<string, string> = {
  NO_ELIGIBLE_QUOTE: `Todavía no tienes un plan de pagos para informar un pago. ${ASK_ADVISOR}`,
  QUOTE_REPLACED: `Tu plan de pagos cambió y ya no admite este pago. ${ASK_ADVISOR}`,
  QUOTE_EXPIRED: `Tu plan de pagos venció y ya no admite este pago. ${ASK_ADVISOR}`,
  LEAD_HAS_OTHER_ACCEPTED_QUOTE: `Tu plan de pagos ya no admite este pago. ${ASK_ADVISOR}`,
  UPLOAD_NOT_ALLOWED: 'No se pudo registrar el comprobante porque tu plan de pagos cambió. Actualiza la página y vuelve a intentarlo, o consulta a tu asesora.'
};

/** Clear Spanish message for a known portal failure, or null to fall back to the server message. */
export function paymentErrorMessage(status: number, code: string): string | null {
  if (ERROR_BY_CODE[code]) return ERROR_BY_CODE[code];
  if (status === 413) return 'El comprobante supera el tamaño permitido de 10 MB.';
  if (status === 429) return 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.';
  if (status === 503) return 'La carga de comprobantes no está disponible por ahora. Inténtalo más tarde.';
  return null;
}

/** Keep backend-only fields out of the rendered page and browser responses. */
export function publicPaymentContext(data: PaymentContext): PaymentContext {
  return {
    pagos: data.pagos.map(p => ({ id: p.id, cotizacion: p.cotizacion, estado: p.estado, estadoTexto: p.estadoTexto, importeCentavos: p.importeCentavos ?? null, moneda: p.moneda ?? null, fechaPago: p.fechaPago ?? null, referencia: p.referencia ?? null, medioPago: p.medioPago ?? null, registradoEn: p.registradoEn, comprobanteRecibido: p.comprobanteRecibido, motivo: p.estado === 'RECHAZADO' ? p.motivo : null })),
    puedeRegistrar: data.puedeRegistrar === true,
    requiereConvenio: data.requiereConvenio === true,
    maxBytes: Math.min(data.maxBytes, LIMITE_MAX_BYTES_ARCHIVO)
  };
}

export function registrationUnavailable(context: PaymentContext): string | null {
  if (context.requiereConvenio) return 'Antes de informar tu pago tienes que aceptar tu convenio de corresponsabilidad.';
  return context.puedeRegistrar ? null : `La carga de comprobantes no está disponible en este momento. ${ASK_ADVISOR}`;
}
