# Sample song

16 bars of a house demo Ian made, 128 BPM, 44.1 kHz, shared for judges and testers. The judges' page plays the same files in its "Try it" section.

| File | What it is |
|---|---|
| `KICK.flac`, `DRUMS.flac`, `BASS.flac`, `LEADS.flac`, `VOCAL.flac` | The five parts before mixing, 24-bit. All five were turned down by the same 6 dB so none goes over 0 dB; their balance is Ian's. |
| `Rough mix.wav` | The five added together: what Aria checks. |
| `Finished mix (reference).wav` | Ian's own finished mix of the same 16 bars, to compare against. |

## What Aria finds

Without a reference, nothing on these 16 bars goes over Aria's thresholds for clashes or buried sounds. The closest is the leads, covered by the rest at 400 to 1000 Hz for 49% of the time against a 50% threshold.

The mix model (Nov 2) puts the rough mix further from the good mixes, and gives two problems to fix: the highs (5 to 10 kHz) sit 3.4 dB above the good mixes' middle, and the sub (30 to 60 Hz) sits 6.7 dB below it. In three Fix all runs, Muse Spark cut 3 dB at 7.1 kHz (on Main or the leads) and lifted 42 Hz by 3 dB on the bass or the kick. Ian's finished mix leans closer than the rough mix, but is still on the further side. With the finished mix as the reference, Aria finds the rough mix 4.7 dB fuller from 220 to 350 Hz (around 310 Hz). Ian took that boxiness out by hand when he mixed it.

## Try it in Live (Live 12 Suite, Aria installed)

1. Make a new Live Set at 128 BPM with five audio tracks named exactly KICK, DRUMS, BASS, LEADS and VOCAL. Drop each file at bar 1. Put Aria on Main.
2. Open Aria's window, choose `Finished mix (reference).wav` as the reference, put the playhead at bar 1 and press Check mix.
3. Press Fix all, or ask Muse something like "sidechain the bass to the kick".

## Try it without Live

Start the engine (`./install.sh` once, then `engine/run.sh`) and send it the rough mix:

```sh
curl -s -X POST 127.0.0.1:8765/mix/analyze -H "Content-Type: application/json" -d "{
  \"mix_path\": \"$PWD/test-pack/sample/Rough mix.wav\", \"start_beat\": 0, \"tempo\": 128,
  \"reference_path\": \"$PWD/test-pack/sample/Finished mix (reference).wav\"}"
```

Run it from the repo's top folder. With `MODEL_API_KEY` in `engine/.env`, the reply includes Muse Spark's advice. Without a key you still get the measurements.
