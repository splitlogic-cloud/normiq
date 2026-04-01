import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import { updateSources, triggerSourceUpdate } from '@/inngest/update-sources'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [updateSources, triggerSourceUpdate],
})
