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
  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: input }] }],
      generationConfig: { temperature: 1.0 },
    }),
  })
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
  return extractText(await res.json())
}

export function countWords(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return text.trim() === '' ? 0 : words.length
}

/**
 * Humanize one text. Fidelity guard: v6 sometimes compresses hard
 * (one test lost 48% of words). If the output has fewer than 60% of the
 * input's words, regenerate once with the same prompt and keep the longer
 * of the two outputs.
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
  if (countWords(first) * 100 >= inWords * 60) {
    return { text: first, regenerated: false }
  }
  const second = await callGemini(apiKey, systemPrompt, input)
  const kept = countWords(second) >= countWords(first) ? second : first
  return { text: kept, regenerated: true }
}
