import { createFileRoute, redirect } from '@tanstack/react-router'
import { createTemplate } from '@/db/repositories/templates'

// Creates an empty template and opens the editor (which autosaves), replacing this
// entry in history so Back returns to where the user came from.
export const Route = createFileRoute('/_app/templates/new')({
  beforeLoad: async () => {
    const template = await createTemplate({ name: 'New template' })
    throw redirect({ to: '/templates/$id', params: { id: template.id }, replace: true })
  },
})
