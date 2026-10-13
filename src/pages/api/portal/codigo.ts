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
  headersRespuestaApi
} from '../../../lib/fgrec-portal.ts';
import { normalizarContacto } from '../../../lib/portal-pure.ts';

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
    // Body vacío permitido si hay sesión activa
  }

  const contexto = extraerContextoVisitante(request);
  let sesionToken = cookies.get(COOKIE_SESION_NOMBRE)?.value;
  let contacto = body.contacto;

  // Si viene contacto explícito (desde pantalla Ingresar), tiene prioridad absoluta sobre cualquier sesión previa
  if (typeof contacto === 'string' && contacto.trim()) {
    if (sesionToken) {
      borrarCookieSegura(cookies, COOKIE_SESION_NOMBRE);
      sesionToken = undefined;
    }
  } else if (!sesionToken) {
    contacto = cookies.get(COOKIE_CONTACTO_NOMBRE)?.value;
  }

  const payload: Record<string, unknown> = {};
  if (!sesionToken) {
    if (typeof contacto !== 'string' || !contacto.trim()) {
      return new Response(JSON.stringify({ code: 'INVALID_INPUT', message: 'Debes indicar un correo o teléfono con código de país.', field: 'contacto' }), {
        status: 400,
        headers: headersRespuestaApi()
      });
    }

    const { valido, normalizado } = normalizarContacto(contacto);
    if (!valido) {
      return new Response(JSON.stringify({ code: 'INVALID_INPUT', message: 'Ingresa un correo válido o un número con código de país (ej. +593991234567).', field: 'contacto' }), {
        status: 400,
        headers: headersRespuestaApi()
      });
    }

    payload.contacto = normalizado;
    // Guardar contacto en cookie temporal segura (10 min)
    cookies.set(COOKIE_CONTACTO_NOMBRE, normalizado, opcionesCookieSegura(10 * 60));
  }

  const respuesta = await llamarFGRECPortal({
    metodo: 'POST',
    rutaRelativa: 'acceso/codigo',
    cuerpo: payload,
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
