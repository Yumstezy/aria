# Mix model training report (2026-10-29)

- Data: 99 mixes from 71 songs/producers. good: 30 (25 groups), mid: 36 (32 groups), bad: 33 (21 groups).
- Dropped 0 rows with a measurement that couldn't be taken. Nothing was filled in.
- Split: 5-fold cross-validation grouped by song and producer, repeated 10 times (50 test rounds). Every model sees the same splits.
- Balanced accuracy: with three tiers, 0.33 is a coin toss. The ± is the spread across repeats.
- Tiers off: average distance from the true tier (0 perfect). Two off: good called bad or bad called good, per run.
- Bad vs better: the same predictions read as "bad" or "not bad" (0.5 is a coin toss). Added after the first run showed bad mixes are the easiest to tell apart; no model was tuned for it.
- Lossy files (mp3) per tier: good 8 of 30, mid 4 of 36, bad 3 of 33. Measurements stop at 16 kHz, where mp3 starts cutting.

| Model | Measurements | Balanced accuracy | Tiers off | Two off | Bad vs better |
|---|---|---|---|---|---|
| random forest | detailed | 0.49 ± 0.03 | 0.59 | 8.5 | 0.69 |
| gradient boosting | detailed | 0.48 ± 0.02 | 0.61 | 9.1 | 0.69 |
| random forest | basic | 0.47 ± 0.02 | 0.63 | 9.5 | 0.72 |
| logistic regression | detailed | 0.46 ± 0.04 | 0.68 | 14.8 | 0.62 |
| ordinal logistic | detailed | 0.46 ± 0.02 | 0.67 | 12.4 | 0.63 |
| loudness-only | - | 0.45 ± 0.01 | 0.58 | 5.6 | 0.71 |
| gradient boosting | basic | 0.44 ± 0.04 | 0.66 | 10.1 | 0.70 |
| logistic regression | basic | 0.42 ± 0.03 | 0.70 | 12.0 | 0.68 |
| ordinal logistic | basic | 0.40 ± 0.04 | 0.71 | 11.8 | 0.66 |
| always-majority | - | 0.33 ± 0.00 | 0.64 | 0.0 | 0.50 |

**Best: random forest on detailed measurements at 0.49, against the best baseline (loudness-only) at 0.45. It wins 66% of the 50 test rounds (the ship rule needs 80%).**
Shuffle test (best of 8 on shuffled tiers, 100 shuffles): p = 0.703. Under 0.05 means the win is unlikely to be luck.

Confusion for the best model (first repeat), rows = truth [good, mid, bad]: [[12, 14, 4], [12, 14, 10], [7, 10, 16]]

No model passes the ship rule, so nothing was saved. By the plan, it doesn't ship.
That's a real result. Report it as it is.
