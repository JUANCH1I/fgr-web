export const prerender = false;

import type { APIRoute } from 'astro';
import {
  llamarFGRECPortal,
  extraerContextoVisitante,
  validarCsrfPortal,
  COOKIE_SESION_NOMBRE,
  borrarCookieSegura,
  headersRespuestaApi
} from '../../../lib/fgrec-portal.ts';

export const POST: APIRoute = async ({ request, cookies }) => {
  const csrf = validarCsrfPortal(request);
  if (!csrf.valido) {
    return new Response(JSON.stringify({ code: 'CSRF_INVALID', message: csrf.motivo }), {
      status: 403,
      headers: headersRespuestaApi()
    });
  }

  const sesionToken = cookies.get(COOKIE_SESION_NOMBRE)?.value;
  if (!sesionToken) {
    return new Response(JSON.stringify({ code: 'SESSION_INVALID', message: 'Tu sesión no es válida o ha vencido.' }), {
      status: 401,
      headers: headersRespuestaApi()
    });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ code: 'INVALID_INPUT', message: 'Cuerpo de solicitud requerido.' }), {
      status: 400,
      headers: headersRespuestaApi()
    });
  }

  const contexto = extraerContextoVisitante(request);

  const respuesta = await llamarFGRECPortal({
    metodo: 'POST',
    rutaRelativa: 'consentimientos',
    cuerpo: {
      codigo: body.codigo,
      version: body.version
    },
    sesion: sesionToken,
    contexto
  });

  if (respuesta.status === 401) {
    borrarCookieSegura(cookies, COOKIE_SESION_NOMBRE);
  }

  return new Response(JSON.stringify(respuesta.data || respuesta.error || {}), {
    status: respuesta.status,
    headers: headersRespuestaApi()
  });
};
