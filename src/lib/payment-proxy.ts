import { llamarFGRECPortal, extraerContextoVisitante, validarCsrfPortal, COOKIE_SESION_NOMBRE, borrarCookieSegura, headersRespuestaApi, obtenerVariableEntorno } from './fgrec-portal.ts';
import { validarUrlSubida } from './portal-pure.ts';
import { publicPaymentContext, validatePaymentBody, type PaymentContext } from './payment-pure.ts';

type Cookies = { get: (name: string) => { value?: string } | undefined; delete: (name: string, opts: any) => void; set: (name: string, value: string, opts: any) => void };
interface Options {
  request: Request;
  cookies: Cookies;
  authorize?: boolean;
  call?: typeof llamarFGRECPortal;
  uploadOrigin?: string;
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: headersRespuestaApi() });

async function readBoundedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('body');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 8192) { await reader.cancel(); throw new Error('body'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function handlePaymentProxy(options: Options): Promise<Response> {
  const { request, cookies, authorize = false } = options;
  if (authorize) {
    const csrf = validarCsrfPortal(request);
    if (!csrf.valido) return json(403, { code: 'CSRF_INVALID', message: csrf.motivo });
  }
  const session = cookies.get(COOKIE_SESION_NOMBRE)?.value;
  if (!session) return json(401, { code: 'SESSION_INVALID', message: 'Tu sesión no es válida o ha vencido.' });
  let body: Record<string, unknown> | undefined;
  let origin = '';
  if (authorize) {
    let parsed: unknown;
    try { parsed = await readBoundedJson(request); }
    catch { return json(400, { code: 'INVALID_INPUT', message: 'Los datos del pago no son válidos.' }); }
    const result = validatePaymentBody(parsed);
    if (!result.ok) return json(400, { code: 'INVALID_INPUT', message: result.message });
    body = result.body;
    origin = options.uploadOrigin ?? obtenerVariableEntorno('FGREC_UPLOAD_ORIGIN');
    if (!origin) return json(503, { code: 'PORTAL_DISABLED', message: 'La carga de comprobantes no está disponible temporalmente.' });
  }
  const result = await (options.call ?? llamarFGRECPortal)({ metodo: authorize ? 'POST' : 'GET', rutaRelativa: authorize ? 'pagos/subida' : 'pagos', ...(body ? { cuerpo: body } : {}), sesion: session, contexto: extraerContextoVisitante(request) });
  if (result.status === 401) borrarCookieSegura(cookies, COOKIE_SESION_NOMBRE);
  if (!result.ok || !result.data) return json(result.status, result.error || { code: 'PAYMENT_ERROR', message: 'No se pudo consultar el servicio de pagos.' });
  if (!authorize) return json(result.status, publicPaymentContext(result.data as PaymentContext));
  const { token, url, expira, maxBytes, tipo } = result.data;
  if (!validarUrlSubida(url, origin) || new URL(url).username || new URL(url).password || new URL(url).search || new URL(url).hash || !new URL(url).pathname.endsWith('/pagos/subidas')) return json(502, { code: 'FORBIDDEN_ORIGIN', message: 'El servidor de carga no está autorizado.' });
  return json(200, { token, url, expira, maxBytes, tipo });
}
