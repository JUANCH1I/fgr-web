// Diploma verification for /certificados/<codigo>.
// The records hold people's names, so they never live in this (public) repo:
// they come from the CERTIFICADOS_JSON server env var in Vercel.
// To revoke a diploma, set its "estado" to "anulado" there and redeploy; never delete the record.

/** Only these fields ever leave the data source. ID number, email and job title are dropped. */
export const CAMPOS_CERTIFICADO = [
  'codigo', 'numero', 'nombre', 'curso', 'fecha_curso', 'horas',
  'evaluacion', 'realizado_para', 'dictado_por', 'emitido_por', 'estado'
] as const;

export type Certificado = Record<(typeof CAMPOS_CERTIFICADO)[number], string>;

export type Verificacion =
  | { tipo: 'vigente'; certificado: Certificado }
  | { tipo: 'anulado'; nombre: string; numero: string }
  | { tipo: 'inexistente' };

const FORMATO_CODIGO = /^[a-z0-9]{8}$/;

function soloCamposPublicos(fila: Record<string, unknown>): Certificado {
  const limpio = {} as Certificado;
  for (const campo of CAMPOS_CERTIFICADO) limpio[campo] = String(fila[campo] ?? '').trim();
  return limpio;
}

/** Parses the env var value. Throws on malformed JSON so a bad deploy fails loudly instead of answering "not found". */
export function leerCertificados(json: string): Certificado[] {
  if (!json.trim()) return [];
  const datos = JSON.parse(json);
  if (!Array.isArray(datos)) throw new Error('CERTIFICADOS_JSON must be a JSON array');
  return datos.map(soloCamposPublicos);
}

export function verificarCertificado(codigo: string, certificados: Certificado[]): Verificacion {
  if (!FORMATO_CODIGO.test(codigo)) return { tipo: 'inexistente' };
  const certificado = certificados.find((c) => c.codigo === codigo);
  if (!certificado) return { tipo: 'inexistente' };
  // Anything other than an explicit "vigente" is treated as revoked: fail closed.
  if (certificado.estado.toLowerCase() !== 'vigente') {
    return { tipo: 'anulado', nombre: certificado.nombre, numero: certificado.numero };
  }
  return { tipo: 'vigente', certificado };
}

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). Used to build the env var from the CSV. */
export function parsearCsv(texto: string): Record<string, string>[] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let entreComillas = false;
  const fuente = texto.replace(/^﻿/, '');
  for (let i = 0; i < fuente.length; i++) {
    const c = fuente[i];
    if (entreComillas) {
      if (c === '"' && fuente[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else campo += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && fuente[i + 1] === '\n') i++;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  const [cabecera = [], ...resto] = filas.filter((f) => f.some((v) => v.trim()));
  const claves = cabecera.map((k) => k.trim());
  return resto.map((f) => Object.fromEntries(claves.map((k, j) => [k, f[j] ?? ''])));
}
