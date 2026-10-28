"""Aria's helper inside Live. ON HOLD (Oct 27, Ian): Aria no longer adds or turns third-party plugins; it shows
how they should look instead (engine/aria_engine/guides.py). The bridge doesn't call this script, and install.sh
no longer installs it. Kept for later: it works in Live 12.4 (it found 277 plugins on Ian's Mac).


Max for Live can't reach Live's browser, so it can't add a third-party plugin. A Remote Script can:
browser.load_item() puts a plugin on the selected track, the same as a double-click. The bridge
(device/bridge.js) sends one JSON line per command on 127.0.0.1:8766 and gets one JSON line back:

  {"cmd": "plugins"}                          -> {"ok": true, "plugins": ["Pro-Q 4", ...]}
  {"cmd": "load", "track": 3, "name": "..."}  -> {"ok": true, "name": "Pro-Q 4", "index": 2}
                                                 track -1 is Main

Turn it on once: Live Settings > Link, Tempo & MIDI > Control Surface: Aria.
"""
import json
import socket

from _Framework.ControlSurface import ControlSurface

PORT = 8766
FORMATS = ("VST3", "AU", "VST")   # preferred format when a plugin is installed more than once
WAIT_TICKS = 40                   # update_display runs about every 100 ms, so about 4 s


def key(text):
    return "".join(c for c in str(text).lower() if c.isalnum())


def create_instance(c_instance):
    return Aria(c_instance)


class Aria(ControlSurface):

    def __init__(self, c_instance):
        ControlSurface.__init__(self, c_instance)
        self._server = None
        self._clients = []      # [socket, bytes read so far]
        self._plugins = None    # [(name, format, browser item)], read once
        self._loading = None    # a load waiting for Live to show the new device
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind(("127.0.0.1", PORT))
            s.listen(4)
            s.setblocking(False)
            self._server = s
            self.log_message("Aria: listening on %d" % PORT)
        except Exception as e:
            self.log_message("Aria: couldn't listen on %d: %s" % (PORT, e))

    def disconnect(self):
        for c in self._clients:
            self._close(c)
        if self._server:
            self._server.close()
        ControlSurface.disconnect(self)

    # Live calls this about ten times a second, on its main thread
    def update_display(self):
        ControlSurface.update_display(self)
        try:
            self._poll()
            if self._loading:
                self._check_loaded()
        except Exception as e:
            self.log_message("Aria: %s" % e)

    def _poll(self):
        if not self._server:
            return
        try:
            while True:
                conn, _ = self._server.accept()
                conn.setblocking(False)
                self._clients.append([conn, b""])
        except (BlockingIOError, socket.error):
            pass
        for c in list(self._clients):
            try:
                data = c[0].recv(65536)
            except (BlockingIOError, socket.error):
                continue
            if not data:
                self._close(c)
                continue
            c[1] += data
            while b"\n" in c[1]:
                line, c[1] = c[1].split(b"\n", 1)
                self._handle(c, line)

    def _close(self, c):
        try:
            c[0].close()
        except Exception:
            pass
        if c in self._clients:
            self._clients.remove(c)

    def _reply(self, c, payload):
        try:
            c[0].setblocking(True)
            c[0].sendall((json.dumps(payload) + "\n").encode("utf-8"))
            c[0].setblocking(False)
        except Exception:
            self._close(c)

    def _handle(self, c, line):
        try:
            msg = json.loads(line.decode("utf-8"))
        except ValueError:
            self._reply(c, {"ok": False, "text": "Not JSON."})
            return
        cmd = msg.get("cmd")
        if cmd == "plugins":
            if msg.get("refresh"):
                self._plugins = None
            names = []
            for name, _, _ in self._plugin_items():
                if name not in names:
                    names.append(name)
            self._reply(c, {"ok": True, "plugins": names})
        elif cmd == "tree":
            self._reply(c, {"ok": True, "tree": self._tree(self.application().browser.plugins, int(msg.get("depth", 3)))})
        elif cmd == "load":
            self._load(c, int(msg.get("track", -1)), str(msg.get("name", "")))
        else:
            self._reply(c, {"ok": False, "text": "Unknown command."})

    # ---------- the plugin list: every loadable device under Plugins in Live's browser ----------

    # Live marks a third-party plugin as loadable, not always as a device, so anything loadable under
    # Plugins counts; folders (formats, makers) are walked. A plugin's own presets sit under it and are skipped.
    def _plugin_items(self):
        if not self._plugins:   # an empty list is read again: Live may still be scanning
            found = []

            def walk(item, fmt, depth):
                for child in item.children:
                    if child.is_loadable and not getattr(child, "is_folder", False):
                        found.append((child.name, fmt, child))
                    elif depth < 5:
                        walk(child, fmt, depth + 1)

            for top in self.application().browser.plugins.children:
                if top.is_loadable and not getattr(top, "is_folder", False):
                    found.append((top.name, "", top))
                else:
                    walk(top, top.name, 1)
            self._plugins = found
            self.log_message("Aria: found %d plugins" % len(found))
        return self._plugins

    def _aria_preset(self, plugin):
        """The producer's "<plugin> (Aria)" rack or preset in the User Library's Presets folder, or None.
        Read each time, so a preset saved a minute ago is found."""
        want = key(plugin + " aria")
        try:
            presets = [c for c in self.application().browser.user_library.children if key(c.name) == "presets"]
        except Exception:
            return None

        def walk(item, depth):
            for child in item.children:
                # A rack (.adg) or device preset (.adv) keeps Live's Configure list; a plugin preset doesn't
                name = child.name
                if name.lower().endswith((".vstpreset", ".fxp", ".aupreset")):
                    continue
                if name.lower().endswith((".adg", ".adv")):
                    name = name.rsplit(".", 1)[0]
                if child.is_loadable and key(name) == want:
                    return child
                if depth < 5 and not child.is_loadable:
                    hit = walk(child, depth + 1)
                    if hit:
                        return hit
            return None

        for p in presets:
            hit = walk(p, 1)
            if hit:
                self.log_message("Aria: using the preset %s" % hit.name)
                return hit
        return None

    def _tree(self, item, depth):
        """Names and flags under an item, for checking how Live lays out its plugins."""
        out = []
        for child in list(item.children)[:40]:
            node = {"name": child.name, "loadable": bool(child.is_loadable), "device": bool(child.is_device),
                    "folder": bool(getattr(child, "is_folder", False))}
            if depth > 1 and not child.is_loadable:
                node["children"] = self._tree(child, depth - 1)
            out.append(node)
        return out

    def _find(self, want):
        k = key(want)
        items = self._plugin_items()
        exact = [it for it in items if key(it[0]) == k]
        near = exact or [it for it in items if k and (k in key(it[0]) or key(it[0]) in k)]
        if not near:
            return None
        rank = lambda it: (FORMATS.index(it[1]) if it[1] in FORMATS else len(FORMATS), len(it[0]))
        return sorted(near, key=rank)[0]

    # ---------- load: select the track, load the plugin, wait for it to show up ----------

    def _track(self, index):
        song = self.song()
        if index < 0:
            return song.master_track
        tracks = list(song.tracks)
        return tracks[index] if index < len(tracks) else None

    def _load(self, c, index, name):
        if self._loading:
            self._reply(c, {"ok": False, "text": "Aria is still adding a plugin."})
            return
        track = self._track(index)
        if track is None:
            self._reply(c, {"ok": False, "text": "No track %d." % index})
            return
        hit = self._find(name)
        if not hit:
            self._reply(c, {"ok": False, "missing": True, "text": "%s isn't in Live's plugin list." % name})
            return
        # A preset the producer saved as "<plugin> (Aria)" has its knobs picked with Configure, so Aria can set them
        preset = self._aria_preset(hit[0])
        if preset:
            hit = (hit[0], hit[1], preset)
        song = self.song()
        song.view.selected_track = track
        devices = list(track.devices)
        # A new device goes after the selected one. Select the last so it lands at the end;
        # on Main it is moved before Aria afterwards, so Aria still hears it.
        if devices:
            song.view.select_device(devices[-1])
        before = [id(d) for d in devices]
        self.application().browser.load_item(hit[2])
        self._loading = {"client": c, "track": track, "index": index, "before": len(before), "name": hit[0], "ticks": 0}

    def _check_loaded(self):
        w = self._loading
        w["ticks"] += 1
        devices = list(w["track"].devices)
        if len(devices) <= w["before"]:
            if w["ticks"] > WAIT_TICKS:
                self._loading = None
                self._reply(w["client"], {"ok": False, "text": "Live didn't add %s." % w["name"]})
            return
        self._loading = None
        new = len(devices) - 1
        for i, d in enumerate(devices):
            if d.class_name in ("PluginDevice", "AuPluginDevice") and key(w["name"]) in key(d.name):
                new = i
        if w["index"] < 0:
            names = [d.name for d in devices]
            if "Aria" in names and names.index("Aria") < new:
                try:
                    at = names.index("Aria")
                    self.song().move_device(devices[new], w["track"], at)
                    new = at
                except Exception as e:
                    self.log_message("Aria: couldn't move it before Aria: %s" % e)
        self._reply(w["client"], {"ok": True, "name": list(w["track"].devices)[new].name, "index": new})
