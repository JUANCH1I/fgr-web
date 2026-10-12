// Módulo reutilizable de firma HMAC-SHA256 para llamadas de fgr-web a FGREC
// Cumple con el contrato §4.1 de integracion-web.md (mismo formato para intake y portal).

import { createHash, createHmac } from 'node:crypto';

/**
 * Normaliza y sanea cabeceras a ASCII imprimible (0x20-0x7E) y longitud máx 512.
 * Cualquier caracter no imprimible o fuera de ASCII se reemplaza por '?'.
 */
export function sanearValorCabecera(valor: unknown): string {
  if (typeof valor !== 'string') return '';
  const recortado = valor.slice(0, 512);
  let resultado = '';
  for (let i = 0; i < recortado.length; i++) {
    const code = recortado.charCodeAt(i);
    if (code >= 0x20 && code <= 0x7e) {
      resultado += recortado[i];
    } else {
      resultado += '?';
    }
  }
  return resultado;
}

export interface ParametrosFirmaFGREC {
  secreto: string;
  timestamp: string | number;
  metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | string;
  ruta: string;
  cuerpoCrudo?: string;
  sesion?: string;
  clientIp?: string;
  clientUa?: string;
}

export interface ResultadoFirmaFGREC {
  timestamp: string;
  signature: string;
  bodyHash: string;
  canonicalString: string;
  headers: Record<string, string>;
}

/**
 * Construye la cadena canónica de 7 líneas y calcula la firma HMAC-SHA256.
 * Cadena canónica:
 * <timestamp>\n<MÉTODO>\n<ruta>\n<sha256_hex(cuerpo_crudo)>\n<sesión>\n<ip_visitante>\n<navegador_visitante>
 */
export function firmarLlamadaFGREC(params: ParametrosFirmaFGREC): ResultadoFirmaFGREC {
  const tsStr = String(params.timestamp);
  const metodoStr = params.metodo.toUpperCase().trim();

  // La ruta debe ser el pathname sin query (ej: /fgrec/api/intake/web)
  let rutaSinQuery = params.ruta;
  try {
    if (rutaSinQuery.startsWith('http://') || rutaSinQuery.startsWith('https://')) {
      const u = new URL(rutaSinQuery);
      rutaSinQuery = u.pathname;
    } else if (rutaSinQuery.includes('?')) {
      rutaSinQuery = rutaSinQuery.split('?')[0];
    }
  } catch (_) {
    if (rutaSinQuery.includes('?')) {
      rutaSinQuery = rutaSinQuery.split('?')[0];
    }
  }

  // SHA256 hex del cuerpo crudo (si está vacío, hash de cadena vacía)
  const bodyText = params.cuerpoCrudo ?? '';
  const bodyHash = createHash('sha256').update(bodyText, 'utf8').digest('hex');

  // Sanear cabeceras a ASCII imprimible <= 512 caracteres
  const sesionLimpia = sanearValorCabecera(params.sesion);
  const ipLimpia = sanearValorCabecera(params.clientIp);
  const uaLimpia = sanearValorCabecera(params.clientUa);

  // Exactamente 7 líneas separadas por \n sin \n final
  const canonicalString = `${tsStr}\n${metodoStr}\n${rutaSinQuery}\n${bodyHash}\n${sesionLimpia}\n${ipLimpia}\n${uaLimpia}`;

  const hmac = createHmac('sha256', params.secreto);
  hmac.update(canonicalString, 'utf8');
  const signature = `sha256=${hmac.digest('hex')}`;

  const headers: Record<string, string> = {
    'X-FGREC-Timestamp': tsStr,
    'X-FGREC-Signature': signature
  };

  if (ipLimpia) {
    headers['X-FGREC-Client-IP'] = ipLimpia;
  }
  if (uaLimpia) {
    headers['X-FGREC-Client-UA'] = uaLimpia;
  }
  if (sesionLimpia) {
    headers['X-FGREC-Session'] = sesionLimpia;
  }

  return {
    timestamp: tsStr,
    signature,
    bodyHash,
    canonicalString,
    headers
  };
}
