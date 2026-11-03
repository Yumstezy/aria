# Side experiment: shape plus stereo and clarity (2026-11-02)

**Not the official result.** Planned in `ml/README.md` ("Planned before running: shape plus stereo and clarity") before running, at Ian's request of Nov 2 (can the shape model reach 0.80?). Reported whatever it shows.

- Data: 30 good and 33 bad mixes in 45 song and producer groups, the same rows and splits as `experiments/shape.py` (scikit-learn 1.6.1). Mid (36) left out of training.
- Model: logistic regression (L2, C = 0.3), standardized inside each training fold. No tuning.

| Set | Held-out balanced accuracy |
|---|---|
| shape (13), rerun here | 0.74 ± 0.03 |
| shape + stereo + clarity (19) | 0.72 ± 0.03 |
| loudness only (reference) | 0.68 ± 0.04 |

Gain from the six new measurements: **-0.021**. The 19 beat the 13 in **9 of 50** rounds (ties don't count; the bar is 40). Shuffle test (the six columns moved together across mixes, 500 times): **p = 0.343**.

Reaches 0.80: **no** (0.72).

How much the 19's held-out score tracks loudness: correlation +0.29.

**Result: does not pass. The app keeps the 13-measurement shape model; nothing changes.**

## The new measurements (logistic regression on all 63 mixes)

| Measurement | Weight | Same sign in | Stable | Good median | Bad median | Weight and medians agree |
|---|---|---|---|---|---|---|
| stereo width of the mids | -0.45 | 49 of 50 | yes | 0.120 | 0.180 | yes |
| stereo width of the highs | +0.31 | 50 of 50 | yes | 0.150 | 0.130 | yes |
| stereo width of the low end (30-150 Hz) | -0.29 | 49 of 50 | yes | 0.000 | 0.000 | yes |
| left/right correlation (mono-safe) | +0.15 | 48 of 50 | yes | 0.949 | 0.922 | yes |
| share of moments with harsh bursts | -0.04 | 29 of 50 | no | 0.243 | 0.282 | yes |
| the strongest ringing peak | +0.02 | 30 of 50 | no | 4.990 | 4.710 | yes |

Mid sanity check: average chance of "good" for mid mixes 0.50, from the model trained on all good and bad.
