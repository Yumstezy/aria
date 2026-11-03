# Side experiment: shape-only good vs bad (2026-11-02)

**Not the official result.** Planned in `ml/README.md` ("Planned before running: shape-only good vs bad") before running, at Ian's request of Oct 31. Reported as a follow-up whatever it shows.

- Data: 30 good and 33 bad mixes from `data/curves.csv`, in 45 song and producer groups. Mid (36) left out of training.
- Testing: 5-fold splits grouped by song and producer, repeated 10 times (50 rounds). Balanced accuracy on held-out songs; chance is 0.50.
- Model that would ship: logistic regression (L2, C = 0.3), standardized inside each training fold. Random forest is a check only.

| Set | Logistic regression | Random forest (check) |
|---|---|---|
| bands (8) | 0.72 ± 0.02 | 0.69 ± 0.02 |
| hypothesis (5) | 0.73 ± 0.03 | 0.73 ± 0.02 |
| both (13) | 0.75 ± 0.02 | 0.76 ± 0.03 |
| loudness only (reference, not a bar) | 0.72 ± 0.01 | |

Loudness alone scores 0.72 on this same good vs bad question, so shape separates good from bad about as well as loudness, not better. What shape adds is that it's loudness-free and points to EQ moves.

**Best set: both, 0.75** on held-out songs (chance 0.50). It beats chance in 94% of the 50 rounds. Shuffle test (the whole pick-the-best-set step on shuffled good/bad labels, 500 shuffles): **p = 0.002**.

## The bar (Ian, Oct 31)

1. Above chance with shuffle p under 0.05: **yes** (0.75, p = 0.002).
2. Direction stable (same sign in at least 40 of 50 rounds): **12 of 13 features** (band_sub_db, band_lowmid_db, band_mid_db, band_himid_db, band_presence_db, band_brilliance_db, band_air_db, low_power_db, mid_bumpiness_db, lowmid_buildup_db, tilt_db_per_oct, top_spread_db).
3. Ian's hypothesis checked: see below.

**Result: PASSES.** Only the stable features may be shown in the app.

## Direction (both set, logistic regression on all 63 mixes)

+ weight means more of it goes with good. Medians are dB unless noted.

| Measurement | Weight | Same sign in | Stable | Good median | Bad median | Good minus bad | Weight and medians agree | Mid median |
|---|---|---|---|---|---|---|---|---|
| sub (30-60 Hz) | +0.49 | 50 of 50 | yes | -17.78 | -21.06 | +3.29 | yes | -19.73 |
| bass (60-120 Hz) | -0.06 | 32 of 50 | no | -17.68 | -17.70 | +0.02 | no | -17.44 |
| low mids (120-400 Hz) | +0.16 | 44 of 50 | yes | -26.21 | -25.52 | -0.69 | no | -25.11 |
| mids (400 Hz-1 kHz) | +0.39 | 50 of 50 | yes | -28.94 | -29.82 | +0.89 | yes | -29.68 |
| upper mids (1-2.5 kHz) | +0.53 | 50 of 50 | yes | -29.54 | -30.49 | +0.95 | yes | -30.24 |
| presence (2.5-5 kHz) | +0.28 | 50 of 50 | yes | -30.91 | -31.12 | +0.22 | yes | -30.93 |
| highs (5-10 kHz) | -0.55 | 50 of 50 | yes | -30.67 | -30.46 | -0.21 | yes | -30.21 |
| air (10-16 kHz) | +0.24 | 48 of 50 | yes | -33.69 | -35.68 | +1.98 | yes | -34.37 |
| low end (30-120 Hz) against the 200 Hz-2 kHz average | +0.09 | 49 of 50 | yes | 10.62 | 10.20 | +0.42 | yes | 10.63 |
| bumpiness of the 200 Hz-2 kHz curve | -0.74 | 50 of 50 | yes | 1.95 | 2.52 | -0.57 | yes | 2.03 |
| low-mid build-up (200-500 Hz against its neighbours) | -0.52 | 50 of 50 | yes | -3.01 | -1.67 | -1.34 | yes | -2.00 |
| overall tilt (dB per octave) | -0.30 | 50 of 50 | yes | -1.88 | -1.62 | -0.26 | yes | -1.86 |
| how far the top end (above 2 kHz) strays from the tilt line | -0.21 | 50 of 50 | yes | 2.50 | 3.18 | -0.68 | yes | 3.04 |

"Weight and medians agree" was added after seeing the first run (Nov 2). It only makes what the app shows stricter: a stable weight that points the other way from the good-vs-bad medians (because features overlap) isn't shown as advice.

In plain words (stable, and the weight and medians agree):

- Good mixes have more sub (30-60 Hz) than bad mixes: median -17.78 vs -21.06 (+3.29).
- Good mixes have more mids (400 Hz-1 kHz) than bad mixes: median -28.94 vs -29.82 (+0.89).
- Good mixes have more upper mids (1-2.5 kHz) than bad mixes: median -29.54 vs -30.49 (+0.95).
- Good mixes have more presence (2.5-5 kHz) than bad mixes: median -30.91 vs -31.12 (+0.22).
- Good mixes have less highs (5-10 kHz) than bad mixes: median -30.67 vs -30.46 (-0.21).
- Good mixes have more air (10-16 kHz) than bad mixes: median -33.69 vs -35.68 (+1.98).
- Good mixes have a stronger low end (30-120 Hz) against the mids than bad mixes: median 10.62 vs 10.20 (+0.42).
- Good mixes have smoother mids (200 Hz-2 kHz) than bad mixes: median 1.95 vs 2.52 (-0.57).
- Good mixes have less low-mid build-up (200-500 Hz) than bad mixes: median -3.01 vs -1.67 (-1.34).
- Good mixes have a steeper downward tilt from lows to highs than bad mixes: median -1.88 vs -1.62 (-0.26).
- Good mixes have a smoother top end (above 2 kHz) than bad mixes: median 2.50 vs 3.18 (-0.68).

Stable but pointing opposite ways, so not shown: low mids (120-400 Hz).

## Ian's hypothesis, checked

| Claim | Good median | Bad median | Holds? |
|---|---|---|---|
| Good mixes have a more powerful low end | 10.62 | 10.20 | yes |
| Good mixes have cleaner (less bumpy) mids | 1.95 | 2.52 | yes |
| Good mixes have less low-mid build-up | -3.01 | -1.67 | yes |

Medians alone don't make a finding stable; the weights and their sign agreement above do.

## Mid sanity check

Average chance of "good" from the model: good mixes 0.64, mid 0.50, bad 0.34 (good and bad from held-out rounds, mid from the model trained on all good and bad). Mid lands between good and bad.

