import { buildSystemPrompt, type Level, type Tone } from './engine'

/**
 * Gemini client — direct browser calls, no backend, no proxy.
 * Model: gemini-3.5-flash-lite, temperature 1.0, no topP
 * (the exact setting validated in the v5/v6 rounds).
 * The API key is supplied by the user in Settings and is sent ONLY to
 * generativelanguage.googleapis.com — never anywhere else.
 */

const MODEL = 'gemini-3.5-flash-lite'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

export interface HumanizeResult {
  text: string
  /** True when the fidelity guard regenerated once and kept the longer output. */
  regenerated: boolean
}

function extractText(data: unknown): string {
  const d = data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    error?: { message?: string; status?: string }
  }
  if (d?.error) {
    throw new Error(d.error.message ?? `Gemini API error (${d.error.status ?? 'unknown'})`)
  }
  const parts = d?.candidates?.[0]?.content?.parts ?? []
  return parts.map((p) => p.text ?? '').join('')
}

async function callGemini(apiKey: string, systemPrompt: string, input: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: input }] }],
        generationConfig: { temperature: 1.0 },
      }),
    })
  } catch {
    throw new Error('تعذّر الاتصال بخدمة Gemini. تأكد من الإنترنت وحاول تاني.')
  }
  if (!res.ok) {
    let message = `Gemini request failed (${res.status})`
    try {
      const data = await res.json()
      const err = (data as { error?: { message?: string } })?.error?.message
      if (err) message = err
    } catch {
      /* keep the status-based message */
    }
    throw new Error(message)
  }
  let data: unknown
  try {
    data = await res.json()
  } catch {
    throw new Error('وصل رد غير مفهوم من Gemini. حاول تاني.')
  }
  return extractText(data)
}

/**
 * Deterministic punctuation cleanup. The model sometimes overshoots the
 * "keep every comma" instruction and emits doubled marks (observed live:
 * "،،" twice in one Arabic output). Collapse any run of the same mark to
 * one — but preserve "..." (ellipsis). v6.4: also collapse mixed runs of
 * periods/commas (".،" / "،.") to the LAST mark of the run.
 */
export function normalizePunctuation(text: string): string {
  const ELLIPSIS = '__HUMANIZEAI_ELLIPSIS_9f3a7c__'
  return text
    .replace(/\.\.\./g, ELLIPSIS)
    .replace(/،(\s*،)+/g, '،')
    .replace(/,(\s*,)+/g, ',')
    .replace(/؟(\s*؟)+/g, '؟')
    .replace(/!(\s*!)+/g, '!')
    // v6.4: mixed period/comma runs -> last mark of the run.
    .replace(/([.،,])(\s*[.،,])+/g, (run) => run.trim().slice(-1))
    .replace(/\.{2,}/g, '.')
    .replaceAll(ELLIPSIS, '...')
}

export function countWords(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return text.trim() === '' ? 0 : words.length
}

/**
 * Humanize one text. Fidelity guard: v6 sometimes compresses hard
 * (one test lost 48% of words; the live comparison showed Arabic
 * 36 -> 24 words). If the output has fewer than 60% of the input's
 * words, regenerate once with the same prompt and keep the longer
 * of the two outputs. Arabic compresses harder, so for Arabic text
 * the bar is 80% instead of 60%.
 */
export async function humanizeText(
  apiKey: string,
  input: string,
  tone: Tone,
  level: Level,
  arabic: boolean,
): Promise<HumanizeResult> {
  const systemPrompt = buildSystemPrompt(tone, level, arabic)
  const first = await callGemini(apiKey, systemPrompt, input)
  const inWords = countWords(input)
  const threshold = arabic ? 80 : 60
  let result: HumanizeResult
  if (countWords(first) * 100 >= inWords * threshold) {
    result = { text: first, regenerated: false }
  } else {
    const second = await callGemini(apiKey, systemPrompt, input)
    const kept = countWords(second) >= countWords(first) ? second : first
    result = { text: kept, regenerated: true }
  }
  // Deterministic cleanup of doubled punctuation (e.g. "،،" from the
  // exact-count instruction) before the empty check.
  result = { text: normalizePunctuation(result.text), regenerated: result.regenerated }
  // An empty final output must never silently wipe a previous result:
  // surface it as an error so the old output stays on screen.
  if (!result.text.trim()) {
    throw new Error('Gemini رجّع رد فاضي. جرّب تاني.')
  }
  return result
}
