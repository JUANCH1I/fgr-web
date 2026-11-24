import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerCertificados, parsearCsv, verificarCertificado } from '../src/lib/certificados.ts';

const csv = [
  'codigo,numero,nombre,curso,fecha_curso,horas,evaluacion,realizado_para,dictado_por,emitido_por,estado,cedula',
  'ab3cd4ef,FGREC-CDV-2026-001,Ana Muñoz,"Custodia Segura de Documentos Valorados",17 de noviembre de 2026,8,Aprobado,"COAC OSCUS, Ltda.",Equipo FGR,Fundación Gran Rosario Ecuador,vigente,1712345678',
  'zz11yy22,FGREC-CDV-2026-002,"José ""Pepe"" Peña",Curso,17 de noviembre de 2026,8,Aprobado,COAC OSCUS,Equipo FGR,FGR,anulado,1798765432',
  ''
].join('\r\n');

const certificados = leerCertificados(JSON.stringify(parsearCsv('﻿' + csv)));

test('parses quoted fields, commas, escaped quotes, accents and BOM', () => {
  assert.equal(certificados.length, 2);
  assert.equal(certificados[0].nombre, 'Ana Muñoz');
  assert.equal(certificados[0].realizado_para, 'COAC OSCUS, Ltda.');
  assert.equal(certificados[1].nombre, 'José "Pepe" Peña');
});

test('drops fields outside the public list (ID number never survives)', () => {
  assert.equal(JSON.stringify(certificados).includes('1712345678'), false);
  assert.equal('cedula' in certificados[0], false);
});

test('valid code shows the full certificate', () => {
  const r = verificarCertificado('ab3cd4ef', certificados);
  assert.equal(r.tipo, 'vigente');
  assert.equal(r.tipo === 'vigente' && r.certificado.numero, 'FGREC-CDV-2026-001');
});

test('revoked code exposes only name and number', () => {
  assert.deepEqual(verificarCertificado('zz11yy22', certificados), {
    tipo: 'anulado', nombre: 'José "Pepe" Peña', numero: 'FGREC-CDV-2026-002'
  });
});

test('any state other than "vigente" counts as revoked', () => {
  const [c] = leerCertificados(JSON.stringify([{ codigo: 'aaaa1111', estado: '' }]));
  assert.equal(verificarCertificado('aaaa1111', [c]).tipo, 'anulado');
});

test('unknown or malformed codes are not found', () => {
  assert.equal(verificarCertificado('zzzzzzzz', certificados).tipo, 'inexistente');
  assert.equal(verificarCertificado('AB3CD4EF', certificados).tipo, 'inexistente');
  assert.equal(verificarCertificado('ab3cd4ef/', certificados).tipo, 'inexistente');
});

test('empty env var means no certificates; malformed JSON throws', () => {
  assert.deepEqual(leerCertificados(''), []);
  assert.throws(() => leerCertificados('{"a":1}'));
  assert.throws(() => leerCertificados('not json'));
});
