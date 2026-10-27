# Judging rubric

Each category is scored 0 to 10. The top 5 projects per track go to a final round, where judges watch the demo videos live and rank them with the same rubric.

| Category | Weight | What judges ask |
|---|---|---|
| Impact | 30% | What's the real-world potential? Who benefits, and how much does it matter? Could this become something people use? Does it fit one of the problem statements? |
| Use of Meta AI tooling | 25% | How creatively did the team use Meta's AI tooling? Did they go beyond a basic integration? Did they surface capabilities that surprised even Meta? |
| Technical depth and execution | 20% | Is the engineering sound and thoughtfully refined? Does it feel thought through, with real craft? |
| Demo | 25% | Is it a working, impressive demo? Does the product hold up live? Is the video cool to watch? |

## How Aria answers each one

- **Impact:** most producers can't afford a mix engineer. Aria tells them in plain words what's wrong compared with a track they love. Real testers send mixes and ratings, so we can show real people using it.
- **Use of Meta AI:** advice text alone is a basic integration. Muse Spark goes further:
  - it drives Live through tool calling (Ask Muse, build step 6)
  - it names sections (step 3)
  - it rates mixes from real rated examples (`docs/ml-plan.md`)
  - it listens to the audio, if the API accepts it (step 1.2)
  - voice works through Muse Voice Transcribe (stretch)
- **Technical depth:** real measurements, loudness matched comparisons, sections graded against an answer key, validated actions with Undo, tests on every endpoint, and honest model numbers.
- **Demo:** three solid beats beat five shaky ones. The beats are: Check mix finds the problem, Muse fixes it in Live when asked, and Undo puts it back.
