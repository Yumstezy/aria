# Good mix vs needs-work model: start here

This is the parallel track from `docs/ml-plan.md`. Read that first for the rules. The short version: real mixes only, rated by real people, and honest numbers even if they're modest.

## 1. Set up (once)

1. Accept the GitHub invite and clone the repo.
2. From the repo root run `./install.sh`. It needs Python 3.11 (`brew install python@3.11`).
3. Make your own key on dev.meta.ai (API keys tab) and put it in `engine/.env` after `MODEL_API_KEY=`. Never commit it.

## 2. Collect and sort mixes

Keep the audio **outside the repo**. Only the measurements go into git.

```
~/Music/Aria Training/
  good/
    Song A - final.wav
  needs-work/
    Song A - rough.wav
    Song C.wav
```

- **The folder is the label.** If you're unsure about a mix, leave it out.
- **Pairs are the most valuable data.** Name versions of the same song with the same name before ` - `, for example `Song A - rough` and `Song A - final`. They're matched automatically.
- **Whole mixes only, not stems.** Only mixes we made or have permission to use. No commercial releases.
- **Target: 100 mixes by Oct 30**, ideally as pairs, mostly electronic or melodic house.
- **Ratings:** each mix should get ratings from 2 or 3 people who didn't make it, if possible. If a mix is labeled only by its maker, that has to be stated wherever we report results.

## 3. Measure them

```sh
engine/.venv/bin/python ml/extract.py "~/Music/Aria Training" ml/data/features.csv
```

- **What it does:** for each mix it finds the loudest 60 s (usually the drop or chorus) and measures it with the same code as Mix check:
  - loudness and true peak
  - crest factor
  - loudness spread
  - Bass, Mids and Treble
  - tilt
  - width
- **Output:** one row of numbers per mix, about 2 KB.
- **Speed:** about 4 s per song.
- **Commit:** `ml/data/features.csv`. No audio ever goes into git.

## 4. Next (Claude builds these when the data exists)

- **`ml/muse_rater.py`:** gives Muse Spark about 30 rated examples as numbers, asks it to rate held-out mixes, and scores it.
- **`ml/train.py`:** logistic regression on the same features, plus the "always good" and "loudness only" baselines.
- **Both are split by song and by producer, never by clip.**
- **Oct 31 checkpoint:** if neither beats the baselines on held-out songs, the score doesn't ship.
