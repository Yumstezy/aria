/* Co-producer chart helpers. Plain DOM + SVG, no dependencies.
   Every chart compares your track to the reference, aligned on song sections.
   Each function takes an <svg> and a data object from the engine; colours come from bundle.css. */
window.CoProducer = (function () {
  var NS = 'http://www.w3.org/2000/svg';
  var uid = 0;

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, cls, anchor) {
    var t = el('text', { x: x, y: y, 'class': cls || 'cp-axis', 'text-anchor': anchor || 'middle' }, parent);
    t.textContent = str;
    return t;
  }
  function frame(svg, w, h) {
    svg.innerHTML = '';
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.classList.add('cp-svg');
    return svg;
  }
  function smooth(P, move) {
    var d = (move === false ? 'L' : 'M') + P[0][0] + ',' + P[0][1];
    for (var i = 0; i < P.length - 1; i++) {
      var p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2, k = 0.17;
      d += 'C' + (p1[0] + (p2[0] - p0[0]) * k) + ',' + (p1[1] + (p2[1] - p0[1]) * k) + ' ' +
        (p2[0] - (p3[0] - p1[0]) * k) + ',' + (p2[1] - (p3[1] - p1[1]) * k) + ' ' + p2[0] + ',' + p2[1];
    }
    return d;
  }
  function chip(parent, x, y, label, hot) {
    var w = label.length * 6.4 + (hot ? 28 : 16);
    el('rect', { x: x - w / 2, y: y, width: w, height: 18, rx: 9, 'class': 'cp-chipbg' }, parent);
    if (hot) el('circle', { cx: x - w / 2 + 9, cy: y + 9, r: 3, 'class': 'cp-chipdot' }, parent);
    text(parent, x + (hot ? 6 : 0), y + 12.5, label, 'cp-chiptext');
  }

  /* 1. Tonal balance: mix vs reference across frequency, the problem band glowing.
     d = { w, h, points: [{hz, mix, ref}], hot: [loHz, hiHz], min, max } */
  function spectrum(svg, d) {
    var w = d.w, h = d.h, padB = 20, padT = 6;
    frame(svg, w, h);
    var lo = Math.log10(30), hi = Math.log10(18000);
    var X = function (hz) { return (Math.log10(hz) - lo) / (hi - lo) * w; };
    var Y = function (db) { return padT + (1 - (db - d.min) / (d.max - d.min)) * (h - padT - padB); };
    var mix = d.points.map(function (p) { return [X(p.hz), Y(p.mix)]; });
    var ref = d.points.map(function (p) { return [X(p.hz), Y(p.ref)]; });
    if (d.hot) {
      var x0 = X(d.hot[0]), x1 = X(d.hot[1]), id = 'cp-clip-' + (++uid);
      el('rect', { x: x0, y: 0, width: x1 - x0, height: h - padB, 'class': 'cp-hotband' }, svg);
      var cp = el('clipPath', { id: id }, svg);
      el('rect', { x: x0, y: 0, width: x1 - x0, height: h }, cp);
      el('path', { d: smooth(mix) + smooth(ref.slice().reverse(), false) + 'Z', 'class': 'cp-hotfill', 'clip-path': 'url(#' + id + ')' }, svg);
    }
    el('path', { d: smooth(mix) + 'L' + w + ',' + (h - padB) + 'L0,' + (h - padB) + 'Z', 'class': 'cp-wash' }, svg);
    el('path', { d: smooth(ref), 'class': 'cp-ref' }, svg);
    el('path', { d: smooth(mix), 'class': 'cp-line' }, svg);
    [[60, 'Sub'], [250, 'Low'], [1000, 'Mid'], [4000, 'Presence'], [12000, 'Air']].forEach(function (t) {
      text(svg, X(t[0]), h - 5, t[1]);
    });
  }

  /* 2. Section map: dB vs the same section of the reference, per band.
     d = { w, sections: [{name}], bands: ['Air','Presence','Mid','Low','Sub'], values: [[per section] per band], focus: [band, section], showValues } */
  function sectionMap(svg, d) {
    var L = d.labelW || 64, top = 20, rowH = d.rowH || 28, gap = 3, cols = d.sections.length;
    var w = d.w, h = top + d.bands.length * rowH + 2;
    frame(svg, w, h);
    var cw = (w - L) / cols;
    d.sections.forEach(function (s, c) { text(svg, L + c * cw + cw / 2, 12, s.name, 'cp-colhead'); });
    d.bands.forEach(function (b, r) {
      var y = top + r * rowH;
      text(svg, 0, y + rowH / 2 + 4, b, 'cp-rowhead', 'start');
      d.values[r].forEach(function (v, c) {
        var x = L + c * cw, a = Math.min(Math.abs(v) / 4, 1);
        var cls = Math.abs(v) < 1 ? 'cp-cell-flat' : v > 0 ? 'cp-cell-hot' : 'cp-cell-cool';
        el('rect', { x: x + gap / 2, y: y + gap / 2, width: cw - gap, height: rowH - gap, rx: 6, 'class': 'cp-cell ' + cls,
          'fill-opacity': Math.abs(v) < 1 ? 1 : (0.18 + a * 0.5).toFixed(2) }, svg);
        if (d.showValues !== false && Math.abs(v) >= 1) text(svg, x + cw / 2, y + rowH / 2 + 4, (v > 0 ? '+' : '') + v.toFixed(1), 'cp-celltext');
      });
    });
    if (d.focus) {
      var fx = L + d.focus[1] * cw, fy = top + d.focus[0] * rowH;
      el('rect', { x: fx + 0.5, y: fy + 0.5, width: cw - 1, height: rowH - 1, rx: 7, 'class': 'cp-cell-focus' }, svg);
    }
  }

  /* 3. Energy arc: short-term loudness per bar, yours vs the reference aligned on sections.
     d = { w, h, sections: [{name, start, len}], mix: [LUFS per bar], ref: [...], min, max, lifts: [{bar, label}] } */
  function energy(svg, d) {
    var w = d.w, h = d.h, n = d.mix.length, padT = 30, padB = 22;
    frame(svg, w, h);
    var X = function (b) { return b / (n - 1) * w; };
    var Y = function (v) { return padT + (1 - (v - d.min) / (d.max - d.min)) * (h - padT - padB); };
    d.sections.forEach(function (s, i) {
      if (s.peak) el('rect', { x: X(s.start), y: padT - 8, width: X(s.start + s.len) - X(s.start), height: h - padB - padT + 8, 'class': 'cp-band' }, svg);
      text(svg, X(s.start + s.len / 2), h - 6, s.name, 'cp-axis');
    });
    var M = d.mix.map(function (v, i) { return [X(i), Y(v)]; }), R = d.ref.map(function (v, i) { return [X(i), Y(v)]; });
    var id = 'cp-clip-' + (++uid), cp = el('clipPath', { id: id }, svg);
    el('path', { d: smooth(R) + 'L' + w + ',' + h + 'L0,' + h + 'Z' }, cp);
    el('path', { d: smooth(M) + smooth(R.slice().reverse(), false) + 'Z', 'class': 'cp-gapfill', 'clip-path': 'url(#' + id + ')' }, svg);
    el('path', { d: smooth(R), 'class': 'cp-ref' }, svg);
    el('path', { d: smooth(M), 'class': 'cp-line' }, svg);
    (d.lifts || []).forEach(function (l) { chip(svg, Math.max(70, Math.min(w - 70, X(l.bar))), 2, l.label, l.hot); });
  }

  /* 4. Stereo width per band, yours vs the reference. Mirrored around the centre.
     d = { w, bands: [{name, mix, ref}] (0 = mono, 1 = full width), tooWide: [names], tooNarrow: [names] } */
  function stereo(svg, d) {
    var L = 64, Rw = 70, rowH = 30, w = d.w, h = d.bands.length * rowH + 18;
    frame(svg, w, h);
    var cx = L + (w - L - Rw) / 2, half = (w - L - Rw) / 2 - 4;
    el('line', { x1: cx, x2: cx, y1: 0, y2: h - 18, 'class': 'cp-grid' }, svg);
    d.bands.forEach(function (b, i) {
      var y = i * rowH + rowH / 2, hw = Math.max(3, b.mix * half), rw = Math.max(3, b.ref * half);
      var state = (d.tooWide || []).indexOf(b.name) > -1 ? 'cp-st-hot' : (d.tooNarrow || []).indexOf(b.name) > -1 ? 'cp-st-cool' : 'cp-st-mix';
      text(svg, 0, y + 4, b.name, 'cp-rowhead', 'start');
      el('rect', { x: cx - hw, y: y - 8, width: hw * 2, height: 16, rx: 8, 'class': state }, svg);
      el('rect', { x: cx - rw, y: y - 11, width: rw * 2, height: 22, rx: 11, 'class': 'cp-st-ref' }, svg);
      text(svg, w, y + 4, Math.round(b.mix * 100) + '% / ' + Math.round(b.ref * 100), state === 'cp-st-mix' ? 'cp-valtext' : 'cp-valtext is-' + state.slice(6), 'end');
    });
    text(svg, cx - half, h - 3, 'wide', 'cp-axis', 'start');
    text(svg, cx, h - 3, 'mono', 'cp-axis');
    text(svg, cx + half, h - 3, 'wide', 'cp-axis', 'end');
  }

  /* 5. Timing: one bar of hits per row, placed at their real time, against the reference's feel.
     d = { w, steps, stepMs, rows: [{label, offsets: [ms per step], role: 'ref'|'ok'|'off'|'fixed'}], target } */
  function timing(svg, d) {
    var L = 70, w = d.w, rowH = 40, rows = d.rows.length, h = rows * rowH + 22;
    frame(svg, w, h);
    var X = function (step, ms) { return L + (step + ms / d.stepMs) / d.steps * (w - L - 6); };
    for (var s = 0; s <= d.steps; s++) el('line', { x1: X(s, 0), x2: X(s, 0), y1: 0, y2: rows * rowH, 'class': s % 4 === 0 ? 'cp-grid-strong' : 'cp-grid' }, svg);
    [1, 2, 3, 4].forEach(function (beat) { text(svg, X((beat - 1) * 4, 0) + 3, h - 6, String(beat), 'cp-axis', 'start'); });
    d.rows.forEach(function (r, i) {
      var base = i * rowH + 28;
      text(svg, 0, base - (r.note ? 12 : 6), r.label, 'cp-rowhead', 'start');
      for (var k = 0; k < d.steps; k++) {
        var ms = r.offsets[k], x = X(k, ms), target = d.target ? d.target[k] : ms;
        var miss = Math.abs(ms - target) > 5, cls = r.role === 'ref' ? 'cp-tr-ref' : r.role === 'fixed' ? 'cp-tr-good' : miss ? 'cp-tr-hot' : 'cp-tr';
        el('path', { d: 'M' + x + ',' + base + 'L' + x + ',' + (base - 18 + (k % 4 ? 5 : 0)) + 'L' + (x + 11) + ',' + base + 'Z', 'class': cls }, svg);
        if (miss && r.role !== 'ref') {
          el('line', { x1: X(k, target), x2: x, y1: base + 4, y2: base + 4, 'class': 'cp-err' }, svg);
        }
      }
      if (r.note) text(svg, 0, base + 3, r.note, r.role === 'off' ? 'cp-valtext is-hot' : r.role === 'fixed' ? 'cp-valtext is-good' : 'cp-valtext', 'start');
    });
  }

  /* 6. Arrangement: your sections against the reference's, on one bar scale, matching sections linked.
     d = { w, rows: [{label, sections: [{name, len, flag}]}], links: [[refIndex, yourIndex]] } */
  function arrangement(svg, d) {
    var L = 78, w = d.w, laneH = 46, gapY = 34, total = 0;
    d.rows.forEach(function (r) { var t = r.sections.reduce(function (a, s) { return a + s.len; }, 0); total = Math.max(total, t); });
    var h = d.rows.length * laneH + (d.rows.length - 1) * gapY + 20;
    frame(svg, w, h);
    var X = function (bar) { return L + bar / total * (w - L); };
    var starts = d.rows.map(function (r) { var at = 0; return r.sections.map(function (s) { var x = at; at += s.len; return x; }); });
    (d.links || []).forEach(function (lk) {
      var x1 = X(starts[0][lk[0]]), x2 = X(starts[1][lk[1]]);
      el('path', { d: 'M' + (x1 + 1.5) + ',' + laneH + 'C' + (x1 + 1.5) + ',' + (laneH + gapY / 2) + ' ' + (x2 + 1.5) + ',' + (laneH + gapY / 2) + ' ' + (x2 + 1.5) + ',' + (laneH + gapY), 'class': x1 === x2 ? 'cp-link' : 'cp-link is-off' }, svg);
    });
    d.rows.forEach(function (r, i) {
      var y = i * (laneH + gapY);
      text(svg, 0, y + laneH / 2 + 4, r.label, 'cp-rowhead', 'start');
      r.sections.forEach(function (s, k) {
        var x = X(starts[i][k]) + 1.5, bw = X(starts[i][k] + s.len) - X(starts[i][k]) - 3;
        el('rect', { x: x, y: y, width: bw, height: laneH, rx: 10, 'class': 'cp-secblock' + (s.peak ? ' is-peak' : '') + (s.flag ? ' is-flag' : '') }, svg);
        if (bw > 36) { text(svg, x + 8, y + 19, s.name, 'cp-secname', 'start'); text(svg, x + 8, y + 34, s.len + ' bars', s.flag ? 'cp-secbars is-hot' : 'cp-secbars', 'start'); }
      });
    });
    for (var b = 0; b <= total; b += 16) text(svg, X(b), h - 3, String(b + 1), 'cp-axis', b === 0 ? 'start' : 'middle');
  }


  /* 7. Live analyzer on canvas: real-time spectrum against the reference, for producers.
     opts = { freqs: centre frequencies (use logBands), ref: dB per freq, min: -72, max: 0, keyRoots: [{hz, name}] }
     Returns { update(bandsDb), setReference(dbOrNull), freeze(bool) }. Feed it ~30 frames a second. */
  function logBands(lo, hi, perOct) {
    var out = [], f = lo;
    while (f <= hi * 1.0001) { out.push(f); f *= Math.pow(2, 1 / perOct); }
    return out;
  }
  var NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function noteName(f) { var n = Math.round(12 * Math.log2(f / 440) + 69); return NOTE[(n % 12 + 12) % 12] + (Math.floor(n / 12) - 1); }
  function fmtHz(f) { return f >= 1000 ? (f / 1000).toFixed(f >= 10000 ? 0 : 1) + ' kHz' : Math.round(f) + ' Hz'; }

  function analyzer(canvas, o) {
    var ctx = canvas.getContext('2d'), st = { live: null, peak: null, ref: o.ref || null, hover: null, frozen: false, raf: 0 };
    var min = o.min == null ? -72 : o.min, max = o.max == null ? 0 : o.max, freqs = o.freqs, perOct = Math.log2(freqs[1] / freqs[0]);
    var L = 34, B = 22, T = 26, W = 0, H = 0, lo = Math.log10(20), hi = Math.log10(20000);
    var css = getComputedStyle(canvas), col = function (n) { return css.getPropertyValue('--' + n).trim() || '#888'; };
    var mono = css.getPropertyValue('--font-mono').trim() || 'monospace', sans = css.getPropertyValue('--font-sans').trim() || 'sans-serif';
    var X = function (f) { return L + (Math.log10(f) - lo) / (hi - lo) * (W - L - 10); };
    var F = function (x) { return Math.pow(10, lo + (x - L) / (W - L - 10) * (hi - lo)); };
    var Y = function (db) { return T + (max - Math.max(min, Math.min(max, db))) / (max - min) * (H - T - B); };
    function at(arr, f) {
      var p = Math.log2(f / freqs[0]) / perOct, i = Math.max(0, Math.min(arr.length - 2, Math.floor(p))), t = Math.max(0, Math.min(1, p - i));
      return arr[i] + (arr[i + 1] - arr[i]) * t;
    }
    function size() {
      var r = canvas.getBoundingClientRect(), d = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(r.width * d) || canvas.height !== Math.round(r.height * d)) { canvas.width = Math.round(r.width * d); canvas.height = Math.round(r.height * d); }
      W = r.width; H = r.height; ctx.setTransform(d, 0, 0, d, 0, 0);
    }
    function line(arr, stroke, width, dash, alpha) {
      ctx.beginPath();
      for (var x = L; x <= W - 10; x += 2) { var y = Y(at(arr, F(x))); if (x === L) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.setLineDash(dash || []); ctx.lineWidth = width; ctx.strokeStyle = stroke; ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    function draw() {
      st.raf = 0; size(); ctx.clearRect(0, 0, W, H);
      ctx.font = '500 10.5px ' + mono; ctx.textBaseline = 'middle';
      ctx.strokeStyle = col('hairline'); ctx.lineWidth = 1; ctx.fillStyle = col('ink-faint');
      for (var db = max; db >= min; db -= 12) { var y = Math.round(Y(db)) + 0.5; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(W - 10, y); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(String(db), L - 6, y); }
      ctx.textAlign = 'center';
      [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].forEach(function (f) {
        var x = Math.round(X(f)) + 0.5; ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, H - B); ctx.stroke();
        ctx.fillText(f >= 1000 ? f / 1000 + 'k' : String(f), Math.min(W - 18, Math.max(L + 8, x)), H - 10);
      });
      var zones = [[20, 60, 'Sub'], [60, 250, 'Low'], [250, 2000, 'Mid'], [2000, 6000, 'Presence'], [6000, 20000, 'Air']];
      ctx.font = '600 10px ' + sans; ctx.fillStyle = col('ink-faint'); ctx.strokeStyle = col('track');
      zones.forEach(function (z, i) {
        if (i) { var x = Math.round(X(z[0])) + 0.5; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, H - B); ctx.stroke(); ctx.setLineDash([]); }
        ctx.fillText(z[2].toUpperCase(), (X(z[0]) + X(z[1])) / 2, 12);
      });
      (o.keyRoots || []).forEach(function (k) {
        var x = Math.round(X(k.hz)) + 0.5; ctx.strokeStyle = col('action'); ctx.globalAlpha = 0.55; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(x, H - B); ctx.lineTo(x, H - B - (H - B - T) * 0.42); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        ctx.fillStyle = col('action'); ctx.font = '600 10px ' + mono; ctx.fillText(k.name, x, H - B - (H - B - T) * 0.42 - 8);
      });
      if (!st.live) return;
      ctx.beginPath(); ctx.moveTo(L, H - B);
      for (var x = L; x <= W - 10; x += 2) ctx.lineTo(x, Y(at(st.live, F(x))));
      ctx.lineTo(W - 10, H - B); ctx.closePath(); ctx.fillStyle = col('action'); ctx.globalAlpha = 0.10; ctx.fill(); ctx.globalAlpha = 1;
      if (st.ref) {
        for (var x2 = L; x2 <= W - 10; x2 += 2) {
          var f = F(x2), dl = at(st.live, f), dr = at(st.ref, f), d = dl - dr;
          if (Math.abs(d) < 1.5) continue;
          ctx.fillStyle = col(d > 0 ? 'hot' : 'cool'); ctx.globalAlpha = d > 0 ? 0.42 : 0.28;
          ctx.fillRect(x2 - 1, Math.min(Y(dl), Y(dr)), 2, Math.abs(Y(dl) - Y(dr)));
        }
        ctx.globalAlpha = 1;
        line(st.ref, col('ink-faint'), 1.5, [5, 4]);
      }
      if (st.peak) line(st.peak, col('ink-faint'), 1, null, 0.7);
      line(st.live, col('ink'), 1.75);
      if (st.hover != null) {
        var hx = st.hover, hf = F(hx), hl = at(st.live, hf), label = fmtHz(hf) + ' · ' + noteName(hf) + ' · ' + hl.toFixed(1) + ' dB';
        if (st.ref) { var dd = hl - at(st.ref, hf); label += ' · ' + (dd >= 0 ? '+' : '') + dd.toFixed(1) + ' vs ref'; }
        ctx.strokeStyle = col('ink'); ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(hx + 0.5, T); ctx.lineTo(hx + 0.5, H - B); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.fillStyle = col('ink'); ctx.beginPath(); ctx.arc(hx, Y(hl), 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.font = '600 11px ' + mono; var tw = ctx.measureText(label).width + 20, cx = Math.max(L + tw / 2, Math.min(W - 10 - tw / 2, hx)), cy = T + 14;
        ctx.fillStyle = col('chip'); ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(cx - tw / 2, cy - 11, tw, 22, 11); else ctx.rect(cx - tw / 2, cy - 11, tw, 22); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.fillText(label, cx, cy + 0.5);
      }
    }
    function later() { if (!st.raf) st.raf = requestAnimationFrame(draw); }
    canvas.addEventListener('mousemove', function (e) { var r = canvas.getBoundingClientRect(), x = e.clientX - r.left; st.hover = x >= L && x <= W - 10 ? x : null; later(); });
    canvas.addEventListener('mouseleave', function () { st.hover = null; later(); });
    window.addEventListener('resize', later);
    later();
    return {
      update: function (bands) {
        if (st.frozen) return;
        st.live = bands;
        st.peak = st.peak ? st.peak.map(function (p, i) { return Math.max(p - 0.4, bands[i]); }) : bands.slice();
        later();
      },
      setReference: function (ref) { st.ref = ref; later(); },
      freeze: function (on) { st.frozen = !!on; },
      hoverAt: function (hz) { size(); st.hover = hz == null ? null : X(hz); later(); }
    };
  }

  return { el: el, smooth: smooth, spectrum: spectrum, sectionMap: sectionMap, energy: energy, stereo: stereo, timing: timing, arrangement: arrangement, analyzer: analyzer, logBands: logBands, noteName: noteName };
})();
