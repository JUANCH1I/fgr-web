export const prerender = false;

import type { APIRoute } from 'astro';
import { llamarFGRECPortal, extraerContextoVisitante, validarCsrfPortal, headersRespuestaApi } from '../../../lib/fgrec-portal.ts';
import { cuerpoParaReenviar } from '../../../lib/errores-portal.ts';

// Reenvía a FGREC (firmado, sin sesión) un error que una página del portal no manejó (integracion-web.md §4.7).
export const POST: APIRoute = async ({ request }) => {
  const csrf = validarCsrfPortal(request);
  if (!csrf.valido) {
    return new Response(JSON.stringify({ code: 'CSRF_INVALID', message: csrf.motivo }), { status: 403, headers: headersRespuestaApi() });
  }

  const cuerpo = cuerpoParaReenviar(await request.text());
  if (!cuerpo) {
    return new Response(JSON.stringify({ code: 'INVALID_INPUT', message: 'El reporte no es válido.' }), { status: 400, headers: headersRespuestaApi() });
  }

  try {
    await llamarFGRECPortal({ metodo: 'POST', rutaRelativa: 'errores', cuerpo, contexto: extraerContextoVisitante(request) });
  } catch {
    // Un reporte que no llega no le cambia nada al postulante.
  }
  return new Response(null, { status: 204, headers: headersRespuestaApi() });
};
