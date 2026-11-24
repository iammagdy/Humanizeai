import { useEffect, useState } from 'react'
import { DirectionProvider } from '@base-ui/react/direction-provider'
import { countWords, humanizeText } from './lib/openai'
import { isArabic, LEVELS, TONES, type Level, type Tone } from './lib/engine'
import {
  addSessionUsed,
  getSessionRemaining,
  getSessionUsed,
  MAX_WORDS_PER_REQUEST,
  SESSION_WORD_BUDGET,
} from './lib/limits'
import { getApiKey } from './lib/settings'
import { STRINGS, type UiLang } from './lib/i18n'
import { ToneSelect } from './components/ToneSelect'
import { SettingsDialog } from './components/SettingsDialog'

const LANG_KEY = 'humanizeai-ui-lang'

function loadLang(): UiLang {
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ar'
  } catch {
    return 'ar'
  }
}

export default function App() {
  const [lang, setLang] = useState<UiLang>(loadLang)
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [tone, setTone] = useState<Tone>('standard')
  const [level, setLevel] = useState<Level>('balanced')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [regenerated, setRegenerated] = useState(false)
  const [copied, setCopied] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hasKey, setHasKey] = useState(() => getApiKey() !== '')
  const [sessionUsed, setSessionUsed] = useState(() => getSessionUsed())

  const t = STRINGS[lang]
  const inputWords = countWords(input)
  const outputWords = countWords(output)
  const overRequestLimit = inputWords > MAX_WORDS_PER_REQUEST

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    try {
      localStorage.setItem(LANG_KEY, lang)
    } catch {
      /* ignore */
    }
  }, [lang])

  async function handleHumanize() {
    setError('')
    setRegenerated(false)
    if (!input.trim()) {
      setError(t.emptyInput)
      return
    }
    if (overRequestLimit) {
      setError(t.limitRequest)
      return
    }
    if (getSessionRemaining() < inputWords) {
      setError(t.limitSession)
      return
    }
    const key = getApiKey()
    if (!key) {
      setSettingsOpen(true)
      return
    }
    setBusy(true)
    try {
      const result = await humanizeText(key, input.trim(), tone, level, isArabic(input))
      setOutput(result.text)
      setRegenerated(result.regenerated)
      setSessionUsed(addSessionUsed(inputWords))
    } catch (e) {
      setError(t.errorPrefix + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }

  async function handleCopy() {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = output
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  function handleDownload() {
    if (!output) return
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'humanizeai.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const toneOptions = TONES.map((value) => ({
    value,
    label:
      value === 'standard'
        ? t.toneStandard
        : value === 'academic'
          ? t.toneAcademic
          : value === 'simple'
            ? t.toneSimple
            : value === 'formal'
              ? t.toneFormal
              : t.toneFlowing,
  }))

  const levelOptions = LEVELS.map((value) => ({
    value,
    label:
      value === 'quality' ? t.levelQuality : value === 'balanced' ? t.levelBalanced : t.levelMax,
    hint:
      value === 'quality'
        ? t.levelQualityHint
        : value === 'balanced'
          ? t.levelBalancedHint
          : t.levelMaxHint,
  }))

  return (
    <DirectionProvider direction={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border bg-card/70">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
                H
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight tracking-tight">
                  Humanize<span className="text-accent">Ai</span>
                </h1>
                <p className="text-xs text-muted-foreground">{t.tagline}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex overflow-hidden rounded-lg border border-border text-sm font-medium">
                <button
                  type="button"
                  onClick={() => setLang('ar')}
                  className={`px-3 py-2 ${lang === 'ar' ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'}`}
                >
                  عربي
                </button>
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`px-3 py-2 ${lang === 'en' ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'}`}
                >
                  EN
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label={t.settingsTitle}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-lg hover:bg-muted"
              >
                ⚙
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          {!hasKey && (
            <div className="mb-5 rounded-xl border border-accent/50 bg-accent/10 p-4">
              <p className="font-semibold">{t.noKeyTitle}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.noKeyBody}</p>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="mt-3 h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                {t.openSettings}
              </button>
            </div>
          )}

          {/* Controls */}
          <div className="mb-5 grid gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:grid-cols-[1fr_2fr]">
            <ToneSelect value={tone} onChange={setTone} options={toneOptions} label={t.toneLabel} />
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t.levelLabel}</span>
              <div className="grid h-11 grid-cols-3 overflow-hidden rounded-lg border border-input">
                {levelOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLevel(opt.value)}
                    className={`flex flex-col items-center justify-center px-2 leading-tight ${
                      level === opt.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card hover:bg-muted'
                    }`}
                  >
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span
                      className={`text-[11px] ${level === opt.value ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}
                    >
                      {opt.hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Two-pane editor */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="flex flex-col rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <label htmlFor="input-text" className="text-sm font-semibold">
                  {t.inputLabel}
                </label>
                <span
                  className={`text-xs tabular-nums ${overRequestLimit ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}
                >
                  {inputWords} / {MAX_WORDS_PER_REQUEST} {t.words}
                </span>
              </div>
              <textarea
                id="input-text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t.inputPlaceholder}
                rows={14}
                className="min-h-72 w-full flex-1 resize-y bg-transparent px-4 py-3 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground"
              />
              <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  {t.sessionUsed}: {sessionUsed} / {SESSION_WORD_BUDGET} · {getSessionRemaining()}{' '}
                  {t.sessionRemaining}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setInput('')
                    setOutput('')
                    setError('')
                    setRegenerated(false)
                  }}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  {t.clear}
                </button>
              </div>
            </section>

            <section className="flex flex-col rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="text-sm font-semibold">{t.outputLabel}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {outputWords} {t.words}
                </span>
              </div>
              <div className="min-h-72 flex-1 px-4 py-3">
                {output ? (
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{output}</p>
                ) : (
                  <p className="text-[15px] leading-relaxed text-muted-foreground">
                    {t.outputPlaceholder}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!output}
                  className="h-10 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-40"
                >
                  {t.download}
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!output}
                  className="h-10 rounded-lg bg-secondary px-4 text-sm font-semibold text-secondary-foreground hover:opacity-90 disabled:opacity-40"
                >
                  {copied ? `${t.copied} ✓` : t.copy}
                </button>
              </div>
            </section>
          </div>

          {/* Action + feedback */}
          <div className="mt-5 flex flex-col items-stretch gap-3 sm:items-center">
            <button
              type="button"
              onClick={handleHumanize}
              disabled={busy || !input.trim()}
              className="h-12 w-full rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-md transition-opacity hover:opacity-90 disabled:opacity-40 sm:w-72"
            >
              {busy ? t.humanizing : t.humanize}
            </button>
            {regenerated && output && (
              <p className="max-w-xl text-center text-sm text-muted-foreground">
                ↻ {t.regeneratedNote}
              </p>
            )}
            {error && (
              <p className="w-full max-w-xl rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <footer className="mt-8 border-t border-border pt-4 text-center text-xs leading-relaxed text-muted-foreground">
            {t.footer}
          </footer>
        </main>

        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          t={t}
          onKeyChange={() => setHasKey(getApiKey() !== '')}
        />
      </div>
    </DirectionProvider>
  )
}
