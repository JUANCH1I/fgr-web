export const prerender = false;

import type { APIRoute } from 'astro';
import {
  llamarFGRECPortal,
  extraerContextoVisitante,
  validarCsrfPortal,
  COOKIE_SESION_NOMBRE,
  borrarCookieSegura,
  headersRespuestaApi,
  obtenerVariableEntorno
} from '../../../lib/fgrec-portal.ts';
import { validarUrlSubida, deducirTipoMime } from '../../../lib/portal-pure.ts';

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

  const { requisito, nombreArchivo, tamano } = body;
  if (!requisito || !nombreArchivo || typeof tamano !== 'number') {
    return new Response(JSON.stringify({ code: 'INVALID_INPUT', message: 'Datos de archivo incompletos.' }), {
      status: 400,
      headers: headersRespuestaApi()
    });
  }

  // Deducir o verificar MIME type explícito sin fallback inseguro
  const tipoMime = deducirTipoMime({ name: nombreArchivo, type: body.tipo });
  if (!tipoMime) {
    return new Response(JSON.stringify({ code: 'UNSUPPORTED_TYPE', message: 'Formato de archivo no soportado. Debe ser PDF, JPG o PNG.' }), {
      status: 415,
      headers: headersRespuestaApi()
    });
  }

  const uploadOrigin = obtenerVariableEntorno('FGREC_UPLOAD_ORIGIN');
  if (!uploadOrigin) {
    return new Response(JSON.stringify({ code: 'PORTAL_DISABLED', message: 'El servicio de carga de documentos no está configurado.' }), {
      status: 503,
      headers: headersRespuestaApi()
    });
  }

  const contexto = extraerContextoVisitante(request);

  const respuesta = await llamarFGRECPortal({
    metodo: 'POST',
    rutaRelativa: 'documentos/subida',
    cuerpo: { requisito, nombreArchivo, tipo: tipoMime, tamano },
    sesion: sesionToken,
    contexto
  });

  if (respuesta.status === 401) {
    borrarCookieSegura(cookies, COOKIE_SESION_NOMBRE);
  }

  if (!respuesta.ok || !respuesta.data) {
    return new Response(JSON.stringify(respuesta.error || { code: 'UPLOAD_ERROR', message: 'No se pudo autorizar la subida.' }), {
      status: respuesta.status,
      headers: headersRespuestaApi()
    });
  }

  const urlSubida = respuesta.data.url;
  if (!validarUrlSubida(urlSubida, uploadOrigin)) {
    return new Response(JSON.stringify({
      code: 'FORBIDDEN_ORIGIN',
      message: 'La URL de subida no coincide con el servidor de carga autorizado.'
    }), {
      status: 502,
      headers: headersRespuestaApi()
    });
  }

  return new Response(JSON.stringify(respuesta.data), {
    status: 200,
    headers: headersRespuestaApi()
  });
};
