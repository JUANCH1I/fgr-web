import fs from 'node:fs';
import path from 'node:path';

const WIX = 'https://static.wixstatic.com/media/';
const CARPETA_LOCAL = path.resolve(process.cwd(), 'public', 'assets', 'img');

export function resolverImagen(id: string, ancho: number = 1200): string {
  if (!id) return '';
  if (/^(https?:)?\/\//.test(id) || id.startsWith('/')) return id;

  const esPng = id.toLowerCase().endsWith('.png');
  const archivoLocal = esPng ? id : id.replace(/\.[a-z0-9]+$/i, '') + '.jpg';

  if (fs.existsSync(path.join(CARPETA_LOCAL, archivoLocal))) {
    return '/assets/img/' + archivoLocal;
  }

  if (esPng) {
    return WIX + id;
  }

  const raiz = id.replace(/\.[a-z0-9]+$/i, '');
  return `${WIX}${id}/v1/fit/w_${ancho},h_${ancho * 3},q_80,enc_jpg/${raiz}.jpg`;
}
