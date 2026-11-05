import { createFileRoute } from '@tanstack/react-router'
import { TemplateEditor } from '@/features/templates/components/template-editor'

// The editor in "new" mode: nothing is created until the first Save, so backing out
// leaves no empty template behind. The name field is active on open.
export const Route = createFileRoute('/_app/templates/new')({
  component: TemplateEditor,
})
