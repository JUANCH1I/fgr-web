import { experimental_createIslandRoute } from '@tinacms/astro/experimental';
import { islas } from '../../lib/islas';

// Endpoint de refresco de la edición visual: solo responde POST del panel de Tina.
export const prerender = false;
export const POST = experimental_createIslandRoute(islas as any);
