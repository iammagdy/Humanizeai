import { Select } from '@base-ui/react/select'
import type { Tone } from '../lib/engine'

interface ToneOption {
  value: Tone
  label: string
}

interface ToneSelectProps {
  value: Tone
  onChange: (value: Tone) => void
  options: ToneOption[]
  label: string
}

/** Accessible tone picker — Base UI Select on shadcn tokens. */
export function ToneSelect({ value, onChange, options, label }: ToneSelectProps) {
  const selectedLabel = options.find((o) => o.value === value)?.label ?? value
  return (
    <div className="flex flex-col gap-1.5">
      <label id="tone-label" className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Select.Root value={value} onValueChange={(v) => onChange(v as Tone)}>
        <Select.Trigger
          aria-labelledby="tone-label"
          className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-sm transition-colors hover:border-ring data-[open]:border-ring"
        >
          <span>{selectedLabel}</span>
          <Select.Icon className="text-muted-foreground">▾</Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner sideOffset={6} className="z-50 outline-none">
            <Select.Popup className="w-[var(--anchor-width)] min-w-44 overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
              {options.map((opt) => (
                <Select.Item
                  key={opt.value}
                  value={opt.value}
                  className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted"
                >
                  <Select.ItemText>{opt.label}</Select.ItemText>
                  <Select.ItemIndicator className="text-primary">✓</Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  )
}
