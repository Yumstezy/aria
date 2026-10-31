// The Live analyzer's stereo view (Oct 31, Ian: a polar view "where you can actually see where your sound is"):
// the device records Main's last 100 ms into a stereo buffer~ (record~, looping), and on each analyzer frame this
// reads it back and sends about 160 left and right sample pairs to the bridge. Runs only while the analyzer is open
// (the metro that bangs it is on only then). jsarguments[1] is the buffer's name, unique to this device.
autowatch = 1;
inlets = 1;
outlets = 1;

var POINTS = 160;
var buf = null;

function bang() {
  if (!buf) {
    try { buf = new Buffer(jsarguments[1]); } catch (e) { return; }
  }
  var frames = buf.framecount();
  if (!frames || buf.channelcount() < 2) return;
  var left = buf.peek(1, 0, frames), right = buf.peek(2, 0, frames);
  if (!left || !right || !left.length) return;
  var step = Math.max(1, Math.floor(frames / POINTS)), out = [];
  for (var i = 0; i < frames; i += step) out.push(Math.round(left[i] * 1000) / 1000, Math.round(right[i] * 1000) / 1000);
  outlet(0, "scope_frame", out);
}
