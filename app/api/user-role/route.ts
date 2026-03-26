import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ role: 'user' })

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  return NextResponse.json({ role: data?.role || 'user' })
}