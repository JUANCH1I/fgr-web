// Módulo unificado de plantillas de correo de la Fundación del Gran Rosario
// Define colores de marca, tipografías, cabecera con logo local alojado y pie institucional.

export const BRAND = {
  colors: {
    azul: '#0B1B2E',
    azul2: '#12263B',
    azul3: '#1B3350',
    lineaOscura: '#22344A',
    cobre: '#C98A4B',
    cobreClaro: '#E2B587',
    cobreTexto: '#8F5320',
    cobreHover: '#6E3F17',
    texto: '#14202E',
    gris: '#4F5B66',
    grisSobreAzul: '#D5DCE4',
    crema: '#F7F4EE',
    crema2: '#F3EBDD',
    borde: '#E3DCCF',
    verdeFondo: '#E4EFE6',
    verdeTexto: '#1F5A32',
    pie: '#07121F'
  },
  // URL pública accesible actualmente (GitHub CDN / fgrec.org en prod)
  logoUrl: 'https://raw.githubusercontent.com/JUANCH1I/fgr-web/main/public/assets/img/64d480_878e9bae365142a8a7cfd49040026764~mv2.png',
  nombre: 'Fundación del Gran Rosario Ecuador',
  sede: 'Sede Ecuador · Portal Web',
  direccion: 'Av. 12 de Octubre N26-97 y Abraham Lincoln, Edificio Torre 1492, Of. 902, Quito',
  telefonoGeneral: '+593 96 301 7631',
  waGeneralSinPlus: '593963017631',
  web: 'https://www.fgrec.org',
  correo: 'contacto@fgrec.org'
};

export function escapeHtml(str: unknown): string {
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

export function sanitizeHref(url: unknown, allowedProtocol: 'mailto' | 'https'): string {
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

export const PAISES_MAP: Record<string, string> = {
  EC: 'Ecuador',
  CO: 'Colombia',
  PE: 'Perú',
  BO: 'Bolivia',
  AR: 'Argentina',
  CL: 'Chile',
  MX: 'México',
  PY: 'Paraguay',
  UY: 'Uruguay',
  PA: 'Panamá',
  CR: 'Costa Rica',
  DO: 'República Dominicana',
  ES: 'España',
  US: 'Estados Unidos',
  OT: 'Otro país'
};

export const VIAS_DESCRIPTIVAS: Record<string, string> = {
  LICENCIATURA: 'Licenciatura completa',
  RECONOCIMIENTO: 'Reconocimiento / Evaluación de estudios previos',
  CCC: 'Ciclo de Complementación Curricular (CCC)',
  REVISION_HUMANA: 'Revisión por una asesora'
};

/**
 * Plantilla base HTML con cabecera y pie de la Fundación
 */
function contenedorBase(asunto: string, subtitulo: string, contenidoHtml: string, badgeCodigo?: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(asunto)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.colors.crema}; font-family: 'Figtree', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: ${BRAND.colors.texto};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${BRAND.colors.crema}; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Contenedor Principal (máx 620px) -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 620px; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; border: 1px solid ${BRAND.colors.borde}; box-shadow: 0 4px 16px rgba(11, 27, 46, 0.06);">
          
          <!-- Cabecera Institucional (Azul Noche + Logo + Acento Cobre) -->
          <tr>
            <td style="background-color: ${BRAND.colors.azul}; padding: 26px 32px 22px; text-align: left; border-bottom: 4px solid ${BRAND.colors.cobre};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td valign="middle" style="width: 170px; padding-right: 20px;">
                    <a href="${BRAND.web}" target="_blank" style="text-decoration: none; display: block;">
                      <img src="${BRAND.logoUrl}" alt="${BRAND.nombre}" width="160" height="47" style="display: block; border: 0; outline: none; max-width: 160px; height: auto;" />
                    </a>
                  </td>
                  <td valign="middle" style="border-left: 1px solid ${BRAND.colors.lineaOscura}; padding-left: 20px;">
                    <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; color: ${BRAND.colors.cobreClaro}; text-transform: uppercase; letter-spacing: 0.12em;">${escapeHtml(BRAND.sede)}</p>
                    <h1 style="margin: 0; font-size: 18px; font-weight: 700; color: #FFFFFF; line-height: 1.25;">${escapeHtml(subtitulo)}</h1>
                  </td>
                  ${badgeCodigo ? `
                  <td align="right" valign="middle" style="padding-left: 12px;">
                    <span style="display: inline-block; background-color: rgba(201, 138, 75, 0.2); border: 1px solid ${BRAND.colors.cobre}; color: #FFFFFF; font-size: 13px; font-weight: 800; padding: 5px 10px; border-radius: 4px; letter-spacing: 0.06em; white-space: nowrap;">
                      ${escapeHtml(badgeCodigo)}
                    </span>
                  </td>` : ''}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contenido dinámico -->
          <tr>
            <td style="padding: 32px 32px 24px;">
              ${contenidoHtml}
            </td>
          </tr>

          <!-- Pie Institucional -->
          <tr>
            <td style="background-color: ${BRAND.colors.pie}; padding: 22px 32px; text-align: center; color: #8A94A0; font-size: 11.5px; line-height: 1.6; border-top: 1px solid ${BRAND.colors.lineaOscura};">
              <p style="margin: 0 0 6px 0; color: ${BRAND.colors.grisSobreAzul}; font-weight: 600;">${escapeHtml(BRAND.nombre)}</p>
              <p style="margin: 0 0 6px 0;">${escapeHtml(BRAND.direccion)}</p>
              <p style="margin: 0;">
                <a href="${BRAND.web}" style="color: ${BRAND.colors.cobreClaro}; text-decoration: none;">www.fgrec.org</a> &nbsp;·&nbsp;
                <a href="mailto:${BRAND.correo}" style="color: ${BRAND.colors.cobreClaro}; text-decoration: none;">${BRAND.correo}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface DatosCorreoInterno {
  formulario: string;
  nombre: string;
  correo: string;
  telefono?: string;
  pais?: string;
  ciudad?: string;
  situacion?: string;
  area?: string;
  carrerasSugeridas?: string;
  mensaje?: string;
  pagina?: string;
  codigo?: string;
  leadRef?: string;
  crmUrl?: string;
  via?: string;
  primerToque?: any;
}

/**
 * 1. Correo interno para la Fundación / Asesoras
 */
export function renderCorreoInterno(datos: DatosCorreoInterno): { asunto: string; html: string } {
  const safeNombre = escapeHtml(datos.nombre.trim());
  const safeFormulario = escapeHtml(datos.formulario.trim());
  const safeCorreo = escapeHtml(datos.correo.trim());
  const safeTel = escapeHtml(datos.telefono || '');
  const safePais = escapeHtml(datos.pais || '');
  const safeCiudad = escapeHtml(datos.ciudad || '');
  const safeSituacion = escapeHtml(datos.situacion || '');
  const safeArea = escapeHtml(datos.area || '');
  const safeCarreras = escapeHtml(datos.carrerasSugeridas || '');
  const safeMensaje = escapeHtml(datos.mensaje || '');
  const safePagina = escapeHtml(datos.pagina || '');
  const refCodigo = datos.codigo ? escapeHtml(datos.codigo) : '';

  const hrefMailto = sanitizeHref(datos.correo.trim(), 'mailto');
  const hrefPagina = sanitizeHref(datos.pagina, 'https');
  const paisDescriptivo = datos.pais ? (PAISES_MAP[datos.pais.toUpperCase()] || datos.pais) : '';
  const viaTexto = datos.via ? (VIAS_DESCRIPTIVAS[datos.via] || datos.via) : '';

  const asunto = `[${safeFormulario}] Nueva consulta: ${safeNombre}${refCodigo ? ` (Ref: ${refCodigo})` : ''}`;

  // Botón principal interno según regla: "El contacto escribe primero"
  // Si FGREC está conectado -> "Ver el lead en el CRM"
  // Si FGREC no respondió -> "Responder por correo" + Nota "Cargar en el CRM"
  let ctaHtml = '';
  if (datos.leadRef) {
    const crmHref = `https://interno.ugr.la/fgrec/l/${encodeURIComponent(datos.leadRef.trim())}`;
    ctaHtml = `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 28px 0 10px;">
        <tr>
          <td align="center">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="border-radius: 4px; background-color: ${BRAND.colors.azul};">
                  <a href="${crmHref}" target="_blank" rel="noopener noreferrer" style="font-size: 14px; font-weight: 700; color: #FFFFFF; text-decoration: none; padding: 13px 28px; border-radius: 4px; display: inline-block; letter-spacing: 0.02em;">
                    Ver el lead en el CRM →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin: 8px 0 0; font-size: 12px; color: ${BRAND.colors.gris};">El contacto escribe primero. Esperar mensaje entrante o gestionar desde el CRM.</p>
          </td>
        </tr>
      </table>`;
  } else {
    ctaHtml = `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 28px 0 10px;">
        <tr>
          <td align="center">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="border-radius: 4px; background-color: ${BRAND.colors.azul};">
                  <a href="${hrefMailto}" style="font-size: 14px; font-weight: 700; color: #FFFFFF; text-decoration: none; padding: 13px 28px; border-radius: 4px; display: inline-block; letter-spacing: 0.02em;">
                    Responder por correo →
                  </a>
                </td>
              </tr>
            </table>
            <div style="margin: 12px 0 0; background-color: ${BRAND.colors.crema2}; border-left: 3px solid ${BRAND.colors.cobre}; padding: 8px 12px; border-radius: 3px; display: inline-block; text-align: left;">
              <p style="margin: 0; font-size: 12px; color: ${BRAND.colors.cobreTexto}; font-weight: 700;">⚠️ Importante: Cargar manualmente este lead en el CRM para no perder el seguimiento.</p>
            </div>
          </td>
        </tr>
      </table>`;
  }

  const utmCampaign = datos.primerToque?.utm_campaign ? escapeHtml(datos.primerToque.utm_campaign) : '';
  const utmSource = datos.primerToque?.utm_source ? escapeHtml(datos.primerToque.utm_source) : '';
  const utmMedium = datos.primerToque?.utm_medium ? escapeHtml(datos.primerToque.utm_medium) : '';

  const contenido = `
    <!-- Datos del Postulante -->
    <h2 style="margin: 0 0 16px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: ${BRAND.colors.cobreTexto}; font-weight: 800; border-bottom: 2px solid ${BRAND.colors.crema2}; padding-bottom: 6px;">
      Datos del interesado
    </h2>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px; font-size: 14.5px; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid ${BRAND.colors.crema}; color: ${BRAND.colors.gris}; width: 140px; font-weight: 600;">Origen:</td>
        <td style="padding: 10px 0; border-bottom: 1px solid ${BRAND.colors.crema}; color: ${BRAND.colors.texto}; font-weight: 700;">${safeFormulario}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid ${BRAND.colors.crema}; color: ${BRAND.colors.gris}; width: 140px; font-weight: 600;">Nombre completo:</td>
        <td style="padding: 10px 0; border-bottom: 1px solid ${BRAND.colors.crema}; color: ${BRAND.colors.texto}; font-weight: 700; font-size: 16px;">${safeNombre}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid ${BRAND.colors.crema}; color: ${BRAND.colors.gris}; font-weight: 600;">Correo electrónico:</td>
        <td style="padding: 10px 0; border-bottom: 1px solid ${BRAND.colors.crema};">
          <a href="${hrefMailto}" style="color: ${BRAND.colors.cobreTexto}; font-weight: 700; text-decoration: none;">${safeCorreo}</a>
        </td>
      </tr>
      ${safeTel ? `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid ${BRAND.colors.crema}; color: ${BRAND.colors.gris}; font-weight: 600;">Teléfono declarado:</td>
        <td style="padding: 10px 0; border-bottom: 1px solid ${BRAND.colors.crema}; color: ${BRAND.colors.texto}; font-weight: 700;">
          ${safeTel} <span style="font-size: 12px; color: ${BRAND.colors.gris}; font-weight: normal;">(dato de contacto)</span>
        </td>
      </tr>` : ''}
      ${safePais || safeCiudad ? `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid ${BRAND.colors.crema}; color: ${BRAND.colors.gris}; font-weight: 600;">País de residencia:</td>
        <td style="padding: 10px 0; border-bottom: 1px solid ${BRAND.colors.crema}; color: ${BRAND.colors.texto};">
          <strong>${escapeHtml(paisDescriptivo || safePais)}</strong>${safeCiudad ? ` · ${safeCiudad}` : ''}
        </td>
      </tr>` : ''}
    </table>

    <!-- Evaluación Académica -->
    ${(safeSituacion || safeArea || safeCarreras || viaTexto) ? `
    <h2 style="margin: 24px 0 16px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: ${BRAND.colors.cobreTexto}; font-weight: 800; border-bottom: 2px solid ${BRAND.colors.crema2}; padding-bottom: 6px;">
      Evaluación y Selección Académica
    </h2>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px; font-size: 14.5px; border-collapse: collapse;">
      ${viaTexto ? `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid ${BRAND.colors.crema}; color: ${BRAND.colors.gris}; width: 140px; font-weight: 600;">Vía preliminar:</td>
        <td style="padding: 10px 0; border-bottom: 1px solid ${BRAND.colors.crema}; color: ${BRAND.colors.azul}; font-weight: 800;">
          <span style="background-color: ${BRAND.colors.crema}; border-left: 3px solid ${BRAND.colors.cobre}; padding: 4px 8px; border-radius: 2px;">
            ${escapeHtml(viaTexto)}
          </span>
        </td>
      </tr>` : ''}
      ${safeSituacion ? `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid ${BRAND.colors.crema}; color: ${BRAND.colors.gris}; width: 140px; font-weight: 600;">Situación académica:</td>
        <td style="padding: 10px 0; border-bottom: 1px solid ${BRAND.colors.crema}; color: ${BRAND.colors.texto};">${safeSituacion}</td>
      </tr>` : ''}
      ${safeArea ? `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid ${BRAND.colors.crema}; color: ${BRAND.colors.gris}; font-weight: 600;">Área de interés:</td>
        <td style="padding: 10px 0; border-bottom: 1px solid ${BRAND.colors.crema}; color: ${BRAND.colors.texto}; font-weight: 600;">${safeArea}</td>
      </tr>` : ''}
      ${safeCarreras ? `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid ${BRAND.colors.crema}; color: ${BRAND.colors.gris}; font-weight: 600;">Carreras aplicables:</td>
        <td style="padding: 10px 0; border-bottom: 1px solid ${BRAND.colors.crema}; color: ${BRAND.colors.azul}; font-weight: 700; line-height: 1.4;">${safeCarreras}</td>
      </tr>` : ''}
    </table>` : ''}

    ${safeMensaje ? `
    <div style="background-color: ${BRAND.colors.crema}; border-left: 4px solid ${BRAND.colors.cobre}; border-radius: 4px; padding: 18px 20px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0; font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: ${BRAND.colors.cobreTexto};">Consulta del interesado:</p>
      <p style="margin: 0; font-size: 14.5px; line-height: 1.6; color: ${BRAND.colors.texto}; white-space: pre-wrap;">${safeMensaje}</p>
    </div>` : ''}

    ${ctaHtml}

    <!-- Atribución comercial -->
    <div style="margin-top: 32px; background-color: #FAF8F5; padding: 14px 18px; border-radius: 4px; border: 1px solid ${BRAND.colors.borde}; font-size: 12px; color: ${BRAND.colors.gris}; line-height: 1.5;">
      ${safePagina ? `<p style="margin: 0 0 4px 0;"><strong>Página origen:</strong> <a href="${hrefPagina}" style="color: ${BRAND.colors.cobreTexto}; text-decoration: none;">${safePagina}</a></p>` : ''}
      ${(utmSource || utmCampaign) ? `
      <p style="margin: 0;">
        <strong>Campaña:</strong> ${utmCampaign || 'Sin campaña'} &nbsp;|&nbsp; 
        <strong>Fuente:</strong> ${utmSource} &nbsp;|&nbsp; 
        <strong>Medio:</strong> ${utmMedium || 'direct'}
      </p>` : ''}
    </div>
  `;

  return {
    asunto,
    html: contenedorBase(asunto, 'Nueva consulta web recibida', contenido, refCodigo)
  };
}

export interface DatosCorreoPostulante {
  nombre: string;
  codigo?: string;
  whatsappNumero?: string;
  via?: string;
  area?: string;
  carrerasSugeridas?: string;
}

/**
 * 2. Correo de confirmación para el POSTULANTE
 * "Ya tenemos tu información" con lenguaje prudente (Brief §4.7)
 * y botón "Continuar por WhatsApp" con su código (ref. W-XXXX)
 */
export function renderCorreoPostulante(datos: DatosCorreoPostulante): { asunto: string; html: string } {
  const nombrePila = escapeHtml(datos.nombre.trim().split(' ')[0] || datos.nombre.trim());
  const refCodigo = datos.codigo ? escapeHtml(datos.codigo) : '';
  const viaTexto = datos.via ? (VIAS_DESCRIPTIVAS[datos.via] || datos.via) : '';
  const safeCarreras = escapeHtml(datos.carrerasSugeridas || '');

  const asunto = refCodigo
    ? `Ya tenemos tu información (Ref: ${refCodigo}) · Fundación del Gran Rosario`
    : `Ya tenemos tu información · Fundación del Gran Rosario`;

  // Construcción del enlace WhatsApp
  const waNum = (datos.whatsappNumero || BRAND.waGeneralSinPlus).replace(/\D/g, '');
  const textoWa = refCodigo
    ? encodeURIComponent(`Hola, completé el formulario web (ref. ${datos.codigo}) y quiero continuar con mi consulta.`)
    : encodeURIComponent('Hola, completé el formulario en la web y quiero consultar con un asesor.');
  const waHref = `https://wa.me/${waNum}?text=${textoWa}`;

  const contenido = `
    <h2 style="margin: 0 0 14px 0; font-size: 20px; font-weight: 700; color: ${BRAND.colors.azul}; line-height: 1.3;">
      Hola ${nombrePila}, recibimos tu consulta.
    </h2>

    <p style="margin: 0 0 16px 0; font-size: 15.5px; line-height: 1.6; color: ${BRAND.colors.texto};">
      Ya registramos tu información en la Fundación. Un asesor académico revisará los datos que completaste para orientarte sobre las opciones de carrera y los requisitos de ingreso.
    </p>

    ${refCodigo ? `
    <!-- Tarjeta de Código de Referencia -->
    <div style="background-color: ${BRAND.colors.crema}; border: 1px solid ${BRAND.colors.borde}; border-left: 4px solid ${BRAND.colors.cobre}; border-radius: 6px; padding: 18px 20px; margin: 22px 0;">
      <p style="margin: 0; font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: ${BRAND.colors.cobreTexto};">Tu código de referencia:</p>
      <p style="margin: 4px 0 6px 0; font-size: 24px; font-weight: 800; color: ${BRAND.colors.azul}; letter-spacing: 0.08em;">${refCodigo}</p>
      <p style="margin: 0; font-size: 13px; color: ${BRAND.colors.gris}; line-height: 1.4;">
        Guarda este código para que el sistema reconozca tus datos al escribirnos o retomar tu trámite.
      </p>
    </div>` : ''}

    ${viaTexto ? `
    <!-- Lenguaje prudente según Brief §4.7 -->
    <div style="margin: 22px 0; padding: 16px 20px; background-color: #FAF8F5; border-radius: 6px; border: 1px solid ${BRAND.colors.borde};">
      <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: ${BRAND.colors.cobreTexto}; text-transform: uppercase; letter-spacing: 0.05em;">Vía de formación preliminar:</p>
      <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: ${BRAND.colors.azul};">${escapeHtml(viaTexto)}</p>
      ${safeCarreras ? `<p style="margin: 0 0 8px 0; font-size: 14px; color: ${BRAND.colors.texto};"><strong>Carreras de interés:</strong> ${safeCarreras}</p>` : ''}
      <p style="margin: 0; font-size: 12.5px; color: ${BRAND.colors.gris}; line-height: 1.4; font-style: italic;">
        * Nota importante: El resultado es de carácter informativo preliminar. La confirmación definitiva de admisión, reconocimiento o equivalencias la otorga la Universidad aliada una vez presentada la documentación oficial correspondiente.
      </p>
    </div>` : ''}

    <p style="margin: 20px 0 24px 0; font-size: 15px; line-height: 1.6; color: ${BRAND.colors.texto};">
      Si prefieres avanzar ahora mismo sin esperar a que te escribamos, puedes abrir WhatsApp con tu código de referencia listo:
    </p>

    <!-- Botón WhatsApp para el Postulante -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0 28px;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="border-radius: 6px; background-color: #1F5A32;">
                <a href="${waHref}" target="_blank" rel="noopener noreferrer" style="font-size: 15px; font-weight: 700; color: #FFFFFF; text-decoration: none; padding: 14px 30px; border-radius: 6px; display: inline-block; letter-spacing: 0.02em;">
                  Continuar por WhatsApp →
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin: 0; font-size: 13.5px; line-height: 1.5; color: ${BRAND.colors.gris}; text-align: center;">
      También estamos disponibles por correo respondiendo a este mensaje o en <a href="${BRAND.web}" style="color: ${BRAND.colors.cobreTexto}; font-weight: 600;">fgrec.org</a>.
    </p>
  `;

  return {
    asunto,
    html: contenedorBase(asunto, 'Ya tenemos tu información', contenido, refCodigo)
  };
}
