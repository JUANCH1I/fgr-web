export const prerender = false;

import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { randomUUID } from 'node:crypto';
import { renderCorreoInterno, renderCorreoPostulante } from '../../lib/correos';
import { firmarLlamadaFGREC } from '../../lib/firma-fgrec';

function escapeHtml(str: unknown): string {
  if (typeof str !== 'string') {
    return str === null || str === undefined ? '' : String(str);
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeHref(url: unknown, allowedProtocol: 'mailto' | 'https'): string {
  if (typeof url !== 'string') return '#';
  const clean = url.trim();
  if (allowedProtocol === 'mailto' && clean.includes('@') && !clean.includes('javascript:')) {
    return `mailto:${clean.replace(/[^\w.@+-]/g, '')}`;
  }
  if (allowedProtocol === 'https' && (clean.startsWith('https://') || clean.startsWith('/'))) {
    return clean.replace(/[<>"']/g, '');
  }
  return '#';
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const contentType = request.headers.get('content-type') || '';
    let body: any;

    if (contentType.includes('application/json')) {
      body = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries());
    } else {
      return new Response(JSON.stringify({ error: 'Formato no soportado' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Honeypot anti-spam
    if (body.web) {
      return new Response(JSON.stringify({ success: true, message: 'Recibido' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const {
      tipo = '',
      formulario = 'Consulta general',
      nombre = '',
      correo = '',
      telefono = '',
      whatsapp = '',
      lugar = '',
      pais = '',
      ciudad = '',
      mensaje = '',
      situacion = '',
      area = '',
      carrerasSugeridas = '',
      pagina = '',
      acepto,
      consentimiento: consentInput,
      origen: origenInput
    } = body;

    const contactoTel = (telefono || whatsapp || '').trim();

    // 1. Consentimiento: obligatorio. Sin aceptación explícita no se procesa nada.
    const consentAceptado = Boolean(
      (consentInput && consentInput.aceptado === true) ||
      acepto === true ||
      acepto === 'on' ||
      acepto === 'true'
    );

    if (!consentAceptado) {
      return new Response(JSON.stringify({ error: 'Debes aceptar la política de protección de datos para continuar.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const consentimiento = {
      aceptado: true,
      version: typeof consentInput?.version === 'string' ? consentInput.version : 'proteccion-de-datos-2026-10',
      at: typeof consentInput?.at === 'string' ? consentInput.at : new Date().toISOString()
    };

    if (!nombre.trim() || !correo.trim()) {
      return new Response(JSON.stringify({ error: 'Faltan campos obligatorios (nombre y correo)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // País y ciudad: ISO-2 obligatorio para FGREC. Sin default.
    const paisCodigo = (pais || '').trim().toUpperCase();
    const ciudadNombre = (ciudad || lugar || '').trim();

    // Tipo de formulario normalizado desde el input oculto o fallback a nombres canónicos
    const tipoNormalizado = (tipo || '').toLowerCase().trim();
    const tipoFormulario = ['precalificador', 'contacto', 'continuidad', 'ccc'].includes(tipoNormalizado)
      ? tipoNormalizado
      : (formulario.toLowerCase().includes('evaluar') || formulario.toLowerCase().includes('precalificador') ? 'precalificador' : 'contacto');

    // Situación: viaja solo el valor fijo de cada tarjeta (bachillerato | tecnico_tecnologo | incompleta | titulo).
    // Si llega otro valor, que FGREC responda 400.
    const situacionNormalizada = situacion ? String(situacion).trim() : undefined;

    // 1. Intentar llamada firmada a FGREC si están configuradas las variables Y vino el país
    const fgrecUrl = import.meta.env.FGREC_INTAKE_URL || process.env.FGREC_INTAKE_URL;
    const fgrecSecret = import.meta.env.FGREC_INTAKE_SECRET || process.env.FGREC_INTAKE_SECRET;

    let fgrecRespuesta: { leadRef?: string; codigo?: string; whatsapp?: string; via?: string } | null = null;

    if (fgrecUrl && fgrecSecret && paisCodigo) {
      try {
        const idempotencyKey = randomUUID();

        const fgrecPayload = {
          idempotencyKey,
          formulario: tipoFormulario,
          contacto: {
            nombre: nombre.trim(),
            correo: correo.trim(),
            whatsapp: contactoTel,
            pais: paisCodigo,
            ciudad: ciudadNombre || undefined
          },
          precalificacion: tipoFormulario === 'precalificador' || tipoFormulario === 'continuidad' || tipoFormulario === 'ccc' ? {
            situacion: situacionNormalizada,
            areaInteres: area || undefined,
            carrerasSugeridas: Array.isArray(carrerasSugeridas)
              ? carrerasSugeridas
              : (carrerasSugeridas ? String(carrerasSugeridas).split(' | ') : undefined)
          } : undefined,
          mensaje: mensaje ? mensaje.trim() : undefined,
          consentimiento,
          origen: origenInput || {
            pagina: pagina || undefined
          }
        };

        const rawBody = JSON.stringify(fgrecPayload);
        const timestamp = Math.floor(Date.now() / 1000).toString();

        // Extraer pathname sin query (la URL no debe llevar query)
        const targetUrl = new URL(fgrecUrl);
        targetUrl.search = ''; // asegurar que no lleve query

        // Extraer IP del visitante (informada por Vercel / proxy) y User-Agent
        const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
          request.headers.get('x-real-ip') ||
          '127.0.0.1';
        const clientUa = request.headers.get('user-agent') || '';

        const firma = firmarLlamadaFGREC({
          secreto: fgrecSecret,
          timestamp,
          metodo: 'POST',
          ruta: targetUrl.pathname,
          cuerpoCrudo: rawBody,
          clientIp,
          clientUa
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(targetUrl.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...firma.headers
          },
          body: rawBody,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          fgrecRespuesta = await response.json();
        } else {
          const errText = await response.text();
          console.warn(`[FGREC Intake]: Falló respuesta con status ${response.status}:`, errText);
        }
      } catch (err: any) {
        console.warn('[FGREC Intake]: Error o timeout en llamada a FGREC:', err.message);
      }
    }

    // 2. Envío de correos mediante el módulo de plantillas institucionales
    const apiKey = import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY;
    const destinatario = import.meta.env.EMAIL_DESTINATARIO || process.env.EMAIL_DESTINATARIO || 'contacto@fgrec.org';
    const remitente = import.meta.env.EMAIL_REMITENTE || process.env.EMAIL_REMITENTE || 'Fundación Gran Rosario <contacto@fgrec.org>';

    let resendInternoEnviado = false;
    let resendInternoId: string | undefined;
    let resendPostulanteEnviado = false;
    let resendPostulanteId: string | undefined;

    if (apiKey) {
      const resend = new Resend(apiKey);

      // A. Correo interno para la Fundación / Asesoras
      const correoInterno = renderCorreoInterno({
        formulario,
        nombre,
        correo,
        telefono: contactoTel,
        pais: paisCodigo,
        ciudad: ciudadNombre,
        situacion,
        area,
        carrerasSugeridas: Array.isArray(carrerasSugeridas) ? carrerasSugeridas.join(' | ') : carrerasSugeridas,
        mensaje,
        pagina,
        codigo: fgrecRespuesta?.codigo,
        leadRef: fgrecRespuesta?.leadRef,
        via: fgrecRespuesta?.via,
        primerToque: origenInput?.primerToque
      });

      try {
        const { data: dataInterno, error: errInterno } = await resend.emails.send({
          from: remitente,
          to: [destinatario],
          replyTo: correo.trim(),
          subject: correoInterno.asunto,
          html: correoInterno.html
        });
        if (errInterno) {
          console.error('[Resend Error Interno]:', errInterno);
        } else {
          resendInternoEnviado = true;
          resendInternoId = dataInterno?.id;
        }
      } catch (err: any) {
        console.error('[Resend Excepción Interno]:', err.message);
      }

      // B. Correo nuevo para el POSTULANTE ("Ya tenemos tu información" con lenguaje prudente y WhatsApp)
      if (correo.trim()) {
        const correoPostulante = renderCorreoPostulante({
          nombre,
          codigo: fgrecRespuesta?.codigo,
          whatsappNumero: fgrecRespuesta?.whatsapp,
          via: fgrecRespuesta?.via,
          area,
          carrerasSugeridas: Array.isArray(carrerasSugeridas) ? carrerasSugeridas.join(' | ') : carrerasSugeridas
        });

        try {
          const { data: dataPostulante, error: errPostulante } = await resend.emails.send({
            from: remitente,
            to: [correo.trim()],
            replyTo: destinatario,
            subject: correoPostulante.asunto,
            html: correoPostulante.html
          });
          if (errPostulante) {
            console.error('[Resend Error Postulante]:', errPostulante);
          } else {
            resendPostulanteEnviado = true;
            resendPostulanteId = dataPostulante?.id;
          }
        } catch (err: any) {
          console.error('[Resend Excepción Postulante]:', err.message);
        }
      }
    } else {
      console.warn('⚠️ [API Formulario]: RESEND_API_KEY no configurada en las variables de entorno.');
    }

    // 3. Verificación de entrega: si ni FGREC respondió ni se pudo enviar correo interno de respaldo, es un 502 Bad Gateway
    if (!fgrecRespuesta && !resendInternoEnviado) {
      console.error('[API Formulario]: Error de entrega - Ni FGREC ni Resend pudieron recibir la consulta.');
      return new Response(JSON.stringify({
        error: 'No se pudo entregar tu consulta en este momento por problemas de conectividad con los servicios de recepción.',
        fallbackWhatsapp: true
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      fgrec: fgrecRespuesta ? {
        conectado: true,
        leadRef: fgrecRespuesta.leadRef,
        codigo: fgrecRespuesta.codigo,
        whatsapp: fgrecRespuesta.whatsapp,
        via: fgrecRespuesta.via
      } : { conectado: false },
      email: {
        internoEnviado: resendInternoEnviado,
        internoId: resendInternoId,
        postulanteEnviado: resendPostulanteEnviado,
        postulanteId: resendPostulanteId
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('Excepción en /api/formulario:', err);
    return new Response(JSON.stringify({ error: 'Ocurrió un error inesperado al procesar tu solicitud. Por favor intenta más tarde o comunícate por WhatsApp.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
