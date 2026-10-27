/* Aria UI: shared code for index.html (window) and strip.html (device strip).
   Inside Live the page runs in jweb and talks to the device through window.max.
   In a normal browser there is no window.max, so it calls the engine directly. */
(function () {
  var ENGINE = 'http://127.0.0.1:8765';
  var inMax = !!(window.max && window.max.outlet);

  // Messages to the device, as in docs/contracts.md ("Device to UI messages").
  function send(name, payload) {
    if (!inMax) return false;
    if (payload === undefined) window.max.outlet(name);
    else window.max.outlet(name, JSON.stringify(payload));
    return true;
  }

  // Messages from the device. Payloads arrive as JSON strings.
  function on(name, fn) {
    if (!inMax) return;
    window.max.bindInlet(name, function (json) {
      var data;
      try { data = json === undefined ? undefined : JSON.parse(json); }
      catch (e) { notice('The device sent a message Aria could not read.'); return; }
      fn(data);
    });
  }

  function $(sel) { return document.querySelector(sel); }

  function notice(text) {
    var el = $('[data-notice]');
    if (!el) return;
    el.textContent = text;
    el.hidden = !text;
  }

  // Sky by default. Night when Live uses a dark theme (sent by the device),
  // or when forced with ?theme=night for development.
  function setTheme(theme) {
    if (theme !== 'sky' && theme !== 'night') return;
    var stage = $('.cp-stage');
    if (stage) stage.setAttribute('data-theme', theme);
  }

  function showEngine(state, detail) {
    var el = $('[data-engine]');
    if (!el) return;
    el.className = 'cp-tag ' + (state === 'up' ? 'cp-tag-good' : state === 'down' ? 'cp-tag-hot' : '');
    el.textContent = state === 'up' ? 'Engine connected' : state === 'down' ? 'Engine not running' : 'Checking engine';
    el.title = detail || '';
    var step = $('[data-step="engine"]');
    if (step) step.classList.toggle('is-done', state === 'up');
  }

  function checkEngine() {
    return fetch(ENGINE + '/health')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (health) {
        var muse = health.muse || {};
        showEngine('up', muse.key_set
          ? 'Muse Spark key is set (' + (muse.model || 'no model named') + ')'
          : 'No Muse Spark key, so advice is unavailable');
        return health;
      })
      .catch(function () {
        showEngine('down', 'Start it with ./install.sh or engine/run.sh');
        return null;
      });
  }

  function checkMix() {
    if (send('check_mix')) {
      notice('Recording 8 bars of your mix.');
      return;
    }
    // Development in a normal browser: analyze a real wav on this machine.
    var path = window.prompt('Development mode. Path to a wav file to analyze:');
    if (!path) return;
    notice('Sending ' + path + ' to the engine.');
    fetch(ENGINE + '/mix/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mix_path: path })
    })
      .then(function (res) {
        if (res.status === 404) throw new Error('Mix check is not in the engine yet.');
        if (!res.ok) throw new Error('The engine could not analyze that file (HTTP ' + res.status + ').');
        return res.json();
      })
      .then(function () { notice('Got a result from the engine.'); })
      .catch(function (err) {
        notice(err instanceof TypeError ? 'The engine is not running.' : err.message);
      });
  }

  function openWindow() {
    if (send('open_window')) return;
    window.open('index.html', 'aria-window');
  }

  function notReady(what) {
    notice(what + ' is not ready yet.');
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
        else notReady(el.getAttribute('data-label') || el.textContent.trim());
      });
    });

    on('state', function (s) {
      if (s && s.theme) setTheme(s.theme);
    });
    on('progress', function (p) { if (p && p.text) notice(p.text); });
    on('error', function (e) { notice(e && e.text ? e.text : 'Something went wrong in the device.'); });

    showEngine('checking');
    checkEngine();
    setInterval(checkEngine, 5000);
  }

  window.Aria = { send: send, on: on, notice: notice, setTheme: setTheme, checkEngine: checkEngine, inMax: inMax };
  document.addEventListener('DOMContentLoaded', init);
})();
