(function () {
  const CATEGORIES = [
    ['toy', 'Toy'],
    ['rules', 'Rules'],
    ['meta', 'Meta'],
    ['theme', 'Theme'],
    ['visual_hook', 'Visual hook'],
    ['monetization', 'Monetization']
  ];
  const STATUS_LABEL = { open: 'Open', action: 'Action', tbd: 'TBD' };

  const app = document.getElementById('app');
  const body = document.body;
  const items = {};
  let sheet, sheetBody, slides = [], dots = [];

  function h(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function md(text) {
    if (text == null || text === '') return '';
    if (typeof marked === 'undefined') return '<p>' + h(text) + '</p>';
    return marked.parse(String(text), { gfm: true, breaks: false });
  }
  function inline(text) {
    return md(text).trim().replace(/^<p>/, '').replace(/<\/p>$/, '');
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dirOf(url) { const i = url.lastIndexOf('/'); return i === -1 ? '' : url.slice(0, i + 1); }

  async function fetchText(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status + ' ' + res.statusText + ' for ' + url);
    return res.text();
  }

  function errorBox(err) {
    const isFile = location.protocol === 'file:';
    return '<div class="error"><h2>Could not load the pitch</h2>' +
      (isFile
        ? '<p>Browsers block a page opened from disk from reading its content files. Serve the folder instead:</p>' +
          '<code>double-click serve.cmd in the PitchingDeck folder</code><p>then open the address it prints.</p>'
        : '<p>' + h(err.message) + '</p>') + '</div>';
  }

  function chip(id, label, kind) {
    return '<button type="button" class="chip k-' + kind + '" data-open="' + h(id) + '"><span class="k">' + h(id) + '</span>' + (label ? ' ' + h(label) : '') + '</button>';
  }
  function refChips(label, refs, ctx) {
    if (!refs || !refs.length) return '';
    const out = refs.map(r => {
      r = String(r);
      if (ctx.convById[r]) return chip(r, ctx.convById[r].short || 'conviction', 'c');
      if (ctx.evById[r]) return chip(r, ctx.evById[r].title, 'e');
      if (ctx.qById[r]) return chip(r, 'question', 'q');
      if (CATEGORIES.some(([k]) => k === r)) return chip('ing-' + r, ctx.catLabel(r), 'i');
      if (items[r]) return chip(r, '', 'x');
      return '<span class="chip"><span class="k">' + h(r) + '</span></span>';
    }).join('');
    return '<div class="chips"><span class="chips-label">' + h(label) + '</span>' + out + '</div>';
  }

  function orbArt(images, opts) {
    const imgs = (images || []).slice(0, 3);
    let out = '<span class="orb-art n' + imgs.length + (opts && opts.crossed ? ' crossed' : '') + '">';
    imgs.forEach(src => { out += '<img src="' + h(src) + '" alt="" loading="lazy">'; });
    out += '</span>';
    return out;
  }

  function comparison(c) {
    if (!c || !c.axes) return '';
    const scale = Number(c.scale) || 10;
    const games = c.games || [];
    let out = '<div class="compare"><div class="compare-legend">';
    games.forEach((g, i) => {
      out += '<div class="g"><span class="swatch g' + i + '"></span>' + (g.image ? '<img src="' + h(g.image) + '" alt="">' : '') + h(g.name) + '</div>';
    });
    out += '</div>';
    c.axes.forEach(a => {
      out += '<div class="compare-row"><div class="axis">' + h(a.name) + '</div><div class="compare-bars">';
      (a.scores || []).forEach((s, i) => {
        const pct = Math.max(0, Math.min(100, (Number(s) / scale) * 100));
        out += '<div class="bar g' + i + '" title="' + h((games[i] || {}).name || '') + ': ' + h(s) + '"><i style="--w:' + pct + '%"></i></div>';
      });
      out += '</div></div>';
    });
    return out + '</div>';
  }

  function evidenceBlock(e, ctx) {
    const typeLabel = e.type === 'testing' ? 'Internal testing' : e.type === 'comp' ? 'Comp' : e.type || 'Evidence';
    let out = '<article class="ev" id="pr-' + h(e.id) + '"><span class="type ' + h(e.type || '') + '">' + h(typeLabel) + '</span><h3>' + h(e.title) + '</h3>';
    if (e.summary) out += '<div class="body">' + md(e.summary) + '</div>';
    if (e.image) out += '<figure><img src="' + h(e.image) + '" alt="" loading="lazy">' + (e.caption ? '<figcaption>' + inline(e.caption) + '</figcaption>' : '') + '</figure>';
    out += comparison(e.comparison);
    if (e.data) out += '<div class="data">' + inline(e.data) + '</div>';
    if (e.link) out += '<a class="ext" href="' + h(e.link) + '" target="_blank" rel="noopener">Source ↗</a>';
    out += refChips('Supports', e.supports, ctx);
    return out + '</article>';
  }

  function refCard(r) {
    let out = '<article class="refcard">';
    out += r.image ? '<img class="thumb" src="' + h(r.image) + '" alt="" loading="lazy">' : '<div class="thumb"></div>';
    out += '<div><div class="name">' + (r.link ? '<a href="' + h(r.link) + '" target="_blank" rel="noopener">' + h(r.name) + '</a>' : h(r.name)) + '</div>';
    if (r.take) out += '<div class="take"><span class="lbl">We take</span>' + md(r.take) + '</div>';
    if (r.why) out += '<div class="why"><span class="lbl">Why</span>' + md(r.why) + '</div>';
    return out + '</div></article>';
  }

  function categoryData(ing, key) {
    const data = ing[key];
    const cards = Array.isArray(data) ? data : (data && Array.isArray(data.cards) ? data.cards : []);
    const extra = (!Array.isArray(data) && data) ? data : {};
    return { cards, points: Array.isArray(extra.points) ? extra.points : [], extra, label: extra.label || null };
  }

  function sheetHead(kicker, title) {
    return '<div class="sheet-head">' + (kicker ? '<div class="kicker">' + h(kicker) + '</div>' : '') + '<h2>' + title + '</h2></div>';
  }

  function register(id, slideId, html) {
    items[id] = { slide: slideId, html };
  }

  function buildTitle(p, ctx) {
    let out = '<section class="slide s-title" id="s-title" data-nav="Pitch"><div class="slide-inner center">';
    if (p.icon) out += '<img class="app-icon anim" src="' + h(p.icon) + '" alt="">';
    out += '<h1 class="anim">' + h(p.title || 'Untitled') + '</h1>';
    if (p.pitch) out += '<div class="pitch anim">' + md(p.pitch) + '</div>';
    if (p.formula) out += '<div class="formula anim">' + h(p.formula) + '</div>';
    if (p.intro && p.intro.length) {
      out += '<div class="ghosts anim">';
      p.intro.forEach((b, i) => {
        const id = b.id || 'intro-' + (i + 1);
        out += '<button type="button" class="ghost" data-open="' + h(id) + '">' + h(b.heading || 'More') + '</button>';
        register(id, 's-title', sheetHead(b.kind === 'proposal' ? 'Proposal' : '', h(b.heading || '')) + '<div class="body">' + md(b.body) + '</div>' + (b.reasoning ? '<div class="reasoning"><div class="lbl">Reasoning</div>' + md(b.reasoning) + '</div>' : ''));
      });
      out += '</div>';
    }
    out += '<div class="hint anim"><span>scroll</span><i></i></div>';
    return out + '</div></section>';
  }

  function buildConvictions(p, ctx) {
    const list = (p.convictions || []).map(id => ctx.convById[id]).filter(Boolean);
    let out = '<section class="slide" id="s-convictions" data-nav="Convictions"><div class="slide-inner">';
    out += '<h2 class="anim">Convictions</h2><div class="row orbs">';
    list.forEach(c => {
      const imgs = (c.images || []).map(src => ctx.convBase + src);
      out += '<button type="button" class="orb anim" data-open="' + h(c.id) + '">' + orbArt(imgs, { crossed: c.crossed }) +
        '<span class="label">' + h(c.short || c.id) + '</span><span class="desc">' + inline(c.statement) + '</span></button>';
      const ev = (p.evidence || []).filter(e => (e.supports || []).includes(c.id));
      let sh = sheetHead(c.short || 'Conviction', inline(c.statement));
      if (c.reasoning) sh += '<div class="body">' + md(c.reasoning) + '</div>';
      if (ev.length) sh += '<div class="sub">Evidence</div>' + ev.map(e => evidenceBlock(e, ctx)).join('');
      register(c.id, 's-convictions', sh);
    });
    out += '</div></div></section>';
    (p.evidence || []).forEach(e => {
      register(e.id, 's-convictions', sheetHead(e.type === 'testing' ? 'Internal testing' : 'Comp', h(e.title)) + evidenceBlock(e, ctx).replace(/<h3>.*?<\/h3>/, '').replace(/<span class="type[^"]*">.*?<\/span>/, ''));
    });
    return out;
  }

  function buildIngredients(p, ctx) {
    const ing = p.ingredients || {};
    let out = '<section class="slide" id="s-ingredients" data-nav="Ingredients"><div class="slide-inner">';
    out += '<h2 class="anim">Ingredients</h2><div class="row pairs">';
    CATEGORIES.forEach(([key, defLabel]) => {
      const { cards, points, extra } = categoryData(ing, key);
      const label = ctx.catLabel(key);
      const id = 'ing-' + key;
      let sh = sheetHead('Ingredient', h(label));
      if (extra.note) sh += '<p class="note">' + inline(extra.note) + '</p>';
      if (points.length) sh += '<ul class="points">' + points.map(x => '<li>' + inline(x) + '</li>').join('') + '</ul>';
      if (cards.length) sh += '<div class="refcards">' + cards.map(refCard).join('') + '</div>';
      const lists = [];
      if (extra.consider && extra.consider.length) lists.push('<div class="list"><div class="lbl">We consider</div><ul>' + extra.consider.map(x => '<li>' + inline(x) + '</li>').join('') + '</ul></div>');
      if (extra.reject && extra.reject.length) lists.push('<div class="list reject"><div class="lbl">We leave out</div><ul>' + extra.reject.map(x => '<li>' + inline(x) + '</li>').join('') + '</ul></div>');
      if (lists.length) sh += '<div class="lists">' + lists.join('') + '</div>';
      register(id, 's-ingredients', sh);
      if (!cards.length) return;
      const imgs = cards.map(c => c.image).filter(Boolean).slice(0, 2);
      out += '<button type="button" class="pair anim" data-open="' + id + '">' +
        '<span class="pair-art n' + imgs.length + '">' + imgs.map(src => '<img src="' + h(src) + '" alt="" loading="lazy">').join('') + '</span>' +
        '<span class="label">' + h(label) + '</span><span class="desc">' + cards.map(c => h(c.name)).join(' · ') + '</span></button>';
      void defLabel;
    });
    return out + '</div></div></section>';
  }

  function buildReasons(p, ctx) {
    let out = '<section class="slide" id="s-why" data-nav="Why"><div class="slide-inner">';
    out += '<h2 class="anim">Why we think it will succeed</h2><div class="row reasons">';
    (p.sanity_check || []).forEach((b, i) => {
      const id = b.id || 'w' + (i + 1);
      out += '<button type="button" class="reason anim' + (b.kind === 'proposal' ? ' proposal' : '') + '" data-open="' + h(id) + '">' +
        '<span class="num">' + pad(i + 1) + '</span><span class="head">' + h(b.heading || '') + '</span>' +
        (b.body ? '<span class="desc">' + inline(b.body) + '</span>' : '') + '</button>';
      let sh = sheetHead(b.kind === 'proposal' ? 'Proposal' : 'Reason ' + pad(i + 1), h(b.heading || ''));
      if (b.body) sh += '<div class="body lead">' + md(b.body) + '</div>';
      if (b.table) sh += '<div class="body">' + md(b.table) + '</div>';
      if (b.diagram) sh += '<pre class="mermaid">' + h(b.diagram) + '</pre>';
      if (b.image) sh += '<figure><img src="' + h(b.image) + '" alt="" loading="lazy">' + (b.caption ? '<figcaption>' + inline(b.caption) + '</figcaption>' : '') + '</figure>';
      if (b.reasoning) sh += '<div class="reasoning"><div class="lbl">Reasoning</div>' + md(b.reasoning) + '</div>';
      sh += refChips('Builds on', b.refs, ctx);
      register(id, 's-why', sh);
    });
    return out + '</div></div></section>';
  }

  function splitSections(text) {
    const sections = [];
    let cur = { heading: null, lines: [] };
    String(text || '').split('\n').forEach(l => {
      const m = l.match(/^##\s+(.+)/);
      if (m) { sections.push(cur); cur = { heading: m[1].trim(), lines: [] }; }
      else cur.lines.push(l);
    });
    sections.push(cur);
    return sections.filter(s => s.heading || s.lines.join('').trim());
  }

  function buildPaths(p, ctx) {
    const dirs = p.directions || [];
    let out = '<section class="slide" id="s-paths" data-nav="Paths"><div class="slide-inner">';
    out += '<h2 class="anim">' + h(p.directions_heading || 'Directions') + '</h2>';
    if (p.directions_sub) out += '<p class="sub-h anim">' + inline(p.directions_sub) + '</p>';
    out += '<div class="row paths">';
    dirs.forEach((d, i) => {
      const id = d.id || 'p' + (i + 1);
      out += '<button type="button" class="path anim" data-goto="' + h(id) + '">' +
        '<span class="tag">Path ' + String.fromCharCode(65 + i) + '</span><span class="head">' + h(d.name) + '</span>' +
        (d.summary ? '<span class="desc">' + inline(d.summary) + '</span>' : '') + '<span class="go">Read it →</span></button>';
    });
    out += '</div></div></section>';
    dirs.forEach((d, i) => {
      const id = d.id || 'p' + (i + 1);
      const letter = String.fromCharCode(65 + i);
      const sections = splitSections(d.body);
      const intro = sections.length && sections[0].heading === null ? sections.shift() : null;
      out += '<section class="slide chapter hook' + (d.image ? ' has-image' : '') + '" id="' + h(id) + '" data-nav="Path ' + letter + '" data-chapter="' + letter + '"><div class="slide-inner"><div class="hook-grid">';
      out += '<div class="hook-text"><span class="tag anim">Path ' + letter + '</span><h2 class="anim">' + h(d.name) + '</h2>';
      if (d.summary) out += '<p class="lead anim">' + inline(d.summary) + '</p>';
      if (intro) out += '<div class="body anim">' + md(intro.lines.join('\n')) + '</div>';
      const answers = refChips('Answers', d.answers, ctx);
      if (answers) out += '<div class="anim">' + answers + '</div>';
      out += '</div>';
      if (d.image) out += '<img class="hook-img anim" src="' + h(d.image) + '" alt="">';
      out += '</div></div></section>';
      if (d.loop && d.loop.length) {
        out += '<section class="slide chapter" id="' + h(id) + '-loop" data-nav="Path ' + letter + ' · loop" data-chapter="' + letter + '"><div class="slide-inner">';
        out += '<h2 class="anim">' + h(d.loop_heading || 'The loop') + '</h2><div class="loop">';
        d.loop.forEach((s, j) => {
          const last = j === d.loop.length - 1;
          out += '<div class="step anim' + (last ? ' last' : '') + '"><span class="n">' + pad(j + 1) + '</span><span class="t">' + h(s.step) + '</span>' + (s.note ? '<span class="d">' + inline(s.note) + '</span>' : '') +
            (last ? '<span class="back">↺ back to 01</span>' : '') + '</div>';
        });
        out += '</div></div></section>';
      }
      sections.forEach((s, j) => {
        out += '<section class="slide chapter" id="' + h(id) + '-s' + (j + 1) + '" data-nav="Path ' + letter + ' · ' + h(s.heading) + '" data-chapter="' + letter + '"><div class="slide-inner narrow">';
        out += '<h2 class="anim">' + h(s.heading) + '</h2><div class="body anim">' + md(s.lines.join('\n')) + '</div></div></section>';
      });
    });
    return out;
  }

  function buildQuestions(p, ctx) {
    const qs = p.open_questions || [];
    if (!qs.length) return '';
    let out = '<section class="slide" id="s-questions" data-nav="Open questions"><div class="slide-inner narrow">';
    out += '<h2 class="anim">Open questions</h2><div class="qs">';
    qs.forEach(q => {
      const st = String(q.status || 'open').toLowerCase();
      out += '<div class="q anim" id="' + h(q.id) + '"><span class="status ' + h(st) + '">' + h(STATUS_LABEL[st] || q.status) + '</span>' +
        '<div><span class="qid">' + h(q.id) + '</span>' + inline(q.question) +
        (q.detail ? '<div class="qdetail">' + md(q.detail) + '</div>' : '') + (q.owner ? '<div class="owner">' + h(q.owner) + '</div>' : '') + '</div></div>';
    });
    out += '</div><div class="foot anim">' + h(p.title || '') + (p.subtitle ? ' · ' + h(p.subtitle) : '') + '</div>';
    return out + '</div></section>';
  }

  function buildChrome(p) {
    let out = '<a class="brand" href="#s-title">' + (p.icon ? '<img src="' + h(p.icon) + '" alt="">' : '') + '<span>' + h(p.title || '') + '</span></a>';
    out += '<a class="view-btn" href="?view=full" title="Everything on one page">' + h(p.overview_label || 'Full overview') + '</a>';
    out += '<nav class="dots" aria-label="Slides"></nav>';
    if (p.skip && p.skip.label) out += '<button type="button" class="skip skip-float" data-goto="' + h(p.skip.to || 's-paths') + '">' + h(p.skip.label) + ' <i>→</i></button>';
    out += '<dialog class="sheet"><button type="button" class="sheet-close" aria-label="Close">×</button><div class="sheet-body"></div></dialog>';
    return out;
  }

  function buildPrint(p) {
    let out = '<div class="print-only">';
    Object.keys(items).forEach(id => { out += '<section class="print-item">' + items[id].html + '</section>'; });
    return out + '</div>';
  }

  function upgradeMermaid(root) {
    root.querySelectorAll('pre > code.language-mermaid').forEach(code => {
      const pre = code.parentElement;
      const div = document.createElement('pre');
      div.className = 'mermaid';
      div.textContent = code.textContent;
      pre.replaceWith(div);
    });
  }
  function runMermaid(root) {
    if (typeof mermaid === 'undefined') return;
    const nodes = Array.from(root.querySelectorAll('.mermaid:not([data-processed])'));
    if (nodes.length) { try { mermaid.run({ nodes }); } catch (e) { console.warn(e); } }
  }

  function openItem(id, push) {
    const it = items[id];
    if (!it) return false;
    sheetBody.classList.remove('in');
    sheetBody.innerHTML = it.html;
    upgradeMermaid(sheetBody);
    sheetBody.scrollTop = 0;
    if (!sheet.open) {
      sheet.showModal();
      document.documentElement.classList.add('sheet-open');
    }
    setTimeout(() => { sheetBody.classList.add('in'); runMermaid(sheetBody); }, 30);
    if (push !== false) history.replaceState(null, '', '#' + id);
    return true;
  }
  function closeSheet() {
    if (!sheet.open) return;
    sheet.classList.add('closing');
    setTimeout(() => {
      sheet.classList.remove('closing');
      sheet.close();
      document.documentElement.classList.remove('sheet-open');
      sheetBody.innerHTML = '';
      const slide = slides.find(s => s.classList.contains('active'));
      if (slide) history.replaceState(null, '', '#' + slide.id);
    }, 180);
  }

  function goTo(i) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    slides[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function activeIndex() {
    const y = window.scrollY + window.innerHeight * 0.5;
    let idx = 0;
    slides.forEach((s, i) => { if (s.offsetTop <= y) idx = i; });
    return idx;
  }

  function wire(root) {
    const initialHash = decodeURIComponent(location.hash.slice(1));
    sheet = root.querySelector('.sheet');
    sheetBody = sheet.querySelector('.sheet-body');
    slides = Array.from(root.querySelectorAll('.slide'));
    const dotsNav = root.querySelector('.dots');
    dotsNav.innerHTML = slides.map((s, i) => '<a href="#' + s.id + '" data-i="' + i + '"' + (s.dataset.chapter ? ' class="sub"' : '') + '><em>' + h(s.dataset.nav) + '</em><span></span></a>').join('');
    const skipFloat = root.querySelector('.skip-float');
    const skipTarget = skipFloat ? slides.findIndex(s => s.id === skipFloat.dataset.goto) : -1;
    dots = Array.from(dotsNav.querySelectorAll('a'));

    slides.forEach(s => {
      Array.from(s.querySelectorAll('.anim')).forEach((el, i) => el.style.setProperty('--i', Math.min(i, 9)));
    });

    let lastActive = -1;
    function updateActive() {
      const i = activeIndex();
      if (i === lastActive) return;
      lastActive = i;
      slides.forEach((s, j) => s.classList.toggle('active', j === i));
      dots.forEach((d, j) => d.classList.toggle('on', j === i));
      if (skipFloat) skipFloat.classList.toggle('show', i > 0 && skipTarget > i);
      if (!sheet.open) history.replaceState(null, '', '#' + slides[i].id);
    }
    window.addEventListener('scroll', updateActive, { passive: true });
    window.addEventListener('resize', updateActive);
    updateActive();

    root.addEventListener('click', e => {
      const btn = e.target.closest('[data-open]');
      if (btn) { e.preventDefault(); openItem(btn.dataset.open); return; }
      const dot = e.target.closest('.dots a');
      if (dot) { e.preventDefault(); goTo(Number(dot.dataset.i)); return; }
      const jump = e.target.closest('[data-goto]');
      if (jump) { e.preventDefault(); const i = slides.findIndex(s => s.id === jump.dataset.goto); if (i >= 0) goTo(i); return; }
      if (e.target.closest('.sheet-close')) { closeSheet(); return; }
      if (e.target === sheet) closeSheet();
    });
    sheet.addEventListener('cancel', e => { e.preventDefault(); closeSheet(); });

    document.addEventListener('keydown', e => {
      if (e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (sheet.open) { if (e.key === 'Escape') { e.preventDefault(); closeSheet(); } return; }
      const next = ['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key) && !e.shiftKey;
      const prev = ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey);
      if (e.key === 'Home') { e.preventDefault(); goTo(0); return; }
      if (e.key === 'End') { e.preventDefault(); goTo(slides.length - 1); return; }
      if (!next && !prev) return;
      e.preventDefault();
      goTo(activeIndex() + (next ? 1 : -1));
    });

    function fromHash(forced) {
      const id = forced != null ? forced : decodeURIComponent(location.hash.slice(1));
      if (!id) return;
      if (items[id]) {
        const s = root.querySelector('#' + CSS.escape(items[id].slide));
        if (s) s.scrollIntoView({ block: 'start' });
        openItem(id);
      } else if (id.startsWith('s-')) {
        closeSheet();
      } else {
        const el = root.querySelector('#' + CSS.escape(id));
        if (el) { const s = el.closest('.slide'); if (s) s.scrollIntoView({ block: 'start' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600); }
      }
    }
    window.addEventListener('hashchange', () => fromHash());
    setTimeout(() => fromHash(initialHash), 60);

    window.addEventListener('beforeprint', () => { runMermaid(root); });
  }

  function render(p, allConvictions, convBase) {
    const ing = p.ingredients || {};
    const ctx = {
      convById: Object.fromEntries((allConvictions || []).map(c => [c.id, c])),
      evById: {},
      qById: Object.fromEntries((p.open_questions || []).map(q => [q.id, q])),
      convBase,
      catLabel(key) {
        const d = categoryData(ing, key);
        if (d.label) return d.label;
        const c = CATEGORIES.find(([k]) => k === key);
        return c ? c[1] : key;
      }
    };
    (p.evidence || []).forEach((e, i) => { if (!e.id) e.id = 'e' + (i + 1); ctx.evById[e.id] = e; });
    (p.open_questions || []).forEach(q => register(q.id, 's-questions', sheetHead('Open question ' + q.id, inline(q.question)) + (q.detail ? '<div class="body">' + md(q.detail) + '</div>' : '') + '<div class="status-line"><span class="status ' + h(String(q.status || 'open').toLowerCase()) + '">' + h(STATUS_LABEL[String(q.status || 'open').toLowerCase()] || q.status) + '</span>' + (q.owner ? ' ' + h(q.owner) : '') + '</div>'));

    document.title = p.title || document.title;

    let out = buildChrome(p) + '<main class="deck">';
    out += buildTitle(p, ctx);
    out += buildConvictions(p, ctx);
    out += buildIngredients(p, ctx);
    out += buildReasons(p, ctx);
    out += buildPaths(p, ctx);
    out += buildQuestions(p, ctx);
    out += '</main>' + buildPrint(p);
    app.innerHTML = out;

    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({
        startOnLoad: false, theme: 'base', securityLevel: 'loose',
        themeVariables: {
          background: '#2a2a2a', primaryColor: '#3a3a3a', primaryTextColor: '#f2f2f2', primaryBorderColor: '#9a9a9a',
          lineColor: '#bdbdbd', secondaryColor: '#333', tertiaryColor: '#2a2a2a', fontFamily: 'Inter, Roboto, system-ui, sans-serif', fontSize: '14px'
        }
      });
    }
    upgradeMermaid(app);
    wire(app);
    runMermaid(app.querySelector('.deck'));
  }

  function pathDoc(d, i, ctx) {
    const letter = String.fromCharCode(65 + i);
    const id = d.id || 'p' + (i + 1);
    const sections = splitSections(d.body);
    const intro = sections.length && sections[0].heading === null ? sections.shift() : null;
    let out = '<article class="doc-item doc-path" id="doc-' + h(id) + '">';
    out += '<div class="sheet-head"><div class="kicker">Path ' + letter + '</div><h2>' + h(d.name) + '</h2></div>';
    if (d.summary) out += '<p class="lead">' + inline(d.summary) + '</p>';
    if (intro) out += '<div class="body">' + md(intro.lines.join('\n')) + '</div>';
    out += refChips('Answers', d.answers, ctx);
    if (d.image) out += '<img class="doc-path-img" src="' + h(d.image) + '" alt="">';
    if (d.loop && d.loop.length) {
      out += '<h3 class="sub">' + h(d.loop_heading || 'The loop') + '</h3><div class="loop">';
      d.loop.forEach((s, j) => {
        const last = j === d.loop.length - 1;
        out += '<div class="step' + (last ? ' last' : '') + '"><span class="n">' + pad(j + 1) + '</span><span class="t">' + h(s.step) + '</span>' + (s.note ? '<span class="d">' + inline(s.note) + '</span>' : '') + (last ? '<span class="back">↺ back to 01</span>' : '') + '</div>';
      });
      out += '</div>';
    }
    sections.forEach(s => { out += '<h3 class="sub">' + h(s.heading) + '</h3><div class="body">' + md(s.lines.join('\n')) + '</div>'; });
    return out + '</article>';
  }

  function renderDoc(p, allConvictions, convBase) {
    const ing = p.ingredients || {};
    const ctx = {
      convById: Object.fromEntries((allConvictions || []).map(c => [c.id, c])),
      evById: {},
      qById: Object.fromEntries((p.open_questions || []).map(q => [q.id, q])),
      convBase,
      catLabel(key) {
        const d = categoryData(ing, key);
        if (d.label) return d.label;
        const c = CATEGORIES.find(([k]) => k === key);
        return c ? c[1] : key;
      }
    };
    (p.evidence || []).forEach((e, i) => { if (!e.id) e.id = 'e' + (i + 1); ctx.evById[e.id] = e; });
    buildTitle(p, ctx); buildConvictions(p, ctx); buildIngredients(p, ctx); buildReasons(p, ctx);
    document.title = (p.title || document.title) + ' · Full overview';

    const sec = (id, num, title, inner) => '<section class="doc-sec" id="doc-' + id + '"><div class="doc-sec-head"><span class="kicker">' + pad(num) + '</span><h2>' + h(title) + '</h2></div>' + inner + '</section>';
    const item = (id, cls) => items[id] ? '<article class="doc-item ' + (cls || '') + '" id="doc-' + h(id) + '">' + items[id].html + '</article>' : '';

    let out = '<a class="brand on" href="./">' + (p.icon ? '<img src="' + h(p.icon) + '" alt="">' : '') + '<span>' + h(p.title || '') + '</span></a>';
    out += '<a class="view-btn" href="./">← Back to the deck</a>';
    out += '<main class="doc">';
    out += '<header class="doc-hero">' + (p.icon ? '<img class="app-icon" src="' + h(p.icon) + '" alt="">' : '') + '<div>' +
      (p.subtitle ? '<div class="kicker">' + h(p.subtitle) + '</div>' : '') + '<h1>' + h(p.title || '') + '</h1>' +
      (p.pitch ? '<div class="pitch">' + md(p.pitch) + '</div>' : '') + (p.formula ? '<div class="formula">' + h(p.formula) + '</div>' : '') + '</div></header>';
    const toc = [['convictions', 'Convictions'], ['ingredients', 'Ingredients'], ['why', 'Why it will succeed'], ['paths', p.directions_heading || 'Directions'], ['questions', 'Open questions']];
    out += '<nav class="doc-toc">' + toc.map(([id, label]) => '<a href="#doc-' + id + '">' + h(label) + '</a>').join('') + '</nav>';
    if (p.intro && p.intro.length) out += '<div class="doc-intro">' + p.intro.map((b, i) => item(b.id || 'intro-' + (i + 1), 'proposal')).join('') + '</div>';

    out += sec('convictions', 1, 'Convictions and evidence', (p.convictions || []).map(id => item(id)).join(''));
    out += sec('ingredients', 2, 'Ingredients', CATEGORIES.map(([key]) => { const d = categoryData(ing, key); return (d.cards.length || d.points.length) ? item('ing-' + key) : ''; }).join(''));
    out += sec('why', 3, 'Why we think it will succeed', (p.sanity_check || []).map((b, i) => item(b.id || 'w' + (i + 1), b.kind === 'proposal' ? 'proposal' : '')).join(''));
    const pathsInner = (p.directions_sub ? '<p class="doc-lede">' + inline(p.directions_sub) + '</p>' : '') + (p.directions || []).map((d, i) => pathDoc(d, i, ctx)).join('');
    out += sec('paths', 4, p.directions_heading || 'Directions', pathsInner);
    const qs = (p.open_questions || []).map(q => {
      const st = String(q.status || 'open').toLowerCase();
      return '<div class="q" id="doc-' + h(q.id) + '"><span class="status ' + h(st) + '">' + h(STATUS_LABEL[st] || q.status) + '</span><div><span class="qid">' + h(q.id) + '</span>' + inline(q.question) + (q.detail ? '<div class="qdetail">' + md(q.detail) + '</div>' : '') + (q.owner ? '<div class="owner">' + h(q.owner) + '</div>' : '') + '</div></div>';
    }).join('');
    out += sec('questions', 5, 'Open questions', '<div class="qs">' + qs + '</div>');
    out += '<div class="foot">' + h(p.title || '') + (p.subtitle ? ' · ' + h(p.subtitle) : '') + ' · full overview</div></main>';
    body.classList.add('doc-view');
    app.innerHTML = out;

    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({ startOnLoad: false, theme: 'base', securityLevel: 'loose', themeVariables: { background: '#2a2a2a', primaryColor: '#3a3a3a', primaryTextColor: '#f2f2f2', primaryBorderColor: '#9a9a9a', lineColor: '#bdbdbd', secondaryColor: '#333', tertiaryColor: '#2a2a2a', fontFamily: 'Inter, Roboto, system-ui, sans-serif', fontSize: '14px' } });
    }
    upgradeMermaid(app);
    runMermaid(app);
    app.addEventListener('click', e => {
      const btn = e.target.closest('[data-open], [data-goto]');
      if (!btn) return;
      const target = document.getElementById('doc-' + (btn.dataset.open || btn.dataset.goto));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); target.classList.add('flash'); setTimeout(() => target.classList.remove('flash'), 1600); }
    });
    if (location.hash) { const t = document.querySelector(location.hash); if (t) setTimeout(() => t.scrollIntoView({ block: 'start' }), 80); }
  }

  (async function init() {
    const pitchUrl = body.dataset.pitch || 'pitch.yaml';
    const convUrl = body.dataset.convictions || '../../convictions.yaml';
    const view = new URLSearchParams(location.search).get('view');
    try {
      const [pitchText, convText] = await Promise.all([fetchText(pitchUrl), fetchText(convUrl)]);
      const pitch = jsyaml.load(pitchText) || {};
      const convictions = jsyaml.load(convText) || [];
      if (view === 'full') renderDoc(pitch, convictions, dirOf(convUrl));
      else render(pitch, convictions, dirOf(convUrl));
    } catch (err) {
      console.error(err);
      app.innerHTML = errorBox(err);
    }
  })();
})();
