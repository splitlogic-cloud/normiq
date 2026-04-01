import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return NextResponse.json({ error: 'Env-variabler saknas', url: !!url, key: !!key })
  }

  const supabase = createClient(url, key)

  // Testa skrivning
  const { error: writeError } = await supabase
    .from('source_versions')
    .upsert({ ref: 'TEST', content_hash: 'abc123', url: 'https://test.se', updated_at: new Date().toISOString() })

  if (writeError) {
    return NextResponse.json({ error: 'Skrivfel', details: writeError.message })
  }

  // Testa läsning
  const { data, error: readError } = await supabase
    .from('source_versions')
    .select('*')
    .eq('ref', 'TEST')
    .single()

  if (readError) {
    return NextResponse.json({ error: 'Läsfel', details: readError.message })
  }

  // Rensa testrad
  await supabase.from('source_versions').delete().eq('ref', 'TEST')

  return NextResponse.json({ ok: true, data })
}