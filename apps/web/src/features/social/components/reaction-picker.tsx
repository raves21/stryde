import { REACTION_EMOJI_MAP, REACTION_EMOJIS, type ReactionEmoji } from '@stryde/shared'
import { SmilePlus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const LABELS: Record<ReactionEmoji, string> = {
  muscle: 'Strong',
  fire: 'Fire',
  clap: 'Clap',
  trophy: 'Trophy',
  grimace: 'Tough',
}

/** Small horizontal emoji picker; the selected one has an accent ring (UI_DESIGN.md §5.11). */
export function ReactionPicker({
  selected,
  onPick,
}: {
  selected: ReactionEmoji | null
  onPick: (emoji: ReactionEmoji) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" aria-label="React">
          <SmilePlus /> React
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-auto gap-1 p-2">
        {REACTION_EMOJIS.map((emoji) => (
          <Button
            key={emoji}
            variant="ghost"
            size="icon"
            aria-label={LABELS[emoji]}
            aria-pressed={selected === emoji}
            className={cn('text-2xl', selected === emoji && 'ring-2 ring-brand')}
            onClick={() => {
              onPick(emoji)
              setOpen(false)
            }}
          >
            {REACTION_EMOJI_MAP[emoji]}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
