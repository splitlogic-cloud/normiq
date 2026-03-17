/**
 * Normiq — SKV Rättslig Vägledning Crawler
 * ==========================================
 * Kör: node scripts/fetch-skv-vagledning.mjs
 *
 * Crawlar www4.skatteverket.se/rattsligvagledning,
 * filtrerar på relevanta ämnen och indexerar i Supabase.
 */
process.on('uncaughtException', err => { console.error('FEL:', err.message, err.stack); process.exit(1) })
process.on('unhandledRejection', err => { console.error('FEL:', err); process.exit(1) })

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { config } from 'dotenv'

config({ path: '.env.local' })

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const BASE_URL = 'https://www4.skatteverket.se/rattsligvagledning/edition/2026'
const DELAY_MS = 400

// ── Nyckelord som avgör om en sida är relevant ────────────────────────────
const RELEVANTA_NYCKELORD = [
  // Skatt — företag
  'representation', 'traktamente', 'milersättning', 'resetraktamente',
  'fåmansföretag', 'fåmansbolag', '3:12', 'kvalificerad andel', 'gränsbelopp',
  'utdelning', 'lönebaserat utrymme', 'förenklingsregeln', 'huvudregeln',
  'bilförmån', 'förmånsvärde', 'tjänstebil', 'förmånsbil',
  'friskvård', 'personalvård', 'personalförmån', 'naturaförmån',
  'arbetsgivaravgift', 'egenavgift', 'f-skatt', 'preliminärskatt',
  'rot-avdrag', 'rut-avdrag', 'rotavdrag', 'rutavdrag',
  'hemkontor', 'arbetsrum', 'dubbel bosättning',
  'kapitalvinst', 'kapitalförlust', 'uppskov',
  'ränteavdrag', 'ränteutgifter',
  'koncernbidrag', 'underprisöverlåtelse',
  'generationsskifte', 'omstrukturering',
  // Moms
  'avdragsrätt moms', 'ingående moms', 'utgående moms',
  'omvänd skattskyldighet', 'frivillig skattskyldighet',
  'omsättningsgräns', 'momsregistrering',
  'fakturakrav', 'förenklad faktura',
  'jämkning', 'blandad verksamhet',
  'export moms', 'import moms',
  // Bokföring & redovisning
  'avskrivning', 'inventarier', 'maskiner',
  'inkurans', 'lagervärdering',
  'periodisering', 'upplupna kostnader', 'förutbetalda',
  'kundförlust', 'osäkra kundfordringar',
  'bokslutsdispositioner', 'obeskattade reserver',
  'periodiseringsfond', 'expansionsfond',
  'k2', 'k3', 'årsredovisning',
  // Lön & anställda
  'lön', 'löneväxling', 'förmåner anställda',
  'traktamente utrikes', 'utlandstraktamente',
  'skattefri ersättning', 'skattepliktig förmån',
]

// ── Hjälpfunktioner ───────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function log(msg) {
  process.stdout.write(`[${new Date().toISOString().slice(11,19)}] ${msg}\n`)
}

function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function extractTitle(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!m) return ''
  return stripHtml(m[1]).replace(/\s*[-–|].*$/, '').trim()
}

function isRelevant(text, title) {
  const haystack = (title + ' ' + text).toLowerCase()
  return RELEVANTA_NYCKELORD.some(kw => haystack.includes(kw.toLowerCase()))
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

// ── Hämta sida ────────────────────────────────────────────────────────────

async function fetchPage(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Normiq/1.0; +https://normiq.se)',
        'Accept': 'text/html',
        'Accept-Language': 'sv-SE,sv;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

// ── Extrahera alla avsnittslänkar från startsidan ─────────────────────────

async function getAllLinks() {
  log('Hämtar navigationsstruktur...')
  const html = await fetchPage(BASE_URL)
  if (!html) throw new Error('Kunde inte hämta startsidan')

  // Extrahera alla interna länkar med avsnittsnummer
  const linkPattern = /href="[^"]*\/(\d+)\.html"/g
  const seen = new Set()
  const links = []
  let m

  while ((m = linkPattern.exec(html)) !== null) {
    const id = m[1]
    if (!seen.has(id)) {
      seen.add(id)
      links.push(`${BASE_URL}/${id}.html`)
    }
  }

  // Prova även att hämta fler sidor från innehållsförteckning
  const tocPattern = /href="([^"]*edition\/2026\/\d+\.html)"/g
  while ((m = tocPattern.exec(html)) !== null) {
    const url = m[1].startsWith('http') ? m[1] : `https://www4.skatteverket.se${m[1]}`
    const id = url.match(/(\d+)\.html/)?.[1]
    if (id && !seen.has(id)) {
      seen.add(id)
      links.push(`${BASE_URL}/${id}.html`)
    }
  }

  log(`  → ${links.length} unika avsnittslänkar hittade på startsidan`)

  // Om för få — crawla en bredare range av kända avsnittsnummer
  if (links.length < 50) {
    log('  Utökar med känd nummerrange...')
    // SKV rättslig vägledning 2026 har avsnitt i range ~100–9999
    for (let i = 100; i <= 9999; i += 1) {
      seen.add(String(i))
    }
    // Men vi provar bara specifika kända avsnitt + de vi hittat
  }

  return [...seen].map(id => `${BASE_URL}/${id}.html`)
}

// ── Indexera en sida ──────────────────────────────────────────────────────

async function indexPage(url, title, text) {
  const chunks = chunkText(text)
  if (chunks.length === 0) return 0

  // Ta bort gamla versionen
  await supabase
    .from('documents')
    .delete()
    .eq('metadata->>url', url)

  let saved = 0
  for (let i = 0; i < chunks.length; i += 5) {
    const batch = chunks.slice(i, i + 5)
    try {
      const embedRes = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch.map(c => `${title}: ${c}`.slice(0, 8000)),
      })
      const rows = batch.map((content, j) => ({
        content,
        metadata: {
          ref: `SKV RV — ${title.slice(0, 60)}`,
          rubrik: title,
          lag: 'Skatteverkets vägledning',
          url,
          uppdaterad: new Date().toISOString().slice(0, 10),
        },
        embedding: embedRes.data[j].embedding,
      }))
      const { error } = await supabase.from('documents').insert(rows)
      if (!error) saved += batch.length
      await sleep(200)
    } catch (err) {
      log(`  ! Embed-fel: ${err.message}`)
    }
  }
  return saved
}

// ── Huvudloop ─────────────────────────────────────────────────────────────

async function crawlAndIndex() {
  // Kända relevanta avsnittsnummer från SKV RV 2026
  // (hämtade manuellt — täcker de viktigaste ämnena)
  const KANDA_AVSNITT = [
    // Representation
    '2803', '2804', '2805', '2806', '2807', '2808',
    // Traktamente & resor
    '2820', '2821', '2822', '2823', '2824', '2825', '2826', '2827', '2828',
    // Förmåner
    '2840', '2841', '2842', '2843', '2844', '2845', '2846', '2847', '2848',
    // Bilförmån
    '2850', '2851', '2852', '2853', '2854',
    // Friskvård
    '2860', '2861',
    // Moms — avdragsrätt
    '3050', '3051', '3052', '3053', '3054', '3055', '3056', '3057', '3058', '3059',
    '3060', '3061', '3062', '3063', '3064', '3065',
    // Moms — faktura
    '3100', '3101', '3102', '3103', '3104', '3105',
    // Fåmansföretag / 3:12
    '4200', '4201', '4202', '4203', '4204', '4205', '4206', '4207', '4208', '4209',
    '4210', '4211', '4212', '4213', '4214', '4215',
    // Avskrivningar / inventarier
    '3500', '3501', '3502', '3503', '3504', '3505',
    // Periodiseringsfond / expansionsfond
    '3600', '3601', '3602', '3603', '3604',
    // Lön / arbetsgivaravgifter
    '2900', '2901', '2902', '2903', '2904',
    // Kapitalvinst
    '4000', '4001', '4002', '4003', '4004',
    // ROT/RUT
    '2700', '2701', '2702', '2703',
    // Bokföring / redovisning
    '1700', '1701', '1702', '1703', '1704',
  ]

  log(`\nFörförsök: ${KANDA_AVSNITT.length} kända avsnitt...`)

  let totalIndexed = 0
  let totalRelevant = 0
  let totalFetched = 0
  const failedIds = []

  // Fas 1: Prova kända avsnitt
  for (const id of KANDA_AVSNITT) {
    const url = `${BASE_URL}/${id}.html`
    const html = await fetchPage(url)
    await sleep(DELAY_MS)

    if (!html) { failedIds.push(id); continue }

    const title = extractTitle(html) || `SKV avsnitt ${id}`
    const text = stripHtml(html)
    totalFetched++

    if (!isRelevant(text, title)) continue
    totalRelevant++

    process.stdout.write(`  ✓ ${id} — ${title.slice(0, 50)}\n`)
    const n = await indexPage(url, title, text)
    totalIndexed += n
  }

  // Fas 2: Crawla startsidan för ytterligare länkar
  log('\nFas 2: Crawlar navigationsstruktur...')
  const html = await fetchPage(BASE_URL)
  if (html) {
    const seen = new Set(KANDA_AVSNITT)
    const pattern = /href="[^"]*\/(\d+)\.html"/g
    let m
    const extraIds = []

    while ((m = pattern.exec(html)) !== null) {
      if (!seen.has(m[1])) {
        seen.add(m[1])
        extraIds.push(m[1])
      }
    }

    log(`  → ${extraIds.length} ytterligare avsnitt att prova`)

    for (const id of extraIds) {
      const url = `${BASE_URL}/${id}.html`
      const pageHtml = await fetchPage(url)
      await sleep(DELAY_MS)

      if (!pageHtml) continue

      const title = extractTitle(pageHtml) || `SKV avsnitt ${id}`
      const text = stripHtml(pageHtml)
      totalFetched++

      if (!isRelevant(text, title)) continue
      totalRelevant++

      process.stdout.write(`  ✓ ${id} — ${title.slice(0, 50)}\n`)
      const n = await indexPage(url, title, text)
      totalIndexed += n
      await sleep(200)
    }
  }

  return { totalFetched, totalRelevant, totalIndexed }
}

// ── Sammanfattning ────────────────────────────────────────────────────────

async function printSummary() {
  const { data } = await supabase
    .from('documents')
    .select('metadata')
    .eq('metadata->>lag', 'Skatteverkets vägledning')

  const count = data?.length || 0
  log(`\nSKV-chunks i databasen: ${count}`)
}

// ── Main ──────────────────────────────────────────────────────────────────

async function run() {
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║  Normiq — SKV Rättslig Vägledning Crawler   ║')
  console.log('╚══════════════════════════════════════════════╝\n')

  if (!process.env.OPENAI_API_KEY) {
    console.error('✗ OPENAI_API_KEY saknas i .env.local')
    process.exit(1)
  }

  const { totalFetched, totalRelevant, totalIndexed } = await crawlAndIndex()

  console.log('\n╔══════════════════════════════════════════════╗')
  console.log(`║  Hämtade sidor:   ${String(totalFetched).padEnd(26)} ║`)
  console.log(`║  Relevanta:       ${String(totalRelevant).padEnd(26)} ║`)
  console.log(`║  Chunks sparade:  ${String(totalIndexed).padEnd(26)} ║`)
  console.log('╚══════════════════════════════════════════════╝')

  await printSummary()

  if (totalIndexed === 0) {
    console.log('\n⚠  Inga chunks indexerades.')
    console.log('   Avsnittsnumren kan ha ändrats i 2026-utgåvan.')
    console.log('   Öppna en SKV-sida manuellt och kolla numret i URL:en,')
    console.log('   uppdatera sedan KANDA_AVSNITT i skriptet.')
  }
}

run().catch(err => {
  console.error('\n✗ Kritiskt fel:', err.message)
  process.exit(1)
})
