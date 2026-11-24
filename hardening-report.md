# HumanizeAi MVP — Hardening Report

**Date:** 2026-11-24 (after the 12:57 push of commit `50895c3`)
**Scope:** the app's own wiring only. The v6 engine itself was already proven by the
1,000-scenario study; it was not re-tested here.
**Result: 18/18 tests passed** (after 1 real bug fix + 2 small error-message improvements;
see "Fixes made").

## Method / tooling

- Production build served locally: `npx vite preview --port 4173` (from `mvp/`, `dist/` rebuilt
  with `npm run build` after the fix — build passes, 366 KB / 119 KB gzip).
- Headless tests: **playwright-core 1.49** (installed in `/tmp/hardening`, not in the app)
  driving the cached Chromium 1248 binary (`~/.cache/ms-playwright/chromium-1248`).
  No Playwright/Puppeteer package was pre-installed; this was the route used.
- **Zero live Gemini calls.** Every request to `generativelanguage.googleapis.com` was
  intercepted with `page.route` and answered from mocks. All other requests were logged;
  only two hosts were ever contacted (see T8).
- Each test ran in a fresh browser context (clean localStorage/sessionStorage).
- Test script: `/tmp/hardening/run-tests.mjs` (results JSON: `/tmp/hardening/results.json`).
- Harness note: the first suite run stalled because of a bad Playwright selector in my own
  helper (`section >> nth=1 p...` matched nothing and burned 30 s per call). The selector
  was fixed (`.nth(1).locator(...)`) and the suite re-ran clean in ~35 s. The 18/18 result
  below is from the clean re-run after the rebuild.

## Per-test results

| # | Test | Result | Evidence |
|---|------|--------|----------|
| T1 | Settings: save dummy key `TESTKEY123`, reload, clear | ✅ PASS | Banner shown before save, hidden after save and after reload, back after clear; saved-key input shows masked placeholder `••••••••••••••••`, input value empty (key never displayed) |
| T2 | Happy path EN | ✅ PASS | Output == mocked text exactly; 1 API call; key present in request URL (`key=TESTKEY123`); clipboard == mocked text; download `humanizeai.txt` content == mocked text; output counter `37 كلمة`; session `28 / 1500 · 1472 remaining`; hosts `[127.0.0.1:4173, generativelanguage.googleapis.com]`. Shot: `preview-shots/t2-happy-en.png` |
| T2b | Happy path AR | ✅ PASS | Output == mocked Arabic text, punctuation `،` intact, page `dir=rtl`, request body contains the MSA/ARABIC_LINE. Shot: `preview-shots/t2b-happy-ar.png` |
| T3 | Fidelity guard | ✅ PASS | Short 1st reply (4 words vs 30-word input) → 2nd API call, longer output kept, `↻` regenerated note visible. 2nd sub-case (both replies short) → also 2 calls, longer of the two kept. Shot: `preview-shots/debug-guard.png` |
| T4a | Error 400 invalid key | ✅ PASS | `حصلت مشكلة: API key not valid. Please pass a valid API key.` — previous output intact, button back to idle, 1 call |
| T4b | Error 429 rate-limited | ✅ PASS | `حصلت مشكلة: Resource exhausted. Please try again later.` — previous output intact, idle, 1 call |
| T4c | Error 500 | ✅ PASS | `حصلت مشكلة: Internal error.` — previous output intact, idle, 1 call |
| T4d | Network failure (aborted) | ✅ PASS | `حصلت مشكلة: تعذّر الاتصال بخدمة Gemini. تأكد من الإنترنت وحاول تاني.` (Arabic — see fix) — previous output intact, idle, 1 call |
| T4e | Malformed JSON (200) | ✅ PASS | `حصلت مشكلة: وصل رد غير مفهوم من Gemini. حاول تاني.` (Arabic — see fix) — previous output intact, idle, 1 call |
| T4f | 200 with empty candidates | ✅ PASS (after fix) | Guard re-runs (2 calls), then throws: `حصلت مشكلة: Gemini رجّع رد فاضي. جرّب تاني.` — previous output intact. **Before the fix this FAILED: the empty reply silently wiped the previous output with no message.** |
| T5a | >300 words blocked | ✅ PASS | 321-word input → `النص أطول من 300 كلمة. قصّره وحاول تاني.`, **0 API calls**, counter shows `321 / 300 كلمة` in red |
| T5b | Session exhausted blocked | ✅ PASS | Session pre-set to 1480/1500, 30-word input → `خلصت رصيد الجلسة (1,500 كلمة)...`, **0 API calls** |
| T5c | Boundary: 300 words, 300 remaining | ✅ PASS | 300-word input with 300 words remaining → 1 call, session ends `1500 / 1500 · 0 المتبقي` |
| T6 | Empty / whitespace-only input | ✅ PASS | Humanize button disabled for empty and whitespace-only input, 0 calls |
| T7 | XSS in mocked output | ✅ PASS | Output `<script>alert(1)</script><img src=x onerror=alert(2)>hello world plain text` rendered as literal inert text: 0 alerts, 0 `<script>`/`<img>` nodes in the output pane. Source grep: no `dangerouslySetInnerHTML`, no `innerHTML` anywhere in `src/` (output is a React text node, auto-escaped) |
| T8 | Key safety / hosts | ✅ PASS | All intercepted API URLs start with `https://generativelanguage.googleapis.com/`; only hosts contacted in a full session: `127.0.0.1:4173` + `generativelanguage.googleapis.com`. Source grep: no hardcoded key (only the `AIza…` placeholder). Settings input is `type=password`, `autoComplete=off`; saved key is never displayed (masked placeholder). "Get a free key" links to `https://aistudio.google.com/apikey` (no request made unless clicked) |
| T9 | Mobile 390px, Arabic | ✅ PASS | `scrollWidth=390 = innerWidth`, no horizontal overflow, Humanize button visible/usable, Arabic output exact. Shot: `preview-shots/t9-mobile-ar.png` |
| T10 | Tone/level change the request | ✅ PASS | Default request body contains `Tone: Standard` + `Level: Balanced`; after switching to أكاديمية/شاملة it contains `Tone: Academic` + `Level: Max`; bodies differ; v6 prompt present in both |

## Fixes made

All in **one file, `mvp/src/lib/gemini.ts`** (33 insertions, 14 deletions). Rebuilt and
re-tested — the full suite passes. **Not committed or pushed** (per instructions).

1. **Empty-output wipe (real bug, found by T4f).** `humanizeText` now throws if the final
   kept text is empty (after the fidelity guard), instead of `setOutput('')` silently
   erasing the previous good result. User sees `حصلت مشكلة: Gemini رجّع رد فاضي. جرّب تاني.`
   and the old output stays on screen.
2. **Arabic error messages for transport failures (T4d/T4e).** `callGemini` now maps a
   failed `fetch` to `تعذّر الاتصال بخدمة Gemini. تأكد من الإنترنت وحاول تاني.` and an
   unparseable 200 body to `وصل رد غير مفهوم من Gemini. حاول تاني.` — previously the raw
   English `Failed to fetch` / `SyntaxError` text was shown to the user.
   (HTTP-error bodies still show Google's own English message, e.g. `API key not valid` —
   kept deliberately: it is specific and informative.)

## Notes / observations (not failures)

- The key is sent as a `?key=` query parameter — that is Google's documented approach for
  browser calls; it travels only over HTTPS to `generativelanguage.googleapis.com`.
- Session budget lives in `sessionStorage` (resets on new tab) and is never sent anywhere.
- The Humanize button is disabled only for empty input; over-limit and session-exhausted
  inputs show a message instead (by design — the counter already turns red past 300).
- Mobile was verified headless at 390×844 only; no real-device check was done.
- The `dist/` rebuild after the fix is uncommitted (as is the source fix); `dist/` is
  gitignored, so only the source change needs committing.

## Open items

1. **Live humanize run with Magdy's real Gemini key — only Magdy can do this.** The entire
   app flow is verified with mocks, but the real key + real Gemini response has never run
   through the app itself. Steps: open the app, Settings → paste key → paste a text →
   Humanize → confirm the output looks right.
2. **Commit + push the fix.** `mvp/src/lib/gemini.ts` is modified but uncommitted (the
   12:57 push does not include it). Needs Magdy's approval to push, as before.
3. Optional, not needed for launch: translate Google's HTTP-error messages (400/429/500)
   into Arabic; add an in-app retry button on 429.
