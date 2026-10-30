"""Vocal sync (Groove match, Oct 30): put a vocal on the song's grid with Live's own warping.

A vocal's tempo comes from its file name when it says one ("Vox 128bpm"), since acapellas are usually labeled, and is
measured otherwise: how strongly the sound's starts and changes (spectral flux, 5 ms steps) repeat over one, two,
four and eight beats where it sings. No measure is right on every vocal, so the next likely readings come too. Half or double the song's tempo counts as the
song's (an 82 BPM acapella in a 165 song is counted at 164). Beat 1 is the bar line where the first phrase starts:
the beat phase that lands on the most syllable starts, then the one of four beats with the strongest starts on it.
The result is two warp markers that Live can set: beat 1 on a bar line, and the vocal's tempo, so Live stretches it to
the song's tempo. Nothing here renders audio.
"""
import re
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import stft

N_FFT, HOP = 2048, 256
TEMPO_RANGE = (60.0, 200.0)
SILENT_DB = 30.0         # the vocal's first sound: the first moment within this many dB of its loudest
TEMPO_IN_NAME = re.compile(r"(?<![\d.])(\d{2,3}(?:\.\d+)?)\s*[-_ ]?\s*bpm", re.I)


def tempo_from_name(name):
    """The tempo written in a file name ("Vox 124bpm", "acapella_128_BPM"), or None"""
    m = TEMPO_IN_NAME.search(name)
    if not m:
        return None
    v = float(m.group(1))
    return (int(v) if v.is_integer() else v) if TEMPO_RANGE[0] <= v <= TEMPO_RANGE[1] else None


def _flux(mono, rate):
    """How much new sound starts in each 5 ms step (positive change in the log spectrum), and steps per second"""
    _, _, z = stft(mono, fs=rate, nperseg=N_FFT, noverlap=N_FFT - HOP, boundary=None, padded=False)
    mag = np.log1p(np.abs(z) * 100)
    flux = np.maximum(0.0, np.diff(mag, axis=1)).sum(axis=0)
    return np.r_[0.0, flux], rate / HOP


def _tempo_readings(flux, fps, level_db):
    """The vocal's likely tempos, best first: how strongly its sound repeats one, two, four and eight beats apart,
    over the frames where it sings (silence left out, so long gaps don't blur it). Repeating over whole bars is what
    a vocal does most clearly; one beat alone was wrong on a real acapella (Ian, Oct 30: 190 for a 126 BPM Sugababes
    acapella). Up to three readings that aren't the same beat counted half or double, each with its score (0 to 1)."""
    act = level_db > level_db.max() - SILENT_DB
    f = np.convolve(flux, np.ones(4) / 4, mode="same")
    f = np.where(act, f - f[act].mean(), 0.0)
    ac = np.correlate(f, f, mode="full")[len(f) - 1:]
    n = np.correlate(act.astype(float), act.astype(float), mode="full")[len(f) - 1:]
    ac = ac / np.maximum(n, 1)
    at = lambda bpm, beats: np.interp(beats * 60 * fps / bpm, np.arange(len(ac)), ac)
    cands = np.arange(TEMPO_RANGE[0], TEMPO_RANGE[1] + 0.01, 0.5)
    sc = np.array([sum(at(b, k) for k in (1, 2, 4, 8)) for b in cands])
    sc = sc / (sc.max() or 1)
    out = []
    for i in np.argsort(-sc):
        b = float(cands[i])
        same = any(min(abs(b * k - o["bpm"]) / o["bpm"] for k in (0.5, 1, 2)) < 0.04 for o in out)
        if not same:
            # refine to 0.05 BPM around it
            fine = np.arange(b - 0.5, b + 0.501, 0.05)
            fb = float(fine[int(np.argmax([sum(at(x, k) for k in (1, 2, 4, 8)) for x in fine]))])
            out.append({"bpm": round(fb, 2), "score": round(float(sc[i]), 3)})
        if len(out) == 3:
            break
    return out


def _beat_one(flux, fps, tempo, first_sound):
    """Beat 1: the first beat at the vocal's first sound (a quarter beat of slack, so a word that starts just ahead
    still counts). Picking which of four beats is a bar's first from a vocal alone put beat 1 two beats into the
    silence on a real acapella (Ian, Oct 30), so Aria assumes the vocal comes in on beat 1 and the producer moves it
    by a beat when it doesn't. The beat phase is the one that lands on the most syllable starts."""
    period = 60 * fps / tempo
    smooth = np.convolve(flux, np.ones(3) / 3, mode="same")
    pos = lambda phase: np.round(np.arange(phase, len(smooth), period)).astype(int).clip(0, len(smooth) - 1)
    phases = np.arange(0, period, 0.25)
    phase_sec = phases[int(np.argmax([smooth[pos(p)].sum() for p in phases]))] / fps
    beat = 60 / tempo
    n = np.ceil((first_sound - 0.25 * beat - phase_sec) / beat)
    return float(max(0.0, phase_sec + n * beat))


# Krumhansl-Kessler key profiles: how strongly each of the 12 notes belongs to a major or a minor key
MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]


def key_of(audio, rate):
    """The vocal's key from the notes it uses: how much of each of the 12 notes it has (55 Hz to 2 kHz), matched against
    every major and minor key's profile. {key, confidence}: confidence is how far the best match is ahead of the next."""
    mono = audio.mean(axis=1) if np.ndim(audio) == 2 else np.asarray(audio, dtype=np.float64)
    freqs, _, z = stft(mono, fs=rate, nperseg=8192, noverlap=8192 - 2048, boundary=None, padded=False)
    mag = np.abs(z).mean(axis=1)
    band = (freqs >= 55) & (freqs <= 2000)
    pc = np.round(12 * np.log2(freqs[band] / 440.0)).astype(int) % 12   # 0 is A
    chroma = np.bincount(pc, weights=mag[band] ** 2, minlength=12)
    chroma = np.roll(chroma, -3)                                          # 0 is C
    if not chroma.any():
        return {"key": None, "confidence": 0.0}
    scores = []
    for k in range(12):
        scores.append((np.corrcoef(chroma, np.roll(MAJOR, k))[0, 1], f"{NOTES[k]} major"))
        scores.append((np.corrcoef(chroma, np.roll(MINOR, k))[0, 1], f"{NOTES[k]} minor"))
    scores.sort(reverse=True)
    return {"key": scores[0][1], "confidence": round(float(scores[0][0] - scores[1][0]), 3)}


def _kick_beats(kick, song_tempo):
    """Where the kick hits in the song, in song beats. Each hit's time is where its full sound starts; a hit counts as a
    kick when what's under 150 Hz jumps at least 6 dB with it (hats and claps don't). Timing from the low band alone
    wandered (a kick's body builds slowly: 28 to 41 ms late on Ian's drums, Oct 30). Placed by where the clip sits; the
    file plays at the song's tempo (a drum loop warped or bounced at it)."""
    from scipy.signal import butter, sosfiltfilt
    from aria_engine import groove
    audio, rate = sf.read(str(kick["path"]), always_2d=True, dtype="float64")
    mono = audio.mean(axis=1)
    low = sosfiltfilt(butter(4, 150, btype="low", fs=rate, output="sos"), mono) ** 2
    w = int(0.03 * rate)
    def is_kick(t):
        i = int(t * rate)
        after, before = low[i:i + w].mean() if i + w <= len(low) else 0.0, low[max(0, i - w):i].mean() if i > 0 else 0.0
        return after > 4 * before + 1e-12
    return [kick["start_beat"] + t * song_tempo / 60 - (kick.get("start_marker") or 0.0) for t in groove.onsets(mono, rate) if is_kick(t)]


def analyze(path, song_tempo, tempo=None, beat_shift=0, kick=None, place=None):
    """{tempo, tempo_source, beats_tempo, song_tempo, key, first_beat_sec, first_sound_sec, seconds, warp, sync, picture}.
    Read from the file itself, unwarped. tempo and beat_shift are the producer's corrections: their own tempo reading,
    and beat 1 moved by whole beats. kick {path, start_beat, start_marker} is the kick's clip and place
    {start_beat, beats_per_bar} where the vocal's clip sits (Ian, Oct 30: "sync it to the kick that will be on every
    beat"): beat 1 then goes on the kick at the nearest bar line, not on Live's grid."""
    audio, rate = sf.read(str(path), always_2d=True, dtype="float64")
    mono = audio.mean(axis=1)
    if not np.any(mono):
        raise ValueError("That clip is silent.")
    seconds = len(mono) / rate
    named = tempo_from_name(Path(path).stem)
    flux, fps = _flux(mono, rate)
    hop_level = 20 * np.log10(np.sqrt(np.convolve(mono ** 2, np.ones(HOP * 4) / (HOP * 4), mode="same"))[::HOP][:len(flux)] + 1e-9)
    hop_level = np.r_[hop_level, np.full(len(flux) - len(hop_level), -200.0)]
    readings = _tempo_readings(flux, fps, hop_level)
    source = "you" if tempo else "file name" if named else "measured"
    tempo = tempo or named or readings[0]["bpm"]
    # Counted at the song's tempo when it's about half or double (Live then stretches it only a little)
    k = min((0.5, 1, 2), key=lambda k: abs(tempo * k - song_tempo))
    beats_tempo = round(tempo * k, 3)
    if source == "measured":
        tempo = beats_tempo      # a measured half or double reading is the same beat; say it at the song's scale

    win = int(0.01 * rate)
    level = 20 * np.log10(np.sqrt(np.convolve(mono ** 2, np.ones(win) / win, mode="same")) + 1e-9)
    first_sound = float(np.argmax(level >= level.max() - SILENT_DB) / rate)
    beat1 = _beat_one(flux, fps, beats_tempo, first_sound) + beat_shift * 60 / beats_tempo
    if beat1 < 0:
        beat1 += 4 * 60 / beats_tempo
    beat1 = round(beat1, 4)

    # Warp markers: beat 1 on a bar line far enough in that the file's start isn't before the clip's, and a second
    # marker the vocal's own tempo further on, as many whole beats as the file has after beat 1
    spb = 60 / beats_tempo
    before = int(np.ceil(beat1 / spb / 4)) * 4
    # With the kick: beat 1 on the kick at the bar line nearest to where it would play, so the vocal follows the
    # drums as they really are (a kick sample can start a few ms after Live's grid)
    sync = {"kick_found": False, "kick_offset_ms": None, "bar": None, "kicks_sec": []}
    if place:
        bpb, v0 = place.get("beats_per_bar") or 4, float(place["start_beat"])
        bar_line = round((v0 + before) / bpb) * bpb
        while bar_line - v0 < beat1 / spb:          # the file's start can't come before the clip's
            bar_line += bpb
        target, kicks = bar_line, []
        if kick:
            kicks = _kick_beats(kick, song_tempo)
            near = min(kicks, key=lambda k: abs(k - bar_line), default=None)
            if near is not None and abs(near - bar_line) < 0.25:
                target = near
                sync.update(kick_found=True, kick_offset_ms=round((near - bar_line) * 60 / song_tempo * 1000, 1))
        before = target - v0
        sync["bar"] = int(round(bar_line / bpb)) + 1
        # The kicks as seconds in the vocal's own file, for the picture: where each lands once synced
        sync["kicks_sec"] = [round(beat1 + (k - target) * spb, 4) for k in kicks if -8 <= k - target <= 24]
    beats = max(1, int((seconds - beat1) / spb))
    markers = [{"beat_time": before, "sample_time": beat1}, {"beat_time": before + beats, "sample_time": round(beat1 + beats * spb, 6)}]
    end = before + (seconds - beat1) / spb
    # The picture: the vocal's level from a bar before beat 1 to three bars after, in 10 ms steps, so the producer
    # sees where beat 1 sits and can move it by a beat
    step = 0.01
    a, b = max(0.0, beat1 - 4 * spb), min(seconds, beat1 + 12 * spb)
    frames = [level[int(t * rate)] for t in np.arange(a, b, step)]
    picture = {"start_sec": round(a, 3), "step_sec": step, "levels_db": [round(max(-60.0, float(v - level.max())), 1) for v in frames]}
    return {"tempo": tempo, "tempo_source": source, "beats_tempo": beats_tempo, "beat_shift": beat_shift, "sync": sync,
            "readings": readings,
            **key_of(audio, rate),
            "song_tempo": song_tempo, "first_beat_sec": beat1, "first_sound_sec": round(first_sound, 4), "seconds": round(seconds, 3),
            "warp": {"markers": markers, "start_marker": 0, "end_marker": round(end, 4), "bars_before": int(before // 4)}, "picture": picture}
