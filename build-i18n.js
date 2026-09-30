#!/usr/bin/env node
// ============================================================
// build-i18n.js — Traduccion AUTOMATICA ES -> EN del index.html
// ------------------------------------------------------------
// Lee el HTML en espanol, detecta cada texto y:
//   · si ya esta traducido (memoria i18n/en.json) -> lo deja como esta
//   · si es nuevo o lo editaste -> lo manda a traducir (Claude) y lo guarda
// Despues regenera el diccionario T_AUTO dentro del index.html.
//
// Uso local : node build-i18n.js            (necesita ANTHROPIC_API_KEY solo si hay textos nuevos)
// En GitHub : lo corre la Action .github/workflows/i18n.yml
//
// Reglas:
//  · Para que un bloque NO se traduzca (ej. T&C): ponele el atributo  data-no-i18n
//  · Para corregir una traduccion: editala en i18n/en.json (el bot la respeta)
//  · Los textos con clave manual (data-i18n="nav.v", etc.) no se tocan: siguen en el diccionario T
// ============================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');

const ROOT = process.cwd();
const HTML_FILE = path.join(ROOT, process.env.I18N_HTML || 'index.html');
const CACHE_FILE = path.join(ROOT, 'i18n', 'en.json');
const MODEL = process.env.I18N_MODEL || 'claude-haiku-4-5-20251001';
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MOCK = process.env.I18N_MOCK === '1';          // solo para pruebas
const BATCH = 25;

const GLOSARIO = `
- NO traduzcas nombres de producto: Alertas Web, ALERTAS WEB, Alertas Automáticas, ALERTAS AUTOMÁTICAS, Estratégica, Premium, JFWEB_MOVI, MOVI, Abril, JF Servicios Web, JF-Búsquedas, Tienda Digital (traducir como "Digital Store" solo en frases; en nombres propios dejalo), Pagefind, Brevo Meetings, Cloudflare, GitHub, WhatsApp, MercadoPago, PayPal.
- "Panel del Dueño" = "Owner Panel". "Panel de Contenidos" = "Content Panel".
- "turno" (cita) = "appointment". "rubro" = "industry" o "type of business". "pymes" = "small businesses".
- "pago único" = "one-time payment". "mes GRATIS" = "month FREE". "membresía" = "membership".
- Tuteo/voseo argentino -> "you". Mantené el tono cercano y directo del original.
- Montos, USD, %, emojis, numeros, URLs, telefonos y mails: copialos IGUAL.
`;

function norm(s) { return s.replace(/\s+/g, ' ').trim(); }
function keyOf(html) { return 'h' + crypto.createHash('sha1').update(norm(html)).digest('hex').slice(0, 8); }
const AUTO_KEY = /^h[0-9a-f]{8}$/;

// ---------- deteccion de unidades ----------
const INLINE = new Set(['a', 'b', 'strong', 'em', 'i', 'span', 'br', 'small', 'code', 'u', 'mark', 'sup', 'sub', 'img', 'abbr', 's']);
const SKIP = new Set(['script', 'style', 'noscript', 'svg', 'head', 'title', 'meta', 'link', 'iframe', 'select', 'option']);
const LETTERS = /[A-Za-zÁÉÍÓÚáéíóúñÑ¿¡]{3,}/;

function collect($, src) {
  const units = [];
  const manual = (el) => el.attribs && ('data-i18n' in el.attribs || 'data-i18n-html' in el.attribs && !AUTO_KEY.test(el.attribs['data-i18n-html']));
  const hasManualAnc = (el) => { let e = el.parent; while (e && e.type === 'tag') { if (manual(e) || (e.attribs && 'data-no-i18n' in e.attribs)) return true; e = e.parent; } return false; };
  const hasTagDesc = (el) => $(el).find('[data-i18n],[data-i18n-html]').length > 0;
  const inlineOnly = (el) => $(el).children().toArray().every((c) => INLINE.has(c.name) && !hasTagDesc(c) && inlineOnly(c));
  function visit(el) {
    if (el.type !== 'tag' || SKIP.has(el.name)) return;
    if (el.attribs && 'data-no-i18n' in el.attribs) return;
    if (hasManualAnc(el)) return;
    const a = el.attribs || {};
    const tagged = 'data-i18n-html' in a && AUTO_KEY.test(a['data-i18n-html']);
    if (manual(el)) return;
    const full = $(el).text().replace(/\s+/g, ' ').trim();
    if (!LETTERS.test(full)) return;
    if (tagged || (!hasTagDesc(el) && inlineOnly(el))) { units.push(el); return; }
    $(el).children().each((i, c) => visit(c));
  }
  visit($('body')[0]);
  return units;
}

// textos que no tienen nada para traducir (solo marcas, precios, numeros): se copian iguales
const IGUALES = /\b(Alertas|Web|ALERTAS|WEB|Estratégica|Premium|JFWEB_MOVI|MOVI|SEO|Blog|USD|WhatsApp|WA|Google|Maps|Email|Instagram|Facebook|Pagefind|Cloudflare|GitHub|Automáticas|AUTOMÁTICAS|Abril|JF|Servicios|FAQ|Esperanza|Santa|Fe|Argentina)\b/g;
function soloMarcas(html) {
  const t = html.replace(/<[^>]+>/g, ' ').replace(/[\w.+-]+@[\w.-]+/g, ' ').replace(/@\w+/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(IGUALES, ' ');
  return !LETTERS.test(t);
}

// ---------- traduccion ----------
function shape(html) { // firma de etiquetas para validar que la IA no rompio nada
  return (html.match(/<[^>]+>/g) || []).map((t) => t.replace(/\s(alt|title|aria-label)="[^"]*"/g, ' $1').replace(/\s+/g, ' ')).join('|');
}
async function llamarClaude(items) { // items: [{k, es}]
  if (MOCK) return Object.fromEntries(items.map((x) => [x.k, '[EN] ' + x.es]));
  if (!API_KEY) throw new Error('Falta ANTHROPIC_API_KEY (hay textos nuevos para traducir).');
  const sistema = `Sos un traductor profesional Español (Argentina) -> Inglés para el sitio web de una agencia de webs y automatización de WhatsApp.
Recibís un JSON {clave: html_en_español}. Devolvé SOLO un JSON {clave: html_en_inglés}, sin texto extra ni bloques de código.
Reglas:
- Conservá EXACTAMENTE todas las etiquetas HTML, sus atributos y su orden (<strong>, <span class=...>, <br>, <img ...>, <a href=...>). Traducí solo el texto; en atributos alt/title traducí el texto, en el resto no cambies nada.
- Las entidades HTML (&amp; etc.) se mantienen.
- Traducción natural y comercial, no literal.
${GLOSARIO}`;
  const body = { model: MODEL, max_tokens: 8000, system: sistema, messages: [{ role: 'user', content: JSON.stringify(Object.fromEntries(items.map((x) => [x.k, x.es]))) }] };
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('API ' + r.status + ': ' + (await r.text()).slice(0, 300));
  const j = await r.json();
  let txt = (j.content || []).map((c) => c.text || '').join('').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(txt);
}

async function traducirFaltantes(faltan, cache) {
  const fallidos = [];
  for (let i = 0; i < faltan.length; i += BATCH) {
    const lote = faltan.slice(i, i + BATCH);
    let res = {};
    try { res = await llamarClaude(lote); } catch (e) { console.log('⚠️  Lote fallido: ' + e.message); }
    const reint = [];
    for (const x of lote) {
      const en = res[x.k];
      if (typeof en === 'string' && shape(en) === shape(x.es) && en.trim()) cache[x.k] = { es: norm(x.es), en: en.trim() };
      else reint.push(x);
    }
    if (reint.length) { // un reintento de los que fallaron validacion
      let res2 = {};
      try { res2 = await llamarClaude(reint); } catch (e) { console.log('⚠️  Reintento fallido: ' + e.message); }
      for (const x of reint) {
        const en = res2[x.k];
        if (typeof en === 'string' && shape(en) === shape(x.es) && en.trim()) cache[x.k] = { es: norm(x.es), en: en.trim() };
        else fallidos.push(x);
      }
    }
  }
  return fallidos;
}

// ---------- main ----------
(async () => {
  if (!fs.existsSync(HTML_FILE)) { console.log('❌ No encuentro ' + HTML_FILE); process.exit(1); }
  const src = fs.readFileSync(HTML_FILE, 'utf8');
  const $ = cheerio.load(src, { sourceCodeLocationInfo: true });
  const units = collect($, src);
  const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};

  // 1) calcular clave actual de cada unidad
  const info = units.map((u) => {
    const loc = u.sourceCodeLocation;
    if (!loc || !loc.startTag || !loc.endTag) return null;
    const inner = src.slice(loc.startTag.endOffset, loc.endTag.startOffset).trim();
    return { u, loc, inner, k: keyOf(inner), cur: u.attribs['data-i18n-html'] };
  }).filter(Boolean);

  // 2) traducir lo que falta en memoria
  const faltan = []; const vistos = new Set();
  for (const x of info) {
    if (cache[x.k] || vistos.has(x.k)) continue;
    vistos.add(x.k);
    if (soloMarcas(x.inner)) { cache[x.k] = { es: norm(x.inner), en: x.inner }; continue; }
    faltan.push({ k: x.k, es: x.inner });
  }
  console.log(`Unidades: ${info.length} · ya traducidas: ${info.length - faltan.length} · nuevas/editadas: ${faltan.length}`);
  let fallidos = [];
  if (faltan.length) fallidos = await traducirFaltantes(faltan, cache);
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  const ordenado = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(CACHE_FILE, JSON.stringify(ordenado, null, 1) + '\n', 'utf8');

  // 3) etiquetar (insertar o corregir data-i18n-html) solo lo que tiene traduccion
  const edits = []; const ES = {}; const EN = {};
  for (const x of info) {
    const c = cache[x.k];
    if (!c) continue;                               // sin traduccion: queda en español, sin tag
    ES[x.k] = x.inner; EN[x.k] = c.en;
    if (x.cur === x.k) continue;
    if (x.cur) { // clave vieja -> reemplazar valor
      const tag = src.slice(x.loc.startTag.startOffset, x.loc.startTag.endOffset);
      const pos = tag.indexOf('data-i18n-html="' + x.cur + '"');
      if (pos < 0) continue;
      edits.push({ at: x.loc.startTag.startOffset + pos, del: ('data-i18n-html="' + x.cur + '"').length, text: 'data-i18n-html="' + x.k + '"' });
    } else edits.push({ at: x.loc.startTag.endOffset - 1, del: 0, text: ' data-i18n-html="' + x.k + '"' });
  }
  // unidades que ya tenian tag pero se quedaron sin traduccion: no tocamos
  let out = src;
  edits.sort((a, b) => b.at - a.at);
  for (const e of edits) out = out.slice(0, e.at) + e.text + out.slice(e.at + e.del);

  // 4) diccionario T_AUTO (una sola linea, entre marcadores)
  const bloque = '/*I18N_AUTO_START*/const T_AUTO=' + JSON.stringify({ es: ES, en: EN }).replace(/<\/script/gi, '<\\/script') + ';/*I18N_AUTO_END*/';
  if (/\/\*I18N_AUTO_START\*\/[\s\S]*?\/\*I18N_AUTO_END\*\//.test(out)) out = out.replace(/\/\*I18N_AUTO_START\*\/[\s\S]*?\/\*I18N_AUTO_END\*\//, () => bloque);
  else if (out.includes('\nconst T={')) out = out.replace('\nconst T={', () => '\n' + bloque + '\nconst T={');
  else { console.log('❌ No encuentro donde poner el diccionario (falta "const T={").'); process.exit(1); }

  if (out !== src) { fs.writeFileSync(HTML_FILE, out, 'utf8'); console.log('✅ index.html actualizado (' + edits.length + ' etiquetas tocadas).'); }
  else console.log('= index.html sin cambios.');
  if (fallidos.length) { console.log('⚠️  ' + fallidos.length + ' texto(s) quedaron SIN traducir (se ven en español en modo EN):'); fallidos.slice(0, 10).forEach((x) => console.log('   · ' + norm(x.es).slice(0, 90))); }
})().catch((e) => { console.log('❌ ' + e.message); process.exit(1); });
