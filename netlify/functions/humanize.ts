/**
 * Netlify Function: POST /.netlify/functions/humanize
 *
 * Shared-service proxy — lets visitors humanize WITHOUT entering their
 * own OpenAI key. The key lives ONLY in the OPENAI_API_KEY environment
 * variable (set in the Netlify dashboard); it is never in code, never
 * logged, never returned to the client.
 *
 * Reuses the exact engine as the browser path: buildSystemPrompt
 * (T49 EN / AR58 AR) + the fidelity guard in humanizeText, imported
 * from src/lib — the prompt is never retyped here.
 *
 * Quota protection (Magdy's free quota is 250K tokens/day and a request
 * crossing it is billed IN FULL):
 * - max 300 words per request (same as the frontend limit);
 * - max 1,500 words/day per client IP;
 * - max 30,000 OpenAI tokens/day across ALL proxy users, counted from
 *   the API's actual usage figures. A 3,000-token reserve is held per
 *   request before calling OpenAI, so the budget can overshoot by at
 *   most one request's real cost (~5,000 tokens worst case with a
 *   guard regen) — still far under the 250K daily quota.
 * Why 30,000: one full 1,500-word tester session is ~5-7 calls, i.e.
 * roughly 7K-17K tokens depending on prompt size and regens, so 30K
 * allows ~2-4 full sessions a day while keeping >=88% of the daily
 * free quota for Magdy's own rounds.
 * Counters persist in Netlify Blobs (store "humanizeai-proxy-usage"),
 * keyed by UTC day (the OpenAI quota resets 00:00 UTC). Client IPs
 * are stored only as a SHA-256 hash, never raw.
 *
 * Deploy note: drag-and-drop manual deploys do NOT support Functions —
 * deploy via a linked repo or `netlify deploy --functions=...`.
 */

import { createHash } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import { countWords, humanizeText, type HumanizeResult } from '../../src/lib/openai.ts'
import { isArabic, LEVELS, TONES, type Level, type Tone } from '../../src/lib/engine.ts'

/** Max words per request — same as the frontend limit. */
const MAX_WORDS_PER_REQUEST = 300
/** Max words per client IP per UTC day (≈ one full session). */
const IP_DAILY_WORD_BUDGET = 1500
/** Max OpenAI tokens across ALL proxy users per UTC day. */
const GLOBAL_DAILY_TOKEN_BUDGET = 30000
/** Tokens held in reserve per request before calling OpenAI. */
const RESERVE_TOKENS_PER_REQUEST = 3000

const BLOB_STORE = 'humanizeai-proxy-usage'

interface UsageStore {
  get(key: string): Promise<number | null>
  set(key: string, value: number): Promise<void>
}

class BlobsUsageStore implements UsageStore {
  async get(key: string): Promise<number | null> {
    const value = await getStore(BLOB_STORE).get(key, { type: 'json' })
    return typeof value === 'number' ? value : null
  }
  async set(key: string, value: number): Promise<void> {
    await getStore(BLOB_STORE).setJSON(key, value)
  }
}

class MemoryUsageStore implements UsageStore {
  private readonly map = new Map<string, number>()
  async get(key: string): Promise<number | null> {
    return this.map.get(key) ?? null
  }
  async set(key: string, value: number): Promise<void> {
    this.map.set(key, value)
  }
}

const memoryStore = new MemoryUsageStore()

/**
 * Production uses Netlify Blobs (persists across invocations).
 * HUMANIZE_USAGE_STORE=memory selects the in-memory store — for local
 * tests and local dev only; never set it in production.
 */
function createUsageStore(): UsageStore {
  return process.env.HUMANIZE_USAGE_STORE === 'memory' ? memoryStore : new BlobsUsageStore()
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10)
}

function ipHash(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16)
}

function clientIp(req: Request, context: { ip?: string }): string {
  if (context.ip) return context.ip
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return req.headers.get('client-ip')?.trim() || 'unknown'
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function err(code: string, message: string): { error: { code: string; message: string } } {
  return { error: { code, message } }
}

export default async (req: Request, context: { ip?: string }): Promise<Response> => {
  if (req.method !== 'POST') {
    return json(405, err('METHOD_NOT_ALLOWED', 'Use POST.'))
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json(400, err('BAD_REQUEST', 'Request body must be JSON.'))
  }
  const { text, tone, level } = (body ?? {}) as { text?: unknown; tone?: unknown; level?: unknown }
  if (typeof text !== 'string' || !text.trim()) {
    return json(400, err('BAD_REQUEST', 'Text is required.'))
  }
  const cleanTone: Tone =
    typeof tone === 'string' && (TONES as string[]).includes(tone) ? (tone as Tone) : 'standard'
  const cleanLevel: Level =
    typeof level === 'string' && (LEVELS as string[]).includes(level) ? (level as Level) : 'balanced'

  // Key check first: without it the service is simply not configured.
  // No key details, no stack trace, ever. Trim: a pasted value can
  // carry trailing whitespace, which OpenAI rejects with a 401.
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return json(503, err('PROXY_UNAVAILABLE', 'Shared humanize service is not configured.'))
  }

  const input = text.trim()
  const words = countWords(input)
  if (words > MAX_WORDS_PER_REQUEST) {
    return json(429, err('TOO_LONG', 'Text is longer than 300 words.'))
  }

  const day = utcDay()
  const store = createUsageStore()
  const globalUsed = (await store.get(`global:${day}`)) ?? 0
  if (globalUsed + RESERVE_TOKENS_PER_REQUEST > GLOBAL_DAILY_TOKEN_BUDGET) {
    return json(429, err('DAILY_LIMIT', 'The shared service ran out of its daily budget.'))
  }
  const ip = clientIp(req, context)
  const ipKey = `ip:${day}:${ipHash(ip)}`
  const ipUsed = (await store.get(ipKey)) ?? 0
  if (ipUsed + words > IP_DAILY_WORD_BUDGET) {
    return json(429, err('DAILY_LIMIT', 'The shared service ran out of its daily budget.'))
  }

  let result: HumanizeResult
  try {
    result = await humanizeText(apiKey, input, cleanTone, cleanLevel, isArabic(input))
  } catch (e) {
    // Never forward the provider's error body — it can leak details.
    // Log only the HTTP status: 401 = key rejected, 404 = no access to
    // the model, none = the request never got an answer (network). The
    // status is attached by callOpenAI; the message itself is never
    // logged because it can contain key material.
    const status = (e as { status?: unknown } | null)?.status
    console.error(
      'humanize proxy: OpenAI call failed',
      typeof status === 'number' ? `status=${status}` : 'status=none',
    )
    return json(502, err('PROXY_UNAVAILABLE', 'Shared humanize service is unavailable right now.'))
  }
  try {
    // Charge only for delivered work, using the API's real usage figures.
    await store.set(ipKey, ipUsed + words)
    await store.set(`global:${day}`, globalUsed + result.usageTokens)
  } catch {
    console.error('humanize proxy: usage counter write failed')
    return json(502, err('PROXY_UNAVAILABLE', 'Shared humanize service is unavailable right now.'))
  }
  return json(200, { text: result.text, regenerated: result.regenerated })
}
