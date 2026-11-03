# Side experiment: more of each song, and the mid mixes (2026-11-03)

**Not the official result.** Planned in `ml/README.md` ("More of each song, plus Audiobox") before running. The second search on the same 63 good and bad mixes.

- Data: 30 good and 33 bad mixes (45 groups); 36 mid mixes for training only. Clips per mix: 5 to 6 (average 6.0). scikit-learn 1.6.1.
- Nested test: grouped 5-fold outside, 10 repeats; only the training songs pick the candidate; the pick is scored on held-out songs it never saw.

## Headline: **0.75 ± 0.02** on held-out songs, after the whole search (chance 0.50).

- Reaches 0.80: **no**.
- Shuffle test (the whole nested search on shuffled good/bad labels, 100 shuffles at 2 repeats): **p = 0.010** (null average 0.49).

| Candidate | What it is | Picked | Own cross-validated score (background) |
|---|---|---|---|
| A single clip | the current shape model | 4 of 50 | 0.74 |
| B clips averaged | shape averaged over 6 clips | 8 of 50 | 0.74 |
| C every clip | each clip a training row | 2 of 50 | 0.72 |
| D single clip + mids | A, with mid mixes in training | 1 of 50 | 0.72 |
| E clips averaged + mids | B, with mid mixes in training | 0 of 50 | 0.71 |
| F every clip + mids | C, with mid mixes in training | 0 of 50 | 0.70 |
| G E + loudness | E plus loudness | 9 of 50 | 0.77 |
| H E + loudness + Audiobox | E plus loudness and Audiobox | 26 of 50 | 0.77 |

The best candidate's own score (H E + loudness + Audiobox, 0.77) is the top of eight noisy scores and is optimistic. The nested headline is the honest number.

**Result: it does not reach 0.80.**

