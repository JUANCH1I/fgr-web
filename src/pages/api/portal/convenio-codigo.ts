export const prerender = false;

import type { APIRoute } from 'astro';
import { manejarCodigoConvenio } from '../../../lib/convenio-proxy.ts';

// Pide el código de aceptación del convenio con clickwrap (el postulante ya marcó los dos consentimientos).
export const POST: APIRoute = ({ request, cookies }) => manejarCodigoConvenio({ request, cookies });
