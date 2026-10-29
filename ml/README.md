# Training Aria's mix model: step by step

You're building the part of Aria that can say how finished an EDM mix sounds, even before the producer loads a reference track, and what pulls it down. Ian runs the prototype. This track is yours. Everything you need is in this folder. The rules behind it are in `docs/ml-plan.md`.

## What you're building, in one minute

- **Input:** a mix. Aria measures its loudest 60 s (usually the drop) and turns it into 11 numbers:
  - loudness, true peak, punch (crest factor)
  - how much the loudness moves
  - Bass, Mids and Treble balance (each band relative to the whole mix), and the tilt from bass to treble
  - width in each band
- **Output:** a tier, **good, mid or bad** (decided Oct 28, `docs/ml-plan.md`), with a confidence and the measurements that pull the mix down.
- **Two approaches, scored on the same held-out songs:**
  1. **A small trained model**: logistic regression, an ordered version of it ("ordinal logistic"), or gradient boosting on the 11 numbers.
  2. **Muse Spark as a rater**: shown 10 real rated mixes per tier as numbers, then asked to rate new ones. This is the Meta AI part, and the judges weight Meta AI use at 25%.
- **Only the better one ships**, and only if it passes the ship rule in Step 5. It ships labeled "experimental", with its real accuracy shown.

**Why numbers and not audio:** we never store or upload anyone's songs. Each mix becomes about 2 KB of measurements. That's all that goes into git, so 300 mixes take under 1 MB.

**Why band balance and not band level:** the raw band levels rise and fall with loudness, so a louder master looks "more bass, more mids, more treble" at once. Balance (band minus the whole mix) tells you the shape of the mix on its own. Loudness keeps its own number. The raw levels are still written to `features.csv` for Mix check.

## The rules (these are hard rules, not preferences)

- **Real mixes only.** Every mix must be one we made or have written permission to use. No commercial releases, not even as "good" examples. Keep where each mix and its rating came from in `ml/data/manifest.csv`.
- **Real labels only.** Every tier comes from a real rating. Never make "bad" mixes by degrading good ones with EQ or compression. That's a made-up label.
- **Honest numbers.** Report the real held-out accuracy even if it's modest. If nothing passes the ship rule, it doesn't ship.
- **Split by song and producer,** never by clip. The scripts do this for you. Don't change it.

## Timeline

| Day | What |
|---|---|
| Oct 28 | The rated mixes (good, mid, bad) are sorted in the shared Drive. |
| Oct 29 | First extraction and first training run, even on partial data |
| Oct 30 | Run the Muse Spark rater. |
| **Oct 31** | **Checkpoint:** compare both against the baselines, then decide whether it ships |
| Nov 1 to 2 | Claude wires the winner into the engine (`POST /mix/score`) and the Mix check screen |
| Nov 3 | Write the README section: dataset size, split, results |

## Step 1. Set up (about 15 minutes, once)

1. **Accept the GitHub invite** from Ian, then clone:
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

- **The rated mixes are in the shared Drive** (Oct 28). Download them to a folder outside the repo, for example `~/Music/Aria Training/`. Never put audio in git.
- **Each mix's rating came with it.** Write down where the ratings came from, and how a rating maps to a tier, in `ml/data/manifest.csv`. Keep the mapping fixed once you start.

## Step 3. Sort into tiers

```
~/Music/Aria Training/
  good/
    GOOD_Artist_-_Title.wav
  mid/
    MID_Artist_-_Title.wav
  bad/
    BAD_Artist_-_Title.wav
```

- **The folder is the tier.** If a mix's rating is unclear, leave it out. Unsure data hurts more than less data.
- **The split groups mixes by the name before ` - `** (underscores count as spaces, and a `GOOD_`, `MID_` or `BAD_` prefix is ignored). For `Artist - Title` that's the artist, so every track by one producer stays on the same side of the train/test split. For `Song A - rough` and `Song A - final` it's the song.
- **Check the `song` column after Step 4.** If two files by the same producer got different names there (for example one has no ` - `), rename the files so they match.

## Step 4. Measure the mixes

```sh
engine/.venv/bin/python ml/extract.py "~/Music/Aria Training" ml/data/features.csv
```

- It takes about 5 to 10 s per song, and prints each file as it goes.
- If a file is unreadable it says SKIPPED and moves on. Check those.
- Open `ml/data/features.csv` and sanity-check it:
  - Do the tiers look different on any number?
  - Are any values empty? Empty means the script couldn't measure that value, and the `unmeasured` column says why. Rows with gaps are left out of training, never filled in.
- Commit `ml/data/features.csv` and `ml/data/manifest.csv`. Never commit audio.

## Step 5. Train the model

```sh
cd ml
../engine/.venv/bin/python train.py data/features.csv
```

- **It refuses to run** with fewer than 30 mixes, or fewer than 5 songs per tier. Below that the numbers mean nothing.
- **It trains five things** and scores each on songs it never saw:
  - `always-majority`: the "always guess the common tier" baseline
  - `loudness-only`: the "just look at loudness" baseline
  - `logistic regression`, `ordinal logistic` (knows bad < mid < good) and `gradient boosting`: the real models
- **The scores:**
  - **Balanced accuracy:** with three tiers, 0.33 is a coin toss.
  - **Tiers off:** how far off it is on average. 0 is perfect.
  - **Two off:** good mixes called bad, or bad called good. The mistakes that matter most.
- **The ship rule, fixed before anyone sees results:** the best real model must beat the best baseline overall **and** in at least 4 of the 5 folds. Winning on the average alone can be one lucky fold.
- **Results:** they go to `ml/results/train-report.md`. If a model passes, it also saves `ml/models/mix_score.joblib`, with where the good mixes sit on each measurement, so Aria can say what pulls a mix down ("mids heavier than most good mixes").
- **Reading it:** if the model only matches `loudness-only`, it hasn't learned anything beyond loudness. That's a real finding, so report it.

## Step 6. Run Muse Spark as a rater

```sh
cd ml
../engine/.venv/bin/python muse_rater.py data/features.csv
```

- **The same split as Step 5,** so the numbers compare fairly.
- **How it works:** for each held-out song, Muse sees 10 real rated mixes per tier from other songs, then rates the held-out mix with a reason.
- **About one call per mix:** a few minutes and pennies for 100 mixes.
- **Results:** they go to `ml/results/muse-report.md`, including sample reasons, which are good material for the demo.
- **Experiments are welcome.** Try `EXAMPLES_PER_LABEL` at 5, 10 and 15. Write down what you tried and report the setting you pick, not the best of many lucky runs.

## Step 7. The Oct 31 checkpoint

Put both reports side by side and write the decision in `docs/status.md`:

| If | Then |
|---|---|
| A trained model passes the ship rule | It ships as "experimental". Tell Claude which one and the numbers. |
| Muse beats the best baseline overall and in 4 of 5 folds | It can ship too. Its reasons are a strong demo moment. |
| Nothing passes | It doesn't ship. Say so in the README. Honest is fine. |

## Step 8. Hand it back

Tell Ian or Claude:
- which approach won
- its held-out balanced accuracy, the per-fold numbers, and how many "two off" mistakes
- the dataset: how many mixes and songs per tier, and where the ratings came from

Claude adds `POST /mix/score` to the engine and puts one line on the Mix check screen, for example: "Mix score: mid. From our model, trained on 104 rated mixes." That line is an example, not real data.

## If something goes wrong

| Problem | Fix |
|---|---|
| `No module named sklearn` | `engine/.venv/bin/pip install -r ml/requirements.txt` |
| `No MODEL_API_KEY in engine/.env` | Step 1.3. Check the file is `.env`, not `.env.example`. |
| Meta answers 401 Unauthorized | The key is wrong or cut off. Make a fresh one and copy it with the copy button. |
| `Not enough data to train honestly` | Exactly what it says. Get more mixes or more songs per tier. |
| A mix shows SKIPPED | The file isn't audio Python can read. Re-export it as WAV. |
