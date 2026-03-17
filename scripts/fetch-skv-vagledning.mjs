/**
 * Normiq — SKV Rättslig Vägledning Crawler
 * ==========================================
 * Kör: node scripts/fetch-skv-vagledning.mjs
 *
 * Crawlar www4.skatteverket.se/rattsligvagledning,
 * filtrerar på relevanta ämnen och indexerar i Supabase.
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { config } from 'dotenv'

config({ path: '.env.local' })

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const BASE_URL = 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.4'
const BASE_HOST = 'https://www4.skatteverket.se'
const DELAY_MS = 400

// Kategorisidor att crawla — hämtar alla undersidelänkar automatiskt
const KATEGORI_URLS = [
  'https://www4.skatteverket.se/rattsligvagledning/edition/2026.4/1225.html',   // Inkomstskatt
  'https://www4.skatteverket.se/rattsligvagledning/edition/2026.4/321516.html', // Mervärdesskatt
  'https://www4.skatteverket.se/rattsligvagledning/edition/2026.4/1221.html',   // Bokföring & redovisning
  'https://www4.skatteverket.se/rattsligvagledning/edition/2026.4/1232.html',   // Socialavgifter
]

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

// ── Extrahera alla avsnittslänkar från en kategorisida ────────────────────

async function getLinksFromPage(url) {
  const html = await fetchPage(url)
  if (!html) return []

  const seen = new Set()
  const links = []

  // Matcha alla interna avsnittslänkar
  const pattern = /href="([^"]*\/edition\/2026\.4\/\d+\.html[^"]*)"/g
  let m
  while ((m = pattern.exec(html)) !== null) {
    let href = m[1]
    if (!href.startsWith('http')) href = BASE_HOST + href
    // Ta bort query-parametrar
    href = href.split('?')[0]
    if (!seen.has(href)) {
      seen.add(href)
      links.push(href)
    }
  }

  // Matcha även relativa länkar med bara nummer
  const relPattern = /href="([^"]*\/\d+\.html)"/g
  while ((m = relPattern.exec(html)) !== null) {
    let href = m[1]
    if (!href.startsWith('http')) {
      if (href.startsWith('/')) href = BASE_HOST + href
      else href = BASE_URL + '/' + href.split('/').pop()
    }
    href = href.split('?')[0]
    if (href.includes('2026.4') && !seen.has(href)) {
      seen.add(href)
      links.push(href)
    }
  }

  return links
}

// ── Huvudloop ─────────────────────────────────────────────────────────────

async function crawlAndIndex() {
  // Steg 1: Samla alla avsnittslänkar från kategorisidorna
  log('Steg 1: Samlar avsnittslänkar från kategorisidor...')
  const allLinks = new Set()

  for (const katUrl of KATEGORI_URLS) {
    log(`  Crawlar: ${katUrl}`)
    const links = await getLinksFromPage(katUrl)
    log(`  → ${links.length} länkar hittade`)

    // För varje länk — crawla även den sidan för djupare länkar
    for (const link of links) {
      allLinks.add(link)
    }

    // Crawla en nivå djupare för varje kategorisida
    for (const link of links.slice(0, 50)) {
      const subLinks = await getLinksFromPage(link)
      for (const sl of subLinks) allLinks.add(sl)
      await sleep(150)
    }

    await sleep(500)
  }

  // Lägg alltid till kategorisidorna själva
  for (const url of KATEGORI_URLS) allLinks.add(url)

  log(`\nTotalt ${allLinks.size} unika avsnittssidor att analysera`)

  // Steg 2: Hämta, filtrera och indexera
  log('Steg 2: Hämtar och indexerar relevanta sidor...\n')

  let totalFetched = 0
  let totalRelevant = 0
  let totalIndexed = 0

  for (const url of allLinks) {
    const html = await fetchPage(url)
    await sleep(DELAY_MS)

    if (!html) continue
    totalFetched++

    const title = extractTitle(html) || url.split('/').pop()
    const text = stripHtml(html)

    if (text.length < 200) continue
    if (!isRelevant(text, title)) continue

    totalRelevant++
    process.stdout.write(`  ✓ ${title.slice(0, 60)}\n`)

    const n = await indexPage(url, title, text)
    totalIndexed += n
    await sleep(200)
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
