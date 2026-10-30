# Side experiment: tiers without loudness (2026-10-29)

**Not the official result.** The official, pre-planned evaluation is `train-report.md`. This idea came after seeing those results, so it's a follow-up experiment.

- Data: the same 99 mixes and the same song and producer grouped splits as `train.py` (5-fold, repeated 10 times).
- The bar is chance, 0.33, because loudness is removed.

| Measurements | Model | Balanced accuracy | Beats chance in | Bad vs better |
|---|---|---|---|---|
| tone and stereo only (20) | ordinal logistic | 0.49 ± 0.04 | 92% of rounds | 0.63 |
| no loudness (27) | ordinal logistic | 0.48 ± 0.03 | 92% of rounds | 0.64 |
| tone and stereo only (20) | random forest | 0.47 ± 0.04 | 94% of rounds | 0.66 |
| no loudness (27) | random forest | 0.47 ± 0.02 | 92% of rounds | 0.65 |

**Best: ordinal logistic on tone and stereo only at 0.49. Shuffle test (best of 4 on shuffled tiers, 100 shuffles): p = 0.010.** (With 100 shuffles, the smallest possible p is 0.010.)

For comparison, loudness alone scores 0.45 in `train-report.md`. Without loudness the model does about as well, using different information: how the mix is balanced, not how loud it is.

What separates the tiers (ordinal logistic on tone and stereo, standardized; + means more of it goes with a better tier). Medians per tier:

| Measurement | Direction | Good | Mid | Bad |
|---|---|---|---|---|
| bal_sub_db | +0.51 | -4.22 | -5.70 | -5.93 |
| bass_rel_db | +0.45 | -0.70 | -0.80 | -1.00 |
| bal_himid_db | +0.43 | -14.90 | -15.09 | -14.83 |
| width_mids | -0.41 | 0.12 | 0.17 | 0.18 |
| bal_brilliance_db | -0.38 | -17.27 | -16.73 | -16.91 |
| width_treble | +0.33 | 0.15 | 0.17 | 0.13 |

How to say it honestly: "Without looking at loudness, the model still tells the tiers apart better than chance (p = 0.01), from tone and stereo balance. This was a follow-up experiment."
