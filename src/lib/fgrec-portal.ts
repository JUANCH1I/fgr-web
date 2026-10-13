// Cliente de servidor para comunicarse con la API firmada de FGREC Portal
// Cumple con el contrato §4.1 de integracion-web.md y §7.1 - §7.3 de docs/portal-postulante.md

import { randomUUID } from 'node:crypto';
import { firmarLlamadaFGREC, sanearValorCabecera } from './firma-fgrec.ts';

export const COOKIE_SESION_NOMBRE = '__Host-fgrec_sesion';
export const COOKIE_CONTACTO_NOMBRE = '__Host-fgrec_contacto_pendiente';

/**
 * Calcula maxAge en segundos desde una fecha ISO devuelta por FGREC.
 */
export function maxAgeDesdeIso(expiraIso?: string | null, fallbackSegundos: number = 3600): number {
  if (!expiraIso) return fallbackSegundos;
  try {
    const ms = new Date(expiraIso).getTime() - Date.now();
    const seg = Math.floor(ms / 1000);
    return Math.max(0, seg);
  } catch {
    return fallbackSegundos;
  }
}

/**
 * Opciones seguras para cookies HttpOnly del portal.
 */
export function opcionesCookieSegura(maxAgeSegundos: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSegundos
  };
}

/**
 * Borra una cookie __Host- cumpliendo con la exigencia de los navegadores:
 * debe enviarse con Secure, HttpOnly, SameSite=Lax y Path=/ para que el navegador acepte el borrado.
 */
export function borrarCookieSegura(cookies: { delete: (name: string, opts: any) => void; set: (name: string, val: string, opts: any) => void }, nombre: string): void {
  cookies.delete(nombre, {
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'lax'
  });
  // Asegura el borrado en navegadores que exigen Max-Age=0 explícito con las mismas banderas
  cookies.set(nombre, '', {
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 0
  });
}

export function borrarSesionYContacto(cookies: { delete: (name: string, opts: any) => void; set: (name: string, val: string, opts: any) => void }): void {
  borrarCookieSegura(cookies, COOKIE_SESION_NOMBRE);
  borrarCookieSegura(cookies, COOKIE_CONTACTO_NOMBRE);
}

/**
 * Cabeceras estándar para todas las respuestas de /api/portal/* (errores y éxitos).
 */
export function headersRespuestaApi(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    ...extra
  };
}

export interface ContextoVisitante {
  ip?: string;
  ua?: string;
}

export interface RespuestaFGREC<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: {
    code: string;
    message: string;
    field?: string;
    intentosRestantes?: number;
  };
}

/**
 * Obtiene la IP del visitante a partir de las cabeceras estándar de proxy.
 * Si faltan x-forwarded-for y x-real-ip, retorna cadena vacía para no colisionar contadores en FGREC.
 */
export function extraerIpVisitante(headers: Headers): string {
  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const primeraIp = xForwardedFor.split(',')[0].trim();
    if (primeraIp) return primeraIp;
  }
  const xRealIp = headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim();
  return '';
}

/**
 * Extrae el contexto del visitante (IP y User-Agent) para la auditoría y firma.
 */
export function extraerContextoVisitante(request: Request): ContextoVisitante {
  const ip = extraerIpVisitante(request.headers);
  const ua = request.headers.get('user-agent') || '';
  return { ip, ua };
}

/**
 * Valida la protección CSRF en mutaciones internas /api/portal/*:
 * 1. Cabecera propia X-FGREC-Portal: 1 (un formulario cruzado no la puede mandar).
 * 2. Origin debe coincidir con el host de la petición.
 */
export function validarCsrfPortal(request: Request): { valido: boolean; motivo?: string } {
  const headerPropio = request.headers.get('x-fgrec-portal');
  if (headerPropio !== '1') {
    return { valido: false, motivo: 'Cabecera de seguridad X-FGREC-Portal ausente o inválida' };
  }

  const origin = request.headers.get('origin');
  if (!origin) {
    const referer = request.headers.get('referer');
    if (!referer) return { valido: false, motivo: 'Petición sin origen detectable' };
    try {
      const urlReferer = new URL(referer);
      const urlReq = new URL(request.url);
      if (urlReferer.host !== urlReq.host) {
        return { valido: false, motivo: 'Referer cruzado no autorizado' };
      }
    } catch {
      return { valido: false, motivo: 'Referer malformado' };
    }
    return { valido: true };
  }

  try {
    const urlOrigin = new URL(origin);
    const urlReq = new URL(request.url);
    if (urlOrigin.host !== urlReq.host) {
      return { valido: false, motivo: 'Origen cruzado no autorizado' };
    }
  } catch {
    return { valido: false, motivo: 'Origin malformado' };
  }

  return { valido: true };
}

export interface LlamadaPortalOpciones {
  metodo: 'GET' | 'POST';
  rutaRelativa: string;
  cuerpo?: Record<string, unknown>;
  sesion?: string;
  contexto: ContextoVisitante;
  idempotencyKey?: string;
}

/**
 * Obtiene una variable de entorno de servidor de forma agnóstica entre Astro (import.meta.env) y Node puro (process.env).
 */
export function obtenerVariableEntorno(clave: string): string {
  // @ts-ignore
  const deImportMeta = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env[clave] : undefined;
  const deProcess = typeof process !== 'undefined' && process.env ? process.env[clave] : undefined;
  return (deImportMeta || deProcess || '').trim();
}

/**
 * Realiza una llamada firmada a la API de FGREC Portal.
 * SIN valores por defecto para configuración: si falta secreto o URL, responde 503 directo.
 * NUNCA loguea datos confidenciales (cuerpos, tokens, contraseñas ni cookies).
 */
export async function llamarFGRECPortal<T = any>(opciones: LlamadaPortalOpciones): Promise<RespuestaFGREC<T>> {
  const rawUrl = obtenerVariableEntorno('FGREC_PORTAL_URL');
  const secreto = obtenerVariableEntorno('FGREC_PORTAL_SECRET');

  if (!rawUrl || !secreto) {
    return {
      ok: false,
      status: 503,
      error: {
        code: 'PORTAL_DISABLED',
        message: 'El servicio de admisiones no está disponible temporalmente.'
      }
    };
  }

  const baseUrl = rawUrl.replace(/\/+$/, '');
  const rutaLimpia = opciones.rutaRelativa.replace(/^\/+/, '');
  if (rutaLimpia.includes('?')) {
    throw new Error('Las rutas firmadas de FGREC no admiten parámetros de consulta (query).');
  }

  const targetUrl = new URL(`${baseUrl}/${rutaLimpia}`);
  const esPost = opciones.metodo === 'POST';
  const rawBody = esPost ? JSON.stringify(opciones.cuerpo ?? {}) : (opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : '');
  const timestamp = Math.floor(Date.now() / 1000);

  const firma = firmarLlamadaFGREC({
    secreto,
    timestamp,
    metodo: opciones.metodo,
    ruta: targetUrl.pathname,
    cuerpoCrudo: rawBody,
    sesion: opciones.sesion,
    clientIp: opciones.contexto.ip,
    clientUa: opciones.contexto.ua
  });

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...firma.headers
  };

  if (esPost || opciones.cuerpo) {
    headers['Content-Type'] = 'application/json';
  }

  if (esPost) {
    headers['Idempotency-Key'] = opciones.idempotencyKey || randomUUID();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const respuesta = await fetch(targetUrl.toString(), {
      method: opciones.metodo,
      headers,
      body: esPost ? rawBody : (opciones.cuerpo ? rawBody : undefined),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (respuesta.status === 204) {
      return { ok: true, status: 204 };
    }

    const contentType = respuesta.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await respuesta.json();
      if (respuesta.ok) {
        return { ok: true, status: respuesta.status, data };
      }
      return {
        ok: false,
        status: respuesta.status,
        error: {
          code: data.code || 'ERROR_FGREC',
          message: data.message || 'Error en la solicitud.',
          field: data.field,
          intentosRestantes: data.intentosRestantes
        }
      };
    }

    return {
      ok: false,
      status: respuesta.status,
      error: {
        code: respuesta.status === 503 ? 'PORTAL_DISABLED' : (respuesta.status === 429 ? 'RATE_LIMITED' : 'ERROR_SERVICIO'),
        message: respuesta.status === 429 ? 'Demasiados intentos, espera unos minutos.' : 'El servicio de admisiones no está disponible temporalmente.'
      }
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error('[FGREC Portal Network Error]:', err?.message || err);
    return {
      ok: false,
      status: 503,
      error: {
        code: 'SERVICIO_NO_DISPONIBLE',
        message: 'El servicio no está disponible; intenta de nuevo en unos minutos.'
      }
    };
  }
}
