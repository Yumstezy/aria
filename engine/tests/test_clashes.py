"""Key tracks mode (build step 4): two tracks fighting in the same band are found, by name.
Test signals are generated here and never reach the app."""
import numpy as np

from aria_engine import stems

RATE, TEMPO = 22050, 120.0          # 2 s per 4/4 bar
SECONDS = 24.0                       # 12 bars


def band_noise(lo, hi, seconds=SECONDS, seed=0):
    rng = np.random.default_rng(seed)
    n = int(seconds * RATE)
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / RATE)
    spec[(f < lo) | (f > hi)] = 0
    x = np.fft.irfft(spec, n)
    return x / np.abs(x).max()


def bars(x, first, last):
    """Keep only bars first..last (1-based)."""
    out = np.zeros_like(x)
    a, b = int((first - 1) * 2 * RATE), int(last * 2 * RATE)
    out[a:b] = x[a:b]
    return out


def test_kick_and_bass_fighting_at_63_hz_in_bars_5_to_8_is_found_first():
    kick = 0.8 * bars(band_noise(56, 71, seed=1), 5, 8) + 0.3 * band_noise(2000, 4000, seed=2)
    bass = 0.8 * bars(band_noise(56, 71, seed=3), 5, 8) + 0.5 * band_noise(180, 240, seed=4)
    leads = 0.6 * band_noise(800, 1600, seed=5)
    found = stems.clashes({"Kick": kick, "Bass": bass, "Leads": leads}, RATE, tempo=TEMPO, start_beat=0.0)
    top = found[0]
    assert top["kind"] == "clash" and set(top["tracks"]) == {"Kick", "Bass"}
    centre = np.sqrt(top["hz_range"][0] * top["hz_range"][1])
    assert abs(np.log2(centre / 63.0)) <= 1 / 6                       # within 1/6 octave
    assert abs(top["bars"][0] - 5) <= 1 and abs(top["bars"][1] - 8) <= 1   # within 1 bar


def test_tracks_in_their_own_bands_dont_clash():
    kick = band_noise(50, 80, seed=1)
    leads = band_noise(1000, 3000, seed=2)
    assert stems.clashes({"Kick": kick, "Leads": leads}, RATE, tempo=TEMPO, start_beat=0.0) == []


def test_one_clearly_louder_track_is_not_a_clash():
    kick = band_noise(56, 71, seed=1)
    bass = 0.2 * band_noise(56, 71, seed=3) + 0.6 * band_noise(180, 240, seed=4)   # 14 dB under the kick at 63 Hz
    assert not [f for f in stems.clashes({"Kick": kick, "Bass": bass}, RATE) if f["hz_range"][0] < 80]


def test_analyze_in_key_tracks_mode_names_the_clashing_tracks(tmp_path, monkeypatch):
    import soundfile as sf
    from fastapi.testclient import TestClient
    from aria_engine import muse
    from aria_engine.app import app

    monkeypatch.setattr(muse, "advise", lambda measured, context, findings=None: (None, "test"))
    kick = 0.4 * bars(band_noise(56, 71, seed=1), 5, 8) + 0.15 * band_noise(2000, 4000, seed=2)
    bass = 0.4 * bars(band_noise(56, 71, seed=3), 5, 8) + 0.25 * band_noise(180, 240, seed=4)
    leads = 0.3 * band_noise(800, 1600, seed=5)
    paths = {}
    for name, x in {"Kick": kick, "Bass": bass, "Leads": leads}.items():
        paths[name] = str(tmp_path / f"{name}.wav")
        sf.write(paths[name], np.stack([x, x], axis=1), RATE)
    mix = kick + bass + leads
    sf.write(tmp_path / "mix.wav", np.stack([mix, mix], axis=1), RATE)
    body = TestClient(app).post("/mix/analyze", json={"mix_path": str(tmp_path / "mix.wav"), "tempo": TEMPO, "start_beat": 0.0,
                                                      "bars": 12, "tracks": paths}).json()
    clarity = body["clarity"]
    assert clarity["mode"] == "tracks" and clarity["tracks"] == ["Kick", "Bass", "Leads"]
    assert clarity["findings"][0]["kind"] == "clash" and set(clarity["findings"][0]["tracks"]) == {"Kick", "Bass"}
    assert set(clarity["spectra"]["parts"]) == {"Kick", "Bass", "Leads"}
