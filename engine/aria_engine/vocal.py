"""Vocal sync (Groove match, Oct 30): put a vocal on the song's grid with Live's own warping.

A vocal's tempo comes from its file name when it says one ("Vox 128bpm"), since acapellas are usually labeled, and is
measured otherwise: the autocorrelation of how the sound starts and changes (spectral flux), like the song's tempo in
sections.py but finer (5 ms steps), because syllables start softly. Half or double the song's tempo counts as the
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


def _pulse(flux, fps, bpm):
    """How strongly sound starts on the beats at this tempo: the average start strength on the beats (best phase, a
    step's slack) against the average overall"""
    per = 60 * fps / bpm
    best = 0.0
    for ph in np.arange(0, per, 0.5):
        idx = np.round(np.arange(ph, len(flux), per)).astype(int)
        best = max(best, float(flux[idx[idx < len(flux)]].mean()))
    return best / (float(flux.mean()) + 1e-12)


def _measure_tempo(flux, fps):
    """The tempo whose beats line up with the most syllable starts. Plain autocorrelation favours fast tempos on a
    vocal (on Ian's 148 BPM vocal it said 183); this compares start strength on the beat, then refines to 0.05 BPM."""
    slack = np.maximum.reduce([np.roll(flux, k) for k in (-1, 0, 1)])
    coarse = np.arange(TEMPO_RANGE[0], TEMPO_RANGE[1] + 0.01, 0.5)
    best = float(coarse[int(np.argmax([_pulse(slack, fps, b) for b in coarse]))])
    fine = np.arange(best - 0.5, best + 0.501, 0.05)
    return float(fine[int(np.argmax([_pulse(slack, fps, b) for b in fine]))])


def _beat_one(flux, fps, tempo, first_sound):
    """The bar line where the first phrase starts, in seconds"""
    period = 60 * fps / tempo
    # The beat phase that lands on the most syllable starts (each start counted at its 5 ms step, with a step's slack)
    smooth = np.convolve(flux, np.ones(3) / 3, mode="same")
    pos = lambda phase, step: np.arange(phase, len(smooth), step)
    score = lambda phase, step: smooth[np.round(pos(phase, step)).astype(int).clip(0, len(smooth) - 1)].sum()
    phases = np.arange(0, period, 0.25)
    beat_phase = phases[int(np.argmax([score(p, period) for p in phases]))]
    # Of the four beats, the one with the strongest starts on it is the bar's first
    down = max(range(4), key=lambda k: score(beat_phase + k * period, 4 * period))
    phase_sec, bar = (beat_phase + down * period) / fps, 4 * 60 / tempo
    # The last bar line at or just before the first sound (a little slack for a soft start)
    n = np.floor((first_sound + 0.25 * 60 / tempo - phase_sec) / bar)
    d = phase_sec + n * bar
    return float(d if d >= 0 else d + bar)


def analyze(path, song_tempo, tempo=None, beat_shift=0):
    """{tempo, tempo_source, beats_tempo, song_tempo, first_beat_sec, first_sound_sec, seconds, warp}. tempo and
    beat_shift are the producer's corrections: their own tempo reading, and beat 1 moved by whole beats."""
    audio, rate = sf.read(str(path), always_2d=True, dtype="float64")
    mono = audio.mean(axis=1)
    if not np.any(mono):
        raise ValueError("That clip is silent.")
    seconds = len(mono) / rate
    named = tempo_from_name(Path(path).stem)
    flux, fps = _flux(mono, rate)
    source = "you" if tempo else "file name" if named else "measured"
    tempo = tempo or named or round(_measure_tempo(flux, fps), 2)
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
    beats = max(1, int((seconds - beat1) / spb))
    markers = [{"beat_time": before, "sample_time": beat1}, {"beat_time": before + beats, "sample_time": round(beat1 + beats * spb, 6)}]
    end = before + (seconds - beat1) / spb
    # The picture: the vocal's level from a bar before beat 1 to three bars after, in 10 ms steps, so the producer
    # sees where beat 1 sits and can move it by a beat
    step = 0.01
    a, b = max(0.0, beat1 - 4 * spb), min(seconds, beat1 + 12 * spb)
    frames = [level[int(t * rate)] for t in np.arange(a, b, step)]
    picture = {"start_sec": round(a, 3), "step_sec": step, "levels_db": [round(max(-60.0, float(v - level.max())), 1) for v in frames]}
    return {"tempo": tempo, "tempo_source": source, "beats_tempo": beats_tempo, "beat_shift": beat_shift,
            "song_tempo": song_tempo, "first_beat_sec": beat1, "first_sound_sec": round(first_sound, 4), "seconds": round(seconds, 3),
            "warp": {"markers": markers, "start_marker": 0, "end_marker": round(end, 4), "bars_before": before // 4}, "picture": picture}
