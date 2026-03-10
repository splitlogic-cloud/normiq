import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  const { query_id, question, answer, rating, comment, session_id } = await req.json()

  const { error } = await supabase.from('feedback').insert({
    query_id: query_id || null,
    question,
    answer,
    rating,
    comment: comment || null,
    session_id,
  })

  if (error) {
    console.error('Feedback insert error:', JSON.stringify(error))
    return Response.json({ error: error.message }, { status: 500 })
  }

  if (rating === -1 && process.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'noreply@normiq.se',
          to: 'hej@normiq.se',
          subject: '👎 Dåligt svar på Normiq',
          html: `<p><strong>Fråga:</strong> ${question}</p><p><strong>Svar:</strong><br/>${answer?.slice(0, 500)}...</p>`,
        }),
      })
    } catch (emailErr) {
      console.error('Resend error:', emailErr)
      // Failar tyst — insert är redan klar
    }
  }

  return Response.json({ ok: true })
}