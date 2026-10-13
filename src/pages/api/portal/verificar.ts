export const prerender = false;

import type { APIRoute } from 'astro';
import {
  llamarFGRECPortal,
  extraerContextoVisitante,
  validarCsrfPortal,
  COOKIE_SESION_NOMBRE,
  COOKIE_CONTACTO_NOMBRE,
  opcionesCookieSegura,
  borrarCookieSegura,
  borrarSesionYContacto,
  maxAgeDesdeIso,
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

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ code: 'INVALID_INPUT', message: 'Cuerpo de solicitud requerido.' }), {
      status: 400,
      headers: headersRespuestaApi()
    });
  }

  const codigo = typeof body.codigo === 'string' ? body.codigo.trim() : '';
  if (!codigo || !/^\d{6}$/.test(codigo)) {
    return new Response(JSON.stringify({ code: 'CODE_INVALID', message: 'Ingresa el código de 6 dígitos.', field: 'codigo' }), {
      status: 400,
      headers: headersRespuestaApi()
    });
  }

  const contexto = extraerContextoVisitante(request);
  const sesionActual = cookies.get(COOKIE_SESION_NOMBRE)?.value;
  const contactoPendiente = cookies.get(COOKIE_CONTACTO_NOMBRE)?.value;

  const payload: Record<string, unknown> = { codigo };
  if (!sesionActual && contactoPendiente) {
    payload.contacto = contactoPendiente;
  }

  const respuesta = await llamarFGRECPortal({
    metodo: 'POST',
    rutaRelativa: 'acceso/verificar',
    cuerpo: payload,
    sesion: sesionActual,
    contexto
  });

  if (respuesta.status === 401) {
    borrarSesionYContacto(cookies);
    return new Response(JSON.stringify(respuesta.error || { code: 'SESSION_INVALID', message: 'Tu sesión ha vencido.' }), {
      status: 401,
      headers: headersRespuestaApi()
    });
  }

  if (respuesta.ok && respuesta.data?.sesion) {
    // Usar la expiración devuelta por FGREC para la cookie de sesión nivel 2
    const maxAge = maxAgeDesdeIso(respuesta.data.expira, 7 * 24 * 60 * 60);
    cookies.set(COOKIE_SESION_NOMBRE, respuesta.data.sesion, opcionesCookieSegura(maxAge));

    // Borrado seguro de la cookie de contacto con las banderas completas
    borrarCookieSegura(cookies, COOKIE_CONTACTO_NOMBRE);

    return new Response(JSON.stringify({
      ok: true,
      siguiente: respuesta.data.siguiente || 'inicio'
    }), {
      status: 200,
      headers: headersRespuestaApi()
    });
  }

  return new Response(JSON.stringify(respuesta.error || { code: 'ERROR_VERIFICACION', message: 'No se pudo verificar el código.' }), {
    status: respuesta.status,
    headers: headersRespuestaApi()
  });
};
