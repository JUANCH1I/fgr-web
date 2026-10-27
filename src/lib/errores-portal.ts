// Errores que una página del portal no manejó (una excepción o una promesa sin capturar). El navegador los manda a
// /api/portal/errores y esa función los reenvía firmados a FGREC, que los lleva a GlitchTip
// (integracion-web.md §4.7). Módulo puro: corre en el navegador, en el servidor y bajo node:test.

export interface ReporteError {
  name?: string;
  message: string;
  stack?: string;
  page?: string;
}

const MAX_POR_PAGINA = 10;
/** El cuerpo más grande que la función reenvía (FGREC acepta hasta 32 KB). */
export const MAX_CUERPO_REPORTE = 24_000;

const recortar = (valor: unknown, max: number): string | undefined => (typeof valor === 'string' ? valor.slice(0, max) : undefined);

/** El reporte que acepta FGREC, a partir de lo que se lanzó. */
export function reporteDeError(lanzado: unknown, pagina?: string): ReporteError {
  const error = lanzado instanceof Error ? lanzado : new Error(String(lanzado));
  return {
    name: recortar(error.name, 100),
    message: recortar(error.message, 2000) ?? '',
    stack: recortar(error.stack, 8000),
    page: recortar(pagina, 300)
  };
}

/**
 * Un reportador que ignora las solicitudes canceladas y los valores vacíos, manda una sola vez cada error repetido y
 * como mucho diez por carga de página (un error en bucle).
 */
export function crearReportador(enviar: (reporte: ReporteError) => Promise<unknown>) {
  const vistos = new Set<string>();
  return (lanzado: unknown, pagina?: string): void => {
    if (lanzado == null || (lanzado as { name?: unknown }).name === 'AbortError') return;
    if (vistos.size >= MAX_POR_PAGINA) return;
    const reporte = reporteDeError(lanzado, pagina);
    const clave = `${reporte.name}|${reporte.message}|${reporte.stack?.split('\n')[1] ?? ''}`;
    if (vistos.has(clave)) return;
    vistos.add(clave);
    enviar(reporte).catch(() => {}); // reportar nunca debe provocar otro error
  };
}

/** El cuerpo que la función reenvía, o null si no es un objeto JSON o es demasiado grande. FGREC valida los campos. */
export function cuerpoParaReenviar(texto: string): Record<string, unknown> | null {
  if (texto.length > MAX_CUERPO_REPORTE) return null;
  try {
    const cuerpo = JSON.parse(texto);
    return cuerpo && typeof cuerpo === 'object' && !Array.isArray(cuerpo) ? cuerpo : null;
  } catch {
    return null;
  }
}
