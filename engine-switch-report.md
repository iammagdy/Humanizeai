# Engine switch v6.14 — Gemini flash-lite -> OpenAI gpt-6-luna

Date: 2026-11-24. Done under Magdy's standing loop authorization
(2026-11-24 ~15:55: fix/test/publish without per-round approval).

## Why

Round v6.13 (gpt-6-luna, n=5 each on T1+T3) was the first engine to beat
the production model (flash-lite) on BOTH texts with zero unusable
outputs: T1 mean 32.4w (83.1%) vs lite 27.0w (69.2%); T3 mean 31.6w
(87.8%) with commas 3.0/3 and sentences 3.0/3 in EVERY run (lite: 2.4/3
and 1.8/3); markers 0/10, meaning 10/10, no leaks. Flash is better on
length (T1 92.8%, T3 usable 100.7%) but leaks 1/5 on Arabic, costs
~90s/call, and its free-key quota lasts ~12 calls/day. Luna: ~4s (EN),
~6-13s (AR), ~682 tokens/call (EN), ~1,667 (AR), no quota wall on
Magdy's key (he has free daily tokens for it).

## Changes (mvp/)

- New `src/lib/openai.ts`: model `gpt-6-luna`,
  `POST https://api.openai.com/v1/chat/completions`, body
  `{model, messages: [system, user], temperature: 1.0,
  max_completion_tokens: 2048}`. NOTE: this model rejects `max_tokens`
  (400) — `max_completion_tokens` is required (verified by live probe).
  Retry on 429/5xx and network failures: 3 retries, delays 2s/8s/30s.
  Same fidelity guard (EN 60% / AR 80%), same `normalizePunctuation`
  (v6.2 + v6.4), same empty-output guard (Arabic error message).
- `src/lib/settings.ts`: key storage key is now
  `humanizeai-openai-key`; key URL is platform.openai.com/api-keys.
  The old Gemini key stays in localStorage, unused.
- `src/components/SettingsDialog.tsx`: input id + key URL updated.
- `src/App.tsx`: imports `humanizeText` from `./lib/openai`.
- `src/lib/i18n.ts`: all Gemini wording replaced with OpenAI wording
  (ar + en). The v6.1 prompt in `engine.ts` is UNCHANGED.
- Deleted `src/lib/gemini.ts` (git history keeps it).

## Verification

New mock suite `hardening/verify-openai.mjs` (zero live calls):
O1 request body (model, max_completion_tokens, no max_tokens, v6.1
lines), O2 AR guard regen, O3 doubled commas, O4 mixed ".،",
O5 429 retried once, O6 empty reply error, O7 host allowlist
(127.0.0.1:4173 + api.openai.com only), O8 EN regression.
Result: **8/8 passed**. Build passes. The old Gemini suites
(verify-v61.mjs, verify-punct.mjs) are retired with the engine and kept
in hardening/ as history.

## User action needed

After deploy, Magdy must enter his OpenAI key in the app's Settings
(the old Gemini key no longer works). The key is stored in localStorage
only, same as before.
