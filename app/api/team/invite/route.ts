import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Ej autentiserad' }, { status: 401 })

  const { emails } = await req.json()
  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'Inga e-postadresser angivna' }, { status: 400 })
  }

  // Hämta eller skapa team för denna ägare
  let { data: team } = await supabase
    .from('teams')
    .select('*')
    .eq('owner_id', userId)
    .single()

  if (!team) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    const { data: newTeam, error } = await supabase
      .from('teams')
      .insert({ owner_id: userId, name: profile?.full_name ? `${profile.full_name}s team` : 'Mitt team' })
      .select()
      .single()

    if (error || !newTeam) return NextResponse.json({ error: 'Kunde inte skapa team' }, { status: 500 })
    team = newTeam

    // Sätt team_id på ägaren
    await supabase.from('profiles').update({ team_id: team.id }).eq('id', userId)
  }

  // Kolla antal befintliga medlemmar
  const { count: memberCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', team.id)

  const results: { email: string; status: 'sent' | 'error'; error?: string }[] = []

  for (const email of emails.slice(0, 10)) {
    try {
      // Skapa invite-token
      const { data: invite, error: inviteError } = await supabase
        .from('team_invites')
        .insert({ team_id: team.id, email, invited_by: userId })
        .select()
        .single()

      if (inviteError || !invite) {
        results.push({ email, status: 'error', error: 'Kunde inte skapa inbjudan' })
        continue
      }

      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://normiq.se'}/invite?token=${invite.token}`

      // Skicka e-post via Resend
      await resend.emails.send({
        from: 'Normiq <hej@normiq.se>',
        to: email,
        subject: 'Du har bjudits in till Normiq',
        html: `
          <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 48px 32px; background: #F5F3EE;">
            <div style="font-family: 'DM Mono', monospace; font-size: 28px; font-weight: 600; color: #0A0A0C; margin-bottom: 32px;">
              normi<span style="color: #C0321A;">q</span>
            </div>
            <h1 style="font-size: 28px; color: #0A0A0C; margin-bottom: 16px; line-height: 1.2;">
              Du har bjudits in till ${team.name}
            </h1>
            <p style="font-size: 15px; color: #555; line-height: 1.8; margin-bottom: 32px;">
              Du har fått en inbjudan att gå med i ett team på Normiq — ett AI-verktyg för svenska skatte- och redovisningsregler med källhänvisning.
            </p>
            <a href="${inviteUrl}" style="display: inline-block; background: #0A0A0C; color: white; font-family: monospace; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; padding: 14px 28px; border-radius: 3px; text-decoration: none;">
              Acceptera inbjudan →
            </a>
            <p style="font-size: 12px; color: #AAA; margin-top: 32px; line-height: 1.7;">
              Länken är personlig och gäller för ${email}.<br/>
              Konsultera alltid en skatteexpert för slutliga beslut.
            </p>
          </div>
        `,
      })

      results.push({ email, status: 'sent' })
    } catch (err) {
      results.push({ email, status: 'error', error: 'Kunde inte skicka e-post' })
    }
  }

  const overLimit = (memberCount ?? 0) >= team.max_members
  return NextResponse.json({ results, overLimit, memberCount })
}
