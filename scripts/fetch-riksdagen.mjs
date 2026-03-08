import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { config } from 'dotenv'

config({ path: '.env.local' })

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const LAGAR = [
  { sfs: '1999:1229', namn: 'Inkomstskattelagen',     kortform: 'IL'  },
  { sfs: '2023:200',  namn: 'Mervärdesskattelagen',    kortform: 'ML'  },
  { sfs: '2011:1244', namn: 'Skatteförfarandelagen',   kortform: 'SFL' },
  { sfs: '1999:1078', namn: 'Bokföringslagen',         kortform: 'BFL' },
  { sfs: '2005:551',  namn: 'Aktiebolagslagen',        kortform: 'ABL' },
]

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function chunkText(text, maxLen = 800) {
  const chunks = []
  const sentences = text.split(/(?<=[.!?])\s+/)
  let current = ''

  for (const s of sentences) {
    const candidate = current ? current + ' ' + s : s
    if (candidate.length > maxLen && current.length > 100) {
      chunks.push(current.trim())
      current = s
    } else {
      current = candidate
    }
  }
  if (current.trim().length > 100) chunks.push(current.trim())
  return chunks
}

async function fetchText(lag) {
  const url = `https://rkrattsbaser.gov.se/sfst?bet=${lag.sfs}`
  console.log(`  Hämtar: ${url}`)

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Normiq/1.0' },
    signal: AbortSignal.timeout(30000)
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  const text = stripHtml(html)
  if (text.length < 500) throw new Error('För lite text')
  console.log(`  ✓ ${text.length} tecken hämtade`)
  return text
}

async function storeChunk(chunk, lag) {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: `${lag.kortform}: ${chunk}`.slice(0, 8000),
  })

  const { error } = await supabase.from('documents').insert({
    content: chunk,
    metadata: { ref: lag.kortform, lag: lag.namn, sfs: lag.sfs },
    embedding: res.data[0].embedding,
  })

  if (error) throw new Error(error.message)
}

async function processLag(lag) {
  console.log(`\n── ${lag.namn} (${lag.sfs}) ──`)

  let text
  try {
    text = await fetchText(lag)
  } catch (err) {
    console.log(`  ✗ Kunde inte hämta: ${err.message}`)
    return 0
  }

  const chunks = chunkText(text)
  console.log(`  ${chunks.length} chunks`)

  let ok = 0
  let fail = 0

  for (let i = 0; i < chunks.length; i++) {
    try {
      await storeChunk(chunks[i], lag)
      ok++
      process.stdout.write(`\r  ${i + 1}/${chunks.length} — ${ok} ok, ${fail} fel`)
      await sleep(250)
    } catch (err) {
      fail++
      if (fail <= 3) console.log(`\n  ! Chunk ${i}: ${err.message}`)
      await sleep(1000) // vänta längre vid fel
    }
  }

  console.log(`\n  ✓ Klar: ${ok} sparade, ${fail} misslyckades`)
  return ok
}

async function run() {
  console.log('═══════════════════════════════════')
  console.log('  Normiq — Regelindex import')
  console.log('═══════════════════════════════════\n')

  let total = 0

  for (const lag of LAGAR) {
    const n = await processLag(lag)
    total += n
    await sleep(2000)
  }

  console.log('\n═══════════════════════════════════')
  console.log(`  Totalt: ${total} chunks indexerade`)
  console.log('═══════════════════════════════════')
}

run().catch(err => {
  console.error('Kritiskt fel:', err.message)
  process.exit(1)
})