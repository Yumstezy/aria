# Side experiment: Meta's Audiobox Aesthetics (2026-10-30)

**Not the official result.** Planned in `ml/README.md` before any scores existed; reported as a follow-up.

- Data: 99 mixes with both measurements and Audiobox scores, the same song and producer grouped splits as `train.py` (5-fold, repeated 10 times).

| Measurements | Model | Balanced accuracy | Bad vs better |
|---|---|---|---|
| audiobox + tone/stereo (24) | logistic regression | 0.51 ± 0.02 | 0.65 |
| audiobox + tone/stereo (24) | ordinal logistic | 0.50 ± 0.03 | 0.65 |
| audiobox + detailed (33) | random forest | 0.49 ± 0.02 | 0.67 |
| detailed (official best's set) (29) | random forest | 0.49 ± 0.03 | 0.69 |
| audiobox + detailed (33) | logistic regression | 0.48 ± 0.04 | 0.65 |
| audiobox + tone/stereo (24) | random forest | 0.48 ± 0.03 | 0.65 |
| audiobox only (4) | ordinal logistic | 0.47 ± 0.02 | 0.62 |
| audiobox + detailed (33) | ordinal logistic | 0.47 ± 0.04 | 0.64 |
| detailed (official best's set) (29) | logistic regression | 0.46 ± 0.04 | 0.62 |
| audiobox only (4) | logistic regression | 0.46 ± 0.02 | 0.62 |
| loudness only (1) | random forest | 0.46 ± 0.03 | 0.67 |
| loudness only (1) | logistic regression | 0.46 ± 0.02 | 0.71 |
| detailed (official best's set) (29) | ordinal logistic | 0.46 ± 0.02 | 0.63 |
| loudness only (1) | ordinal logistic | 0.46 ± 0.03 | 0.72 |
| audiobox only (4) | random forest | 0.44 ± 0.04 | 0.56 |

**Best new set: logistic regression on audiobox + tone/stereo at 0.51**, against loudness only at 0.46 and the official best at 0.49. It beats loudness in 52% of rounds (the ship rule asks for 80%). Shuffle test (best of 9 on shuffled tiers, 100 shuffles): p = 0.010.

Audiobox medians per tier (good, mid, bad):

- PQ: 8.10, 8.02, 8.02
- PC: 6.56, 6.51, 6.43
- CE: 6.67, 6.75, 6.84
- CU: 8.00, 7.89, 7.86
