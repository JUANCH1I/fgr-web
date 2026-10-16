export const prerender = false;

import type { APIRoute } from 'astro';
import { manejarEscrituraCarta } from '../../../lib/carta-proxy.ts';

// Autoguardado del borrador de la carta de interés.
export const POST: APIRoute = ({ request, cookies }) =>
  manejarEscrituraCarta({ ruta: 'carta/borrador', request, cookies });
