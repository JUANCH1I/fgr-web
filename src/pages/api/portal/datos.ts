export const prerender = false;

import type { APIRoute } from 'astro';
import { manejarLecturaDatos, manejarGuardadoDatos } from '../../../lib/datos-proxy.ts';

// "Mis datos": lectura y guardado del documento del postulante.
export const GET: APIRoute = ({ request, cookies }) => manejarLecturaDatos({ request, cookies });
export const POST: APIRoute = ({ request, cookies }) => manejarGuardadoDatos({ request, cookies });
