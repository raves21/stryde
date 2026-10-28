import type { WeightUnit } from '@stryde/shared'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { updateSettings } from '@/db/repositories/settings'

export function UnitsStep({ initial, onDone }: { initial: WeightUnit; onDone: () => void }) {
  const [unit, setUnit] = useState<WeightUnit>(initial)

  async function next() {
    await updateSettings({ unit })
    onDone()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[28px] font-semibold leading-tight">Units</h1>
        <p className="text-muted-foreground">
          How do you count your plates? You can change this later.
        </p>
      </div>
      <ToggleGroup
        type="single"
        value={unit}
        onValueChange={(v) => {
          if (v === 'kg' || v === 'lb') setUnit(v)
        }}
        className="grid w-full grid-cols-2 gap-3"
        spacing={3}
        aria-label="Weight unit"
      >
        {(['kg', 'lb'] as const).map((u) => (
          <ToggleGroupItem
            key={u}
            value={u}
            className="h-28 rounded-xl bg-surface font-display text-4xl font-bold uppercase data-[state=on]:bg-brand-dim data-[state=on]:text-brand"
          >
            {u}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Button size="lg" onClick={next}>
        Continue
      </Button>
    </div>
  )
}
