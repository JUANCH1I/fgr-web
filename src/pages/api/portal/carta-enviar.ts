export const prerender = false;

import type { APIRoute } from 'astro';
import { manejarEscrituraCarta } from '../../../lib/carta-proxy.ts';

// Envío definitivo de la carta de interés (no se puede modificar después).
export const POST: APIRoute = ({ request, cookies }) =>
  manejarEscrituraCarta({ ruta: 'carta/enviar', request, cookies });
