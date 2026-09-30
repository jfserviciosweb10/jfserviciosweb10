/* blog-lang.js — selector ES/EN del blog. Lo inserta el bot build-i18n-blog.js.
   Usa la memoria de traducciones /i18n/en.json (la misma de la home) y recuerda
   el idioma elegido (clave jf_lang, compartida con la home). */
(function () {
  var dict = null, orig = new Map(), btns = {};
  function getLang() { try { return localStorage.getItem('jf_lang') === 'en' ? 'en' : 'es'; } catch (e) { return 'es'; } }
  function saveLang(l) { try { localStorage.setItem('jf_lang', l); } catch (e) {} }
  function paint(l) {
    document.documentElement.lang = l;
    for (var k in btns) btns[k].classList.toggle('active', k === l);
    if (btns.es) { var on = 'var(--gold,#f5b301)'; ['es', 'en'].forEach(function (x) { btns[x].style.color = x === l ? on : ''; btns[x].style.borderColor = x === l ? on : ''; }); }
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      if (!orig.has(el)) orig.set(el, el.innerHTML);
      if (l === 'es') { el.innerHTML = orig.get(el); return; }
      var t = dict && dict[el.getAttribute('data-i18n-html')];
      if (t && t.en) el.innerHTML = t.en;
    });
  }
  function setLang(l) {
    saveLang(l);
    if (l === 'en' && !dict) {
      fetch('/i18n/en.json').then(function (r) { return r.json(); }).then(function (j) { dict = j; paint('en'); }).catch(function () { paint('es'); });
    } else paint(l);
  }
  function init() {
    var box = document.querySelector('.nav-right');
    if (box && !document.getElementById('jfLangBlog')) {
      var w = document.createElement('span');
      w.id = 'jfLangBlog'; w.setAttribute('data-no-i18n', ''); w.style.cssText = 'display:inline-flex;gap:4px;margin-right:8px';
      ['es', 'en'].forEach(function (l) {
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = l.toUpperCase(); b.className = 'lang-btn';
        b.style.cssText = 'font-size:.78rem;font-weight:600;letter-spacing:.04em;padding:5px 10px;border:1px solid rgba(128,128,128,.4);border-radius:6px;background:transparent;color:inherit;cursor:pointer';
        b.onclick = function () { setLang(l); };
        btns[l] = b; w.appendChild(b);
      });
      box.insertBefore(w, box.firstChild);
    }
    if (getLang() === 'en') setLang('en'); else paint('es');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
