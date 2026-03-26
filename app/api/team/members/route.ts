import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Ej autentiserad' }, { status: 401 })

  // Hämta team som ägs av användaren
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', userId)
    .single()

  if (!team) return NextResponse.json({ members: [], invites: [] })

  // Hämta medlemmar
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('team_id', team.id)

  // Hämta e-poster från auth.users via service role
  const members = []
  for (const profile of profiles || []) {
    const { data: { user } } = await supabase.auth.admin.getUserById(profile.id)
    if (user) {
      members.push({
        id: profile.id,
        full_name: user.user_metadata?.full_name || null,
        email: user.email || '',
        role: profile.role,
      })
    }
  }

  // Hämta inbjudningar
  const { data: invites } = await supabase
    .from('team_invites')
    .select('id, email, created_at, accepted_at')
    .eq('team_id', team.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ members, invites: invites || [] })
}
