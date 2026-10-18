// Precalificador del portal: valores y textos que FGREC acepta (docs/integracion-web.md §4.2) y armado del cuerpo.
// Los textos de situación son los mismos que las tarjetas de "Evaluar mis estudios" del sitio
// (public/assets/js/sitio.js, SITUACIONES): si cambian allí, cambian aquí.

export const SITUACIONES = [
  { clave: 'bachillerato', texto: 'Terminé el bachillerato' },
  { clave: 'tecnico_tecnologo', texto: 'Tengo un título técnico o tecnológico' },
  { clave: 'incompleta', texto: 'Empecé una carrera y no la terminé' },
  { clave: 'titulo', texto: 'Tengo un título universitario y quiero otro' }
] as const;

export const BACHILLERATO_OPCIONES = [
  { clave: 'SI', texto: 'Sí, ya terminé el bachillerato' },
  { clave: 'EN_CURSO', texto: 'Lo estoy cursando' },
  { clave: 'NO', texto: 'No' }
] as const;

const CLAVES_SITUACION: readonly string[] = SITUACIONES.map((s) => s.clave);
const CLAVES_BACHILLERATO: readonly string[] = BACHILLERATO_OPCIONES.map((b) => b.clave);

/** Campos del formulario del portal tal como los lee el navegador (todo texto). */
export type RespuestasFormulario = Record<string, string | undefined>;

/**
 * Arma el objeto `precalificacion` que valida FGREC. Siempre viajan `bachillerato` y `estudiosPrevios`;
 * el detalle de estudios previos solo cuando hubo estudios previos.
 */
export function construirPrecalificacion(r: RespuestasFormulario): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  const texto = (v?: string) => (v ?? '').trim();

  if (CLAVES_SITUACION.includes(texto(r.situacion))) out.situacion = texto(r.situacion);
  if (CLAVES_BACHILLERATO.includes(texto(r.bachillerato))) out.bachillerato = texto(r.bachillerato);
  if (texto(r.areaInteres)) out.areaInteres = texto(r.areaInteres);

  if (r.estudiosPrevios === 'true' || r.estudiosPrevios === 'false') {
    out.estudiosPrevios = r.estudiosPrevios === 'true';
    if (out.estudiosPrevios) {
      if (texto(r.carreraPrevia)) out.carreraPrevia = texto(r.carreraPrevia);
      if (r.finalizada === 'true' || r.finalizada === 'false') out.finalizada = r.finalizada === 'true';
      const anios = Number(texto(r.duracionAnios));
      if (texto(r.duracionAnios) && Number.isFinite(anios) && anios > 0) out.duracionAnios = anios;
    }
  }
  return out;
}

const CAMPOS_HUMANOS: Record<string, string> = {
  situacion: 'cuál es tu situación académica',
  bachillerato: 'si completaste el bachillerato',
  estudiosPrevios: 'si realizaste estudios superiores antes',
  carreraPrevia: 'qué carrera o programa cursaste',
  finalizada: 'si finalizaste esa carrera',
  duracionAnios: 'cuántos años duraban esos estudios',
  areaInteres: 'tu carrera o área de interés'
};

/** Traduce un error de validación de FGREC a una frase para el postulante, sin rutas de campo. */
export function mensajeErrorPrecalificador(status: number, data: { code?: string; message?: string; field?: string } | null | undefined): string {
  if (status === 429) return 'Realizaste muchas solicitudes en poco tiempo. Espera unos minutos e inténtalo de nuevo.';
  if (status >= 500) return 'El servicio no está disponible por ahora. Inténtalo de nuevo en unos minutos.';
  const campo = String(data?.field ?? '').replace(/^precalificacion\./, '').replace(/\[\d+\]$/, '');
  const humano = CAMPOS_HUMANOS[campo];
  if (humano) return `Falta o no es válido el dato que indica ${humano}. Revisa esa pregunta e inténtalo de nuevo.`;
  if (campo === 'carrerasSugeridas') return 'No pudimos procesar las carreras indicadas. Revisa tus respuestas e inténtalo de nuevo.';
  return 'No pudimos procesar tus respuestas. Revisa que todas las preguntas estén completas e inténtalo de nuevo.';
}
