# Testing AI import without burning API credits

Document import is **not** one OpenAI call — it is **2 + number of trip days**:

1. Trip outline (dates, cities per day)
2. Trip structure (transport, stays, location paints)
3. **One call per day** for activities (each resends the full document text)

A 14-day trip like the Thailand PDF = **16 API calls per import**.

## Rough cost (gpt-4o-mini, default)

| Runs | Approx cost |
|------|-------------|
| 1 import | ~$0.01–0.03 |
| 20 imports while debugging | ~$0.20–0.60 |
| 100 imports | ~$1–3 |

Costs scale up quickly if `OPENAI_MODEL` is set to a larger model. The expensive part is **re-importing the same PDF** after every small bug fix — not normal unit tests.

## What to test without AI

Most import bugs are in **apply logic**, not the model:

- Location sanitization (`sanitize-imported-locations.test.ts`)
- Calendar / stay boundaries / transport dedupe (existing setup tests)
- PDF text extraction (pdf-parse / pdfjs fallback)
- Activity persistence (`wizardSource` tagging)

Run `npm test` — **282+ tests, $0**.

When fixing “Melbourne painted as a destination” or “activities not showing”, you usually only need unit tests + one recorded fixture replay, not a live re-import.

## Record once, replay forever

Set in `.env.local`:

```bash
OPENAI_FIXTURE_DIR=test/fixtures/openai-import/thailand
OPENAI_FIXTURE_RECORD=1   # only while recording
```

Run **one** import (UI or API). Responses are saved as JSON under that folder (~16 files).

Then switch to replay mode:

```bash
OPENAI_FIXTURE_DIR=test/fixtures/openai-import/thailand
# OPENAI_FIXTURE_RECORD=1   ← remove or unset
```

Re-import the same PDF as many times as you want — **no OpenAI calls**, no cost. Fixtures are keyed by prompt hash, so they stay valid until you change the import prompts.

Commit the fixture folder to git if you want CI to run import apply tests offline.

## Future optimization

The building phase could batch all days into **one** activity extraction call (3 calls total instead of N+2). That would cut import cost ~80% on a two-week trip.
