import { createFileRoute } from '@tanstack/react-router'
import { SearchX } from 'lucide-react'
import { EmptyState } from '@/components/app/empty-state'
import { Screen } from '@/components/app/screen'
import { TopBar } from '@/components/app/top-bar'
import { TemplateEditor } from '@/features/templates/components/template-editor'
import { useTemplateTree } from '@/features/templates/use-templates'

export const Route = createFileRoute('/_app/templates/$id')({
  component: TemplatePage,
})

function TemplatePage() {
  const { id } = Route.useParams()
  const tree = useTemplateTree(id)
  if (tree === undefined) return null
  if (tree === null) {
    return (
      <Screen>
        <TopBar title="Template" back />
        <EmptyState icon={SearchX} title="This template doesn't exist or was deleted." />
      </Screen>
    )
  }
  // Keyed so switching templates (e.g. after Duplicate) resets the editor's local state.
  return <TemplateEditor key={id} tree={tree} />
}
