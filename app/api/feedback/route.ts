import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { query_id, question, answer, rating, comment, session_id } = await req.json()

  // Spara feedback
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

  // ── TUMME UPP → spara i library för granskning ──────────────────────────
  if (rating === 1 && question && answer) {
    try {
      // Extrahera källor från svaret (format: "Källor: IL 16:1, ML 8:9")
      const sourceLine = answer.split('\n').find((l: string) => l.toLowerCase().startsWith('källor:')) || ''
      const sources = sourceLine
        ? sourceLine.replace(/^källor:\s*/i, '').split(',').map((s: string) => s.trim()).filter(Boolean)
        : []

      // Extrahera risknivå
      const riskLine = answer.split('\n').find((l: string) => l.toLowerCase().startsWith('risk:')) || ''
      const riskLevel = riskLine.includes('HÖG') ? 'HÖG' : riskLine.includes('MEDEL') ? 'MEDEL' : 'LÅG'

      // Kolla om frågan redan finns i library
      const { data: existing } = await supabase
        .from('library')
        .select('id, use_count')
        .ilike('question', question.trim())
        .single()

      if (existing) {
        // Öka use_count
        await supabase
          .from('library')
          .update({ use_count: (existing.use_count || 0) + 1 })
          .eq('id', existing.id)
      } else {
        // Lägg till nytt svar i library — ej verifierat ännu
        await supabase.from('library').insert({
          question: question.trim(),
          answer,
          sources,
          risk_level: riskLevel,
          category: 'Övrigt', // Kategoriseras av reviewer
          lagrum: sources,
          verified_by: null,   // Väntar på manuell granskning
          notes: null,
          use_count: 1,
          active: false,       // Aktiveras av reviewer
        })
      }
    } catch (libErr) {
      console.error('Library insert error:', libErr)
      // Failar tyst — feedback är redan sparad
    }
  }

  // ── TUMME NED → skicka mail ───────────────────────────────────────────────
  if (rating === -1 && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'Normiq <hej@normiq.se>',
        to: 'hej@normiq.se',
        subject: '👎 Dåligt svar på Normiq',
        html: `
          <div style="font-family:Georgia,serif;max-width:600px;padding:32px;background:#F5F3EE">
            <div style="font-family:monospace;font-size:22px;font-weight:600;color:#0A0A0C;margin-bottom:20px">
              normi<span style="color:#C0321A">q</span> — Negativt feedback
            </div>
            <div style="background:white;border:1px solid #E0DDD6;border-radius:8px;padding:20px;margin-bottom:16px">
              <div style="font-family:monospace;font-size:10px;color:#AAA;text-transform:uppercase;margin-bottom:8px">Fråga</div>
              <div style="font-size:15px;color:#0A0A0C">${question}</div>
            </div>
            <div style="background:white;border:1px solid #E0DDD6;border-radius:8px;padding:20px">
              <div style="font-family:monospace;font-size:10px;color:#AAA;text-transform:uppercase;margin-bottom:8px">Svar (utdrag)</div>
              <div style="font-size:13px;color:#555;line-height:1.7">${answer?.slice(0, 600)}...</div>
            </div>
            ${comment ? `<div style="margin-top:16px;padding:14px;background:#FDF4F3;border-radius:6px;font-size:13px;color:#C0321A">${comment}</div>` : ''}
            <div style="margin-top:20px;font-family:monospace;font-size:10px;color:#CCC">
              Query ID: ${query_id || 'saknas'} · Session: ${session_id || 'anonym'}
            </div>
          </div>
        `,
      })
    } catch (emailErr) {
      console.error('Resend error:', emailErr)
    }
  }

  return Response.json({ ok: true })
}