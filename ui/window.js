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

  function renderMap(r, list) {
    var map = $('[data-map]'), space = (r.clarity || {}).space;
    map.textContent = '';
    $('[data-map-key]').hidden = !space;
    if (!space) {
      map.appendChild(el('p', 'cp-meta', 'The space map appears when Aria splits your mix into parts.'));
      $('[data-map-note]').textContent = '';
      return;
    }
    $('[data-map-note]').textContent = 'vs the rest of the mix';
    var flagged = {};
    ((r.clarity || {}).findings || []).forEach(function (f) { if (f.kind === 'masking') flagged[f.masked + ':' + f.range] = f; });

    map.appendChild(el('span', ''));
    RANGES.forEach(function (rg) {
      var head = el('span', 'aria-map-head', rg[1]);
      head.appendChild(el('small', '', rg[2]));
      map.appendChild(head);
    });
    PARTS.forEach(function (p) {
      map.appendChild(el('span', 'aria-map-part', p[1]));
      var cells = space[p[0]];
      RANGES.forEach(function (rg) {
        var cell = el('span', 'aria-cell');
        if (!cells) { cell.classList.add('is-absent'); cell.title = p[1] + ' isn\'t playing in these bars.'; map.appendChild(cell); return; }
        var c = cells[rg[0]];
        if (!c || !c.lives_here) { cell.classList.add('is-empty'); cell.title = 'Not much ' + p[1].toLowerCase() + ' in this range.'; map.appendChild(cell); return; }
        var v = c.vs_rest_db;
        cell.classList.add(v >= OWNS_DB ? 'is-owns' : v > COVERED_DB ? 'is-shares' : 'is-covered');
        if (v <= COVERED_DB) cell.style.setProperty('--depth', Math.min(1, -v / 15).toFixed(2));
        cell.title = p[1] + ' sits ' + Math.abs(v).toFixed(1) + ' dB ' + (v >= 0 ? 'over' : 'under') + ' the rest of the mix in ' + rg[2] + '.';
        var f = flagged[p[0] + ':' + rg[0]];
        if (f) {
          cell.classList.add('is-flagged');
          cell.appendChild(el('b', '', f.gap_db.toFixed(0) + ' dB'));
          cell.setAttribute('role', 'button');
          cell.tabIndex = 0;
          var open = function () {
            var i = list.findIndex(function (pr) { return pr.findings.indexOf(f) >= 0; });
            if (i >= 0) toggle(i, true);
          };
          cell.addEventListener('click', open);
          cell.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
        }
        map.appendChild(cell);
      });
    });
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
    renderMap(r, list);
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
