import { embedAndStore } from '@/lib/embed'

export async function POST(req: Request) {
  const { text, ref, rubrik, lag } = await req.json()

  if (!text || !ref || !rubrik || !lag) {
    return Response.json({ error: 'text, ref, rubrik och lag krävs' }, { status: 400 })
  }

  await embedAndStore(text, { ref, rubrik, lag })
  return Response.json({ success: true })
}