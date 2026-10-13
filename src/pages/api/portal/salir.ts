export const prerender = false;

import type { APIRoute } from 'astro';
import {
  llamarFGRECPortal,
  extraerContextoVisitante,
  validarCsrfPortal,
  COOKIE_SESION_NOMBRE,
  borrarSesionYContacto,
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
  const contexto = extraerContextoVisitante(request);

  if (sesionToken) {
    try {
      await llamarFGRECPortal({
        metodo: 'POST',
        rutaRelativa: 'acceso/salir',
        sesion: sesionToken,
        contexto
      });
    } catch {
      // Ignorar error al cerrar en el servidor, de todos modos se borran las cookies locales
    }
  }

  borrarSesionYContacto(cookies);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: headersRespuestaApi()
  });
};
