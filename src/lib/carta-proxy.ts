// Proxy compartido de las escrituras de la carta de interés (borrador y envío).
// Misma cadena que el resto de /api/portal/*: CSRF propio, sesión en cookie HttpOnly,
// llamada firmada a FGREC (nivel 2) y limpieza de cookie ante 401.

import {
  llamarFGRECPortal,
  extraerContextoVisitante,
  validarCsrfPortal,
  COOKIE_SESION_NOMBRE,
  borrarCookieSegura,
  headersRespuestaApi
} from './fgrec-portal.ts';
import { contarCaracteres, MAXIMO_CARACTERES_CARTA, textoEnviable } from './carta-pure.ts';

type Llamar = typeof llamarFGRECPortal;

export interface OpcionesProxyCarta {
  /** Ruta firmada hacia FGREC, sin query string. */
  ruta: 'carta/borrador' | 'carta/enviar';
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

/** Valida el cuerpo según la ruta y devuelve el cuerpo a reenviar, o un error de entrada. */
export function prepararCuerpoCarta(
  ruta: OpcionesProxyCarta['ruta'],
  body: any
): { ok: true; cuerpo: Record<string, unknown> } | { ok: false; message: string } {
  const texto = body?.texto;

  if (ruta === 'carta/borrador') {
    if (typeof texto !== 'string') return { ok: false, message: 'El texto de la carta es obligatorio.' };
    if (contarCaracteres(texto) > MAXIMO_CARACTERES_CARTA) {
      return { ok: false, message: `La carta supera el máximo de ${MAXIMO_CARACTERES_CARTA.toLocaleString('es-EC')} caracteres.` };
    }
    return { ok: true, cuerpo: { texto } };
  }

  // carta/enviar: el sitio siempre manda el texto que el postulante tiene a la vista.
  if (typeof texto !== 'string' || !textoEnviable(texto)) {
    return { ok: false, message: 'La carta está vacía. Escribe tu carta antes de enviarla.' };
  }
  if (contarCaracteres(texto) > MAXIMO_CARACTERES_CARTA) {
    return { ok: false, message: `La carta supera el máximo de ${MAXIMO_CARACTERES_CARTA.toLocaleString('es-EC')} caracteres.` };
  }
  return { ok: true, cuerpo: { texto } };
}

export async function manejarEscrituraCarta(opciones: OpcionesProxyCarta): Promise<Response> {
  const { request, cookies, ruta } = opciones;
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

  const preparado = prepararCuerpoCarta(ruta, body);
  if (!preparado.ok) {
    return json(400, { code: 'INVALID_INPUT', field: 'texto', message: preparado.message });
  }

  const respuesta = await llamar({
    metodo: 'POST',
    rutaRelativa: ruta,
    cuerpo: preparado.cuerpo,
    sesion: sesionToken,
    contexto: extraerContextoVisitante(request)
  });

  if (respuesta.status === 401) {
    borrarCookieSegura(cookies, COOKIE_SESION_NOMBRE);
  }

  return json(respuesta.status, respuesta.data || respuesta.error || {});
}
