import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  const { query_id, question, answer, rating, comment, session_id } = await req.json()

  const { error } = await supabase.from('feedback').insert({
    query_id,
    question,
    answer,
    rating,
    comment,
    session_id,
  })

  if (error) return Response.json({ error }, { status: 500 })
  return Response.json({ ok: true })
}