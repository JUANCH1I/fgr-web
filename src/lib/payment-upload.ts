import { paymentErrorMessage } from './payment-pure.ts';

export class PaymentUploadError extends Error {
  status: number;
  code: string;
  ambiguous: boolean;
  requiresRefresh: boolean;
  constructor(message: string, status = 0, code = '', ambiguous = false, requiresRefresh = false) {
    super(message);
    this.name = 'PaymentUploadError';
    this.status = status;
    this.code = code;
    this.ambiguous = ambiguous;
    this.requiresRefresh = requiresRefresh || ambiguous;
  }
}

async function readJson(response: Response): Promise<any> {
  try { return await response.json(); } catch { return {}; }
}

/** One authorization and one direct upload. Never retry an uncertain financial operation. */
export async function reportPayment(body: Record<string, unknown>, file: File, options: { fetch?: typeof fetch; onProgress?: (message: string) => void } = {}): Promise<{ pagoId: number; estado: 'REGISTRADO' }> {
  const request = options.fetch ?? fetch;
  options.onProgress?.('Autorizando la carga del comprobante…');
  let authorization: Response;
  try {
    authorization = await request('/api/portal/pagos/subida', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-FGREC-Portal': '1' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
    });
  } catch {
    throw new PaymentUploadError('No se pudo autorizar la carga. No se envió el comprobante. Puedes volver a intentarlo.');
  }
  const auth = await readJson(authorization);
  if (!authorization.ok) throw new PaymentUploadError(paymentErrorMessage(authorization.status, auth.code) || auth.message || 'No fue posible autorizar la carga.', authorization.status, auth.code);
  if (!auth.token || !auth.url || !auth.tipo || file.size > auth.maxBytes) throw new PaymentUploadError('La autorización de carga no es válida. Actualiza la página antes de continuar.');
  options.onProgress?.('Enviando el comprobante para revisión…');
  let upload: Response;
  try {
    upload = await request(auth.url, {
      method: 'POST', headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': auth.tipo }, body: file,
      credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(120000)
    });
  } catch {
    throw new PaymentUploadError('No pudimos confirmar si se recibió el comprobante. Revisa el historial antes de volver a informar este pago; si tienes dudas, contacta a tu asesora.', 0, 'UPLOAD_UNCERTAIN', true);
  }
  const result = await readJson(upload);
  if (upload.status !== 202 || result.estado !== 'REGISTRADO' || !Number.isSafeInteger(result.pagoId)) {
    const uncertain = upload.ok || upload.status >= 500;
    throw new PaymentUploadError(uncertain ? 'No pudimos confirmar la recepción. Revisa el historial antes de volver a informar este pago.' : paymentErrorMessage(upload.status, result.code) || result.message || 'No se recibió el comprobante. Actualiza la página antes de intentarlo de nuevo.', upload.status, result.code, uncertain, true);
  }
  return result;
}
