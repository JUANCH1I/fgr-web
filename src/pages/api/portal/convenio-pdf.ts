export const prerender = false;

import type { APIRoute } from 'astro';
import { manejarPdfConvenio } from '../../../lib/convenio-proxy.ts';

// El PDF del convenio vigente del postulante (con su sesión). Se ve en la página o se descarga con ?descargar=1.
export const GET: APIRoute = ({ request, cookies }) => manejarPdfConvenio({ request, cookies });
