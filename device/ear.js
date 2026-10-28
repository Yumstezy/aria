// Aria Ear: records its track when the main Aria's Check mix starts (key tracks mode, build step 4).
// The main Aria broadcasts on "aria_ear"; each Ear answers on "aria_ear_back" with its track's name and
// its file, so the engine can name the tracks that clash.
//   in:  record <dir> <ms> <stamp>   start recording this track for ms milliseconds
//        stop                        stop early (playback stopped)
//   out 0: to sfrecord~   out 1: to "aria_ear_back" (URI-encoded JSON)
autowatch = 1;
inlets = 1;
outlets = 2;

function trackName() {
  try {
    const me = new LiveAPI("this_device");
    const track = new LiveAPI("id " + me.get("canonical_parent")[1]);
    return String(track.get("name"));
  } catch (e) {
    return "Track";
  }
}

function record(dir, ms, stamp) {
  const me = new LiveAPI("this_device");
  const file = String(dir) + "/ear-" + stamp + "-" + me.id + ".aif";
  outlet(0, "samptype", "float32");
  outlet(0, "open", file);
  outlet(0, "record", Number(ms));
  outlet(1, encodeURIComponent(JSON.stringify({ name: trackName(), file: file })));
}

function stop() {
  outlet(0, 0);
}
