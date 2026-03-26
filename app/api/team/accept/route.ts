import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { token, user_id } = await req.json()
  if (!token || !user_id) return NextResponse.json({ error: 'Saknar token eller user_id' }, { status: 400 })

  // Hämta inbjudan
  const { data: invite } = await supabase
    .from('team_invites')
    .select('id, team_id, accepted_at')
    .eq('token', token)
    .single()

  if (!invite) return NextResponse.json({ error: 'Ogiltig token' }, { status: 404 })
  if (invite.accepted_at) return NextResponse.json({ error: 'Redan accepterad' }, { status: 400 })

  // Sätt team_id på användaren
  await supabase.from('profiles').update({ team_id: invite.team_id }).eq('id', user_id)

  // Markera inbjudan som accepterad
  await supabase.from('team_invites').update({ accepted_at: new Date().toISOString() }).eq('id', invite.id)

  return NextResponse.json({ ok: true })
}
