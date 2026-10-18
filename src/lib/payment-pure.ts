import { LIMITE_MAX_BYTES_ARCHIVO, validarArchivoCliente } from './portal-pure.ts';

export interface Payment {
  id: number;
  cotizacion: string;
  estado: 'REGISTRADO' | 'CONFIRMADO' | 'RECHAZADO' | 'ANULADO';
  estadoTexto: string;
  importeCentavos: number;
  moneda: string;
  fechaPago: string;
  referencia: string;
  medioPago: string;
  registradoEn: string;
  comprobanteRecibido: boolean;
  motivo: string | null;
}
export interface PaymentContext {
  pagos: Payment[];
  cotizaciones: { id: number; codigo: string }[];
  medios: { id: number; nombre: string; moneda: string }[];
  cuentas: { id: number; nombre: string; banco: string; moneda: string }[];
  puedeRegistrar: boolean;
  maxBytes: number;
}

export const MAX_PAYMENT_CENTS = 1_000_000_000_000;
const FIELDS = ['cotizacionId', 'medioPagoId', 'cuentaReceptoraId', 'importeBrutoCentavos', 'moneda', 'fechaPago', 'referencia', 'nombreArchivo', 'tipo', 'tamano'];

/** Parse decimal digits, not binary floating-point arithmetic. No grouping separators. */
export function parseAmountCents(value: string): number | null {
  const match = /^(\d{1,11})(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const cents = BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'));
  return cents > 0n && cents <= BigInt(MAX_PAYMENT_CENTS) ? Number(cents) : null;
}

export function formatPaymentAmount(cents: number, currency: string): string {
  const digits = String(cents).padStart(3, '0');
  return `${currency} ${digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${digits.slice(-2)}`;
}

export function paymentToday(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function validatePaymentBody(body: unknown, today = paymentToday()): { ok: true; body: Record<string, unknown> } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, message: 'Datos de pago incompletos.' };
  const b = body as Record<string, unknown>;
  if (Object.keys(b).length !== FIELDS.length || Object.keys(b).some(key => !FIELDS.includes(key))) return { ok: false, message: 'Los datos del pago no son válidos.' };
  if (!['cotizacionId', 'medioPagoId', 'cuentaReceptoraId'].every(key => Number.isSafeInteger(b[key]) && Number(b[key]) > 0)) return { ok: false, message: 'Selecciona la cotización, el medio y la cuenta del pago.' };
  if (!Number.isSafeInteger(b.importeBrutoCentavos) || Number(b.importeBrutoCentavos) <= 0 || Number(b.importeBrutoCentavos) > MAX_PAYMENT_CENTS) return { ok: false, message: 'El importe del pago no es válido.' };
  if (typeof b.moneda !== 'string' || !/^[A-Z]{3}$/.test(b.moneda)) return { ok: false, message: 'La moneda del pago no es válida.' };
  if (typeof b.fechaPago !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.fechaPago) || !Number.isFinite(Date.parse(`${b.fechaPago}T12:00:00Z`)) || new Date(`${b.fechaPago}T12:00:00Z`).toISOString().slice(0, 10) !== b.fechaPago || b.fechaPago > today) return { ok: false, message: 'Selecciona una fecha real que no sea futura.' };
  if (typeof b.referencia !== 'string' || !b.referencia.trim() || b.referencia.trim().length > 100) return { ok: false, message: 'Escribe una referencia de hasta 100 caracteres.' };
  if (typeof b.nombreArchivo !== 'string' || !b.nombreArchivo.trim() || b.nombreArchivo.length > 255 || typeof b.tipo !== 'string' || !Number.isSafeInteger(b.tamano)) return { ok: false, message: 'Selecciona un comprobante válido.' };
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(b.tipo)) return { ok: false, message: 'Solo se aceptan comprobantes PDF, JPG o PNG.' };
  const file = validarArchivoCliente({ name: b.nombreArchivo, type: b.tipo, size: Number(b.tamano) });
  if (!file.valido) return { ok: false, message: file.error || 'El comprobante no es válido.' };
  return { ok: true, body: { ...b, referencia: b.referencia.trim() } };
}

/** Keep backend-only fields out of the rendered page and browser responses. */
export function publicPaymentContext(data: PaymentContext): PaymentContext {
  return {
    pagos: data.pagos.map(p => ({ id: p.id, cotizacion: p.cotizacion, estado: p.estado, estadoTexto: p.estadoTexto, importeCentavos: p.importeCentavos, moneda: p.moneda, fechaPago: p.fechaPago, referencia: p.referencia, medioPago: p.medioPago, registradoEn: p.registradoEn, comprobanteRecibido: p.comprobanteRecibido, motivo: p.estado === 'RECHAZADO' ? p.motivo : null })),
    cotizaciones: data.cotizaciones.map(q => ({ id: q.id, codigo: q.codigo })),
    medios: data.medios.map(m => ({ id: m.id, nombre: m.nombre, moneda: m.moneda })),
    cuentas: data.cuentas.map(a => ({ id: a.id, nombre: a.nombre, banco: a.banco, moneda: a.moneda })),
    puedeRegistrar: data.puedeRegistrar === true,
    maxBytes: Math.min(data.maxBytes, LIMITE_MAX_BYTES_ARCHIVO)
  };
}

export function registrationUnavailable(context: PaymentContext): string | null {
  if (context.cotizaciones.length === 0) return 'Aún no tienes una cotización habilitada para informar pagos. Contacta a tu asesora institucional.';
  if (!context.medios.some(method => context.cuentas.some(account => account.moneda === method.moneda))) return 'No hay medios y cuentas disponibles para informar tu pago. Contacta a tu asesora institucional.';
  return context.puedeRegistrar ? null : 'La carga de comprobantes no está habilitada en este momento. Puedes consultar con tu asesora institucional.';
}
