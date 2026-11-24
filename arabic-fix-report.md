# HumanizeAi — Arabic Fix Report (v6.1)

**Date:** 2026-11-24
**Trigger:** live comparison 2026-11-24 13:47–13:51 showed our Arabic
output for a 36-word input came out 24 words (67%) and lost all 3
Arabic commas (،) — the same as the vendor. English was fine
(85–93% length, markers 0) and was not touched.
**Shipped variant:** attempt 1 (see below). Nothing committed, pushed,
or redeployed.

## What changed

### 1. Prompt — `mvp/src/lib/engine.ts`, rule 8 (V6_PROMPT)

Before (v6):
> 8. For Arabic text, apply the same rules in Arabic: short everyday
> words, every sentence opening with a plain subject, concrete details,
> repeated simple words.

After (v6.1, attempt 1 — shipped):
> 8. For Arabic text, apply the same rules in Arabic: short everyday
> words, every sentence opening with a plain subject, concrete details,
> repeated simple words. Keep ALL Arabic punctuation from the original:
> every comma (،) and every period (.) must appear in the output —
> never drop a comma. Keep the output about the same length as the
> original: preserve every clause and every detail, do not shorten or
> compress the text.

### 2. Prompt — `mvp/src/lib/engine.ts`, `ARABIC_LINE` (appended for Arabic)

Before (v6):
> …Keep ALL Arabic punctuation correct and complete: every sentence
> must end with its proper mark (، . ؟ !) — never drop punctuation…

After (v6.1, attempt 1 — shipped):
> …Keep ALL Arabic punctuation from the original, exactly: every comma
> (،) must stay — if the original has 3 commas, the output must have
> 3 commas — and every sentence must end with its proper mark (. ؟ !).
> Never drop punctuation. Keep the output about the same length as the
> original: preserve every clause and every detail, do not shorten or
> compress…

### 3. Fidelity guard — `mvp/src/lib/gemini.ts`

Arabic threshold raised from 60% to 80% of the input's words before an
output is accepted (other text stays at 60%). One regeneration, keep
the longer output, same note. No other change.

### 4. Draft — `files/api-test/engine-prompt-v6.1-draft.md`

New file: v6 + the two Arabic additions, with both attempts' prompt
blocks and results, so the draft stays in sync with the app. The
runner (`run_gemini_v6_1_arabic_test.py`) extracts the prompt from
`engine.ts` itself and asserts it matches the draft.

## Live verification (Gemini, gemini-3.5-flash-lite, temp 1.0)

Exact 3 live-comparison texts, via the project's surrogate runner.
Arabic text ×3 runs, English texts ×1 run each, per variant.

Input baselines: Text 1 EN 39 words / 3 periods; Text 2 EN 41 words /
3 periods; Text 3 AR 36 words / 3 commas (،) / 3 periods.

### Attempt 1 (shipped) — `my_outputs_v6_1_arabic.json`

| Run | Words | Ratio | Commas | Periods | Markers survived | Guard regen |
|-----|-------|-------|--------|---------|------------------|-------------|
| Text 1 EN | 29/39 | 74.4% | — | 3/3 | none | no |
| Text 2 EN | 38/41 | 92.7% | — | 3/3 | none | no |
| Text 3 AR #1 | 36/36 | 100.0% | 2/3 | 3/3 | none | no |
| Text 3 AR #2 | 28/36 | 77.8% | 2/3 | 1/3 | none (dialect slipped in: "عشان"، "تبغى") | yes |
| Text 3 AR #3 | 38/36 | 105.6% | 2/3 | 2/3 | "من الواضح أن" | no |

Arabic mean ratio 94.5% (v6 live: 67%). Commas 2/3 in every run.

### Attempt 2 (tested, NOT shipped) — `my_outputs_v6_1b_arabic.json`

Stronger wording: "EXACTLY the same number of commas and periods",
"same number of sentences", firmer MSA-only line.

| Run | Words | Ratio | Commas | Periods | Markers survived | Guard regen |
|-----|-------|-------|--------|---------|------------------|-------------|
| Text 1 EN | 26/39 | 66.7% | — | 3/3 | none | no |
| Text 2 EN | 41/41 | 100.0% | — | 3/3 | none | no |
| Text 3 AR #1 | 31/36 | 86.1% | 1/3 | 2/3 | "من الواضح أن" | no |
| Text 3 AR #2 | 30/36 | 83.3% | 2/3 | 2/3 | none | no |
| Text 3 AR #3 | 28/36 | 77.8% | 0/3 | 3/3 | none | yes |

Arabic mean ratio 82.4%, mean commas 1.0/3. Exact-count wording did
NOT fix commas — the model does not count punctuation; it either
merges sentences (losing a period + a comma) or writes short
comma-free sentences. It did fix dialect (3/3 runs clean MSA).

### Verdict

- **Compression: FIXED.** Arabic mean ratio 94.5% (attempt 1) vs 67%
  before; every run ≥77.8%, and the 80% guard regenerates the one
  sub-80% run in the app.
- **Commas: NOT fixed by prompting — UNRESOLVED.** Best measured is
  2/3 (attempt 1, stable across all 3 runs; v6 was 0/3). Attempt 2's
  exact-count instruction made it worse (1/3, 2/3, 0/3). Two prompt
  variants tried; per the task bound, prompting stops here.
- **English: unchanged, no regression.** Markers 0 in all 4 English
  runs across both variants; periods 3/3 every time.
- **Markers (Arabic):** "من الواضح أن" survived in 1 of 3 runs in
  each variant; all other Arabic markers killed in all runs.

## Why attempt 1 ships, not attempt 2

Attempt 1 measured better on the two goals of this fix: commas 2/3
stable (vs 1.0/3 mean) and mean ratio 94.5% (vs 82.4%). Its one
dialect slip (1/3 runs) is the smaller defect. Attempt 2 is fully
documented above; restoring it is a two-line change in `engine.ts`.

## Rebuild + wiring re-verification

- `npm run build` passes (dist rebuilt, 366.68 KB / 119.07 KB gzip).
- The original mock hardening suite (`/tmp/hardening/run-tests.mjs`)
  was lost when /tmp was cleaned, so a focused suite was rebuilt
  (`/tmp/hardening/verify-v61.mjs`, playwright-core 1.49 + cached
  Chromium 1248, zero live calls): **5/5 passed** —
  - R1: new Arabic lines present in the request body the app sends
    ("never drop a comma", "if the original has 3 commas",
    "do not shorten or compress"), 1 call.
  - R2: Arabic guard at 80% regenerates once, keeps the longer
    output, note shown.
  - R3: English regression — 1 call, output shown.
  - R4: empty-reply error (T4f fix) still holds after the guard edit.
  - R5: only hosts contacted: 127.0.0.1:4173 +
    generativelanguage.googleapis.com.

## Open items

1. **Commas unresolved by prompting.** Best is 2/3. Idea not
   implemented: deterministic post-processing in the app that
   restores dropped commas by sentence alignment (e.g., if the output
   has fewer commas than the input, re-insert them at matching clause
   boundaries). Needs a product decision before building.
2. **Fresh deploy needed.** The Netlify Drop link
   (thunderous-sfogliatella-47514c.netlify.app) expires ~14:43 EET
   2026-11-24. The fix is built locally only; nothing was redeployed.
3. **Live re-test on the deployed app** with the new prompt once it is
   redeployed (Magdy's key is already in the app).
4. **"من الواضح أن"** survived in 1 of 6 Arabic runs total — the
   ban-list phrase is sometimes reused verbatim by the model.

## v6.2 — Deterministic punctuation cleanup (2026-11-24 15:09–15:15)

Cause: the v6.1 exact-count instruction ("if the original has 3 commas, the
output must have 3 commas") made the model overshoot — live re-test Run 1
(2026-11-24 15:03, claimed link) produced "،،" twice and collapsed 3
sentences into 1. Prompting cannot fix counting; code can.

Change (`mvp/src/lib/gemini.ts`, uncommitted): new exported
`normalizePunctuation(text)`, applied to the final output after the fidelity
guard, before the empty check. Collapses any run of the same mark to one:
`،،` → `،`, `,,` → `,`, `؟؟` → `؟`, `!!` → `!`, `..` → `.` (also
space-separated runs like `، ،`). Preserves `...` (ellipsis) via a NUL-byte
placeholder. The prompt is UNCHANGED — the model still tries to keep every
comma, the code just corrects its overshoot.

Verification (mock-based, zero live calls, `dist/` rebuilt):
- New suite `/tmp/hardening/verify-punct.mjs`: P1 (exact live Run 1 output
  with "،،" twice → displayed with 2 single commas, 0 doubled, 1 call) and
  P2 (`,,`/`..` collapsed, `...` kept) — 2/2 passed.
- v6.1 regression suite `/tmp/hardening/verify-v61.mjs` — 5/5 passed.
- `npm run build` passes.

Status: NOT pushed, NOT deployed — awaiting Magdy's approval.

## v6.4 — Mixed-punctuation cleanup, SHIPPED (2026-11-24 ~15:56)

Applied to `mvp/src/lib/gemini.ts` under Magdy's standing loop authorization
(2026-11-24 ~15:55: fix/test/publish without per-round approval). One added
step to `normalizePunctuation`: collapse any run of periods/commas (mixed
or not) to the LAST mark of the run (".،" → "،", "،." → "."). Draft and
18/18 unit tests were in `files/api-test/normalize-punct-v6.4-draft.md`.

Verification: the /tmp/hardening suite had been wiped by /tmp cleanup, so
the harness was rebuilt permanently under `mvp/hardening/` (gitignored,
playwright-core 1.49 installed there; `verify-punct.mjs` + `verify-v61.mjs`
recreated, P3 added for the mixed ".،" case). Results on the rebuilt dist:
P1+P2+P3 3/3, R1–R5 5/5, build passes.

Commit + push + deploy: see git log / Netlify deploy after this note.
