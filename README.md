# HumanizeAi — MVP

AI-to-human text humanizer, modelled on humanizeai.pro. React + TypeScript +
Vite + Tailwind v4, Base UI primitives on shadcn-style OKLCH tokens.

## Run it

```bash
cd ~/workspace/goals/wise-humanize-build/mvp
npm install
npm run dev        # dev server, default http://localhost:5173
npm run build      # production build (tsc + vite)
npm run preview    # serve the production build
```

## How it works

- **Engine:** the v6 prompt (`src/lib/engine.ts`, verbatim from the 1,000-scenario
  study) is sent as the system instruction to Google Gemini
  (`gemini-3.5-flash-lite`, temperature 1.0, no topP) directly from the browser.
- **API key:** the user enters their own free Gemini key in Settings. It is stored
  in `localStorage` only and sent only to `generativelanguage.googleapis.com`.
  There is no hardcoded key and no fallback key — without a key the app shows
  a Settings prompt. Get a free key at https://aistudio.google.com/apikey
- **Tones:** Standard, Academic, Simple, Formal, Flowing (the 5 tones from the
  vendor study). Tone changes wording style only.
- **Levels:** Quality (most faithful), Balanced (default v6), Max (most thorough
  rewording).
- **Arabic:** input containing Arabic script is auto-detected and rewritten in
  Modern Standard Arabic (MSA), formal, with correct punctuation kept — the
  vendor drops Arabic punctuation entirely. Never dialect.
- **Fidelity guard:** if the output has fewer than 60% of the input's words,
  the app regenerates once and keeps the longer output, showing a small note.
- **Free limits (mirror the vendor's free tier):** 300 words per request,
  1,500 words total per browser session (sessionStorage — resets on new tab).
- **UI:** Arabic RTL by default, EN toggle. No billing, no accounts, no
  plagiarism checker, no detector scores (dropped by Magdy's decision).

## Files

- `src/lib/engine.ts` — v6 prompt + tone/level/Arabic suffixes
- `src/lib/gemini.ts` — Gemini API call + fidelity guard
- `src/lib/limits.ts` — word limits / session budget
- `src/lib/settings.ts` — localStorage API-key storage
- `src/lib/i18n.ts` — Arabic/English UI strings
- `src/components/` — Base UI Select (tone) + Dialog (settings)
- `src/App.tsx` — two-pane editor UI
