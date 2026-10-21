// Proxy de "Mis datos": leer (GET), guardar documento y fecha de nacimiento (POST) y avisar a la asesora que el nombre está mal.
// Misma cadena que el resto de /api/portal/*: sesión en cookie HttpOnly, llamada firmada a FGREC (nivel 2) y limpieza de
// cookie ante 401. Las escrituras llevan además la protección CSRF; la lectura (GET) no cambia nada.

import {
  llamarFGRECPortal,
  extraerContextoVisitante,
  validarCsrfPortal,
  COOKIE_SESION_NOMBRE,
  borrarCookieSegura,
  headersRespuestaApi
} from './fgrec-portal.ts';
import { prepararCuerpoDatos, prepararCuerpoNombre, type CuerpoPreparado } from './datos-pure.ts';

type Llamar = typeof llamarFGRECPortal;

export interface OpcionesProxyDatos {
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

async function reenviar(
  opciones: OpcionesProxyDatos,
  { metodo, rutaRelativa, preparar }: { metodo: 'GET' | 'POST'; rutaRelativa: string; preparar?: (body: any) => CuerpoPreparado<Record<string, unknown>> }
): Promise<Response> {
  const { request, cookies } = opciones;
  const llamar = opciones.llamar ?? llamarFGRECPortal;

  if (metodo === 'POST') {
    const csrf = validarCsrfPortal(request);
    if (!csrf.valido) return json(403, { code: 'CSRF_INVALID', message: csrf.motivo });
  }

  const sesionToken = cookies.get(COOKIE_SESION_NOMBRE)?.value;
  if (!sesionToken) {
    return json(401, { code: 'SESSION_INVALID', message: 'Tu sesión no es válida o ha vencido.' });
  }

  let cuerpo: Record<string, unknown> | undefined;
  if (preparar) {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return json(400, { code: 'INVALID_INPUT', message: 'Cuerpo de solicitud requerido.' });
    }
    const preparado = preparar(body);
    if (!preparado.ok) return json(400, { code: 'INVALID_INPUT', field: preparado.field, message: preparado.message });
    cuerpo = preparado.cuerpo;
  }

  const respuesta = await llamar({ metodo, rutaRelativa, cuerpo, sesion: sesionToken, contexto: extraerContextoVisitante(request) });

  if (respuesta.status === 401) {
    borrarCookieSegura(cookies, COOKIE_SESION_NOMBRE);
  }

  return json(respuesta.status, respuesta.data || respuesta.error || {});
}

/** GET: los datos que FGREC tiene del postulante. */
export const manejarLecturaDatos = (o: OpcionesProxyDatos) => reenviar(o, { metodo: 'GET', rutaRelativa: 'datos' });

/** POST: documento y/o fecha de nacimiento. */
export const manejarGuardadoDatos = (o: OpcionesProxyDatos) => reenviar(o, { metodo: 'POST', rutaRelativa: 'datos', preparar: prepararCuerpoDatos });

/** POST: avisa a la asesora que el nombre está mal (comentario opcional). */
export const manejarAvisoNombre = (o: OpcionesProxyDatos) => reenviar(o, { metodo: 'POST', rutaRelativa: 'datos/nombre', preparar: prepararCuerpoNombre });
