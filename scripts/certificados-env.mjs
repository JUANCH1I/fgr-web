// Prints the CERTIFICADOS_JSON value for Vercel from the certificates CSV.
// Usage: node --experimental-strip-types scripts/certificados-env.mjs /private/path/certificados.csv
// Keep the CSV outside this repo: it holds people's names.
import { readFileSync } from 'node:fs';
import { leerCertificados, parsearCsv } from '../src/lib/certificados.ts';

const ruta = process.argv[2];
if (!ruta) {
  console.error('Usage: scripts/certificados-env.mjs <csv>');
  process.exit(1);
}
const certificados = leerCertificados(JSON.stringify(parsearCsv(readFileSync(ruta, 'utf8'))));
const codigos = new Set(certificados.map((c) => c.codigo));
const invalidos = certificados.filter((c) => !/^[a-z0-9]{8}$/.test(c.codigo));
if (invalidos.length || codigos.size !== certificados.length) {
  console.error(`Invalid or duplicated codes: ${invalidos.map((c) => c.numero).join(', ') || 'duplicates'}`);
  process.exit(1);
}
console.error(`${certificados.length} certificates`);
process.stdout.write(JSON.stringify(certificados));
