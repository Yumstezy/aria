# Training Aria's mix model: step by step

You're building the part of Aria that can say how finished an EDM mix sounds, even before the producer loads a reference track, and what pulls it down. Ian runs the prototype. This track is yours. Everything you need is in this folder. The rules behind it are in `docs/ml-plan.md`.

## Where it stands (Oct 29)

- **Data:** 99 rated mixes from the shared Drive (good 30, mid 36, bad 33), in 71 song and producer groups.
- **Official result** (`results/train-report.md`): the best model scores 0.49 on songs it never saw, against 0.45 for "just look at loudness" (0.33 is a coin toss). It wins only 66% of test rounds and fails the shuffle test (p = 0.70), so **by the ship rule, nothing ships yet.**
- **Side experiment** (`results/no-loudness-experiment.md`, added after the official run): with loudness taken out, tone and stereo alone still separate the tiers better than chance. See "Side experiments" below.
- **Permission (answered by Ian, Oct 30):** the mixes were given to the team or released by their artists for free download for us to use.
- **In the app (Oct 30):** the classifier doesn't ship, but the good-rated mixes' band balance does, as Aria's "against good mixes" comparison when no reference song is picked (`engine/aria_engine/typical.py`). It measures exactly as `detail.py` does and only reads `data/features.csv`.

## What's in this folder

| File | What it is |
|---|---|
| `extract.py` | Measures every mix in a folder and writes one row of numbers per mix |
| `detail.py` | The 18 detailed measurements `extract.py` adds (balance, mud, harshness, punch, stereo, clipping, dynamics) |
| `common.py` | Tiers, minimum data checks and the song-grouped split, shared by the scripts |
| `train.py` | **The official evaluation.** Trains the models, compares them with the baselines, applies the ship rule |
| `muse_rater.py` | Muse Spark as a second rater, on the same split |
| `aesthetics.py` | Meta's Audiobox Aesthetics scores (production quality, complexity, enjoyment, usefulness) for each mix. Writes `data/aesthetics.csv` |
| `curves.py` | Each mix's EQ curve (twelfth octaves, loudness taken out) for the app's "typical good mix" chart. Writes `data/curves.csv`, numbers only |
| `experiments/` | Side experiments. Never the official result |
| `data/features.csv` | The measurements (about 2 KB per mix). No audio |
| `data/song_groups.csv` | Fixes for file names the grouping rule gets wrong, each with a reason |
| `data/excluded.csv` | Files left out on purpose, each with a reason |
| `data/manifest.csv` | Where each mix and its rating came from, and permission. To fill in |
| `results/` | The reports |

## What you're building, in one minute

- **Input:** a mix. Aria measures its loudest 60 s (usually the drop) and turns it into 29 numbers:
  - **basic (11):** loudness, true peak, punch (crest factor), how much the loudness moves, Bass/Mids/Treble balance and tilt, width per band
  - **detailed (18, `detail.py`):** balance in 8 bands from sub to air, mud, harshness, the strongest ringing peak, punch in the lows and highs, left/right correlation, low-end width, clipping, how much the whole song moves and how far the drop lifts
- **Output:** a tier, **good, mid or bad** (decided Oct 28, `docs/ml-plan.md`), with a confidence and the measurements that pull the mix down.
- **Two approaches, scored on the same held-out songs:**
  1. **Small trained models**: logistic regression, ordinal logistic (knows bad < mid < good), gradient boosting, random forest.
  2. **Muse Spark as a rater**: shown 10 real rated mixes per tier as numbers, then asked to rate new ones. This is the Meta AI part, and the judges weight Meta AI use at 25%.
- **Only the better one ships**, and only if it passes the ship rule in Step 5. It ships labeled "experimental", with its real accuracy shown.

**Why numbers and not audio:** we never store or upload anyone's songs. Each mix becomes about 2 KB of measurements. That's all that goes into git.

**Why balance and not raw band level:** raw band levels rise and fall with loudness, so a louder master looks like "more of everything". Balance (each band against the whole mix) describes the shape of the mix on its own. Loudness keeps its own number.

**Why everything stops at 16 kHz:** mp3s cut the top end, and about a third of the good mixes are mp3. Measuring above 16 kHz would let the model learn the file format instead of the mix.

## The rules (these are hard rules, not preferences)

- **Real mixes only.** Every mix must be one we made or have written permission to use. No commercial releases, not even as "good" examples. Keep where each mix and its rating came from in `data/manifest.csv`.
- **Real labels only.** Every tier comes from a real rating. Never make "bad" mixes by degrading good ones with EQ or compression. That's a made-up label.
- **Honest numbers.** Report the real held-out accuracy even if it's modest. If nothing passes the ship rule, it doesn't ship.
- **Split by song and producer,** never by clip. The scripts do this for you. Don't change it.
- **Decide before you look.** Any change to the models, measurements or ship rule is written down before the run. Ideas that come after seeing results go in `experiments/` and are reported as follow-ups.

### Planned before running: Audiobox Aesthetics (written Oct 30, before any scores existed)

Meta's Audiobox Aesthetics model scores audio on Production Quality, Production Complexity, Content Enjoyment and Content Usefulness. Question: do those four scores, alone or added to our measurements, tell the tiers apart better than loudness and the official best?

- Scores: `ml/aesthetics.py`, on each mix's same loudest 60 s.
- Test: `ml/experiments/audiobox.py`. Three new sets (Audiobox only; Audiobox plus tone and stereo; Audiobox plus detailed), three models (random forest, ordinal logistic, logistic regression), the same song-grouped splits, the shuffle test over the whole best-of step. Bars: loudness only and the official best, on the same splits.
- It stays a side experiment. If it beats loudness in 80% of rounds with shuffle p under 0.05, it goes to the team as a proposal for the next official run, not shipped from this result.

## Timeline

| Day | What |
|---|---|
| Oct 28 | The rated mixes (good, mid, bad) are sorted in the shared Drive. |
| Oct 29 | Extraction and first training runs (done) |
| Oct 30 | Run the Muse Spark rater. |
| **Oct 31** | **Checkpoint:** compare both against the baselines, then decide whether it ships |
| Nov 1 to 2 | Claude wires the winner into the engine (`POST /mix/score`) and the Mix check screen |
| Nov 3 | Write the README section: dataset size, split, results |

## Step 1. Set up (about 15 minutes, once)

1. **Accept the GitHub invite** from Ian (github.com/Yumstezy/aria/invitations), then clone:
   ```sh
   git clone https://github.com/Yumstezy/aria.git
   cd aria
   ```
2. **Install the libraries.**
   - **Mac:** install Python 3.11 (`brew install python@3.11`), then:
     ```sh
     ./install.sh                     # sets up engine/.venv and starts the engine (Ctrl+C to stop it)
     engine/.venv/bin/pip install -r ml/requirements.txt
     ```
   - **Windows** (`install.sh` is Mac only; the ML scripts don't need the engine running). Install Python 3.11 from python.org, then in PowerShell from the repo root:
     ```powershell
     py -3.11 -m venv engine\.venv
     engine\.venv\Scripts\pip install -r engine\requirements.txt -r ml\requirements.txt
     copy engine\.env.example engine\.env
     ```
   In the steps below, Windows uses `engine\.venv\Scripts\python` where Mac uses `engine/.venv/bin/python`.
3. **Make your own Meta API key** (only Step 6 needs it):
   - Go to https://dev.meta.ai, open the **API keys** tab, create a key and copy it with the copy button. The full key is only shown once.
   - Open `engine/.env` (hidden on a Mac: in Finder press Cmd+Shift+. to see it) and paste the key after `MODEL_API_KEY=`, with no spaces or quotes.
   - **Never put the key in `.env.example`.** That file is public on GitHub.

## Step 2. Get the mixes

- **The rated mixes are in the shared Drive** (Oct 28). Download them to a folder outside the repo. Never put audio in git.
- **Fill in `data/manifest.csv`:** for each mix, who owns it, whether we have written permission to train on it, where its rating came from, and how a rating maps to a tier. Keep the mapping fixed once you start.

## Step 3. Sort into tiers

```
Aria Training/
  good/   GOOD_Artist - Title.wav
  mid/    MID_Artist - Title.wav
  bad/    BAD_Artist - Title.wav
```

- **The folder is the tier.** Capitals don't matter (`GOOD/` works too). If a mix's rating is unclear, leave it out.
- **Formats:** WAV, AIFF, FLAC and mp3. m4a/AAC can't be read; convert it to WAV or it's skipped.
- **The split groups mixes by the name before ` - `** (underscores count as spaces, capitals are ignored, and a `GOOD_`, `MID_` or `BAD_` prefix is dropped). For `Artist - Title` that's the artist, so every track by one producer stays on the same side of the train/test split. For `Song A - rough` and `Song A - final` it's the song.
- **Names the rule gets wrong** (title and artist swapped, one producer spelled two ways, collabs) go in `data/song_groups.csv` with a reason. **Files to leave out on purpose** (exact duplicates, unreadable formats) go in `data/excluded.csv` with a reason. `extract.py` reads both.

## Step 4. Measure the mixes

```sh
engine/.venv/bin/python ml/extract.py "path/to/Aria Training" ml/data/features.csv
```

- It measures two songs at a time, about 10 to 15 s each, and prints each file as it goes. About 10 minutes for 100 mixes.
- If a file is unreadable it says SKIPPED and moves on. Files in `data/excluded.csv` say LEFT OUT.
- Sanity-check `data/features.csv`:
  - Is the `song` column grouping each producer's tracks together?
  - Are any values empty? Empty means the script couldn't measure that value, and the `unmeasured` column says why. Rows with gaps are left out of training, never filled in.
- Commit everything in `data/`. Never commit audio.

## Step 5. Train the model (the official result)

```sh
cd ml
../engine/.venv/bin/python train.py data/features.csv
```

- **It refuses to run** with fewer than 30 mixes, or fewer than 5 songs per tier.
- **What it compares**, all fixed before the run:
  - baselines: `always-majority` and `loudness-only`
  - four models (logistic regression, ordinal logistic, gradient boosting, random forest), each on the **basic** 11 and the **detailed** 29 measurements
- **How it tests:** 5-fold splits grouped by song and producer, repeated 10 times with different shuffles (50 test rounds). Every model sees the same splits.
- **The scores:**
  - **Balanced accuracy:** with three tiers, 0.33 is a coin toss.
  - **Tiers off:** how far off it is on average. 0 is perfect.
  - **Two off:** good mixes called bad, or bad called good. The mistakes that matter most.
  - **Bad vs better:** the same predictions read as "bad" or "not bad".
- **The ship rule:** the best model must beat the best baseline on average, **in at least 80% of the 50 test rounds**, and **pass the shuffle test** (p under 0.05). The shuffle test redoes the whole pick-the-best-of-8 step on shuffled tiers, so picking the best of several can't make luck look like skill.
- **Runtime:** about 25 minutes, most of it the shuffle test.
- **Results:** `results/train-report.md`. If a model passes, it also saves `models/mix_score.joblib`, with where the good mixes sit on each measurement, so Aria can say what pulls a mix down.

## Step 6. Run Muse Spark as a rater

```sh
cd ml
../engine/.venv/bin/python muse_rater.py data/features.csv
```

- **It uses the basic 11 measurements** and the first of `train.py`'s 10 splits (same shuffle), so it compares with the basic-set models.
- **How it works:** for each held-out song, Muse sees 10 real rated mixes per tier from other songs, then rates the held-out mix with a reason.
- **About one call per mix:** a few minutes and pennies for 100 mixes.
- **Results:** `results/muse-report.md`, including sample reasons, which are good material for the demo.
- **Experiments are welcome.** Try `EXAMPLES_PER_LABEL` at 5, 10 and 15. Write down what you tried and report the setting you pick, not the best of many lucky runs.

## Step 7. The Oct 31 checkpoint

Put both reports side by side and write the decision in `docs/status.md`:

| If | Then |
|---|---|
| A trained model passes the ship rule | It ships as "experimental". Tell Claude which one and the numbers. |
| Muse beats the best baseline overall and in 4 of its 5 folds | It can ship too. Its reasons are a strong demo moment. |
| Nothing passes | It doesn't ship. Say so in the README. Honest is fine. |

## Step 8. Hand it back

Tell Ian or Claude:
- which approach won
- its held-out balanced accuracy, how often it won the test rounds, and the shuffle test
- the dataset: how many mixes and groups per tier, and where the ratings came from

Claude adds `POST /mix/score` to the engine and puts one line on the Mix check screen, for example: "Mix score: mid. From our model, trained on 99 rated mixes." That line is an example, not real data.

## Side experiments

Ideas that came after seeing the official results. Each has its own script in `experiments/` and its own report in `results/`. **They are never the official result.** Report them as follow-ups.

| Experiment | Question | Result |
|---|---|---|
| `experiments/no_loudness.py` | Can the model tell the tiers apart without loudness? | Yes, better than chance: tone and stereo alone score about 0.49 (chance 0.33), shuffle test p = 0.01. Not better than loudness alone (0.45) by enough to ship. Good mixes have more sub-bass and narrower mids. See `results/no-loudness-experiment.md`. |

## If something goes wrong

| Problem | Fix |
|---|---|
| `No module named sklearn` | `engine/.venv/bin/pip install -r ml/requirements.txt` |
| `No MODEL_API_KEY in engine/.env` | Step 1.3. Check the file is `.env`, not `.env.example`. |
| Meta answers 401 Unauthorized | The key is wrong or cut off. Make a fresh one and copy it with the copy button. |
| `Not enough data to train honestly` | Exactly what it says. Get more mixes or more songs per tier. |
| A mix shows SKIPPED | The file isn't audio Python can read (m4a, for example). Re-export it as WAV. |
| Two tracks by one producer have different `song` values | Add the file to `data/song_groups.csv` with the right name and a reason, then re-run Step 4. |
