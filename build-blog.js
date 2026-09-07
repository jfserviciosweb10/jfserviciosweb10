#!/usr/bin/env node
/* build-blog.js — convierte los artículos que se guardan desde Sveltia
   (Markdown, en blog/_posts/) en páginas HTML reales, con el mismo
   diseño que el resto del blog, y las suma a blog/index.html.
   Corre solo, vía GitHub Actions, cada vez que Sveltia comitea un
   artículo nuevo. Si un artículo ya fue publicado antes, no lo vuelve
   a sumar al índice (evita duplicados). */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const CARPETA_POSTS = 'blog/_posts';
const RUTA_BLOG_INDEX = 'blog/index.html';

function escAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Separa el "frontmatter" (los datos: título, fecha, etc.) del cuerpo
// del artículo. Sveltia guarda los .md con este formato:
//   ---
//   title: "..."
//   date: ...
//   ---
//   contenido en markdown
function parsearFrontmatter(texto) {
  const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { datos: {}, cuerpo: texto };
  const bloqueDatos = m[1];
  const cuerpo = m[2];
  const datos = {};
  bloqueDatos.split(/\r?\n/).forEach((linea) => {
    const idx = linea.indexOf(':');
    if (idx === -1) return;
    const clave = linea.slice(0, idx).trim();
    let valor = linea.slice(idx + 1).trim();
    valor = valor.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    datos[clave] = valor;
  });
  return { datos, cuerpo };
}

// El nombre del archivo que arma Sveltia trae fecha adelante
// (2026-09-06-mi-titulo.md) — le sacamos la fecha para que la URL final
// quede prolija, igual que tus artículos actuales.
function slugLimpio(nombreArchivo) {
  return nombreArchivo
    .replace(/\.md$/, '')
    .replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

function formatearFecha(fechaIso) {
  try {
    const d = new Date(fechaIso);
    if (isNaN(d.getTime())) return fechaIso || '';
    return d.toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (e) {
    return fechaIso || '';
  }
}

// Busca una foto en Pexels usando las palabras clave del artículo.
// Si no hay clave configurada, o la búsqueda falla, devuelve null y el
// artículo sigue con la imagen que ya tenía (o el logo por defecto) —
// nunca rompe la generación por esto.
async function buscarFotoPexels(keywords) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey || !keywords) return null;
  try {
    const resp = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(keywords)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: apiKey } }
    );
    if (!resp.ok) {
      console.log(`Pexels respondió ${resp.status} para "${keywords}" — se usa imagen por defecto.`);
      return null;
    }
    const data = await resp.json();
    const foto = data.photos && data.photos[0];
    return foto ? foto.src.large : null;
  } catch (e) {
    console.log(`Error buscando en Pexels ("${keywords}"): ${e.message} — se usa imagen por defecto.`);
    return null;
  }
}

function generarArticuloHTML(datos, cuerpoHTML, slug) {
  const titulo = datos.title || 'Artículo';
  const descripcion = datos.description || '';
  const fecha = datos.date || new Date().toISOString();
  const imagen = datos.image || 'https://jfserviciosweb.com/img/logo.png';
  const fechaLegible = formatearFecha(fecha);
  const fechaSoloDia = String(fecha).slice(0, 10);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escAttr(titulo)} | JF Servicios Web</title>
<meta name="description" content="${escAttr(descripcion)}">
<link rel="canonical" href="https://jfserviciosweb.com/blog/${slug}.html">
<meta property="og:type" content="article">
<meta property="og:title" content="${escAttr(titulo)}">
<meta property="og:description" content="${escAttr(descripcion)}">
<meta property="og:url" content="https://jfserviciosweb.com/blog/${slug}.html">
<meta property="og:image" content="${escAttr(imagen)}">
<meta name="robots" content="index, follow">
<link rel="icon" href="../favicon.ico">
<link rel="stylesheet" href="assets/site.css">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Article","headline":"${escAttr(titulo)}","description":"${escAttr(descripcion)}","author":{"@type":"Organization","name":"JF Servicios Web"},"publisher":{"@type":"Organization","name":"JF Servicios Web","logo":{"@type":"ImageObject","url":"https://jfserviciosweb.com/img/logo.png"}},"datePublished":"${fechaSoloDia}","dateModified":"${fechaSoloDia}","mainEntityOfPage":{"@type":"WebPage","@id":"https://jfserviciosweb.com/blog/${slug}.html"},"image":"${escAttr(imagen)}"},{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Inicio","item":"https://jfserviciosweb.com"},{"@type":"ListItem","position":2,"name":"Blog","item":"https://jfserviciosweb.com/blog/"},{"@type":"ListItem","position":3,"name":"${escAttr(titulo)}","item":"https://jfserviciosweb.com/blog/${slug}.html"}]}]}</script>
</head>
<body>

<div id="cookieBanner">
  <p style="margin:0;font-size:.85rem;color:var(--t2)">Usamos cookies para mejorar tu experiencia. Al continuar, aceptás nuestra política de cookies.</p>
  <button onclick="acceptCookies()" class="btn-primary" style="padding:.6rem 1.4rem;font-size:.82rem">✓ Aceptar</button>
</div>

<nav id="nav">
  <div class="nav-logo-wrap">
    <a href="../"><img src="../img/logo.png" alt="JF Servicios Web" class="nav-logo-img" width="160" height="40" fetchpriority="high"></a>
  </div>
  <ul class="nav-links">
    <li><a href="../#ganchos2">Propuesta</a></li>
    <li><a href="../#planes">Planes</a></li>
    <li><a href="../#preview-webs">Ejemplos reales</a></li>
    <li><a href="../#rebomba">Alerta-Web</a></li>
    <li><a href="../#faq">FAQ</a></li>
    <li><a href="../#contacto">Contacto</a></li>
  </ul>
  <div class="nav-right">
    <button class="hamburger" id="hamburger" aria-label="Menú" onclick="toggleMenu()"><span></span><span></span><span></span></button>
  </div>
</nav>
<div class="mobile-nav" id="mobileNav">
  <a href="../#ganchos2" onclick="closeMenu()">Propuesta</a>
  <a href="../#planes" onclick="closeMenu()">Planes</a>
  <a href="../#preview-webs" onclick="closeMenu()">Ejemplos reales</a>
  <a href="../#rebomba" onclick="closeMenu()">Alerta-Web</a>
  <a href="../#contacto" onclick="closeMenu()">Contacto</a>
</div>

<main id="main-content">
<article style="max-width:820px;margin:0 auto;padding:3rem 1.5rem 5rem">

  <nav aria-label="breadcrumb" style="font-size:.8rem;color:var(--t3);margin-bottom:1.5rem">
    <a href="../" style="color:var(--t3)">Inicio</a> › <a href="./" style="color:var(--t3)">Blog</a> › <span style="color:var(--t2)">${escAttr(titulo)}</span>
  </nav>

  <div style="font-size:.78rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--t3);margin-bottom:.6rem">${escAttr(fechaLegible)}</div>
  <h1 style="font-family:var(--font-head);font-size:clamp(1.8rem,4.5vw,2.6rem);font-weight:800;line-height:1.15;margin-bottom:1.5rem;color:var(--t1)">${escAttr(titulo)}</h1>

  <style>
    .article-body img{display:block;max-width:100%;height:auto;border-radius:var(--r2);margin:1.75rem auto;box-shadow:0 4px 16px rgba(0,0,0,.15)}
  </style>
  <div class="article-body" style="font-size:1rem;line-height:1.75;color:var(--t1)">
${cuerpoHTML}
  </div>

  <div style="margin-top:3rem;background:linear-gradient(135deg,rgba(240,180,41,.1),rgba(240,180,41,.03));border:2px solid var(--gold);border-radius:var(--r2);padding:2rem">
    <p style="font-size:.92rem;color:var(--t2);margin-bottom:1.25rem">¿Querés algo así de simple para tu negocio? Escribinos:</p>
    <a href="https://api.whatsapp.com/send?phone=5493496591636&text=Hola%20Jos%C3%A9%2C%20le%C3%AD%20tu%20art%C3%ADculo%20sobre%20${encodeURIComponent(titulo)}%20y%20quiero%20consultar" target="_blank" rel="noopener noreferrer" class="btn-wa" style="display:inline-flex">💬 Quiero saber más</a>
  </div>

</article>
</main>

<footer>
  <div class="footer-top">
    <div class="footer-brand">
      <img src="../img/logo.png" alt="JF Servicios Web" width="160" height="40">
      <p>Sitios web profesionales para pymes y emprendedores de Latinoamérica. Velocidad, SEO y automatización desde el día uno.</p>
    </div>
    <div class="footer-col">
      <h4>Navegación</h4>
      <ul>
        <li><a href="../#ganchos2">Propuesta</a></li>
        <li><a href="../#planes">Planes</a></li>
        <li><a href="../#rebomba">Alerta-Web</a></li>
        <li><a href="../#faq">FAQ</a></li>
        <li><a href="../#contacto">Contacto</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4>Contacto</h4>
      <div class="footer-contact-info">
        <p>
          <a href="https://api.whatsapp.com/send?phone=5493496591636" target="_blank" rel="noopener noreferrer">+54 9 3496 591636</a><br>
          ✉️ <a href="mailto:info@jfserviciosweb.com">info@jfserviciosweb.com</a><br>
          📍 Esperanza, Santa Fe, Argentina
        </p>
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <p>© <span id="year"></span> JF Servicios Web · Esperanza, Santa Fe, Argentina</p>
  </div>
</footer>

<a id="wa-float" href="https://api.whatsapp.com/send?phone=5493496591636&text=Hola%20Jos%C3%A9%2C%20quiero%20consultar" target="_blank" rel="noopener noreferrer" aria-label="Contactar por WhatsApp">
  <span id="wa-float-text">Escribinos al +54 9 3496 591636</span>
  <img src="../img/whatsapp-flotante.webp?v=3" alt="WhatsApp" width="58" height="58">
</a>

<script>
function toggleMenu(){document.getElementById('mobileNav').classList.toggle('open')}
function closeMenu(){document.getElementById('mobileNav').classList.remove('open')}
document.getElementById('year').textContent = new Date().getFullYear();
(function(){
  var key='cookiesAccepted_v3';
  if(!localStorage.getItem(key))document.getElementById('cookieBanner').style.display='flex';
})();
function acceptCookies(){
  localStorage.setItem('cookiesAccepted_v3','1');
  document.getElementById('cookieBanner').style.display='none';
}
</script>
</body>
</html>
`;
}

function generarTarjetaHTML(datos, slug) {
  const titulo = datos.title || 'Artículo';
  const descripcion = datos.description || '';
  const fechaLegible = formatearFecha(datos.date || new Date().toISOString());
  return `      <a href="${slug}.html" class="blog-card" style="display:block;background:var(--card);border:1px solid var(--border);border-radius:var(--r2);padding:1.5rem;text-decoration:none;transition:border-color .2s,transform .2s">
        <div style="font-size:.7rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--t3);margin-bottom:.5rem">${escAttr(fechaLegible)}</div>
        <h2 style="font-size:1.05rem;font-weight:800;color:var(--t1);margin-bottom:.6rem;line-height:1.3">${escAttr(titulo)}</h2>
        <p style="font-size:.85rem;color:var(--t2);line-height:1.6;margin:0">${escAttr(descripcion)}</p>
        <span style="display:block;margin-top:1rem;padding-top:.8rem;border-top:1px solid var(--border);font-size:.8rem;font-weight:700;color:var(--gold);line-height:1.4">👉 Leer el artículo completo</span>
      </a>
`;
}

async function procesarTodo() {
  if (!fs.existsSync(CARPETA_POSTS)) {
    console.log('No hay carpeta blog/_posts todavía — nada para procesar.');
    return;
  }

  let indexHTML = fs.existsSync(RUTA_BLOG_INDEX) ? fs.readFileSync(RUTA_BLOG_INDEX, 'utf8') : null;
  let cambioIndex = false;
  let nuevos = 0;

  const archivos = fs.readdirSync(CARPETA_POSTS).filter((f) => f.endsWith('.md'));

  for (const archivo of archivos) {
    const rutaMd = path.join(CARPETA_POSTS, archivo);
    const texto = fs.readFileSync(rutaMd, 'utf8');
    const { datos, cuerpo } = parsearFrontmatter(texto);
    const slug = slugLimpio(archivo);
    const rutaHtmlSalida = path.join('blog', `${slug}.html`);

    // Si no hay imagen manual pero sí palabras clave, se busca sola en Pexels.
    if (!datos.image && datos.pexels_keywords) {
      const fotoPexels = await buscarFotoPexels(datos.pexels_keywords);
      if (fotoPexels) datos.image = fotoPexels;
    }

    const cuerpoHTML = marked.parse(cuerpo || '');
    const htmlArticulo = generarArticuloHTML(datos, cuerpoHTML, slug);
    fs.writeFileSync(rutaHtmlSalida, htmlArticulo, 'utf8');

    // Solo se suma la tarjeta al índice si este artículo todavía no
    // estaba linkeado ahí (evita duplicar si el script corre de nuevo).
    if (indexHTML && !indexHTML.includes(`href="${slug}.html"`)) {
      const marcaInicio = '<!-- BLOG-CARDS-AUTO-START -->';
      const tarjeta = generarTarjetaHTML(datos, slug);
      indexHTML = indexHTML.replace(marcaInicio, marcaInicio + '\n' + tarjeta);
      cambioIndex = true;
      nuevos++;
    }
  }

  if (cambioIndex) {
    fs.writeFileSync(RUTA_BLOG_INDEX, indexHTML, 'utf8');
  }

  console.log(`Listo. ${archivos.length} artículo(s) en blog/_posts, ${nuevos} nuevo(s) sumado(s) al índice.`);
}

procesarTodo();
