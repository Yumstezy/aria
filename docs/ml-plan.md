# Good mix vs bad mix model

A parallel track for the teammate who knows ML, with Ian's help. The goal is a model, trained on real mixes rated by our testers, that scores how finished a mix sounds and says which aspects pull it down. It runs alongside the reference comparison. It doesn't replace it.

## Why it helps the demo

- It gives Aria an opinion even before a reference is loaded.
- It's our own trained model, built in the window, which is a strong story for judges.
- "Trained on N real mixes rated by M producers" is a claim we can show and defend.

## Rules

- **Real data only.** Every training example is a real mix that a tester made or has the rights to share, rated by a real person. No synthetic labels and no made-up examples.
- **Consent and rights.** Each tester confirms in writing that they own the mix, or have permission, and that we may use it to train and evaluate. Keep that in the manifest. No commercial releases as training mixes.
- **New work.** Collection, labeling, features and training all happen from Oct 27 onward, and the repo history shows it.
- **Honest reporting.** The README and video state:
  - the dataset size
  - how it was split
  - the real held-out accuracy, even if it's modest

If the model isn't good enough by Nov 2, it ships as "experimental" or not at all. We never show a score we can't back.

## Data collection (start Oct 27)

1. **Ask testers for mixes.** Each one gives a 30 to 90 second WAV bounce of the most important part of the song, usually the drop or chorus. Unfinished versions are welcome too, since they give us the "needs work" examples.
2. **Ratings.** Each mix gets rated by at least 3 testers who didn't make it:
   - overall, 1 to 5
   - Bass, Mids, Treble, Loudness, Width, each as too little, about right or too much
   - an optional note
3. **Pairs (optional, but strong).** Testers who share two versions of the same song (rough and final) are gold. Pairwise "which is better" labels are more reliable than absolute scores.
4. **Same genre focus first.** Start with the styles we know (electronic, melodic house), so a small dataset is consistent.

Files:
- `ml/data/manifest.csv`: `mix_id, file, owner, consent (yes), genre, version_of (optional), bpm, notes`
- `ml/data/ratings.csv`: `mix_id, rater_id, overall_1_5, bass, mids, treble, loudness, width, note`
- Audio stays out of git (`ml/data/audio/` is in `.gitignore`). Share it through a team drive.

## Labels

- Average the overall ratings per mix.
  - 4.0 and above is "good".
  - 2.5 and below is "needs work".
  - Leave the middle out of the first binary model.
- Measure how well raters agree (for example Krippendorff's alpha). If raters disagree a lot, the model can't do better than they do, and we say so.
- The per-aspect labels (too little, about right, too much) become one small classifier each, if there's enough data.

## Features

Reuse the engine's measurements, so the model and Mix check read the same numbers:
- integrated and short-term loudness spread
- true peak
- crest factor
- band balance (Bass, Mids, Treble, plus the 5 band detail)
- width per band
- phase correlation
- spectral tilt
- transient density

Optionally add pretrained audio embeddings (a small open model run locally). Write down which model and its license.

## Model

- Start simple:
  - logistic regression and gradient boosted trees on the measurement features
  - small data, so keep it interpretable
- Split by song and by producer, never by clip. Otherwise the model learns the producer, not the mix.
- Report cross-validated accuracy and a confusion matrix, and compare against a dumb baseline (always "good", or a loudness-only rule).
- Explain each score with feature contributions, so Aria can say "your score is low mostly because of treble". That's also what Muse Spark gets as input.

## Muse Spark as a second rater

Run alongside the trained model, on the same data and the same split. This is the Meta AI side of the ML work.

- Give Muse Spark real rated examples from the training split: each mix's measurements, its average rating, and the per-aspect labels. If it accepts audio (build step 1.2), include short clips of the examples too.
- Ask it to rate a held-out mix in the same shape: overall, plus too little, about right or too much for each aspect, with a short reason.
- Score it exactly like the trained model: held-out accuracy, a confusion matrix, and the same dumb baselines.
- Only real rated mixes go in the prompt. No made-up examples and no ratings written by us.
- Keep whichever is better on held-out songs, or both if they agree often enough to be useful. Report both numbers honestly in the README and video.

## How it plugs into Aria

- Engine endpoint: `POST /mix/score` returns:
  - `score` (0 to 1)
  - `label`
  - `confidence`
  - `top_factors` (feature, direction, contribution)
  - `model_version`
  - `trained_on` (number of mixes, number of raters)
- Mix check shows it as one line, with the model named: "Mix score 0.62 from our model, trained on 140 rated mixes". It sits next to the reference comparison, never instead of it.
- If the model's confidence is low, or the mix is out of the training distribution (for example a genre we have no data for), show nothing rather than a guess.

## Timeline

| Day | Work |
|---|---|
| Oct 26 to 28 | Send the call for mixes and the rating form to testers. Set up the manifest, the ratings files and the consent wording |
| Oct 29 to 30 | Ratings come in. The feature extractor runs on every mix with the engine's analysis code |
| Oct 31 | First model and honest numbers. Checkpoint: is it good enough to show? |
| Nov 1 to 2 | Wire `/mix/score` into the engine and Mix check, or drop it if it isn't good enough |
| Nov 3 | Write the README section with the dataset size, split and results |
