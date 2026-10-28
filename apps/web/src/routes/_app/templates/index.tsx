import { createFileRoute, Link } from '@tanstack/react-router'
import { LayoutList, Plus } from 'lucide-react'
import { EmptyState } from '@/components/app/empty-state'
import { Screen } from '@/components/app/screen'
import { TopBar } from '@/components/app/top-bar'
import { Button } from '@/components/ui/button'
import { TemplateCard } from '@/features/templates/components/template-card'
import { useTemplateSummaries } from '@/features/templates/use-templates'

export const Route = createFileRoute('/_app/templates/')({
  component: TemplatesPage,
})

function TemplatesPage() {
  const templates = useTemplateSummaries()
  return (
    <Screen>
      <TopBar
        title="Templates"
        back
        actions={
          <Button variant="ghost" size="icon" aria-label="New template" asChild>
            <Link to="/templates/new">
              <Plus className="size-6" />
            </Link>
          </Button>
        }
      />
      {templates && templates.length === 0 ? (
        <EmptyState
          icon={LayoutList}
          title="No templates yet. Build your usual workouts once, then start them in one tap."
          action={
            <Button asChild>
              <Link to="/templates/new">
                <Plus /> New template
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {templates?.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      )}
    </Screen>
  )
}
