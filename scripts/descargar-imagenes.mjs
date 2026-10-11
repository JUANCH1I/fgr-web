import fs from 'node:fs';
import path from 'node:path';

const CARPETA = path.resolve('public', 'assets', 'img');
const WIX = 'https://static.wixstatic.com/media/';
fs.mkdirSync(CARPETA, { recursive: true });

const sitio = JSON.parse(fs.readFileSync('src/datos/sitio.json', 'utf8'));
const carreras = JSON.parse(fs.readFileSync('src/datos/carreras.json', 'utf8')).carreras;
const fondos = JSON.parse(fs.readFileSync('src/datos/fondos.json', 'utf8')).fondos;

const imagenes = new Set();
if (sitio.logo) imagenes.add(sitio.logo);
if (sitio.imagenCompartir) imagenes.add(sitio.imagenCompartir);

for (const c of carreras) {
  if (c.imagen) imagenes.add(c.imagen);
  if (c.imagenTarjeta) imagenes.add(c.imagenTarjeta);
}
for (const f of fondos) {
  if (f.imagen) imagenes.add(f.imagen);
  if (f.imagenTarjeta) imagenes.add(f.imagenTarjeta);
  for (const g of f.oferta || []) {
    for (const item of g.carreras || []) {
      if (item.imagen) imagenes.add(item.imagen);
    }
  }
}

console.log(`Descargando ${imagenes.size} imágenes a public/assets/img...`);

for (const id of imagenes) {
  if (!id || /^(https?:)?\/\//.test(id)) continue;
  const esPng = id.toLowerCase().endsWith('.png');
  const archivoLocal = esPng ? id : id.replace(/\.[a-z0-9]+$/i, '') + '.jpg';
  const destino = path.join(CARPETA, archivoLocal);

  if (fs.existsSync(destino) && fs.statSync(destino).size > 0) {
    continue;
  }

  const url = esPng 
    ? `${WIX}${id}` 
    : `${WIX}${id}/v1/fit/w_1200,h_3600,q_80,enc_jpg/${id.replace(/\.[a-z0-9]+$/i, '')}.jpg`;

  try {
    const res = await fetch(url);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(destino, buf);
      console.log(`✓ ${archivoLocal} (${Math.round(buf.length / 1024)} KB)`);
    } else {
      console.warn(`✗ Error ${res.status} al bajar ${id}`);
    }
  } catch (err) {
    console.warn(`✗ Fallo al bajar ${id}:`, err.message);
  }
}

console.log('Imágenes descargadas exitosamente.');
