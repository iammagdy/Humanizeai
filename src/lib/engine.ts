/**
 * HumanizeAi engine — prompt layer.
 *
 * Ships the best arms from the experiment rounds (gate 9/17):
 * - English: T49 (v6.49, gpt-5.6-terra) — the v6.35 R prompt minus
 *   REPLACE_LINE, rule 7 ablated, plus the distilled lines L1/L5/L3/
 *   L4/L2; register + frame lines fire only for formal inputs
 *   (markers + formal words >= 2, as in run_openai_v6_49_test.py).
 *   Best EN arm: 3/7 detector passers.
 * - Arabic: AR58 (v6.58, terra) — the v6.55 one-sentence directive
 *   plus "Do not use any commas at all." Best AR arm: 6/7.
 *
 * Both prompts are used VERBATIM as the system instruction. Tone and
 * level only append one short line each (Standard/Balanced is what the
 * rounds tested; the other tone/level lines slot into the same place).
 *
 * Do not edit the prompt lines without re-testing — the T49/AR58
 * wordings are the tested artifacts (see files/api-test/
 * run_openai_v6_49_test.py and run_openai_v6_58_test.py).
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
  max: 'Level: Max — reword more wordily and with more variation; change sentence shapes and vocabulary while keeping the facts.',
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
 * Rule-7 ablation (v6.44, kept in T49 and AR58). Removes rule 7 from the
 * V6 base and renumbers the old rule 8 (Arabic) to 7 — exactly as the
 * test runners do. Throws loudly if the V6 text ever drifts, so a
 * broken base can never ship silently.
 */
const RULE7_TEXT = `7. Repeat simple words. Use lots of small connecting words (and, but, so, then, before, after, when). Repeat the same plain nouns and verbs instead of finding a new synonym each time. Humans repeat themselves; do not vary every word.`

function stripRule7(v6: string): string {
  if (!v6.includes(RULE7_TEXT)) {
    throw new Error('engine.ts: V6_PROMPT rule 7 text changed — T49/AR58 base cannot be built')
  }
  const out = v6.replace(RULE7_TEXT + '\n', '')
  if (!out.includes('8. For Arabic text')) {
    throw new Error('engine.ts: V6_PROMPT rule 8 (Arabic) not found — T49/AR58 base cannot be built')
  }
  return out.replace('8. For Arabic text', '7. For Arabic text')
}

/** V6 base shared by both shipped arms: rule 7 ablated. */
const V6_ABLATED = stripRule7(V6_PROMPT)

// ---------------------------------------------------------------------------
// T49 (English) — verbatim lines from run_openai_v6_49_test.py
// ---------------------------------------------------------------------------

const MERGE_LINE_S4 =
  'Merge at most one pair of adjacent sentences into a single sentence, keeping every fact and every clause — and keep at least 3 sentences when the input has 3 or more.'

const REGISTER_LINE_V2 =
  'Use at least 2 of these formal words somewhere inside your sentences (not at the start of a sentence): evident, essential, integral, rigorous, meticulous, scholarly, obvious, implementation, accordingly, increasingly, quite, necessitate, approach, utilize, opportunity. And join at least one pair of clauses with "that" or "which" instead of "and" or "so". Do not repeat plain words: use each of need, plan, use, work, and make at most once in the whole text — when you would repeat one of them, use a formal word from the list above instead (for example, "necessitate" instead of "need", "approach" instead of "plan", "utilize" instead of "use"). Prefer a formal word over a plain one whenever you have the choice.'

const LANDSCAPE_CLAUSE =
  "Do not keep the word 'landscape' from the input: replace it with 'area', 'field', or 'range' (for example, 'the intricate landscape of digital transformation' becomes 'the intricate area of digital transformation')."

const FRAME_LINE_R =
  'Open at least one sentence with one of these long impersonal frames: "It should be mentioned that", "It should be noted that", "There is no question that", "What is more important is that", "Another fact is that", "From this we understand that", "It has become evident that". Vary the frame you choose; do not always pick the first one in the list.'

const FRAME_CARVEOUT =
  'The long impersonal frames listed above are allowed as sentence openers; bare transition openers (Moreover, Furthermore, In addition, Besides, Therefore, Thus, Consequently, Finally, Also) are still banned.'

const MUST_BAN = "Do not use the word 'must'."

const L1_LINE =
  "Replace at least three quarters of the input's content words with different words. Keep only the words that name what the text is about — the topic nouns like thesis, citation, sources, students. Replace every descriptive and formal word from the input with a different word: intricate, robust, leverage, landscape, precise, demands, academic, careful, clear, process, structure, environment, and every adjective and adverb like them. Do not keep any adjective or adverb from the input word for word."

const L5_LINE =
  "When you replace a word, do not pick the most obvious synonym. Pick a slightly less common word that still fits exactly — for example, write 'advisers' instead of 'supervisors', 'a strong case' instead of 'a robust argument', 'takes a lot of steps' instead of 'is an intricate process'. A slightly surprising word choice is better than the smoothest one."

const L3_LINE =
  'At least two sentences must have a person or a group of people as the subject — students, researchers, teachers, advisers, supervisors, companies, readers — not a thing or an abstract idea.'

const L4_LINE =
  "If you open a sentence with a long impersonal frame, prefer 'Another fact is that' over the others, and use it in the middle of the text rather than the first sentence."

const L2_LINE =
  'Vary your sentence lengths sharply: make your longest sentence at least twice as long as your shortest sentence, and include at least one short sentence of 6 to 8 words.'

/** v6.30 marker list, verbatim from run_openai_v6_49_test.py. */
const MARKERS_EN = [
  'moreover', 'furthermore', 'in addition', 'however', 'therefore',
  'leverage', 'delve', 'intricacies', 'cutting-edge',
  'it is clear that', 'indispensable', 'pivotal', 'robust',
  'facilitate', 'in order to', "today's fast-paced",
  'a wide range of', 'landscape', 'seamless', 'tapestry',
  'ultimately', 'as a result', 'streamline', "in today's",
  'in conclusion', 'embrace', 'it is evident that',
]

/** Formal-word set, verbatim from analyze_v6_29.py. */
const FORMAL_EN = new Set(
  `utilization utilize implementation implement necessitate necessity
comprehensive crucial essential significant facilitate robust framework integration
seamless optimize optimization pivotal intricate intricacies indispensable dynamics
substantial considerable effectively efficiently notably particularly specifically
fundamentally predominantly consequently furthermore moreover additionally therefore
thus hence nevertheless nonetheless whereby wherein accordingly subsequently
ultimately primarily principally extensively increasingly critically vital paramount
imperative integral inherent profound sophisticated elaborate meticulous rigorous
systematic strategic operational organizational institutional professional academic
scholarly theoretical empirical analytical conceptual contextual structural
functional procedural methodological technological transformation transition evolution
paradigm phenomenon perspective dimension characteristic attribute capability
potential opportunity requirement objective outcome implication constraint barrier
solution approach technique strategy procedure phenomenon obvious evident clearly
certainly undoubtedly indeed quite definitely`.split(/\s+/),
)

function enTokens(text: string): string[] {
  return text.toLowerCase().match(/[a-zA-Z]+(?:'[a-z]+)?/g) ?? []
}

function countMarkersEn(text: string): number {
  const joined = ` ${enTokens(text).join(' ')} `
  let n = 0
  for (const m of MARKERS_EN) {
    const needle = ` ${m} `
    let idx = joined.indexOf(needle)
    while (idx !== -1) {
      n++
      idx = joined.indexOf(needle, idx + needle.length)
    }
  }
  return n
}

/**
 * Formal gating (§5.1 of the v6.35 design, as in run_openai_v6_49_test.py):
 * markers + formal words in the INPUT >= 2. Formal inputs get the
 * register + frame lines and the +8% length line; plain inputs do not.
 */
export function isFormalEnglish(text: string): boolean {
  const formalIn = enTokens(text).filter((w) => FORMAL_EN.has(w)).length
  return countMarkersEn(text) + formalIn >= 2
}

function lengthLinePlain(n: number): string {
  return `Aim for about the same number of words as the input — about ${n} words.`
}

function lengthLineFormal(n: number): string {
  return `Aim for a few more words than the input — about ${Math.round(n * 1.08)} words.`
}

// ---------------------------------------------------------------------------
// AR58 (Arabic) — verbatim lines from run_openai_v6_58_test.py
// ---------------------------------------------------------------------------

const MERGE_AR =
  'Write the whole text as ONE single sentence. Do not use any full stop except the final one. Join everything with commas and connecting words — keep the meaning of every clause.'

const NO_COMMA_LINE = 'Do not use any commas at all. Write the sentence without commas.'

function countWordsLocal(text: string): number {
  const trimmed = text.trim()
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length
}

/**
 * Full system instruction.
 *
 * English (T49): V6-ablated + tone + level + length line (formal-gated)
 * + MERGE_LINE_S4 [+ REGISTER_LINE_V2] + LANDSCAPE_CLAUSE [+ FRAME_LINE_R
 * + FRAME_CARVEOUT] + MUST_BAN + L1 + L5 + L3 + L4 + L2.
 * Arabic (AR58): V6-ablated + tone + level + ARABIC_LINE + MERGE_AR
 * + NO_COMMA_LINE. No length line, no merge line (as tested).
 *
 * The v6.24 D2 merge directive and the v6.17 lengthLine/mergeLine helpers
 * are gone — T49 replaces them (MERGE_LINE_S4) by design.
 */
export function buildSystemPrompt(tone: Tone, level: Level, arabic: boolean, input: string): string {
  if (arabic) {
    return [V6_ABLATED, TONE_LINES[tone], LEVEL_LINES[level], ARABIC_LINE, MERGE_AR, NO_COMMA_LINE].join('\n\n')
  }
  const formal = isFormalEnglish(input)
  const parts = [
    V6_ABLATED,
    TONE_LINES[tone],
    LEVEL_LINES[level],
    formal ? lengthLineFormal(countWordsLocal(input)) : lengthLinePlain(countWordsLocal(input)),
    MERGE_LINE_S4,
  ]
  if (formal) parts.push(REGISTER_LINE_V2)
  parts.push(LANDSCAPE_CLAUSE)
  if (formal) parts.push(FRAME_LINE_R, FRAME_CARVEOUT)
  parts.push(MUST_BAN, L1_LINE, L5_LINE, L3_LINE, L4_LINE, L2_LINE)
  return parts.join('\n\n')
}
