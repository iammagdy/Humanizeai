/**
 * Free-tier limits, mirroring the vendor's free tier:
 * 300 words per request, 1,500 words total per session.
 * The session budget lives in sessionStorage — it resets when the tab
 * closes, and it is never sent anywhere.
 */

export const MAX_WORDS_PER_REQUEST = 300
export const SESSION_WORD_BUDGET = 1500

const USED_KEY = 'humanizeai-session-used'

export function getSessionUsed(): number {
  try {
    return Number(sessionStorage.getItem(USED_KEY) ?? 0) || 0
  } catch {
    return 0
  }
}

export function addSessionUsed(words: number): number {
  const next = getSessionUsed() + words
  try {
    sessionStorage.setItem(USED_KEY, String(next))
  } catch {
    /* storage unavailable — budget just won't persist */
  }
  return next
}

export function getSessionRemaining(): number {
  return Math.max(0, SESSION_WORD_BUDGET - getSessionUsed())
}
