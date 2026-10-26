import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../src/pages/mi-postulacion/convenio.astro', import.meta.url), 'utf8');

test('agreement page omits the separate financial summary', () => {
  assert.equal(/>Resumen<|convenio__resumen|filasResumen/.test(page), false);
});

test('agreement page omits the draft notice without removing the PDF or acceptance controls', () => {
  assert.equal(page.includes('El texto de este convenio todavía está en revisión de la Fundación'), false);
  assert.match(page, /<object[^>]+data=\{RUTA_PDF_CONVENIO\}/);
  assert.match(page, /id="chkAcepto"/);
  assert.match(page, /id="btnAceptar"[^>]+disabled/);
});

test('el convenio aceptado lleva al siguiente paso: informar el primer pago en Pagos', () => {
  const bloque = page.slice(page.indexOf('{aceptado && ('), page.indexOf('<h2 class="convenio__subtitulo">Documento</h2>'));
  assert.match(bloque, /href="\/mi-postulacion\/pagos"/);
  assert.match(bloque, /Ir a Pagos/);
});

test('un botón deshabilitado del convenio se ve deshabilitado (no parece activo sin las casillas)', () => {
  assert.match(page, /\.convenio__acciones \.portal-btn:disabled\s*\{[^}]*opacity:[^}]*cursor:\s*not-allowed/);
});

test('el error del clickwrap se muestra junto a los botones del paso en curso, no arriba del formulario', () => {
  assert.match(page, /const destino = paso\.hidden \? btnEnviar\.closest\('\.convenio__acciones'\) : btnAceptar\.closest\('\.convenio__acciones'\);/);
  assert.match(page, /destino\.parentElement\?\.insertBefore\(alerta, destino\)/);
  assert.match(page, /alerta\.scrollIntoView\(\{ block: 'nearest' \}\)/);
});
