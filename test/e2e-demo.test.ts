import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { llamarFGRECPortal } from '../src/lib/fgrec-portal.ts';

// Configuración explícita solo para el test runner (nunca en el código de producción)
process.env.FGREC_PORTAL_URL = 'http://127.0.0.1:3410/fgrec/api/portal';
process.env.FGREC_PORTAL_SECRET = 'demo-portal-secret-NOT-FOR-PRODUCTION-0123456789';
process.env.FGREC_UPLOAD_ORIGIN = 'http://127.0.0.1:3410';

interface LeadTestInfo {
  token: string;
  email: string;
}

function crearLeadTestFresco(): LeadTestInfo {
  const script = `
    import { createPool } from "./src/db/pool.js";
    import { createPortalAccessService } from "./src/portal/access/service.js";
    const db = createPool("postgres://postgres:postgres_dev@localhost:55433/fgrec_portal_demo?options=-c%20role=fgrec_app");
    const num = Date.now().toString().slice(-8);
    const tel = "+59399" + num;
    const email = "postulante." + num + "@example.com";
    const { rows: [lead] } = await db.query(
      "INSERT INTO lead (nombre, email, telefono, pais_id, secundaria, estudios_previos, via) VALUES ('Test Runner', $1, $2, (SELECT id FROM pais WHERE iso2 = 'EC'), 'SI', true, 'RECONOCIMIENTO') RETURNING id",
      [email, tel]
    );
    const access = createPortalAccessService({
      db,
      secret: "demo-portal-secret-NOT-FOR-PRODUCTION-0123456789",
      publicUrl: "http://localhost:4321/mi-postulacion",
      mail: { name: "test", delivers: true, send: async () => {} }
    });
    const link = await access.issueEntryLink({ leadId: Number(lead.id), purpose: "DOCUMENTOS", channel: "WEB" });
    const token = new URL(link.url).searchParams.get("t");
    process.stdout.write(JSON.stringify({ token, email }));
    await db.end();
  `;
  const raw = execFileSync('node', ['--input-type=module', '-e', script], {
    cwd: '/home/juanmanfredi/desarrollo/fgrec-sistema-portal-a',
    encoding: 'utf8'
  }).trim();
  return JSON.parse(raw);
}

test('E2E completo contra la demo local de FGREC', async (t) => {
  let demoArriba = false;
  try {
    const res = await fetch('http://127.0.0.1:3410/fgrec/api/portal/sesion');
    demoArriba = res.status === 401;
  } catch {
    demoArriba = false;
  }

  if (!demoArriba) {
    t.skip('Demo local en 127.0.0.1:3410 no disponible, omitiendo test E2E.');
    return;
  }

  // 1. Crear lead de prueba fresco
  const { token, email } = crearLeadTestFresco();
  assert.ok(token, 'Debe emitir un token base64url');

  // 2. Canjear el token con POST acceso/enlace
  const canje = await llamarFGRECPortal({
    metodo: 'POST',
    rutaRelativa: 'acceso/enlace',
    cuerpo: { token },
    contexto: { ip: '127.0.0.1', ua: 'TestRunner/1.0' }
  });
  assert.equal(canje.status, 200);
  assert.equal(canje.data?.proposito, 'documentos');
  assert.equal(canje.data?.nombre, 'Test');
  assert.ok(canje.data?.sesion, 'Debe entregar sesión de nivel 1');
  const sesionNivel1 = canje.data.sesion;

  // 3. Solicitar código de 6 dígitos para subir de nivel
  const reqCodigo = await llamarFGRECPortal({
    metodo: 'POST',
    rutaRelativa: 'acceso/codigo',
    sesion: sesionNivel1,
    contexto: { ip: '127.0.0.1', ua: 'TestRunner/1.0' }
  });
  assert.equal(reqCodigo.status, 202);
  assert.equal(reqCodigo.data?.enviado, true);

  // 4. Leer código del log simulado de correo
  const mailsText = readFileSync('/tmp/fgrec_portal_demo-mails.jsonl', 'utf8').trim();
  const lineas = mailsText.split('\n');
  const ultimoMail = JSON.parse(lineas[lineas.length - 1]);
  assert.equal(ultimoMail.to, email);
  const matchCodigo = ultimoMail.text.match(/código de verificación es:\s*(\d{6})/i);
  assert.ok(matchCodigo, 'El correo debe contener el código de 6 dígitos');
  const codigo = matchCodigo[1];

  // 5. Verificar código para ascender a nivel 2
  const verif = await llamarFGRECPortal({
    metodo: 'POST',
    rutaRelativa: 'acceso/verificar',
    cuerpo: { codigo },
    sesion: sesionNivel1,
    contexto: { ip: '127.0.0.1', ua: 'TestRunner/1.0' }
  });
  assert.equal(verif.status, 200);
  assert.equal(verif.data?.nivel, 2);
  assert.equal(verif.data?.siguiente, 'documentos');
  assert.ok(verif.data?.sesion, 'Debe devolver sesión de nivel 2');
  const sesionNivel2 = verif.data.sesion;

  // 6. Consultar documentos (GET documentos)
  const docs = await llamarFGRECPortal({
    metodo: 'GET',
    rutaRelativa: 'documentos',
    sesion: sesionNivel2,
    contexto: { ip: '127.0.0.1' }
  });
  assert.equal(docs.status, 200);
  assert.ok(Array.isArray(docs.data?.requisitos), 'Debe listar los requisitos');
  assert.ok(docs.data?.requisitos.length > 0, 'Lead en Reconocimiento debe tener requisitos');
  const reqPendiente = docs.data.requisitos.find((r: any) => r.estado === 'PENDIENTE') || docs.data.requisitos[0];

  // 7. Consultar y aceptar consentimiento antes de subir
  const cons = await llamarFGRECPortal({
    metodo: 'GET',
    rutaRelativa: 'consentimientos',
    sesion: sesionNivel2,
    contexto: { ip: '127.0.0.1' }
  });
  assert.equal(cons.status, 200);
  assert.ok(cons.data?.textos?.length > 0);
  const textoCons = cons.data.textos[0];

  const aceptarCons = await llamarFGRECPortal({
    metodo: 'POST',
    rutaRelativa: 'consentimientos',
    cuerpo: { codigo: textoCons.codigo, version: textoCons.version },
    sesion: sesionNivel2,
    contexto: { ip: '127.0.0.1' }
  });
  assert.ok([200, 201].includes(aceptarCons.status));

  // 8. Autorizar subida de documento (POST documentos/subida)
  const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000102 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n');
  const authSubida = await llamarFGRECPortal({
    metodo: 'POST',
    rutaRelativa: 'documentos/subida',
    cuerpo: {
      requisito: reqPendiente.codigo,
      nombreArchivo: 'titulo.pdf',
      tipo: 'application/pdf',
      tamano: pdfBytes.length
    },
    sesion: sesionNivel2,
    contexto: { ip: '127.0.0.1', ua: 'TestRunner/1.0' }
  });
  assert.equal(authSubida.status, 200);
  assert.ok(authSubida.data?.token, 'Debe devolver token de subida de un solo uso');
  assert.ok(authSubida.data?.url, 'Debe devolver URL directa de subida');

  // 9. Subida directa del archivo por parte del navegador (con Bearer token y Content-Length calculado)
  const resSubida = await fetch(authSubida.data.url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authSubida.data.token}`,
      'Content-Type': 'application/pdf',
      'Content-Length': String(pdfBytes.length),
      'Origin': 'http://localhost:4321'
    },
    body: pdfBytes
  });
  assert.equal(resSubida.status, 202);
  const dataSubida = await resSubida.json();
  assert.equal(dataSubida.estado, 'RECIBIDO');
  assert.ok(dataSubida.documentoId, 'Debe devolver el id del documento');

  // 10. Consultar "Mi postulación" (GET postulacion)
  const postulacion = await llamarFGRECPortal({
    metodo: 'GET',
    rutaRelativa: 'postulacion',
    sesion: sesionNivel2,
    contexto: { ip: '127.0.0.1' }
  });
  assert.equal(postulacion.status, 200);
  assert.equal(postulacion.data?.situacion, 'ACTIVA');

  // 11. Cerrar sesión (POST acceso/salir)
  const salir = await llamarFGRECPortal({
    metodo: 'POST',
    rutaRelativa: 'acceso/salir',
    sesion: sesionNivel2,
    contexto: { ip: '127.0.0.1' }
  });
  assert.equal(salir.status, 204);

  // 12. Verificar que la sesión quedó revocada
  const intentoRevocado = await llamarFGRECPortal({
    metodo: 'GET',
    rutaRelativa: 'postulacion',
    sesion: sesionNivel2,
    contexto: { ip: '127.0.0.1' }
  });
  assert.equal(intentoRevocado.status, 401);
});
