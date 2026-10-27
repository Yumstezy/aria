/* Aria window (index.html): Home and Mix check (Simple and Detailed).
   Rendered from the engine's real result only. Before the first Check mix, every view
   says what will appear and how to get it. Uses Aria.* from app.js. */
(function () {
  var result = null;
  var view = 'home';
  var detail = false;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function setView(name) {
    view = name;
    document.querySelectorAll('[data-view]').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== name; });
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      if (a.getAttribute('data-nav') === name) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    var title = $('[data-title]');
    if (title) title.textContent = name === 'mixcheck' ? 'Mix check' : 'Home';
  }

  function setDetail(on) {
    detail = on;
    document.querySelectorAll('[data-seg]').forEach(function (b) {
      b.setAttribute('aria-pressed', String((b.getAttribute('data-seg') === 'detailed') === on));
    });
    $('[data-simple]').hidden = on;
    $('[data-detailed]').hidden = !on;
  }

  // Short status word per finding, for tags (DESIGN.md: one plain word, color never alone).
  function word(f) {
    return { masking: f.masked === 'other' && f.range === 'low-mid' ? 'Muddy' : 'Buried', bass_click: 'Clicks',
             resonance: 'Rings', harsh: 'Harsh', buildup: 'Builds up' }[f.kind] || 'Sticks out';
  }

  function noteFor(r, i) {
    var notes = (r.advice && r.advice.notes) || [];
    for (var k = 0; k < notes.length; k++) if (notes[k].finding === i) return notes[k];
    return null;
  }

  function barsLabel(f) { return 'Bars ' + f.bars[0] + (f.bars[1] !== f.bars[0] ? ' to ' + f.bars[1] : ''); }

  function renderSimple(r) {
    var findings = (r.clarity || {}).findings || [];
    var n = findings.length;

    // Verdict hero
    $('[data-verdict]').textContent = n === 0 ? 'Nothing sticks out' : n === 1 ? '1 thing to fix' : n + ' things to fix';
    $('[data-verdict-line]').textContent = r.advice ? r.advice.summary : (r.advice_error || '');
    var score = $('[data-score]');
    score.textContent = '';
    findings.forEach(function (f) {
      var s = el('span'); var i = el('i', 'is-watch'); s.appendChild(i); s.appendChild(document.createTextNode(Aria.describe(f)[0])); score.appendChild(s);
    });
    if (!n) { var ok = el('span'); ok.appendChild(el('i', 'is-good')); ok.appendChild(document.createTextNode('Clear in these bars')); score.appendChild(ok); }

    // Fix first: the strongest finding, in Muse's words when there are some
    var fix = $('[data-fixfirst]');
    fix.hidden = n === 0;
    if (n) {
      var top = findings[0], d = Aria.describe(top), note = noteFor(r, 0);
      $('[data-fix-title]').textContent = d[0] + (top.kind === 'masking' ? ' in ' + Aria.hzRange(top.hz_range) : '');
      $('[data-fix-line]').textContent = note ? note.text : d[3];
      var fixBtn = $('[data-action="fix-it"]');
      fixBtn.hidden = !(note && note.fix);
      if (note && note.fix) fixBtn.setAttribute('data-fix', JSON.stringify(note.fix));
      $('[data-hear]').setAttribute('data-bar', top.bars[0]);
    }

    // One card per finding
    var cards = $('[data-cards]');
    cards.textContent = '';
    findings.forEach(function (f, i) {
      var d = Aria.describe(f), note = noteFor(r, i);
      var card = el('section', 'cp-tile cp-card cp-stat span-' + (n === 1 ? 12 : n === 2 ? 6 : 4));
      var head = el('div', 'cp-stat-head');
      head.appendChild(el('span', 'cp-stat-name', d[0]));
      head.appendChild(el('span', 'cp-tag cp-tag-watch cp-stat-word', word(f)));
      card.appendChild(head);
      card.appendChild(el('p', 'cp-stat-line', note ? note.text : d[3]));
      var meta = el('button', 'aria-card-meta cp-mono', d[1] + ' · ' + d[2] + ' · ' + barsLabel(f));
      meta.title = 'Jump to bar ' + f.bars[0];
      meta.addEventListener('click', function () { Aria.send('jump_to', { bar: f.bars[0] }); });
      card.appendChild(meta);
      cards.appendChild(card);
    });

    // Where it happens: one block per recorded bar, outlined where something sticks out
    var where = $('[data-where]');
    where.textContent = '';
    var first = r.start_bar || (r.clarity && r.clarity.bars && r.clarity.bars[0]);
    var count = (r.recording && r.recording.bars) || 8;
    if (!first) { where.appendChild(el('p', 'cp-meta', 'Bar numbers appear when Check mix runs inside Live.')); return; }
    for (var b = first; b < first + count; b++) {
      var hits = findings.filter(function (f) { return b >= f.bars[0] && b <= f.bars[1]; });
      // The design's cp-where blocks are spans; make each one a keyboard-reachable button.
      var block = el('span', hits.length ? 'is-hot' : '');
      block.setAttribute('role', 'button');
      block.tabIndex = 0;
      block.style.setProperty('--n', 1);
      block.title = hits.length ? hits.map(function (f) { return Aria.describe(f)[0]; }).join(', ') : 'Nothing sticks out';
      block.appendChild(document.createTextNode('Bar ' + b));
      block.appendChild(el('small', '', hits.length ? (hits.length === 1 ? Aria.describe(hits[0])[0] : hits.length + ' things') : 'Clear'));
      var jump = (function (bar) { return function () { Aria.send('jump_to', { bar: bar }); }; })(b);
      block.addEventListener('click', jump);
      block.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jump(); } });
      where.appendChild(block);
    }
  }

  function number(label, value, unit, why) {
    var tile = el('div', 'aria-number');
    tile.appendChild(el('span', 'cp-cap', label));
    var v = el('span', 'aria-number-value' + (value === null || value === undefined ? ' is-missing' : ''));
    if (value === null || value === undefined) { v.textContent = 'Not measured'; v.title = why || ''; }
    else { v.textContent = value; if (unit) v.appendChild(el('small', '', ' ' + unit)); }
    tile.appendChild(v);
    return tile;
  }

  function renderDetailed(r) {
    var m = r.measured || {}, why = m.unmeasured || {}, box = $('[data-numbers]');
    box.textContent = '';
    var f1 = function (x) { return x === null || x === undefined ? null : Number(x).toFixed(1); };
    box.appendChild(number('Loudness', f1(m.integrated_lufs), 'LUFS', why.integrated_lufs || why.all));
    box.appendChild(number('True peak', f1(m.true_peak_dbtp), 'dBTP', why.all));
    ['bass', 'mids', 'treble'].forEach(function (b) {
      box.appendChild(number(b.charAt(0).toUpperCase() + b.slice(1), f1((m.bands_db || {})[b]), 'dB', why['bands_db.' + b] || why.all));
    });
    ['bass', 'mids', 'treble'].forEach(function (b) {
      var w = (m.width || {})[b];
      box.appendChild(number('Width ' + b, w === null || w === undefined ? null : Math.round(w * 100), '%', why['width.' + b] || why.all));
    });

    var parts = $('[data-parts]');
    parts.textContent = '';
    var st = (r.clarity || {}).stems;
    $('[data-parts-tile]').hidden = !st;
    if (st) {
      Object.keys(st).forEach(function (k) {
        parts.appendChild(number({ vocals: 'Vocal', drums: 'Drums and loops', bass: 'Bass', other: 'Synths and keys' }[k] || k, f1(st[k]), 'dB vs mix'));
      });
      $('[data-split-by]').textContent = 'Split by ' + (r.clarity.split_by || 'Demucs') + '. A sound more than 20 dB under the mix counts as not playing.';
    }

    var notes = $('[data-notes]');
    notes.textContent = '';
    ((r.advice && r.advice.notes) || []).forEach(function (n) { notes.appendChild(el('li', '', n.text)); });
    if (!r.advice) notes.appendChild(el('li', 'cp-meta', r.advice_error || 'No advice.'));
  }

  function render(r) {
    result = r;
    var where = r.start_bar ? 'Bars ' + r.start_bar + ' to ' + (r.start_bar + ((r.recording && r.recording.bars) || 8) - 1) : 'Your recording';
    var mode = (r.clarity || {}).mode === 'split' ? 'split into parts' : 'full mix only';
    document.querySelectorAll('[data-session]').forEach(function (s) { s.textContent = where + ' · ' + mode; });
    $('[data-mix-empty]').hidden = true;
    $('[data-mix-body]').hidden = false;
    renderSimple(r);
    renderDetailed(r);
    var home = $('[data-home-latest]');
    if (home) {
      home.hidden = false;
      $('[data-home-empty]').hidden = true;
      $('[data-home-verdict]').textContent = $('[data-verdict]').textContent;
      $('[data-home-line]').textContent = r.advice ? r.advice.summary : (r.advice_error || '');
    }
    var step = $('[data-step="check"]');
    if (step) step.classList.add('is-done');
  }

  function progress(p) {
    Aria.notice(p.text + (p.detail ? ' · ' + p.detail : ''));
  }

  function init() {
    if (!$('[data-view]')) return;
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); setView(a.getAttribute('data-nav')); });
    });
    document.querySelectorAll('[data-seg]').forEach(function (b) {
      b.addEventListener('click', function () { setDetail(b.getAttribute('data-seg') === 'detailed'); });
    });
    var hear = $('[data-hear]');
    if (hear) hear.addEventListener('click', function () { Aria.send('jump_to', { bar: Number(hear.getAttribute('data-bar')) }); });
    setView('home');
    setDetail(false);
  }

  window.AriaWindow = { render: function (r) { render(r); if (view === 'home') setView('mixcheck'); }, progress: progress };
  document.addEventListener('DOMContentLoaded', init);
})();
