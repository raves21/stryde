import type { SetRow, SetType, TargetKind } from '@stryde/shared'
import { Trash2 } from 'lucide-react'
import { BottomSheet } from '@/components/app/bottom-sheet'
import { NumberInput } from '@/components/app/number-input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { RepsTargetInput } from './reps-target-input'

const KIND_LABELS: Record<TargetKind, string> = { fixed: 'Reps', rir: 'RIR', failure: 'Failure' }

/** The target fields shared by planned (template) and logged (session) sets. */
export type SetTargets = Pick<
  SetRow,
  'setType' | 'targetKind' | 'targetReps' | 'targetRepsMax' | 'targetRir'
>

/** Set type, target kind, target reps/range and RIR, delete (UI_DESIGN.md §5.4, §5.8). */
export function SetOptionsSheet({
  set,
  timed,
  onOpenChange,
  onChange,
  onKindChange,
  onDelete,
}: {
  set: SetTargets | null
  timed: boolean
  onOpenChange: (open: boolean) => void
  onChange: (patch: Partial<Omit<SetTargets, 'targetKind'>>) => void
  /** Kind changes also touch other fields (e.g. a session set's actual RIR). */
  onKindChange: (kind: TargetKind) => void
  onDelete: () => void
}) {
  return (
    <BottomSheet open={set !== null} onOpenChange={onOpenChange} title="Set options">
      {set && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>Set type</Label>
            <ToggleGroup
              type="single"
              value={set.setType}
              onValueChange={(v) => v && onChange({ setType: v as SetType })}
              className="grid w-full grid-cols-2"
              spacing={2}
              aria-label="Set type"
            >
              <ToggleGroupItem
                value="warmup"
                className="h-12 bg-surface-2 data-[state=on]:bg-brand-dim data-[state=on]:text-brand"
              >
                Warm-up
              </ToggleGroupItem>
              <ToggleGroupItem
                value="working"
                className="h-12 bg-surface-2 data-[state=on]:bg-brand-dim data-[state=on]:text-brand"
              >
                Working
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          {!timed && (
            <>
              <div className="flex flex-col gap-2">
                <Label>Target</Label>
                <ToggleGroup
                  type="single"
                  value={set.targetKind}
                  onValueChange={(v) => v && onKindChange(v as TargetKind)}
                  className="grid w-full grid-cols-3"
                  spacing={2}
                  aria-label="Target kind"
                >
                  {(['fixed', 'rir', 'failure'] as const).map((k) => (
                    <ToggleGroupItem
                      key={k}
                      value={k}
                      className="h-12 bg-surface-2 data-[state=on]:bg-brand-dim data-[state=on]:text-brand"
                    >
                      {KIND_LABELS[k]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="target-reps">Target reps or range</Label>
                  <RepsTargetInput
                    aria-label="Target reps or range"
                    reps={set.targetReps}
                    repsMax={set.targetRepsMax}
                    onCommit={(targetReps, targetRepsMax) =>
                      onChange({ targetReps, targetRepsMax })
                    }
                  />
                </div>
                {set.targetKind === 'rir' && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="target-rir">Target RIR</Label>
                    <NumberInput
                      id="target-rir"
                      value={set.targetRir}
                      onValueChange={(v) => v !== null && v <= 10 && onChange({ targetRir: v })}
                    />
                  </div>
                )}
              </div>
            </>
          )}
          <Button variant="ghost" className="text-failure" onClick={onDelete}>
            <Trash2 /> Delete set
          </Button>
        </div>
      )}
    </BottomSheet>
  )
}
