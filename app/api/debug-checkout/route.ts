import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, stripe_customer_id')
    .eq('id', userId)
    .single()

  return NextResponse.json({
    userId,
    profile,
    error: error?.message,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    keyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 10),
  })
}