#!/usr/bin/env node
/* build-faq.js — reconstruye la parte "auto" del FAQ del sitio principal
   a partir de _data/faq.yml, entre las marcas FAQ-AUTO-START/END.
   No toca los FAQ que ya estaban escritos a mano — solo reemplaza lo
   que hay entre esas dos marcas. Corre vía GitHub Actions cada vez que
   Sveltia comitea un cambio en _data/faq.yml. */

const fs = require('fs');
const yaml = require('js-yaml');

const RUTA_DATOS = '_data/faq.yml';
const RUTA_INDEX = 'index.html';

function escAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

if (!fs.existsSync(RUTA_DATOS)) {
  console.log('No hay _data/faq.yml todavía — nada para procesar.');
  process.exit(0);
}
if (!fs.existsSync(RUTA_INDEX)) {
  console.error('No se encontró index.html.');
  process.exit(1);
}

const datos = yaml.load(fs.readFileSync(RUTA_DATOS, 'utf8')) || {};
const items = Array.isArray(datos.items) ? datos.items : [];

const bloque = items.map((it) => {
  return `      <div class="faq-item">
        <button class="faq-q" onclick="toggleFaq(this)"><span>${escAttr(it.pregunta)}</span><span class="faq-arrow">↓</span></button>
        <div class="faq-a"><p>${escAttr(it.respuesta)}</p></div>
      </div>
`;
}).join('');

let html = fs.readFileSync(RUTA_INDEX, 'utf8');
const marcaInicio = '<!-- FAQ-AUTO-START -->';
const marcaFin = '<!-- FAQ-AUTO-END -->';
const i0 = html.indexOf(marcaInicio);
const i1 = html.indexOf(marcaFin);

if (i0 === -1 || i1 === -1) {
  console.error('No se encontraron las marcas FAQ-AUTO-START/END en index.html.');
  process.exit(1);
}

const nuevo = html.slice(0, i0 + marcaInicio.length) + '\n' + bloque + html.slice(i1);

if (nuevo !== html) {
  fs.writeFileSync(RUTA_INDEX, nuevo, 'utf8');
  console.log(`index.html actualizado con ${items.length} pregunta(s) de FAQ.`);
} else {
  console.log('Sin cambios en el FAQ.');
}
