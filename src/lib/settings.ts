/**
 * API-key storage. The key is the user's own Gemini key, entered in
 * Settings. It lives in localStorage ONLY — never committed, never sent
 * anywhere except to generativelanguage.googleapis.com.
 */

const KEY = 'humanizeai-gemini-key'

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function setApiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(KEY, key.trim())
    else localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable */
  }
}

export function clearApiKey(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable */
  }
}

export const GEMINI_KEY_URL = 'https://aistudio.google.com/apikey'
