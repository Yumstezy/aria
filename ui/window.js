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

  var PARTS = [['vocals', 'Vocal'], ['other', 'Synths and keys'], ['bass', 'Bass'], ['drums', 'Drums and loops']];
  var RANGES = [['low', 'Low', '30–150 Hz'], ['low-mid', 'Low-mid', '150–400 Hz'], ['mid', 'Mid', '400 Hz–1 kHz'], ['presence', 'Presence', '1–4 kHz']];
  var COVERED_DB = -3, OWNS_DB = 3;   // same 3 dB line the engine uses for "covered"

  function notesFor(r, indexes) {
    var notes = (r.advice && r.advice.notes) || [];
    return notes.filter(function (n) { return indexes.indexOf(n.finding) >= 0; });
  }

  // One row per problem: the same sound covered in two ranges is one problem.
  function problems(r) {
    var findings = (r.clarity || {}).findings || [], groups = [], byKey = {};
    findings.forEach(function (f, i) {
      var key = f.kind === 'masking' ? 'masking:' + f.masked : f.kind + ':' + i;
      if (!byKey[key]) { byKey[key] = { findings: [], indexes: [] }; groups.push(byKey[key]); }
      byKey[key].findings.push(f);
      byKey[key].indexes.push(i);
    });
    return groups.map(function (g) {
      var f = g.findings[0], notes = notesFor(r, g.indexes);
      var lo = Math.min.apply(null, g.findings.map(function (x) { return x.hz_range[0]; }));
      var hi = Math.max.apply(null, g.findings.map(function (x) { return x.hz_range[1]; }));
      var short = notes.map(function (n) { return n.short; }).filter(Boolean)[0];
      return {
        name: Aria.describe(f)[0], findings: g.findings, notes: notes,
        where: f.kind === 'bass_click' ? 'Note starts' : f.kind === 'resonance' || f.kind === 'harsh' ? Aria.describe(f)[1] : Aria.hzRange([lo, hi]),
        // Before Muse answers, or if it couldn't, describe the measurement itself.
        short: short || Aria.describe(f)[3] || '',
        fix: notes.map(function (n) { return n.fix; }).filter(Boolean)[0] || null,
        bar: f.bars[0],
      };
    });
  }

  var SVG = 'http://www.w3.org/2000/svg';
  var W = 640, H = 300, PAD_B = 24, PAD_T = 26, LO = 30, HI = 16000, FLOOR_DB = -60;
  var PART_ORDER = ['drums', 'bass', 'other', 'vocals'];          // drawn back to front
  var PART_NAME = { vocals: 'Vocal', other: 'Synths and keys', bass: 'Bass', drums: 'Drums and loops', mix: 'Your mix' };

  function sv(tag, attrs, parent) {
    var e = document.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }
  function X(hz) { return (Math.log10(hz) - Math.log10(LO)) / (Math.log10(HI) - Math.log10(LO)) * W; }
  function Y(db) { return PAD_T + (1 - (Math.max(db, FLOOR_DB) - FLOOR_DB) / -FLOOR_DB) * (H - PAD_T - PAD_B); }

  // Smooth curve through points (Catmull-Rom as cubic Bezier)
  function smooth(pts) {
    var d = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += 'C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ',' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' +
           (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ',' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' +
           p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
    }
    return d;
  }

  // Display only: average each point with its neighbours (about half an octave) so the
  // curves read as shapes, not spikes. The engine's numbers stay as measured.
  function displaySmooth(values) {
    return values.map(function (v, i) {
      var a = values[i - 1] === undefined ? v : values[i - 1], b = values[i + 1] === undefined ? v : values[i + 1];
      return (a + 2 * v + b) / 4;
    });
  }

  function renderWaves(r, list) {
    var svg = $('[data-waves]'), key = $('[data-wave-key]'), sp = (r.clarity || {}).spectra;
    svg.textContent = '';
    key.textContent = '';
    if (!sp) { $('[data-waves-note]').textContent = ''; return; }
    var split = (r.clarity || {}).mode === 'split';
    $('[data-waves-note]').textContent = split ? 'Each part, split from your mix' : 'Your whole mix';

    // Frequency grid and labels
    [50, 100, 200, 500, 1000, 2000, 5000, 10000].forEach(function (hz) {
      sv('line', { x1: X(hz), x2: X(hz), y1: PAD_T - 6, y2: H - PAD_B, 'class': 'aria-grid' }, svg);
      var t = sv('text', { x: X(hz), y: H - 6, 'class': 'aria-axis', 'text-anchor': 'middle' }, svg);
      t.textContent = hz >= 1000 ? hz / 1000 + 'k' : hz;
    });

    // Problem zones behind the waves: where a part is covered, or a ringing note or harsh hits
    var findings = (r.clarity || {}).findings || [];
    findings.forEach(function (f) {
      var lo = f.kind === 'resonance' || f.kind === 'harsh' ? f.hz * 0.92 : f.hz_range[0];
      var hi = f.kind === 'resonance' || f.kind === 'harsh' ? f.hz * 1.08 : f.hz_range[1];
      if (f.kind === 'bass_click') return;          // a click is about timing, not where it sits
      var zone = sv('g', { 'class': 'aria-zone' }, svg);
      sv('rect', { x: X(lo), y: PAD_T - 6, width: Math.max(4, X(hi) - X(lo)), height: H - PAD_B - PAD_T + 6 }, zone);
      var label = sv('text', { x: (X(lo) + X(hi)) / 2, y: 14, 'text-anchor': 'middle' }, zone);
      label.textContent = Aria.describe(f)[0] + ' ' + (f.kind === 'masking' ? f.gap_db.toFixed(0) : '+' + f.size_db.toFixed(0)) + ' dB';
      zone.addEventListener('click', function () {
        var i = list.findIndex(function (p) { return p.findings.indexOf(f) >= 0; });
        if (i >= 0) toggle(i, true);
      });
    });

    // The parts a problem is about stand out; the others step back.
    var involved = {};
    findings.forEach(function (f) {
      if (f.kind === 'masking') involved[f.masked] = true;
      if (f.kind === 'bass_click') involved.bass = true;
    });
    var anyInvolved = Object.keys(involved).length > 0;

    // The waves, back to front, each a filled curve with its name on its peak
    var names = split ? PART_ORDER.filter(function (n) { return sp.parts[n]; }) : ['mix'];
    var labels = [];
    names.forEach(function (n) {
      var values = displaySmooth(split ? sp.parts[n] : sp.mix);
      var pts = sp.hz.map(function (hz, i) { return [X(hz), Y(values[i])]; });
      var line = smooth(pts);
      var g = sv('g', { 'class': 'aria-wave is-' + n + (anyInvolved && !involved[n] && split ? ' is-quiet' : '') }, svg);
      sv('path', { d: line + 'L' + W + ',' + (H - PAD_B) + 'L0,' + (H - PAD_B) + 'Z', 'class': 'aria-wave-fill' }, g);
      sv('path', { d: line, 'class': 'aria-wave-line' }, g);
      var peak = values.indexOf(Math.max.apply(null, values));
      labels.push({ g: g, name: PART_NAME[n] || n, x: Math.min(W - 50, Math.max(50, X(sp.hz[peak]))), y: Y(values[peak]) - 6 });
      var item = el('span', 'is-' + n);
      item.appendChild(el('i'));
      item.appendChild(document.createTextNode(PART_NAME[n] || n));
      key.appendChild(item);
    });
    // Names on the peaks, nudged up so no two overlap
    labels.sort(function (a, b) { return b.y - a.y; });
    var placed = [];
    labels.forEach(function (l) {
      var width = l.name.length * 6.2;
      placed.forEach(function (p) {
        if (Math.abs(p.x - l.x) < (width + p.width) / 2 + 4 && Math.abs(p.y - l.y) < 13) l.y = Math.min(l.y, p.y - 13);
      });
      l.y = Math.max(PAD_T - 2, l.y);
      l.width = width;
      placed.push(l);
      var t = sv('text', { x: l.x, y: l.y, 'text-anchor': 'middle', 'class': 'aria-wave-name' }, l.g);
      t.textContent = l.name;
    });
    if (split) {
      Object.keys(sp.parts).forEach(function (n) {
        if (!sp.parts[n]) key.appendChild(el('span', 'is-absent', (PART_NAME[n] || n) + ': not playing here'));
      });
    }
  }

  function toggle(i, forceOpen) {
    document.querySelectorAll('.aria-problem').forEach(function (row, k) {
      var open = k === i ? (forceOpen || !row.classList.contains('is-open')) : false;
      row.classList.toggle('is-open', open);
      row.querySelector('.aria-problem-head').setAttribute('aria-expanded', String(open));
    });
  }

  function renderProblems(list) {
    var box = $('[data-problems]');
    box.textContent = '';
    if (!list.length) {
      var li = el('li', 'aria-problem-none');
      li.appendChild(el('span', 'cp-tag cp-tag-good', 'Clear'));
      li.appendChild(document.createTextNode(' Nothing sticks out in these bars.'));
      box.appendChild(li);
      return;
    }
    list.forEach(function (p, i) {
      var row = el('li', 'aria-problem');
      var head = el('button', 'aria-problem-head');
      head.appendChild(el('i', 'aria-dot'));
      var titles = el('span', 'aria-problem-titles');
      var top = el('span', 'aria-problem-top');
      top.appendChild(el('b', '', p.name));
      top.appendChild(el('span', 'aria-chip', p.where));
      titles.appendChild(top);
      titles.appendChild(el('span', 'aria-problem-short', p.short));
      head.appendChild(titles);
      head.appendChild(el('span', 'aria-chevron', ''));
      head.addEventListener('click', function () { toggle(i); });
      row.appendChild(head);

      var more = el('div', 'aria-problem-more');
      p.notes.forEach(function (n) { more.appendChild(el('p', '', n.text)); });
      var facts = el('div', 'aria-facts');
      p.findings.forEach(function (f) {
        var d = Aria.describe(f);
        facts.appendChild(el('span', 'aria-chip', d[1] + ' · ' + d[2] + ' · bars ' + f.bars[0] + (f.bars[1] !== f.bars[0] ? '–' + f.bars[1] : '')));
      });
      more.appendChild(facts);
      var actions = el('div', 'cp-row');
      var hear = el('button', 'cp-btn cp-btn-sm', 'Hear it in Live');
      hear.addEventListener('click', function () { Aria.send('jump_to', { bar: p.bar }); });
      actions.appendChild(hear);
      if (p.fix) {
        var fix = el('button', 'cp-btn cp-btn-primary cp-btn-sm', 'Fix it for me');
        fix.addEventListener('click', function () { Aria.notice('Fix it for me is coming next.'); });
        actions.appendChild(fix);
      }
      more.appendChild(actions);
      row.appendChild(more);
      box.appendChild(row);
    });
    toggle(0, true);   // the first one is "fix first", open by default
  }

  function renderSimple(r) {
    var list = problems(r);
    var n = list.length;
    $('[data-verdict]').textContent = n === 0 ? 'Nothing sticks out' : n === 1 ? '1 thing to fix' : n + ' things to fix';
    $('[data-verdict-line]').textContent = r.advice ? r.advice.summary : (r.advice_error || '');
    renderWaves(r, list);
    renderProblems(list);
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
    setView('home');
    setDetail(false);
  }

  window.AriaWindow = { render: function (r) { render(r); if (view === 'home') setView('mixcheck'); }, progress: progress };
  document.addEventListener('DOMContentLoaded', init);
})();
