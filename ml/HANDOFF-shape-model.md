# Handoff: a shape-only good vs bad model (Oct 31)

For Raghav and his Claude. Read `ml/README.md` and `docs/ml-plan.md` first; this builds on them. Feature freeze is end of day Nov 2, so this is a short, focused experiment.

## What Ian wants

Ian (Oct 31), after the Audiobox result:

- **Look at the shape, not loudness.** "Loudness really shouldn't be what we're looking at, just purely the shape of the waveform/data."
- **His hypothesis:** "Most of the good songs will have a powerful deep Hz and clean mid, and the rest should be pretty balanced out."
- **Good vs bad only.** "The mids vs goods will be hard to tell, cuz it's purely a talent and time difference."
- **Point the way, not certainty.** "Who says we need 80% confidence... we are never gonna be able to provide the best mix because every song is different, but the model should be able to point people in the right direction based on the good vs bad mixes."

So the question is narrower and fairer than the official run: **does the spectral shape of a mix, with loudness taken out, separate the good-rated mixes from the bad-rated ones, and in which direction?**

## What already exists

| What | Where | Notes |
|---|---|---|
| Each mix's EQ curve | `ml/data/curves.csv` | Your run, Oct 31. 99 rows (good 30, mid 36, bad 33), columns `file, label, song, hz_31 ... hz_16000`: 109 twelfth-octave levels in dB **against the mix's own loudness**, from its loudest 60 s. Loudness is already out. Made by `ml/curves.py` |
| Band balance | `ml/data/features.csv` `bal_*_db` | 8 bands' share of 30 Hz to 16 kHz (also loudness-free), from `detail.py` |
| Song-grouped splits | `ml/common.py` (`song_folds`, `load`, `check_enough`) | Same 71 song and producer groups as every run so far |
| Results so far | `ml/results/` | Official 3 tiers: best 0.49 vs loudness 0.45, p = 0.70. No loudness (tone and stereo, 3 tiers): 0.49, p = 0.01. Audiobox: 0.51 vs 0.46, beats loudness in 52% of rounds, p = 0.010 |

Nobody has run **good vs bad on shape alone** yet. That's the new part.

## The experiment

Write it in `ml/README.md` before running it (the "decide before you look" rule), as a side experiment under `ml/experiments/shape.py`, with a report in `ml/results/shape-experiment.md`.

- **Data:** good (30) and bad (33) from `curves.csv`. Mid is left out of training. You can score the mid mixes afterward as a sanity check: they should land between good and bad on average.
- **Features: keep them few** (about 60 mixes, so at most around 10 features, or the model memorizes):
  - **Bands:** the curve averaged into the 8 bands of `ml/detail.py` `BALANCE` (sub, bass, low mids, mids, upper mids, presence, highs, air).
  - **Ian's hypothesis, as numbers:**
    - Low end power: sub plus bass (30 to 120 Hz) against the 200 Hz to 2 kHz average.
    - Mid cleanliness: how bumpy the curve is from 200 Hz to 2 kHz (the spread after subtracting a smoothed curve), plus low-mid build-up (200 to 500 Hz against its neighbors).
    - Balance elsewhere: the overall tilt (the slope of a line through the curve per octave), and how far the curve strays from that line above 2 kHz.
  - Try the 8 bands and the hypothesis features as two separate sets, and maybe both together. That's three sets, no more.
- **Models:** logistic regression with L2 (its weights are the "direction", which is what the app needs), and one small random forest as a check. Standardize inside each training fold only.
- **Testing:** the same song-grouped 5-fold split, repeated 10 times (50 rounds), so no song or producer is in both train and test.
- **Report:**
  - Balanced accuracy on held-out songs (chance is 0.50).
  - Loudness only, good vs bad, on the same splits, as a reference: reported, not a bar to beat (per Ian).
  - The shuffle test over the whole pick-the-best step (100 or more shuffles).
  - **The direction:** the logistic weights, and the good vs bad medians per feature, in plain words, for example "good mixes have 2.1 dB more sub and bass against their mids".

## The new bar (Ian, Oct 31)

The 80% ship rule is replaced for this question by **"points the right way"**:

1. Balanced accuracy on held-out songs above chance, **with shuffle p under 0.05** (the result isn't luck).
2. **The direction is stable**: a feature's sign agrees in at least most of the 50 rounds. A weight that flips between rounds isn't advice.
3. **Ian's hypothesis is checked, not assumed.** If good mixes don't actually have more low end or cleaner mids than bad ones, say so plainly. That's a real finding too.

Write this bar in `ml/README.md` with the date, and note that it applies to this good vs bad direction question, not the old 3-tier score.

## What the app would use (only if it passes)

- **The comparison:** the user's checked bars are measured the same way as `curves.py` (`engine/aria_engine/reference.py` `_spectrum` and `_levels`), so a mix and the rated mixes compare like with like.
- **What Aria shows:** per band or feature, whether the user's mix sits on the good side or the bad side, and by how much against the good mixes' middle. The words always read "closer to the good mixes here" or "further from the good mixes here", never "your mix is bad", and never a quality score out of 100.
- **Where it fits in:** the same shape as the old "against good mixes" findings (taken out Oct 30 because "good mixes" was confusing and only compared ranges). It's in git history: `git show 6845fda^:engine/aria_engine/typical.py` (deleted in `6845fda`). Claude on Ian's side will do the engine and UI part. Your part is the experiment and a short file the engine can read, for example `ml/data/shape-model.json` with the feature definitions, weights, scaler and the good and bad medians.

## Rules that still hold

- Numbers only in the repo: never commit audio. The 99 mixes were given or released free for us to use (Ian, Oct 30).
- Real ratings only. No made-up labels or "plausible" numbers anywhere.
- Report the real held-out result even if it's modest. If the direction doesn't hold, the app doesn't show it.
