// Ayudas compartidas por todas las plantillas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CARPETA_IMAGENES = path.join(RAIZ, 'src', 'assets', 'img');
const WIX = 'https://static.wixstatic.com/media/';

// Escapa texto para ponerlo dentro de HTML.
export function esc(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Texto sin acentos y en minúsculas (para buscar y comparar).
export function normalizar(texto) {
  return String(texto ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// "Salud y Rehabilitación" -> "salud-y-rehabilitacion"
export function aSlug(texto) {
  return normalizar(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ---------- Imágenes ----------
// Las imágenes se nombran con su identificador del banco de Wix
// (por ejemplo 64d480_...~mv2.jpg). Si el archivo ya está descargado en
// src/assets/img, se usa la copia local; si no, se toma de Wix.
// "npm run imagenes" descarga todas las que usa el sitio.

const anchosPedidos = new Map();
const ORIGINALES = new Set(); // imágenes que se descargan sin convertir (por ejemplo, logos con transparencia)

export function mantenerOriginal(id) {
  if (id) ORIGINALES.add(id);
}

function raiz(id) {
  return id.replace(/\.[a-z0-9]+$/i, '');
}

// Nombre del archivo local de una imagen.
export function archivoImagen(id) {
  return ORIGINALES.has(id) ? id : raiz(id) + '.jpg';
}

export function urlImagen(id, ancho = 1200) {
  if (!id) return '';
  if (/^(https?:)?\/\//.test(id) || id.startsWith('/')) return id;
  anchosPedidos.set(id, Math.max(anchosPedidos.get(id) || 0, ancho));
  const archivo = archivoImagen(id);
  if (fs.existsSync(path.join(CARPETA_IMAGENES, archivo))) {
    return '/assets/img/' + archivo;
  }
  if (ORIGINALES.has(id)) return WIX + id;
  return WIX + id + '/v1/fit/w_' + ancho + ',h_' + ancho * 3 + ',q_80,enc_jpg/' + raiz(id) + '.jpg';
}

// Lista de imágenes usadas, con el ancho mayor que pidió el sitio.
export function imagenesUsadas() {
  return [...anchosPedidos.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([id, ancho]) => ({ id, ancho: Math.min(ancho, 1920), archivo: archivoImagen(id), original: ORIGINALES.has(id) }));
}

export function img(id, { alt = '', ancho = 1200, clase = '', carga = 'lazy', alto = '' } = {}) {
  if (!id) return '';
  return '<img src="' + esc(urlImagen(id, ancho)) + '" alt="' + esc(alt) + '"' +
    (clase ? ' class="' + clase + '"' : '') +
    (alto ? ' width="' + ancho + '" height="' + alto + '"' : '') +
    ' loading="' + carga + '" decoding="async">';
}

// ---------- Enlaces y botones ----------

export function boton(texto, url, tipo = 'principal') {
  if (!url) return '';
  const externo = /^https?:\/\//.test(url);
  return '<a class="boton boton--' + tipo + '" href="' + esc(url) + '"' +
    (externo ? ' target="_blank" rel="noopener"' : '') + '>' + esc(texto) + '</a>';
}

export function enlaceFlecha(texto, url) {
  if (!url) return '';
  const externo = /^https?:\/\//.test(url);
  return '<a class="enlace-flecha" href="' + esc(url) + '"' +
    (externo ? ' target="_blank" rel="noopener"' : '') + '>' + esc(texto) + ' <span aria-hidden="true">→</span></a>';
}

// Datos que el navegador lee desde la página (para buscadores y filtros).
export function datosJSON(id, datos) {
  const json = JSON.stringify(datos).replace(/</g, '\\u003c');
  return '<script type="application/json" id="' + id + '">' + json + '</script>';
}

// Une las partes de una lista de HTML, ignorando las vacías.
export function unir(...partes) {
  return partes.flat(Infinity).filter(Boolean).join('\n');
}

// "Abril 2026" o "24 de enero de 2026" -> fecha (fin de ese mes o ese día). Otros textos -> null.
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function fechaDeInicio(texto) {
  const t = String(texto || '').toLowerCase();
  const m = t.match(/(?:(\d{1,2})\s+de\s+)?([a-záéíóú]+)\s+(?:de\s+)?(\d{4})/);
  if (!m) return null;
  const mes = MESES.indexOf(m[2]);
  if (mes < 0) return null;
  return m[1] ? new Date(Number(m[3]), mes, Number(m[1]) + 1) : new Date(Number(m[3]), mes + 1, 1);
}
