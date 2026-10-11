export const prerender = false;

import type { APIRoute } from 'astro';
import { Resend } from 'resend';

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
      formulario = 'Consulta general',
      nombre = '',
      correo = '',
      telefono = '',
      whatsapp = '',
      lugar = '',
      mensaje = '',
      situacion = '',
      area = '',
      carrerasSugeridas = '',
      pagina = ''
    } = body;

    const contactoTel = (telefono || whatsapp || '').trim();

    if (!nombre.trim() || !correo.trim()) {
      return new Response(JSON.stringify({ error: 'Faltan campos obligatorios (nombre y correo)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const apiKey = import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY;
    const destinatario = import.meta.env.EMAIL_DESTINATARIO || process.env.EMAIL_DESTINATARIO || 'info@fgrec.org';
    const remitente = import.meta.env.EMAIL_REMITENTE || process.env.EMAIL_REMITENTE || 'Fundación Gran Rosario <contacto@fgrec.com>';

    // Si aún no está configurada la API KEY en .env, logueamos y avisamos limpiamente
    if (!apiKey) {
      console.warn('⚠️ [API Formulario]: RESEND_API_KEY no configurada en las variables de entorno.');
      return new Response(JSON.stringify({
        warning: 'RESEND_API_KEY_MISSING',
        message: 'Consulta recibida en servidor, pero falta configurar la clave de Resend en el entorno.'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const resend = new Resend(apiKey);
    const asunto = `[${formulario}] Nueva consulta de ${nombre.trim()}`;

    // Construir tabla HTML ordenada para el correo
    const htmlContenido = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #14202E; border: 1px solid #E3DCCF; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0B1B2E; padding: 24px; text-align: center; border-bottom: 4px solid #C98A4B;">
          <h2 style="color: #FFFFFF; margin: 0; font-size: 20px; font-weight: 700;">Fundación del Gran Rosario</h2>
          <p style="color: #E2B587; margin: 4px 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em;">Nueva consulta web</p>
        </div>
        
        <div style="padding: 24px; background: #FFFFFF;">
          <h3 style="color: #0B1B2E; margin-top: 0; font-size: 18px; border-bottom: 1px solid #EEE; padding-bottom: 8px;">Detalles del interesado:</h3>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 15px;">
            <tr>
              <td style="padding: 8px 0; color: #4F5B66; width: 140px; font-weight: 600;">Origen:</td>
              <td style="padding: 8px 0; color: #0B1B2E; font-weight: 700;">${formulario}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #4F5B66; font-weight: 600;">Nombre:</td>
              <td style="padding: 8px 0; color: #0B1B2E; font-weight: 700;">${nombre}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #4F5B66; font-weight: 600;">Correo:</td>
              <td style="padding: 8px 0;"><a href="mailto:${correo}" style="color: #8F5320; font-weight: 600;">${correo}</a></td>
            </tr>
            ${contactoTel ? `
            <tr>
              <td style="padding: 8px 0; color: #4F5B66; font-weight: 600;">Teléfono / WhatsApp:</td>
              <td style="padding: 8px 0;"><a href="https://wa.me/${contactoTel.replace(/[^0-9]/g, '')}" style="color: #1F5A32; font-weight: 600;">${contactoTel}</a></td>
            </tr>` : ''}
            ${lugar ? `
            <tr>
              <td style="padding: 8px 0; color: #4F5B66; font-weight: 600;">Ciudad / País:</td>
              <td style="padding: 8px 0; color: #0B1B2E;">${lugar}</td>
            </tr>` : ''}
            ${situacion ? `
            <tr>
              <td style="padding: 8px 0; color: #4F5B66; font-weight: 600;">Situación previa:</td>
              <td style="padding: 8px 0; color: #0B1B2E;">${situacion}</td>
            </tr>` : ''}
            ${area ? `
            <tr>
              <td style="padding: 8px 0; color: #4F5B66; font-weight: 600;">Área de interés:</td>
              <td style="padding: 8px 0; color: #0B1B2E;">${area}</td>
            </tr>` : ''}
            ${carrerasSugeridas ? `
            <tr>
              <td style="padding: 8px 0; color: #4F5B66; font-weight: 600;">Carreras sugeridas:</td>
              <td style="padding: 8px 0; color: #0B1B2E; font-weight: 600;">${carrerasSugeridas}</td>
            </tr>` : ''}
          </table>

          ${mensaje ? `
          <div style="background: #F7F4EE; padding: 16px; border-radius: 6px; border-left: 3px solid #C98A4B; margin-top: 14px;">
            <p style="margin: 0 0 6px; font-weight: 700; font-size: 13px; text-transform: uppercase; color: #8F5320;">Mensaje del interesado:</p>
            <p style="margin: 0; font-size: 15px; line-height: 1.5; color: #14202E; white-space: pre-wrap;">${mensaje}</p>
          </div>` : ''}

          ${pagina ? `<p style="margin-top: 24px; font-size: 12px; color: #8A94A0;">Enviado desde: <a href="${pagina}" style="color: #8A94A0;">${pagina}</a></p>` : ''}
        </div>
      </div>
    `;

    const { data, error: resendError } = await resend.emails.send({
      from: remitente,
      to: [destinatario],
      replyTo: correo,
      subject: asunto,
      html: htmlContenido
    });

    if (resendError) {
      console.error('Error enviando con Resend:', resendError);
      return new Response(JSON.stringify({ error: resendError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, id: data?.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('Excepción en /api/formulario:', err);
    return new Response(JSON.stringify({ error: err.message || 'Error del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
