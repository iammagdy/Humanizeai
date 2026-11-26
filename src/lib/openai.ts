import { buildSystemPrompt, type Level, type Tone } from './engine'

/**
 * OpenAI client — direct browser calls, no backend, no proxy.
 * Model: gpt-6-luna (chosen by Magdy 2026-11-24; round v6.13 proved it
 * beats flash-lite on both test texts with zero unusable outputs).
 * Temperature 1.0. NOTE: this model rejects `max_tokens` (400) — it
 * takes `max_completion_tokens` instead (verified by live probe).
 * The API key is supplied by the user in Settings and is sent ONLY to
 * api.openai.com — never anywhere else.
 */

const MODEL = 'gpt-6-luna'
const ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const MAX_COMPLETION_TOKENS = 2048
/** Retry delays after a 429/5xx or a network failure (3 retries max). */
const RETRY_DELAYS_MS = [2000, 8000, 30000]

export interface HumanizeResult {
  text: string
  /** True when the fidelity guard regenerated once and kept the longer output. */
  regenerated: boolean
}

function extractText(data: unknown): string {
  const d = data as {
    choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>
    error?: { message?: string; type?: string; code?: string }
  }
  if (d?.error) {
    throw new Error(d.error.message ?? 'OpenAI API error')
  }
  const choice = d?.choices?.[0]
  return choice?.message?.content ?? ''
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function callOpenAI(apiKey: string, systemPrompt: string, input: string): Promise<string> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    let res: Response
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: input },
          ],
          temperature: 1.0,
          max_completion_tokens: MAX_COMPLETION_TOKENS,
        }),
      })
    } catch {
      lastError = new Error('تعذّر الاتصال بخدمة OpenAI. تأكد من الإنترنت وحاول تاني.')
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt])
        continue
      }
      throw lastError
    }
    if (res.ok) {
      let data: unknown
      try {
        data = await res.json()
      } catch {
        throw new Error('وصل رد غير مفهوم من OpenAI. حاول تاني.')
      }
      return extractText(data)
    }
    // Retryable: rate limit or server error.
    if ((res.status === 429 || res.status >= 500) && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt])
      continue
    }
    let message = `OpenAI request failed (${res.status})`
    try {
      const data = await res.json()
      const err = (data as { error?: { message?: string } })?.error?.message
      if (err) message = err
    } catch {
      /* keep the status-based message */
    }
    throw new Error(message)
  }
  throw lastError ?? new Error('OpenAI request failed')
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
  const inWords = countWords(input)
  const systemPrompt = buildSystemPrompt(tone, level, arabic, input)
  const first = await callOpenAI(apiKey, systemPrompt, input)
  const threshold = arabic ? 80 : 60
  let result: HumanizeResult
  if (countWords(first) * 100 >= inWords * threshold) {
    result = { text: first, regenerated: false }
  } else {
    const second = await callOpenAI(apiKey, systemPrompt, input)
    const kept = countWords(second) >= countWords(first) ? second : first
    result = { text: kept, regenerated: true }
  }
  // Deterministic cleanup of doubled punctuation (e.g. "،،" from the
  // exact-count instruction) before the empty check.
  result = { text: normalizePunctuation(result.text), regenerated: result.regenerated }
  // An empty final output must never silently wipe a previous result:
  // surface it as an error so the old output stays on screen.
  if (!result.text.trim()) {
    throw new Error('OpenAI رجّع رد فاضي. جرّب تاني.')
  }
  return result
}
