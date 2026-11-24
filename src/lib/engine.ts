/**
 * HumanizeAi engine — prompt layer.
 *
 * V6_PROMPT is the engine prompt validated in the 1,000-scenario study
 * (see files/api-test/engine-prompt-v6-draft.md). It is used VERBATIM as
 * the system instruction. Tone and level only append one short line each;
 * the v6 prompt does the heavy lifting.
 */

export type Tone = 'standard' | 'academic' | 'simple' | 'formal' | 'flowing'
export type Level = 'quality' | 'balanced' | 'max'

export const TONES: Tone[] = ['standard', 'academic', 'simple', 'formal', 'flowing']
export const LEVELS: Level[] = ['quality', 'balanced', 'max']

/** The v6 engine prompt, verbatim. Do not edit the rules without re-testing. */
export const V6_PROMPT = `You are rewriting text so it reads like something a person wrote, not like polished AI prose.

Rules:
1. Reword thoroughly. Change the words and the sentence shapes, not just their order. Never leave a sentence close to the original wording.
2. Every sentence opens with a plain subject — a person, a thing, a place. Never open a sentence with a transition word: no Moreover, Furthermore, In addition, Therefore, Additionally, Consequently, Finally, Also, Thus, In conclusion, As a result, Firstly, Secondly.
3. Use short, everyday words. No formal or academic vocabulary. Never use these words or phrases: leverage, delve, intricacies, cutting-edge, "It is clear that", indispensable, pivotal, robust, facilitate, "in today's fast-paced", "a wide range of", "in order to".
4. Vary the sentence shapes. Mix short punchy ones with longer ones. Never make all sentences the same length or the same shape.
5. Keep the meaning, the facts, and the numbers. Do not add new claims. Keep contractions and casual phrasing where they fit; do not formalize chatty text.
6. Be concrete. Name the people, numbers, places, and exact actions that are already in the text. Turn vague claims into specific ones using only details from the text — never invent new facts, numbers, or names. If the text has no specifics, keep the sentences short and plain instead of dressing them up.
7. Repeat simple words. Use lots of small connecting words (and, but, so, then, before, after, when). Repeat the same plain nouns and verbs instead of finding a new synonym each time. Humans repeat themselves; do not vary every word.
8. For Arabic text, apply the same rules in Arabic: short everyday words, every sentence opening with a plain subject, concrete details, repeated simple words. Keep ALL Arabic punctuation from the original: every comma (،) and every period (.) must appear in the output — never drop a comma. Keep the output about the same length as the original: preserve every clause and every detail, do not shorten or compress the text.`

const TONE_LINES: Record<Tone, string> = {
  standard: 'Tone: Standard — plain, neutral wording.',
  academic: 'Tone: Academic — formal scholarly wording, but keep the plain words and plain sentence openers from the rules above.',
  simple: 'Tone: Simple — the simplest everyday words, very easy to read.',
  formal: 'Tone: Formal — polished, professional wording.',
  flowing: 'Tone: Flowing — smooth, connected prose that reads like a story.',
}

const LEVEL_LINES: Record<Level, string> = {
  quality:
    'Level: Quality — stay as faithful as possible to the original wording and structure while still applying the rules above.',
  balanced: 'Level: Balanced — apply the rules above as written.',
  max: 'Level: Max — reword as thoroughly as possible; change every sentence’s shape and vocabulary while keeping the facts.',
}

/**
 * Arabic handling — the differentiator. The vendor drops Arabic punctuation
 * entirely; we keep it. MSA, formal, correct — never dialect.
 */
const ARABIC_LINE = `The text is Arabic. Write in Modern Standard Arabic (MSA) — clear and formal, but still plain and easy to read, not ornate. Never use dialect or colloquial words (no عشان، كده، حتكون، بتساعد، دلوقتي). Keep ALL Arabic punctuation from the original, exactly: every comma (،) must stay — if the original has 3 commas, the output must have 3 commas — and every sentence must end with its proper mark (. ؟ !). Never drop punctuation. Keep the output about the same length as the original: preserve every clause and every detail, do not shorten or compress. Keep correct gender agreement. Never open a sentence with a stock transition: no علاوة على ذلك، بالإضافة إلى ذلك، وفي الختام، وأخيرًا، لذلك، وبالتالي، ونتيجة لذلك.`

/** True when the text contains Arabic script. */
export function isArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text)
}

/**
 * v6.17 target-length line (English only). Tested on gpt-6-luna in
 * rounds v6.16/v6.16b: T1 pooled 80.9% -> 91.8% (p=0.0021), markers 0,
 * meaning kept; T2 flat, no harm. Arabic is excluded — its length is
 * already near the vendor's (88.9% vs 92.8%) and the line was never
 * tested on Arabic. Appended LAST, exactly as the test runner did.
 */
export function lengthLine(wordCount: number): string {
  return `Aim for about the same number of words as the input — about ${wordCount} words.`
}

/** Full system instruction: v6 prompt + one tone line + one level line (+ Arabic line) (+ length line for English). */
export function buildSystemPrompt(tone: Tone, level: Level, arabic: boolean, wordCount?: number): string {
  const parts = [V6_PROMPT, TONE_LINES[tone], LEVEL_LINES[level]]
  if (arabic) parts.push(ARABIC_LINE)
  else if (wordCount !== undefined) parts.push(lengthLine(wordCount))
  return parts.join('\n\n')
}
