/**
 * Normiq — Förbättrad källindexering
 * ====================================
 * - Paragraf-aware chunkning (delar vid § istället för ordgräns)
 * - Bättre metadata per chunk (kapitel, paragrafnummer, lagnamn)
 * - Deduplikering via hash
 * - Stöd för IL, ML, BFL, SFL, ABL + SKV-vägledningar
 */

import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { createHash } from 'crypto'

dotenv.config({ path: '.env.local' })

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const BATCH_SIZE = 10
const DELAY_MS   = 200

// ── TYPER ─────────────────────────────────────────────────────────────────

interface Chunk {
  ref: string
  rubrik: string
  lag: string
  text: string
  kapitel?: string
  paragraf?: string
}

// ── HTML-RENSNING ─────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── PARAGRAF-AWARE CHUNKNING ──────────────────────────────────────────────
// Delar lagtext vid §-tecken så varje chunk är en komplett paragraf
// med omgivande kontext (kapitelrubrik + paragrafnummer)

function chunkByParagraph(text: string, kortnamn: string): Chunk[] {
  const chunks: Chunk[] = []
  const lines = text.split(/\n+/).map(l => l.trim()).filter(l => l.length > 5)

  let currentKapitel = ''
  let currentKapitelRubrik = ''
  let buffer = ''
  let currentParagraf = ''
  let chunkCount = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Kapitelrubrik: "1 kap." eller "Kapitel 1"
    const kapMatch = line.match(/^(\d+)\s+kap\.?\s*(.*)/i)
    if (kapMatch) {
      // Spara föregående buffer
      if (buffer.trim().length > 80 && currentParagraf) {
        chunks.push({
          ref: `${kortnamn} ${currentKapitel} ${currentParagraf}`.trim(),
          rubrik: currentKapitelRubrik || kortnamn,
          lag: kortnamn,
          kapitel: currentKapitel,
          paragraf: currentParagraf,
          text: `${currentKapitel} ${currentKapitelRubrik}\n\n${buffer.trim()}`,
        })
        chunkCount++
      }
      currentKapitel = `${kapMatch[1]} kap.`
      currentKapitelRubrik = kapMatch[2]?.replace(/[*_]+/g, '').trim() || ''
      buffer = ''
      currentParagraf = ''
      continue
    }

    // Paragrafstart: "1 §" eller "§ 1"
    const parMatch = line.match(/^(\d+)\s*§/) || line.match(/^§\s*(\d+)/)
    if (parMatch) {
      // Spara föregående paragraf som en chunk
      if (buffer.trim().length > 80 && currentParagraf) {
        chunks.push({
          ref: `${kortnamn} ${currentKapitel} ${currentParagraf}`.trim().replace(/\s+/g, ' '),
          rubrik: currentKapitelRubrik || kortnamn,
          lag: kortnamn,
          kapitel: currentKapitel,
          paragraf: currentParagraf,
          text: `[${kortnamn} ${currentKapitel} ${currentParagraf}] ${currentKapitelRubrik}\n\n${buffer.trim()}`,
        })
        chunkCount++
      }
      currentParagraf = `${parMatch[1]} §`
      buffer = line
      continue
    }

    // Lägg till i buffer
    if (currentParagraf) {
      buffer += ' ' + line
      // Om buffern blir för stor — dela den
      if (buffer.length > 2000) {
        chunks.push({
          ref: `${kortnamn} ${currentKapitel} ${currentParagraf}`.trim().replace(/\s+/g, ' '),
          rubrik: currentKapitelRubrik || kortnamn,
          lag: kortnamn,
          kapitel: currentKapitel,
          paragraf: currentParagraf,
          text: `[${kortnamn} ${currentKapitel} ${currentParagraf}] ${currentKapitelRubrik}\n\n${buffer.trim()}`,
        })
        chunkCount++
        buffer = ''
        currentParagraf = `${currentParagraf} (forts.)`
      }
    }
  }

  // Sista buffern
  if (buffer.trim().length > 80 && currentParagraf) {
    chunks.push({
      ref: `${kortnamn} ${currentKapitel} ${currentParagraf}`.trim().replace(/\s+/g, ' '),
      rubrik: currentKapitelRubrik || kortnamn,
      lag: kortnamn,
      kapitel: currentKapitel,
      paragraf: currentParagraf,
      text: `[${kortnamn} ${currentKapitel} ${currentParagraf}] ${currentKapitelRubrik}\n\n${buffer.trim()}`,
    })
  }

  // Om paragraf-parsing gav för få chunks — fall tillbaka på ord-chunkning
  if (chunks.length < 5) {
    return chunkByWords(text, kortnamn)
  }

  return chunks
}

// Fallback: ord-baserad chunkning för texter utan tydlig paragrafstruktur
function chunkByWords(text: string, ref: string, rubrik = '', lag = ''): Chunk[] {
  const CHUNK_SIZE = 500
  const OVERLAP    = 80
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: Chunk[] = []

  for (let i = 0; i < words.length; i += CHUNK_SIZE - OVERLAP) {
    const chunk = words.slice(i, i + CHUNK_SIZE).join(' ').trim()
    if (chunk.length > 80) {
      chunks.push({ ref, rubrik: rubrik || ref, lag: lag || ref, text: chunk })
    }
  }
  return chunks
}

// ── HÄMTA LAGTEXT ─────────────────────────────────────────────────────────

async function fetchLagtext(sfs: string): Promise<string> {
  const url = `https://rkrattsbaser.gov.se/sfst?bet=${sfs}`
  log(`  Hämtar ${url}...`)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Normiq/2.0 (normiq.se)' },
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    const text = stripHtml(html)
    if (text.length < 500) throw new Error('För lite text')
    log(`  ✓ ${text.length.toLocaleString()} tecken`)
    return text
  } catch (err) {
    log(`  ✗ ${err}`)
    return ''
  }
}

async function fetchUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Normiq/2.0 (normiq.se)',
        'Accept': 'text/html',
        'Accept-Language': 'sv-SE,sv;q=0.9',
      },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return ''
    return stripHtml(await res.text())
  } catch { return '' }
}

// ── EMBEDDING + LAGRING ───────────────────────────────────────────────────

async function embedAndStore(chunks: Chunk[]): Promise<number> {
  let saved = 0

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    try {
      const res = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch.map(c => c.text),
      })
      const rows = batch.map((chunk, j) => ({
        content: chunk.text,
        metadata: {
          ref:     chunk.ref,
          rubrik:  chunk.rubrik,
          lag:     chunk.lag,
          kapitel: chunk.kapitel || '',
          paragraf: chunk.paragraf || '',
        },
        embedding: res.data[j].embedding,
      }))
      const { error } = await supabase.from('documents').insert(rows)
      if (error) log(`  ! Insert error: ${error.message}`)
      else saved += batch.length
    } catch (err) {
      log(`  ! Embed error batch ${i}: ${err}`)
    }
    await sleep(DELAY_MS)
    process.stdout.write(`\r  ${i + batch.length}/${chunks.length} chunks...`)
  }
  process.stdout.write('\n')
  return saved
}

// ── INDEXERA EN LAG ───────────────────────────────────────────────────────

async function indexLag(sfs: string, kortnamn: string, lagnamn: string): Promise<number> {
  log(`\n── ${lagnamn} (${sfs}) ──`)

  // Kolla om redan indexerad med samma hash
  const text = await fetchLagtext(sfs)
  if (!text) return 0

  const hash = createHash('sha256').update(text.slice(0, 20000)).digest('hex').slice(0, 16)

  const { data: existing } = await supabase
    .from('source_versions')
    .select('content_hash')
    .eq('ref', kortnamn)
    .single()

  if (existing?.content_hash === hash) {
    log(`  ↷ Oförändrad sedan senaste indexering`)
    return 0
  }

  // Ta bort gamla chunks
  const { error: delError } = await supabase
    .from('documents')
    .delete()
    .eq('metadata->>lag', lagnamn)
  if (delError) log(`  ! Delete error: ${delError.message}`)

  // Chunka paragraf-aware
  const chunks = chunkByParagraph(text, kortnamn)
  log(`  ${chunks.length} paragrafer extraherade`)

  if (chunks.length === 0) {
    log(`  ✗ Inga chunks — hoppar över`)
    return 0
  }

  // Sätt lag-namn på alla chunks
  for (const c of chunks) { c.lag = lagnamn }

  const saved = await embedAndStore(chunks)
  log(`  ✓ ${saved} chunks sparade`)

  // Uppdatera version
  await supabase.from('source_versions').upsert({
    ref: kortnamn,
    content_hash: hash,
    url: `https://rkrattsbaser.gov.se/sfst?bet=${sfs}`,
    updated_at: new Date().toISOString(),
  })

  return saved
}

// ── INDEXERA SKV-SIDA ─────────────────────────────────────────────────────

async function indexSkvSida(url: string, ref: string, rubrik: string): Promise<number> {
  log(`\n── ${rubrik} ──`)
  log(`  URL: ${url}`)

  const text = await fetchUrl(url)
  if (!text || text.length < 200) {
    log(`  ✗ Ingen text hämtad`)
    return 0
  }

  const hash = createHash('sha256').update(text.slice(0, 10000)).digest('hex').slice(0, 16)

  const { data: existing } = await supabase
    .from('source_versions')
    .select('content_hash')
    .eq('ref', ref)
    .single()

  if (existing?.content_hash === hash) {
    log(`  ↷ Oförändrad`)
    return 0
  }

  // Ta bort gamla
  await supabase.from('documents').delete().eq('metadata->>ref', ref)

  const chunks = chunkByWords(text, ref, rubrik, 'Skatteverkets vägledning')
  log(`  ${chunks.length} chunks`)

  const saved = await embedAndStore(chunks)
  log(`  ✓ ${saved} chunks sparade`)

  await supabase.from('source_versions').upsert({
    ref,
    content_hash: hash,
    url,
    updated_at: new Date().toISOString(),
  })

  return saved
}

// ── LOGGING ───────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`)
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── SAMMANFATTNING ────────────────────────────────────────────────────────

async function printSummary() {
  const { data } = await supabase.from('documents').select('metadata')
  if (!data) return
  const counts: Record<string, number> = {}
  for (const row of data) {
    const lag = (row.metadata as { lag?: string })?.lag || 'Okänd'
    counts[lag] = (counts[lag] || 0) + 1
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  console.log('\n── Chunks per källa ──')
  for (const [lag, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${lag.padEnd(35)} ${count}`)
  }
  console.log(`  ${'Totalt'.padEnd(35)} ${total}`)
}

// ── MAIN ──────────────────────────────────────────────────────────────────

const LAGAR = [
  { sfs: '1999:1229', kortnamn: 'IL',  lagnamn: 'Inkomstskattelagen' },
  { sfs: '2023:200',  kortnamn: 'ML',  lagnamn: 'Mervärdesskattelagen' },
  { sfs: '2011:1244', kortnamn: 'SFL', lagnamn: 'Skatteförfarandelagen' },
  { sfs: '1999:1078', kortnamn: 'BFL', lagnamn: 'Bokföringslagen' },
  { sfs: '2005:551',  kortnamn: 'ABL', lagnamn: 'Aktiebolagslagen' },
]

const SKV_SIDOR = [
  { url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/1508.html', ref: 'SKV-representation',   rubrik: 'Representation' },
  { url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/1600.html', ref: 'SKV-traktamente',      rubrik: 'Traktamente' },
  { url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/1400.html', ref: 'SKV-personalformaner', rubrik: 'Personalförmåner' },
  { url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/3300.html', ref: 'SKV-utdelning-3-12',   rubrik: 'Utdelning fåmansföretag 3:12' },
  { url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/1100.html', ref: 'SKV-avdrag',           rubrik: 'Avdrag i näringsverksamhet' },
  { url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/2940.html', ref: 'SKV-moms-allmant',     rubrik: 'Moms — allmänt' },
  { url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/2941.html', ref: 'SKV-momssatser',       rubrik: 'Momssatser' },
]

async function main() {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║   Normiq — Källindexering v3.0           ║')
  console.log('║   Paragraf-aware chunkning               ║')
  console.log('╚══════════════════════════════════════════╝\n')

  if (!process.env.OPENAI_API_KEY)          throw new Error('OPENAI_API_KEY saknas')
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('NEXT_PUBLIC_SUPABASE_URL saknas')

  const args = process.argv.slice(2)
  const only = args.find(a => a.startsWith('--only='))?.split('=')[1]
  const force = args.includes('--force')

  // Rensa allt om --force
  if (force) {
    log('--force: rensar documents och source_versions...')
    await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('source_versions').delete().neq('ref', '__dummy__')
  }

  let total = 0

  for (const lag of LAGAR) {
    if (only && only !== lag.kortnamn.toLowerCase()) continue
    const n = await indexLag(lag.sfs, lag.kortnamn, lag.lagnamn)
    total += n
    await sleep(2000)
  }

  if (!only || only === 'skv') {
    for (const sida of SKV_SIDOR) {
      const n = await indexSkvSida(sida.url, sida.ref, sida.rubrik)
      total += n
      await sleep(1000)
    }
  }

  await printSummary()
  log(`\n✓ Klar — ${total} nya chunks indexerade`)
}

main().catch(err => {
  console.error('✗ Kritiskt fel:', err)
  process.exit(1)
})