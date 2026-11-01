"""Aria's racks (Nov 1): Ian's own racks, built only from Live's stock devices, renamed "Aria <what it does>".
The files are in device/racks/ (device/tools/make_aria_racks.py); install.sh puts them in the User Library, and
Aria's helper in Live loads them by name. What each does and what each macro moves was read from the racks
themselves (which knobs each macro is mapped to, and over what range).

mix: True for the racks that fix a mix problem, which Fix my whole mix may use. The rest are effects the producer
asks for by name or by sound ("add a transition wash", "make the snare fuzzy").
Macro values are 0 to 100: percent of the macro's travel (Live's 0 to 127).
"""

RACKS = {
    # ---------- drums ----------
    "Aria Kick Glue": {"mix": True, "does": "Glue Compressor tuned for a kick: holds the kick together and evens its hits.", "macros": {}},
    "Aria Kick Mix": {"mix": True, "does": "Kick channel strip: soft clip, Drum Buss, a low boost, a boxy-cut bell, Glue, Limiter.",
                      "macros": {"INIT SOFT CLIP": "Saturator soft clip, dry to full",
                                 "Macro 2": "Drum Buss transients, softer (0) to sharper (100)",
                                 "LOW BOOSY": "low boost, -0.2 to +3.5 dB",
                                 "CUT BOXY": "where the boxy cut sits, 327 to 634 Hz",
                                 "GLUE": "Glue Compressor, dry to full",
                                 "Macro 6": "Drum Buss drive", "Macro 7": "Drum Buss crunch"}},
    "Aria Kick Enhance": {"mix": True, "does": "Splits the kick into bands, then blends in glue, tube warmth, low saturation, parallel "
                                               "compression, distortion and a tuned sub (Corpus) under it.",
                          "macros": {"Glue Dry/Wet": "Glue Compressor blend", "Tube Dry/Wet": "Dynamic Tube blend",
                                     "LowTubeDry/Wet": "saturation on the lows", "Parallel Dry/Wet": "parallel compression blend",
                                     "Distort Drive": "Overdrive drive", "Distort Dry/Wet": "Overdrive blend (0 is off)",
                                     "SUB Decay": "length of the added sub", "SUB Dry/Wet": "how much sub is added (0 is off)"}},
    "Aria Hard Kick": {"mix": False, "does": "Heavy kick processing for hard dance: glue, Drum Buss, overdrive, tube, saturation, "
                                             "a rumble layer with echo and chorus.",
                       "macros": {"Macro 1": "Saturator color, -24 to +24", "Macro 2": "Tube output, -15 to +15 dB",
                                  "Macro 3": "Overdrive drive", "Macro 4": "Drum Buss crunch", "Macro 5": "Drum Buss boom amount",
                                  "Macro 6": "Drum Buss boom frequency, 30 to 90 Hz", "Macro 7": "Glue threshold, -40 to 0 dB",
                                  "Macro 8": "Glue blend", "RUMBLE VOL": "rumble layer level", "DELAY TIME": "rumble echo time",
                                  "Macro 11": "rumble filter cutoff", "DAMM CHORUS": "rumble chorus amount"}},
    "Aria Punch Through": {"mix": True, "does": "Four parallel punch chains (saturation, compression, tube, low boost) to make drums or "
                                                "a kick cut through a busy mix.",
                           "macros": {"Macro 1": "chain 1: light drive and compression", "Macro 2": "chain 2: drive and a low boost up to +10 dB",
                                      "Macro 3": "chain 3: tube and heavy compression", "Macro 4": "chain 4: drive and a low boost up to +8 dB",
                                      "Macro 5": "the low boost's frequency, 32 to 80 Hz", "Output": "output level"}},
    "Aria Snare Fuzz": {"mix": False, "does": "Roar distortion and EQ for a fuzzy, gritty snare.", "macros": {"SNARE FUZZ": "Roar blend"}},
    # ---------- bass ----------
    "Aria Bass Thicken": {"mix": True, "does": "Cleans the very low end, saturates and glues the bass so it's thick and steady, with the "
                                               "original kept underneath.",
                          "macros": {"Freq": "where the low end is cleaned and split, about 20 to 160 Hz",
                                     "Comp": "Glue compression with makeup (more is denser)",
                                     "Original Bass": "switches the clean original layer"}},
    "Aria Wide Bass": {"mix": True, "does": "Like Aria Bass Thicken, plus a wide top layer: the lows stay centered, the top of the bass "
                                            "spreads out.",
                       "macros": {"Freq": "where the bass splits, about 20 to 160 Hz", "Comp": "Glue compression with makeup",
                                  "TOP WIDE BASS": "switches the wide top layer"}},
    "Aria Bass FX": {"mix": False, "does": "Bass transitions: filter sweeps, delay throws, beat repeat and overdrive, one per macro.",
                     "macros": {"1": "transition 1: filter and delay", "2": "transition 2: erosion and filter",
                                "3": "transition 3: beat repeat", "4": "transition 4: overdrive, filter, reverb, auto pan"}},
    "Aria Bass Downsample": {"mix": False, "does": "Lo-fi downsampled bass with a ping-pong delay and reverb.",
                             "macros": {"DONWSAMPLE": "how crushed it is", "PONG DELAY": "ping-pong delay level", "REVERB": "reverb blend"}},
    # ---------- whole mix and splitting ----------
    "Aria 3 Band Split": {"mix": False, "does": "Splits a sound into low, mid and high chains so each can be treated on its own.",
                          "macros": {"Lo-Mid FreqSplit": "low to mid crossover, 30 to 1000 Hz",
                                     "Mid-Hi FreqSplit": "mid to high crossover, 2 to 12 kHz"}},
    "Aria Master Chain": {"mix": False, "does": "Quick master chain for Main: EQ, soft saturation, Glue, Limiter. Only when the producer "
                                                "asks for a master chain or for the mix to be louder.",
                          "macros": {"Macro 1": "Limiter gain, -6 to +6 dB"}},
    "Aria Clipper": {"mix": False, "does": "Saturator clipper: drives in and pulls the output back down the same amount, so peaks clip "
                                           "without getting louder.",
                     "macros": {"CLIP ME": "clip amount, 0 to 36 dB in and out"}},
    "Aria Crisp": {"mix": False, "does": "Adds crisp, screaming top end: saturation, pedal, amp, high band boost, glue.",
                   "macros": {"CRISPY": "how crisp"}},
    # ---------- filters, space and effects ----------
    "Aria Filter FX": {"mix": True, "does": "High-pass and low-pass filters, chorus, echo and reverb in one rack. Its HP is a quick low cut "
                                            "and its LP a quick high cut.",
                       "macros": {"HP": "high-pass cutoff (0 is open)", "LP": "low-pass cutoff (100 is open)", "CHORUS": "chorus blend",
                                  "DELAY/WET": "echo blend", "DELAY/FEEDBACK": "echo feedback", "REV/WET": "reverb blend",
                                  "REV/SIZE": "reverb size", "REV/DECAY": "reverb decay"}},
    "Aria Synth FX": {"mix": True, "does": "Synth strip: glue, soft clip, low cut, high cut, then phaser, chorus, echo and plate reverb.",
                      "macros": {"Comprss": "Glue threshold down to -23 dB with makeup", "Saturate": "soft clip drive, 0 to 12 dB",
                                 "Low Cut": "low cut, off at 0, then 10 to 250 Hz", "High Cut": "high cut, off at 0, then 250 Hz to 22 kHz",
                                 "Phaser": "phaser blend", "Chorus": "chorus blend", "Echo": "echo blend", "Plate Verb": "plate reverb blend"}},
    "Aria Reverb": {"mix": False, "does": "A full reverb: pre-delay, decay, EQ'd tail (high-pass, low-pass, body, highs), tamed highs, "
                                          "a touch of downsampling.",
                    "macros": {"DELAY LEVEL": "reverb level", "TIME": "decay time", "Macro 3": "stereo spread", "DOWNSAMPLE": "lo-fi amount",
                               "PRE DELAY": "pre-delay, 0.5 to 150 ms", "TAME HIGHS": "compresses the tail's highs",
                               "BODY": "tail's body, -6 to +6 dB", "HIGHS": "tail's highs, -6 to +6 dB",
                               "HP": "tail's high-pass, 10 Hz to 3 kHz", "LP": "tail's low-pass, 529 Hz to 22 kHz"}},
    "Aria Plain Reverb": {"mix": False, "does": "Live's Reverb with Ian's settings, no macros.", "macros": {}},
    "Aria Delay": {"mix": False, "does": "Echo with level, time, feedback, filters, chorus and width.",
                   "macros": {"DELAY LEVEL": "delay level", "TIME": "delay time", "FEEDBACK": "feedback", "ECHO MODE": "stereo or ping-pong",
                              "HP": "echo high-pass, 80 Hz to 16 kHz", "LP": "echo low-pass, 112 Hz to 8 kHz", "CHORUS": "chorus on the echo",
                              "WIDTH": "stereo width", "SYNC MODE": "synced or free time"}},
    "Aria Groove Delay": {"mix": False, "does": "Three delays in a groove pattern with reverb.",
                          "macros": {"VOLUME": "delay level", "GROOVE LENGTH": "pattern length"}},
    "Aria Reverse Reverb": {"mix": False, "does": "A reverb and delay send for reverse and freeze effects.",
                            "macros": {"FX VOLUME": "effect level", "Macro 2": "reverb decay", "REV VOLUME": "reverb level",
                                       "DELAY": "delay time", "FREEZE ON": "freezes the reverb", "DELAY FEEDBACK": "delay feedback",
                                       "Macro 7": "ping-pong on or off", "Macro 8": "delay filter width", "DELAY ON/OFF": "delay on or off"}},
    "Aria Transition Wash": {"mix": False, "does": "Washes a sound out for a transition: grain delay, filter, reverb, a low dip, delays.",
                             "macros": {"Wash Out": "how washed out, 0 is untouched"}},
    "Aria Fake Out": {"mix": False, "does": "A fake-out drop: washes and filters the sound, with a riser.",
                      "macros": {"EQ": "the wash and dip, 0 is untouched", "Filter": "the riser filter"}},
    "Aria Enchanter": {"mix": False, "does": "Shine and space: OTT-style multiband boost, then reverb and chorus.",
                       "macros": {"Boost": "multiband boost amount", "Dissipate": "reverb and chorus"}},
    "Aria Vinyl": {"mix": False, "does": "Old-record sound: EQ'd to a narrow band, with a mono switch.",
                   "macros": {"Dry/Wet": "amount", "Macro 2": "mono"}},
    "Aria Endless Smile": {"mix": False, "does": "A big build effect: stacks saturation, chorus, reverbs, delays, vocoder and shifters as it rises.",
                           "macros": {"INTENSITY": "how far into the build", "Soft/Medium/Hard/Extreme": "which version"}},
}

MIX_RACKS = [n for n, r in RACKS.items() if r["mix"]]


def lines(names=None):
    """The racks as prompt lines: name, what it does, and its macros."""
    out = []
    for name in names or RACKS:
        r = RACKS[name]
        macros = "; ".join(f"{m}: {what}" for m, what in r["macros"].items())
        out.append(f"- {name}: {r['does']}" + (f" Macros: {macros}." if macros else ""))
    return "\n".join(out)


def check(args, tracks, match_track):
    """aria_rack {track, rack, macros: [{name, value}]}: the track and rack exist, macros are the rack's own, 0 to 100."""
    track = "Main" if str(args.get("track", "")).strip().lower() in ("main", "master") else match_track(args.get("track"), tracks)
    rack = next((n for n in RACKS if n.lower() == str(args.get("rack", "")).strip().lower()), None)
    if not track or not rack:
        return None
    macros = []
    for m in args.get("macros") or []:
        if not isinstance(m, dict):
            return None
        name = next((k for k in RACKS[rack]["macros"] if k.strip().lower() == str(m.get("name", "")).strip().lower()), None)
        value = m.get("value")
        if name is None or isinstance(value, bool) or not isinstance(value, (int, float)) or not 0 <= value <= 100:
            return None
        macros.append({"name": name.strip(), "value": round(float(value), 1)})
    return {"track": track, "rack": rack, "macros": macros[:8]}
