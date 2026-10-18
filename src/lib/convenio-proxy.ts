// Proxy de las dos rutas del convenio que el navegador usa: confirmar la aceptación (POST) y ver o descargar el PDF (GET).
// Misma cadena que el resto de /api/portal/*: sesión en cookie HttpOnly, llamada firmada a FGREC (nivel 2) y limpieza de
// cookie ante 401. La aceptación lleva además la protección CSRF propia; el PDF es una lectura (GET) y no cambia nada.

import {
  llamarFGRECPortal,
  extraerContextoVisitante,
  validarCsrfPortal,
  COOKIE_SESION_NOMBRE,
  borrarCookieSegura,
  headersRespuestaApi
} from './fgrec-portal.ts';
import { cabecerasPdf, prepararCuerpoAceptacion } from './convenio-pure.ts';

type Llamar = typeof llamarFGRECPortal;

export interface OpcionesProxyConvenio {
  request: Request;
  cookies: {
    get: (name: string) => { value?: string } | undefined;
    delete: (name: string, opts: any) => void;
    set: (name: string, val: string, opts: any) => void;
  };
  /** Inyectable para pruebas. */
  llamar?: Llamar;
}

function json(status: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: headersRespuestaApi() });
}

/** POST: el postulante confirma que leyó y acepta el documento (versión y huella) que tiene delante. */
export async function manejarAceptacionConvenio(opciones: OpcionesProxyConvenio): Promise<Response> {
  const { request, cookies } = opciones;
  const llamar = opciones.llamar ?? llamarFGRECPortal;

  const csrf = validarCsrfPortal(request);
  if (!csrf.valido) {
    return json(403, { code: 'CSRF_INVALID', message: csrf.motivo });
  }

  const sesionToken = cookies.get(COOKIE_SESION_NOMBRE)?.value;
  if (!sesionToken) {
    return json(401, { code: 'SESSION_INVALID', message: 'Tu sesión no es válida o ha vencido.' });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json(400, { code: 'INVALID_INPUT', message: 'Cuerpo de solicitud requerido.' });
  }

  const preparado = prepararCuerpoAceptacion(body);
  if (!preparado.ok) {
    return json(400, { code: 'INVALID_INPUT', field: preparado.field, message: preparado.message });
  }

  const respuesta = await llamar({
    metodo: 'POST',
    rutaRelativa: 'convenio/aceptar',
    cuerpo: preparado.cuerpo,
    sesion: sesionToken,
    contexto: extraerContextoVisitante(request)
  });

  if (respuesta.status === 401) {
    borrarCookieSegura(cookies, COOKIE_SESION_NOMBRE);
  }

  return json(respuesta.status, respuesta.data || respuesta.error || {});
}

/** GET: el PDF del convenio vigente, tal cual lo guarda FGREC. `?descargar=1` lo ofrece como descarga. */
export async function manejarPdfConvenio(opciones: OpcionesProxyConvenio): Promise<Response> {
  const { request, cookies } = opciones;
  const llamar = opciones.llamar ?? llamarFGRECPortal;

  const sesionToken = cookies.get(COOKIE_SESION_NOMBRE)?.value;
  if (!sesionToken) {
    return json(401, { code: 'SESSION_INVALID', message: 'Tu sesión no es válida o ha vencido.' });
  }

  const respuesta = await llamar({
    metodo: 'GET',
    rutaRelativa: 'convenio/pdf',
    sesion: sesionToken,
    contexto: extraerContextoVisitante(request)
  });

  if (respuesta.status === 401) {
    borrarCookieSegura(cookies, COOKIE_SESION_NOMBRE);
  }

  if (!respuesta.ok || !respuesta.archivo) {
    return json(respuesta.ok ? 502 : respuesta.status, respuesta.error || { code: 'ERROR_SERVICIO', message: 'No se pudo obtener el convenio.' });
  }

  const descargar = new URL(request.url).searchParams.get('descargar') === '1';
  return new Response(respuesta.archivo.bytes, {
    status: 200,
    headers: cabecerasPdf({ nombreArchivo: respuesta.archivo.nombreArchivo, sha256: respuesta.archivo.sha256, descargar })
  });
}
