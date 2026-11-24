import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { clearApiKey, getApiKey, GEMINI_KEY_URL, setApiKey } from '../lib/settings'
import type { Strings } from '../lib/i18n'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  t: Strings
  onKeyChange: () => void
}

/** API-key settings — Base UI Dialog. The key lives in localStorage only. */
export function SettingsDialog({ open, onOpenChange, t, onKeyChange }: SettingsDialogProps) {
  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState(false)
  const hasKey = getApiKey() !== ''

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft('')
      setSaved(false)
    }
    onOpenChange(next)
  }

  function handleSave() {
    setApiKey(draft)
    setSaved(true)
    onKeyChange()
  }

  function handleRemove() {
    clearApiKey()
    setDraft('')
    setSaved(false)
    onKeyChange()
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl">
          <Dialog.Title className="text-lg font-semibold">{t.settingsTitle}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t.settingsBody}
          </Dialog.Description>

          <div className="mt-5 flex flex-col gap-1.5">
            <label htmlFor="gemini-key" className="text-sm font-medium">
              {t.apiKeyLabel}
            </label>
            <input
              id="gemini-key"
              type="password"
              autoComplete="off"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setSaved(false)
              }}
              placeholder={hasKey ? '••••••••••••••••' : t.apiKeyPlaceholder}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">{t.keySavedNote}</p>
          </div>

          <a
            href={GEMINI_KEY_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-4"
          >
            {t.getKey} ↗
          </a>

          <div className="mt-6 flex items-center justify-between gap-2">
            {hasKey ? (
              <button
                type="button"
                onClick={handleRemove}
                className="rounded-lg px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                {t.removeKey}
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              {saved && <span className="text-sm text-primary">{t.saved} ✓</span>}
              <Dialog.Close className="h-10 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">
                ✕
              </Dialog.Close>
              <button
                type="button"
                onClick={handleSave}
                disabled={!draft.trim()}
                className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
              >
                {t.save}
              </button>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
