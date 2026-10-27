/* Aria UI: shared code for index.html (window) and strip.html (device strip).
   Inside Live the page runs in jweb and talks to device/bridge.js through window.max.
   Payloads both ways are URI-encoded JSON, so Max never splits them on spaces or commas.
   In a normal browser there is no window.max, so it calls the engine directly. */
(function () {
  var ENGINE = 'http://127.0.0.1:8765';
  var inMax = !!(window.max && window.max.outlet);

  function send(name, payload) {
    if (!inMax) return false;
    if (payload === undefined) window.max.outlet(name);
    else window.max.outlet(name, encodeURIComponent(JSON.stringify(payload)));
    return true;
  }

  function on(name, fn) {
    if (!inMax) return;
    window.max.bindInlet(name, function (encoded) {
      var data;
      try { data = encoded === undefined ? undefined : JSON.parse(decodeURIComponent(encoded)); }
      catch (e) { notice('The device sent a message Aria could not read.'); return; }
      fn(data);
    });
  }

  function $(sel) { return document.querySelector(sel); }
  function text(sel, value) { var el = $(sel); if (el) el.textContent = value; return el; }
  function show(sel, visible) { var el = $(sel); if (el) el.hidden = !visible; return el; }

  function notice(msg) {
    var el = $('[data-notice]');
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
  }

  // Sky by default. Night when Live uses a dark theme, or forced with ?theme=night.
  function setTheme(theme) {
    if (theme !== 'sky' && theme !== 'night') return;
    var stage = $('.cp-stage');
    if (stage) stage.setAttribute('data-theme', theme);
  }

  function showEngine(state, detail) {
    var el = $('[data-engine]');
    if (el) {
      el.className = 'cp-tag ' + (state === 'up' ? 'cp-tag-good' : state === 'error' || state === 'down' ? 'cp-tag-hot' : '');
      el.textContent = state === 'up' ? 'Engine connected' : state === 'error' || state === 'down' ? 'Engine not running' : 'Starting Aria';
      el.title = detail || '';
    }
    var step = $('[data-step="engine"]');
    if (step) step.classList.toggle('is-done', state === 'up');
  }

  function checkEngine() {
    return fetch(ENGINE + '/health')
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (health) {
        var muse = health.muse || {};
        showEngine('up', muse.key_set ? 'Muse Spark key is set (' + (muse.model || 'no model named') + ')' : 'No Muse Spark key, so advice is unavailable');
        return health;
      })
      .catch(function () { showEngine('down', 'Start it with ./install.sh or engine/run.sh'); return null; });
  }

  // ---------- strip states ----------

  function stripState(state) {
    ['idle', 'progress', 'result', 'error'].forEach(function (s) { show('[data-state="' + s + '"]', s === state); });
  }

  function showProgress(p) {
    if (window.AriaWindow) window.AriaWindow.progress(p);
    stripState('progress');
    text('[data-progress-text]', p.text || '');
    text('[data-progress-detail]', p.detail || '');
    var bar = $('[data-progress-bar]');
    if (bar) bar.style.width = p.total ? Math.min(100, 100 * p.done / p.total) + '%' : '100%';
    var btn = $('[data-action="check-mix"]');
    if (btn) btn.disabled = true;
    text('[data-advice-title]', p.step === 'analyze' ? 'Muse Spark is writing' : 'Advice by Muse Spark');
  }

  function showResult(r) {
    stripState('result');
    text('[data-result-where]', r.start_bar ? 'Bars ' + r.start_bar + ' to ' + (r.start_bar + (r.recording.bars || 8) - 1) : 'Your recording');
    // Aria hears only what comes before it. Say so when that isn't the whole mix.
    var c = r.chain;
    var warn = c && (!c.on_main ? 'Not on Main' : c.after.length ? 'Move Aria last' : '');
    var where = $('[data-result-where]');
    if (where) {
      where.className = warn ? 'cp-tag cp-tag-hot' : 'cp-meta cp-mono';
      if (warn) where.textContent = warn;
      where.title = !c ? '' : !c.on_main ? 'Aria is on "' + c.track + '", so it only hears that track. Put it on Main.'
        : c.after.length ? 'Aria hears your mix before ' + c.after.join(', ') + '. Drag Aria to the end of Main to measure what listeners hear.' : '';
    }
    renderFindings((r.clarity || {}).findings || []);
    if (window.AriaWindow) window.AriaWindow.render(r);

    text('[data-advice-title]', r.advice ? 'Advice by Muse Spark' : 'No advice');
    text('[data-advice]', r.advice ? r.advice.summary : r.advice_error || 'Muse Spark did not answer.');
    var adv = $('[data-advice]');
    if (adv) {
      adv.classList.toggle('is-missing', !r.advice);
      adv.title = r.advice ? r.advice.notes.map(function (n) { return n.text; }).join('\n') : '';
    }
    var mark = show('[data-action="mark"]', !!r.start_bar && inMax);
    if (mark) { mark.setAttribute('data-bar', r.start_bar); mark.disabled = false; mark.textContent = 'Mark bar ' + r.start_bar + ' in Live'; }
    var btn = $('[data-action="check-mix"]');
    if (btn) { btn.disabled = false; btn.textContent = 'Check again'; }
  }

  // Everyday names for what the engine found (DESIGN.md: plain words first, numbers as detail).
  var KIND_WORD = { resonance: 'Ringing note', buildup: 'Build-up', harsh: 'Harsh hits', bass_click: 'Bass click' };
  var SOUND_WORD = { vocals: 'Vocal', bass: 'Bass', drums: 'Drums', other: 'Synths', 'the rest': 'the rest of the mix' };

  function hz(v) { return v >= 1000 ? (v / 1000).toFixed(1) + ' kHz' : Math.round(v) + ' Hz'; }
  function hzRange(r) {
    return r[0] >= 1000 ? r[0] / 1000 + '–' + r[1] / 1000 + ' kHz' : r[1] >= 1000 ? r[0] + ' Hz–' + r[1] / 1000 + ' kHz' : r[0] + '–' + r[1] + ' Hz';
  }

  // One row per finding: [what, where in frequency, how much, hover text]
  function describe(f) {
    if (f.kind === 'masking') {
      var what = f.masked === 'other' && f.range === 'low-mid' ? 'Mud' : (SOUND_WORD[f.masked] || f.masked) + ' buried';
      return [what, hzRange(f.hz_range), f.gap_db.toFixed(1) + ' dB',
        (SOUND_WORD[f.masked] || f.masked) + ' sits ' + Math.abs(f.gap_db).toFixed(1) + ' dB under ' + (SOUND_WORD[f.by] || f.by) +
        ' in ' + hzRange(f.hz_range) + ', ' + Math.round(f.share * 100) + '% of the time it plays.'];
    }
    if (f.kind === 'bass_click') {
      return [KIND_WORD.bass_click, 'note starts', '+' + Math.round(f.size_db) + ' dB',
        'A click on ' + Math.round(f.clicky_share * 100) + '% of ' + f.starts + ' bass note starts.'];
    }
    return [KIND_WORD[f.kind] || f.kind, f.kind === 'buildup' ? hz(f.hz_range[0]) + ' to ' + hz(f.hz_range[1]) : hz(f.hz),
      '+' + Number(f.size_db).toFixed(1) + ' dB', ''];
  }

  function renderFindings(findings) {
    var list = $('[data-findings]');
    if (!list) return;
    list.textContent = '';
    show('[data-clear]', findings.length === 0);
    findings.forEach(function (f) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.className = 'aria-finding';
      var d = describe(f);
      btn.title = (d[3] ? d[3] + ' ' : '') + 'Bars ' + f.bars[0] + (f.bars[1] !== f.bars[0] ? ' to ' + f.bars[1] : '') + '. Click to jump there.';
      [['aria-finding-kind', d[0]], ['aria-finding-hz', d[1]], ['aria-finding-size', d[2]],
       ['aria-finding-bars', 'bar ' + f.bars[0]]].forEach(function (p) {
        var span = document.createElement('span');
        span.className = p[0];
        span.textContent = p[1];
        btn.appendChild(span);
      });
      btn.addEventListener('click', function () { send('jump_to', { bar: f.bars[0] }); });
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function showError(e) {
    stripState('error');
    text('[data-error]', e.text || 'Something went wrong.');
    var btn = $('[data-action="check-mix"]');
    if (btn) btn.disabled = false;
  }

  // ---------- actions ----------

  function checkMix() {
    if (send('check_mix')) { showProgress({ step: 'start', text: 'Getting ready' }); return; }
    // Development in a normal browser: analyze a real wav on this machine.
    var path = window.prompt('Development mode. Path to a wav or aiff file to analyze:');
    if (!path) return;
    showProgress({ step: 'analyze', text: 'Measuring and asking Muse Spark' });
    fetch(ENGINE + '/mix/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mix_path: path })
    })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error(body.detail || 'The engine could not analyze that file (HTTP ' + res.status + ').');
          return body;
        });
      })
      .then(showResult)
      .catch(function (err) { showError({ text: err instanceof TypeError ? 'The engine is not running.' : err.message }); });
  }

  function mark(el) {
    var bar = Number(el.getAttribute('data-bar'));
    el.disabled = true;
    el.textContent = 'Adding marker';
    send('add_marker', { bar: bar, name: 'Aria check' });
  }

  function openWindow() {
    if (send('open_window')) return;
    window.open('index.html', 'aria-window');
  }

  function init() {
    var params = new URLSearchParams(window.location.search);
    setTheme(params.get('theme') || 'sky');

    document.querySelectorAll('[data-action]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        var action = el.getAttribute('data-action');
        if (action === 'check-mix') checkMix();
        else if (action === 'open-window') openWindow();
        else if (action === 'mark') mark(el);
        else notice((el.getAttribute('data-label') || el.textContent.trim()) + ' is not ready yet.');
      });
    });

    on('engine', function (s) { showEngine(s.state, s.text); if (s.state === 'error') showError({ text: s.text }); });
    on('state', function (s) { if (s && s.theme) setTheme(s.theme); });
    on('progress', showProgress);
    on('mix_result', showResult);
    on('error', showError);
    on('marker_done', function (m) {
      var el = $('[data-action="mark"]');
      if (el) el.textContent = 'Marked "' + m.name + '" at bar ' + m.bar;
    });

    if (inMax) {
      // bridge.js owns the engine inside Live. Tell it the page is ready for messages.
      showEngine('starting');
      send('ready');
    } else {
      showEngine('checking');
      checkEngine();
      setInterval(checkEngine, 5000);
    }
  }

  window.Aria = { send: send, on: on, notice: notice, setTheme: setTheme, checkEngine: checkEngine, inMax: inMax, showResult: showResult,
                  describe: describe, hzRange: hzRange };
  document.addEventListener('DOMContentLoaded', init);
})();
