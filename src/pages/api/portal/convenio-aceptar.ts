export const prerender = false;

import type { APIRoute } from 'astro';
import { manejarAceptacionConvenio } from '../../../lib/convenio-proxy.ts';

// Aceptación digital del convenio de corresponsabilidad (el postulante confirma versión y huella del documento).
export const POST: APIRoute = ({ request, cookies }) => manejarAceptacionConvenio({ request, cookies });
