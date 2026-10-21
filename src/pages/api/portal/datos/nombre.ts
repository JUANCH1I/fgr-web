export const prerender = false;

import type { APIRoute } from 'astro';
import { manejarAvisoNombre } from '../../../../lib/datos-proxy.ts';

// Aviso a la asesora de que el nombre del postulante está mal escrito.
export const POST: APIRoute = ({ request, cookies }) => manejarAvisoNombre({ request, cookies });
