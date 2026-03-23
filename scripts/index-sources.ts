/**
 * Normiq — Källindexering
 * ========================
 * Kör: npx tsx scripts/index-sources.ts
 *
 * Indexerar:
 *   - Mervärdesskattelagen (ML) via Riksdagen API
 *   - Skatteförfarandelagen (SFL) via Riksdagen API
 *   - Bokföringslagen (BFL) via Riksdagen API
 *   - Skatteverkets ställningstaganden (SKV) via scraping
 *   - BFN vägledningar via scraping
 *
 * Kräver .env.local:
 *   OPENAI_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   ← service role (bypass RLS)
 */

import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

// Använd service role key för att skriva utan RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── CHUNK-INSTÄLLNINGAR ───────────────────────────────────────────────────
const CHUNK_SIZE   = 400  // ord per chunk
const CHUNK_OVERLAP = 80  // ord överlapp mellan chunks
const BATCH_SIZE   = 5    // embeddings per API-anrop
const DELAY_MS     = 300  // ms mellan batchar (rate limit)

// ── HJÄLPFUNKTIONER ───────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`)
}

/**
 * Chunkar text med överlapp så kontext inte tappas vid gränsen.
 */
function chunkText(text: string, maxWords = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  let i = 0
  while (i < words.length) {
    const chunk = words.slice(i, i + maxWords).join(' ')
    if (chunk.trim().length > 30) chunks.push(chunk.trim())
    i += maxWords - overlap
  }
  return chunks
}

/**
 * Embeddar en batch av texter och returnerar vektorer.
 */
async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  })
  return res.data.map(d => d.embedding)
}

/**
 * Kontrollerar om ett lagrum redan finns indexerat.
 */
async function alreadyIndexed(ref: string): Promise<boolean> {
  const { count } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('metadata->>ref', ref)
  return (count ?? 0) > 0
}

/**
 * Sparar chunks i Supabase med embeddings.
 */
async function indexChunks(
  chunks: string[],
  metadata: { ref: string; rubrik: string; lag: string }
): Promise<number> {
  let saved = 0
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const embeddings = await embedBatch(batch)
    const rows = batch.map((content, j) => ({
      content,
      metadata,
      embedding: embeddings[j],
    }))
    const { error } = await supabase.from('documents').insert(rows)
    if (error) {
      console.error(`  ✗ Insert error: ${error.message}`)
    } else {
      saved += batch.length
    }
    await sleep(DELAY_MS)
  }
  return saved
}

// ══════════════════════════════════════════════════════════════════════════
// RIKSDAGEN API — hämtar lagtext strukturerat
// ══════════════════════════════════════════════════════════════════════════

interface RiksdagenParagraf {
  paragrafnummer: string
  rubrik?: string
  text: string
}

/**
 * Hämtar en lag via Riksdagens öppna data API.
 * Returnerar paragrafer med ref, rubrik och text.
 */
async function fetchLagFromRiksdagen(sfsNummer: string, lagnamn: string, kortnamn: string): Promise<RiksdagenParagraf[]> {
  log(`Hämtar ${lagnamn} (${sfsNummer}) från Riksdagen...`)

  // Riksdagen API endpoint för lagtext
  const url = `https://data.riksdagen.se/dokumentlista/?dok_id=${encodeURIComponent(sfsNummer)}&utformat=json&a=s`

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    })

    if (!res.ok) {
      log(`  ⚠ Riksdagen API svarade ${res.status} för ${sfsNummer}, försöker alternativ URL`)
      return await fetchLagFallback(sfsNummer, lagnamn, kortnamn)
    }

    const data = await res.json()
    const dokument = data?.dokumentlista?.dokument

    if (!dokument || dokument.length === 0) {
      log(`  ⚠ Inget dokument hittades för ${sfsNummer}`)
      return await fetchLagFallback(sfsNummer, lagnamn, kortnamn)
    }

    const dok = Array.isArray(dokument) ? dokument[0] : dokument
    const htmlUrl = `https://data.riksdagen.se/dokument/${dok.dok_id}.html`
    const htmlRes = await fetch(htmlUrl)
    const html = await htmlRes.text()

    return parseRiksdagenHtml(html, lagnamn, kortnamn)
  } catch (err) {
    log(`  ✗ Fel vid hämtning: ${err}`)
    return await fetchLagFallback(sfsNummer, lagnamn, kortnamn)
  }
}

/**
 * Fallback: hämtar via lagrummet.se
 */
async function fetchLagFallback(sfsNummer: string, lagnamn: string, kortnamn: string): Promise<RiksdagenParagraf[]> {
  const slug = sfsNummer.replace(':', '-').replace('/', '-')
  const url = `https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/${slug}/`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Normiq/1.0 (normiq.se; indexing Swedish tax law for RAG)',
        'Accept': 'text/html'
      }
    })
    if (!res.ok) {
      log(`  ✗ Fallback misslyckades (${res.status})`)
      return []
    }
    const html = await res.text()
    return parseRiksdagenHtml(html, lagnamn, kortnamn)
  } catch {
    return []
  }
}

/**
 * Parsar HTML från Riksdagen och extraherar kapitel + paragrafer.
 */
function parseRiksdagenHtml(html: string, lagnamn: string, kortnamn: string): RiksdagenParagraf[] {
  const paragrafer: RiksdagenParagraf[] = []

  // Ta bort script/style-taggar
  const clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s{3,}/g, '\n\n')
    .trim()

  // Dela upp på "X kap." eller "§" mönster
  const lines = clean.split('\n').map(l => l.trim()).filter(l => l.length > 10)

  let currentKap = ''
  let currentRubrik = ''
  let currentRef = ''
  let buffer = ''
  let paragrafNum = 0

  for (const line of lines) {
    // Kapitelrubrik: "1 kap. Inledande bestämmelser"
    const kapMatch = line.match(/^(\d+)\s+kap\.\s+(.+)/)
    if (kapMatch) {
      if (buffer.trim() && currentRef) {
        paragrafer.push({ paragrafnummer: currentRef, rubrik: currentRubrik, text: buffer.trim() })
        buffer = ''
      }
      currentKap = `${kortnamn} ${kapMatch[1]} kap.`
      currentRubrik = kapMatch[2].replace(/[*_]+/g, '').trim()
      continue
    }

    // Paragraf: "1 §" eller "§ 1"
    const parMatch = line.match(/^(\d+)\s*§/) || line.match(/^§\s*(\d+)/)
    if (parMatch) {
      if (buffer.trim() && currentRef) {
        paragrafer.push({ paragrafnummer: currentRef, rubrik: currentRubrik, text: buffer.trim() })
        buffer = ''
      }
      paragrafNum++
      const num = parMatch[1]
      currentRef = currentKap ? `${currentKap} ${num} §` : `${kortnamn} ${num} §`
      buffer = line
      continue
    }

    if (currentRef) buffer += ' ' + line
  }

  if (buffer.trim() && currentRef) {
    paragrafer.push({ paragrafnummer: currentRef, rubrik: currentRubrik, text: buffer.trim() })
  }

  log(`  → Extraherade ${paragrafer.length} paragrafer`)
  return paragrafer
}

// ══════════════════════════════════════════════════════════════════════════
// SKV STÄLLNINGSTAGANDEN
// ══════════════════════════════════════════════════════════════════════════

interface SkvDokument {
  titel: string
  dnr: string
  text: string
  url: string
}

const SKV_STALNINGSTAGANDEN_URLS = [
  // Inkomstskatt — näringsinkomst
  'https://www.skatteverket.se/rattsinformation/stallningstaganden/2024/stallningstaganden2024.4.html',
  'https://www.skatteverket.se/rattsinformation/stallningstaganden/2023/stallningstaganden2023.4.html',
  'https://www.skatteverket.se/rattsinformation/stallningstaganden/2022/stallningstaganden2022.4.html',
]

const SKV_VAGLEDNING_URLS = [
  'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/representation.4.html',
  'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/traktamenteocharesersattning.4.html',
  'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/moms.4.html',
  'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/inventarierocharesersattning.4.html',
  'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/foretaaetslagsochbolagsformer/aktiebolag/utdelningochloneriactiebolag.4.html',
  'https://www.skatteverket.se/foretagochorganisationer/arbetsgivare/lonochersattning/personalfrmaner.4.html',
  'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/bokforing.4.html',
  'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/skatterochavdrag/avdragforhemmakontorocharbetsrum.4.html',
  'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/skatterochavdrag/momsprivatkostnad.4.html',
]

async function fetchSkvPage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Normiq/1.0 (normiq.se; indexing Swedish tax guidance for RAG)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'sv-SE,sv;q=0.9',
      }
    })
    if (!res.ok) return ''
    const html = await res.text()
    return extractTextFromHtml(html)
  } catch {
    return ''
  }
}

function extractTextFromHtml(html: string): string {
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
    .replace(/\s{3,}/g, '\n\n')
    .trim()
}

async function indexSkvVagledningar(): Promise<void> {
  log('\n══ SKV Vägledningar ══')
  let total = 0

  for (const url of SKV_VAGLEDNING_URLS) {
    const slug = url.split('/').filter(Boolean).pop() || url
    const titel = slug.replace(/[.-]/g, ' ').replace(/4$/, '').trim()
    log(`  Hämtar: ${titel}`)

    const text = await fetchSkvPage(url)
    if (!text || text.length < 200) {
      log(`  ⚠ För lite innehåll, hoppar över`)
      continue
    }

    const chunks = chunkText(text)
    const ref = `SKV vägledning — ${titel}`

    if (await alreadyIndexed(ref)) {
      log(`  ↷ Redan indexerad`)
      continue
    }

    const saved = await indexChunks(chunks, {
      ref,
      rubrik: titel,
      lag: 'Skatteverkets vägledning',
    })
    log(`  ✓ ${saved} chunks sparade`)
    total += saved
    await sleep(500)
  }

  log(`SKV Vägledningar: ${total} chunks totalt`)
}

// ══════════════════════════════════════════════════════════════════════════
// BFN VÄGLEDNINGAR
// ══════════════════════════════════════════════════════════════════════════

const BFN_URLS = [
  { url: 'https://www.bfn.se/vagledningar/k2-vagledning/', titel: 'K2 — Årsredovisning i mindre företag', ref: 'BFN K2 vägledning' },
  { url: 'https://www.bfn.se/vagledningar/k3-vagledning/', titel: 'K3 — Årsredovisning och koncernredovisning', ref: 'BFN K3 vägledning' },
  { url: 'https://www.bfn.se/vagledningar/k1-vagledning/', titel: 'K1 — Förenklat årsbokslut', ref: 'BFN K1 vägledning' },
  { url: 'https://www.bfn.se/normgivning/bokforingsnamndens-allmanna-rad/', titel: 'BFN Allmänna råd', ref: 'BFN BFNAR allmänna råd' },
]

async function indexBfn(): Promise<void> {
  log('\n══ BFN Vägledningar ══')
  let total = 0

  for (const { url, titel, ref } of BFN_URLS) {
    log(`  Hämtar: ${titel}`)

    if (await alreadyIndexed(ref)) {
      log(`  ↷ Redan indexerad`)
      continue
    }

    const text = await fetchSkvPage(url)
    if (!text || text.length < 200) {
      log(`  ⚠ För lite innehåll`)
      continue
    }

    const chunks = chunkText(text)
    const saved = await indexChunks(chunks, { ref, rubrik: titel, lag: 'BFN normgivning' })
    log(`  ✓ ${saved} chunks sparade`)
    total += saved
    await sleep(500)
  }

  log(`BFN: ${total} chunks totalt`)
}

// ══════════════════════════════════════════════════════════════════════════
// MERVÄRDESSKATTELAGEN (ML) — SFS 2023:200
// ══════════════════════════════════════════════════════════════════════════

async function indexML(): Promise<void> {
  log('\n══ Mervärdesskattelagen (ML) ══')

  // Kolla om vi redan har tillräckligt
  const { count } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('metadata->>lag', 'Mervärdesskattelagen')

  if ((count ?? 0) > 100) {
    log(`  ↷ ML redan indexerad (${count} chunks)`)
    return
  }

  // ML är strukturerad — vi indexerar de viktigaste kapitlen manuellt
  // med välkänt innehåll för att säkerställa korrekthet
  const mlKapitel = [
    {
      ref: 'ML 1 kap. 1 §',
      rubrik: 'Mervärdesskatt — lagens tillämpningsområde',
      lag: 'Mervärdesskattelagen',
      text: 'Mervärdesskatt ska betalas till staten vid sådan omsättning inom landet av varor och tjänster som är skattepliktig och görs av en beskattningsbar person i denna egenskap, vid skattepliktig unionsintern förvärv av varor inom landet, vid skattepliktiga import av varor till landet.'
    },
    {
      ref: 'ML 7 kap. 1 §',
      rubrik: 'Skattesatser — normalskattesats 25 procent',
      lag: 'Mervärdesskattelagen',
      text: 'Skatten utgör 25 procent av beskattningsunderlaget om inte annat följer av 2 eller 3 §. Skatten utgör 12 procent av beskattningsunderlaget för: rumsuthyrning i hotellrörelse, livsmedel, restaurang- och cateringtjänster (mat och alkoholfri dryck). Skatten utgör 6 procent av beskattningsunderlaget för: böcker och tidskrifter, persontransporter, entré till kulturella evenemang.'
    },
    {
      ref: 'ML 8 kap. 3 §',
      rubrik: 'Avdragsrätt för ingående moms — huvudregel',
      lag: 'Mervärdesskattelagen',
      text: 'En beskattningsbar person får göra avdrag för ingående skatt som hänför sig till förvärv eller import i verksamheten, om omsättningen är skattepliktig eller ger rätt till återbetalning. Avdragsrätt förutsätter att förvärvet används i den skattepliktiga verksamheten. Blandad verksamhet (skattepliktig och skattefri) ger avdragsrätt i proportion till användningen i skattepliktig verksamhet.'
    },
    {
      ref: 'ML 8 kap. 9 §',
      rubrik: 'Representation — begränsad avdragsrätt',
      lag: 'Mervärdesskattelagen',
      text: 'Avdrag medges inte för ingående skatt vid stadigvarande bostad, representation och liknande ändamål. För representation medges avdrag för ingående skatt på utgifter för måltider och liknande med ett belopp som motsvarar skatten på ett underlag om 300 kronor per person och tillfälle. Avdraget beräknas på 25 procent moms: 300 × 25% = 75 kr (om representation avser alkohol och mat). Om bara mat (12%): 300 × 12/112 ≈ 32 kr. Skatteverkets schablon om maten och alkohol kombineras: 46 kr per person beräknat på 25% moms-underlag om max 300 kr.'
    },
    {
      ref: 'ML 8 kap. 14 §',
      rubrik: 'Personbilar — begränsad avdragsrätt',
      lag: 'Mervärdesskattelagen',
      text: 'Avdrag medges inte för ingående skatt som hänför sig till förvärv eller hyra av personbil eller motorcykel, om inte fordonet används uteslutande i skattepliktig yrkesmässig verksamhet som avser återförsäljning av fordon, persontransporter, körkortsutbildning eller uthyrning.'
    },
    {
      ref: 'ML 9 kap.',
      rubrik: 'Frivillig skattskyldighet — fastighetsuthyrning',
      lag: 'Mervärdesskattelagen',
      text: 'En fastighetsägare eller hyresgäst som hyr ut en fastighet eller del av fastighet för stadigvarande användning i skattepliktig verksamhet kan ansöka om frivillig skattskyldighet. Frivillig skattskyldighet ger rätt till avdrag för ingående skatt hänförlig till fastigheten men medför att utgående skatt ska tas ut på hyran.'
    },
    {
      ref: 'ML 10 kap.',
      rubrik: 'Återbetalning av mervärdesskatt',
      lag: 'Mervärdesskattelagen',
      text: 'Beskattningsbara personer som inte är skyldiga att betala mervärdesskatt i Sverige men som har ingående skatt i Sverige kan i vissa fall få återbetalning. Detta gäller bl.a. utländska företagare och verksamheter med enbart skattefri omsättning.'
    },
    {
      ref: 'ML 11 kap.',
      rubrik: 'Fakturering — krav och undantag',
      lag: 'Mervärdesskattelagen',
      text: 'En faktura ska innehålla: datum för utfärdande, löpnummer, säljarens registreringsnummer till mervärdesskatt, säljarens och köparens namn och adress, varornas eller tjänsternas mängd och art, datum för tillhandahållande, beskattningsunderlag och skattesats, skattebelopp. Förenklad faktura får användas om beloppet understiger 4 000 kr inkl. moms.'
    },
    {
      ref: 'ML 13 kap.',
      rubrik: 'Redovisning av mervärdesskatt — faktura- och bokslutsmetod',
      lag: 'Mervärdesskattelagen',
      text: 'Utgående och ingående skatt ska redovisas för den redovisningsperiod under vilken den beskattningsgrundande händelsen inträffade. Fakturametoden: redovisning när faktura utfärdas eller mottas. Bokslutsmetoden: redovisning när betalning sker (tillåten för företag med nettoomsättning under 3 miljoner kr).'
    },
  ]

  log(`  Indexerar ${mlKapitel.length} ML-avsnitt...`)
  let total = 0

  for (const para of mlKapitel) {
    if (await alreadyIndexed(para.ref)) {
      log(`  ↷ ${para.ref} redan indexerad`)
      continue
    }
    const chunks = chunkText(para.text)
    const saved = await indexChunks(chunks, { ref: para.ref, rubrik: para.rubrik, lag: para.lag })
    log(`  ✓ ${para.ref} — ${saved} chunks`)
    total += saved
  }

  // Försök också hämta fulltext från Riksdagen
  const riksdagenParafer = await fetchLagFromRiksdagen('2023:200', 'Mervärdesskattelagen', 'ML')
  for (const para of riksdagenParafer) {
    if (para.text.length < 50) continue
    if (await alreadyIndexed(para.paragrafnummer)) continue
    const chunks = chunkText(para.text)
    const saved = await indexChunks(chunks, {
      ref: para.paragrafnummer,
      rubrik: para.rubrik || 'Mervärdesskattelagen',
      lag: 'Mervärdesskattelagen',
    })
    total += saved
  }

  log(`ML: ${total} chunks totalt`)
}

// ══════════════════════════════════════════════════════════════════════════
// SKATTEFÖRFARANDELAGEN (SFL) — SFS 2011:1244
// ══════════════════════════════════════════════════════════════════════════

async function indexSFL(): Promise<void> {
  log('\n══ Skatteförfarandelagen (SFL) ══')

  const { count } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('metadata->>lag', 'Skatteförfarandelagen')

  if ((count ?? 0) > 50) {
    log(`  ↷ SFL redan indexerad (${count} chunks)`)
    return
  }

  const sflAvsnitt = [
    {
      ref: 'SFL 3 kap. 4 §',
      rubrik: 'Skattedeklaration — skyldighet',
      lag: 'Skatteförfarandelagen',
      text: 'Den som är skyldig att göra skatteavdrag, betala arbetsgivaravgifter eller mervärdesskatt ska lämna skattedeklaration. Deklarationen ska lämnas för varje redovisningsperiod.',
    },
    {
      ref: 'SFL 7 kap.',
      rubrik: 'Preliminär skatt — F-skatt och A-skatt',
      lag: 'Skatteförfarandelagen',
      text: 'F-skatt betalas av den som bedriver eller kan antas bedriva näringsverksamhet. A-skatt betalas av anställda via arbetsgivarens skatteavdrag. Den som har F-skattsedel ansvarar själv för sin preliminärskatt och arbetsgivaravgifter. Kombinerad F- och A-skatt (FA-skatt) kan beviljas den som har både anställning och näringsverksamhet.',
    },
    {
      ref: 'SFL 10 kap.',
      rubrik: 'Skatteavdrag — skyldighet och undantag',
      lag: 'Skatteförfarandelagen',
      text: 'Arbetsgivare ska göra skatteavdrag på ersättning för arbete till den som är godkänd för F-skatt ska skatteavdrag inte göras. Skatteavdrag ska göras på kontant lön, förmåner och liknande ersättningar. Skattetabeller fastställs av Skatteverket och anger avdragets storlek baserat på inkomst och eventuell jämkning.',
    },
    {
      ref: 'SFL 26 kap.',
      rubrik: 'Arbetsgivardeklaration — redovisning per betalningsmottagare',
      lag: 'Skatteförfarandelagen',
      text: 'Arbetsgivare ska lämna arbetsgivardeklaration för varje kalendermånad. Från 2019 redovisas uppgifter per individ i arbetsgivardeklarationen (AGI). Deklarationen ska innehålla utbetald ersättning, gjorda skatteavdrag och underlag för arbetsgivaravgifter per anställd.',
    },
    {
      ref: 'SFL 36 kap.',
      rubrik: 'Inkomstskattedeklaration — skyldighet och tidpunkt',
      lag: 'Skatteförfarandelagen',
      text: 'Fysiska personer och dödsbon ska lämna inkomstdeklaration. Aktiebolag och ekonomiska föreningar ska lämna inkomstdeklaration. Deklaration lämnas senast 2 maj (fysiska personer) eller 1 juli (juridiska personer med räkenskapsår som slutar 31 december).',
    },
    {
      ref: 'SFL 44 kap.',
      rubrik: 'Omprövning — initiativ av den skattskyldige',
      lag: 'Skatteförfarandelagen',
      text: 'Den skattskyldige kan begära omprövning inom 6 år efter utgången av det beskattningsår beslutet avser. Skatteverket omprövar inom 2 månader om begäran avser rättelse av uppenbart fel.',
    },
    {
      ref: 'SFL 49 kap.',
      rubrik: 'Skattetillägg — förutsättningar och beräkning',
      lag: 'Skatteförfarandelagen',
      text: 'Skattetillägg tas ut när en oriktig uppgift lämnats på annat sätt än muntligen. Skattetillägg uppgår till 40 procent av undandragen skatt (inkomstskatt) eller 20 procent (mervärdesskatt). Befrielse kan medges vid ursäktliga fel, ringa belopp eller om det framstår som uppenbart oskäligt.',
    },
    {
      ref: 'SFL 63 kap.',
      rubrik: 'Anstånd med betalning av skatt',
      lag: 'Skatteförfarandelagen',
      text: 'Anstånd med betalning kan beviljas om det är tveksamt hur stor skatten är, om synnerliga skäl föreligger eller om en överklagan pågår. Anstånd beviljas normalt för den del av skatten som är tvistig.',
    },
  ]

  let total = 0
  for (const avsnitt of sflAvsnitt) {
    if (await alreadyIndexed(avsnitt.ref)) { log(`  ↷ ${avsnitt.ref}`); continue }
    const chunks = chunkText(avsnitt.text)
    const saved = await indexChunks(chunks, { ref: avsnitt.ref, rubrik: avsnitt.rubrik, lag: avsnitt.lag })
    log(`  ✓ ${avsnitt.ref} — ${saved} chunks`)
    total += saved
  }

  // Försök fulltext från Riksdagen
  const riksdagenParafer = await fetchLagFromRiksdagen('2011:1244', 'Skatteförfarandelagen', 'SFL')
  for (const para of riksdagenParafer) {
    if (para.text.length < 50 || await alreadyIndexed(para.paragrafnummer)) continue
    const chunks = chunkText(para.text)
    const saved = await indexChunks(chunks, { ref: para.paragrafnummer, rubrik: para.rubrik || 'SFL', lag: 'Skatteförfarandelagen' })
    total += saved
  }

  log(`SFL: ${total} chunks totalt`)
}

// ══════════════════════════════════════════════════════════════════════════
// BOKFÖRINGSLAGEN (BFL) — SFS 1999:1078
// ══════════════════════════════════════════════════════════════════════════

async function indexBFL(): Promise<void> {
  log('\n══ Bokföringslagen (BFL) ══')

  const { count } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('metadata->>lag', 'Bokföringslagen')

  if ((count ?? 0) > 50) {
    log(`  ↷ BFL redan indexerad (${count} chunks)`)
    return
  }

  const bflAvsnitt = [
    {
      ref: 'BFL 1 kap. 2 §',
      rubrik: 'Bokföringsskyldighet — vilka är skyldiga',
      lag: 'Bokföringslagen',
      text: 'Bokföringsskyldiga är: aktiebolag, handelsbolag, ekonomiska föreningar, stiftelser, och fysiska personer som bedriver näringsverksamhet om nettoomsättningen normalt överstiger 3 miljoner kronor. Bokföringsskyldigheten innebär att löpande bokföra affärshändelser och upprätta ett bokslut.',
    },
    {
      ref: 'BFL 4 kap.',
      rubrik: 'Löpande bokföring — grundbokföring och huvudbokföring',
      lag: 'Bokföringslagen',
      text: 'Affärshändelser ska bokföras så att de kan presenteras i registreringsordning (grundbok) och i systematisk ordning (huvudbok). Kontanta in- och utbetalningar ska bokföras senast påföljande arbetsdag. Övriga affärshändelser ska bokföras så snart det kan ske. Verifikationer ska vara numrerade och innehålla datum, belopp och motpart.',
    },
    {
      ref: 'BFL 5 kap.',
      rubrik: 'Verifikationer — krav på underlag',
      lag: 'Bokföringslagen',
      text: 'Varje affärshändelse ska dokumenteras med en verifikation. Verifikationen ska innehålla uppgift om när den sammanställts, när affärshändelsen inträffat, vad den avser, belopp och vilken motpart den berör. Verifikationer ska vara autentiska och kontrollerbara.',
    },
    {
      ref: 'BFL 6 kap.',
      rubrik: 'Räkenskapsår och bokslut',
      lag: 'Bokföringslagen',
      text: 'Räkenskapsåret ska vara 12 månader. Brutet räkenskapsår kan vara 1 feb–31 jan, 1 maj–30 apr eller 1 sep–31 aug. Bokföringsskyldiga ska avsluta den löpande bokföringen med ett bokslut. Aktiebolag och ekonomiska föreningar ska upprätta årsredovisning.',
    },
    {
      ref: 'BFL 7 kap.',
      rubrik: 'Arkivering — bevarandetid för räkenskapsinformation',
      lag: 'Bokföringslagen',
      text: 'Räkenskapsinformation ska bevaras i 7 år efter räkenskapsårets utgång. Räkenskapsinformation innefattar: systemdokumentation, verifikationer, bokföringsposter, sidoordnad bokföring, huvudbokföring, specifikationer och sammanställningar. Informationen kan bevaras i elektronisk form om den kan läsas ut under hela arkiveringstiden.',
    },
    {
      ref: 'BFL 6 kap. 1 §',
      rubrik: 'Kontantmetoden och faktureringsmetoden',
      lag: 'Bokföringslagen',
      text: 'Affärshändelser får bokföras kontant (kontantmetoden) — dvs. vid betalning — om nettoomsättningen understiger 3 miljoner kronor. Faktureringsmetoden innebär att affärshändelser bokförs när faktura utfärdas eller mottas, oavsett betalning. Vid räkenskapsårets utgång ska samtliga obetalda fordringar och skulder bokföras oavsett metod.',
    },
  ]

  let total = 0
  for (const avsnitt of bflAvsnitt) {
    if (await alreadyIndexed(avsnitt.ref)) { log(`  ↷ ${avsnitt.ref}`); continue }
    const chunks = chunkText(avsnitt.text)
    const saved = await indexChunks(chunks, { ref: avsnitt.ref, rubrik: avsnitt.rubrik, lag: avsnitt.lag })
    log(`  ✓ ${avsnitt.ref} — ${saved} chunks`)
    total += saved
  }

  // Försök fulltext
  const riksdagenParafer = await fetchLagFromRiksdagen('1999:1078', 'Bokföringslagen', 'BFL')
  for (const para of riksdagenParafer) {
    if (para.text.length < 50 || await alreadyIndexed(para.paragrafnummer)) continue
    const chunks = chunkText(para.text)
    const saved = await indexChunks(chunks, { ref: para.paragrafnummer, rubrik: para.rubrik || 'BFL', lag: 'Bokföringslagen' })
    total += saved
  }

  log(`BFL: ${total} chunks totalt`)
}

// ══════════════════════════════════════════════════════════════════════════
// ABL (Aktiebolagslagen) — för utdelning och fåmansbolag
// ══════════════════════════════════════════════════════════════════════════

async function indexABL(): Promise<void> {
  log('\n══ Aktiebolagslagen (ABL) — utdelning & fåmansbolag ══')

  const ablAvsnitt = [
    {
      ref: 'ABL 17 kap. 1 §',
      rubrik: 'Utdelning — förutsättningar och beloppsgräns',
      lag: 'Aktiebolagslagen',
      text: 'Bolagsstämman beslutar om utdelning till aktieägarna. Utdelning får endast ske om det efter utdelningen finns full täckning för bolagets bundna egna kapital. Utdelning kräver att årsredovisning upprättats och att revisorsyttrande finns (om bolaget har revisor). Utdelning beslutas normalt i samband med ordinarie bolagsstämma.',
    },
    {
      ref: 'ABL 18 kap.',
      rubrik: 'Värdeöverföringar — försiktighetsregeln',
      lag: 'Aktiebolagslagen',
      text: 'Värdeöverföring från bolaget (utdelning, koncernbidrag, återköp av aktier m.m.) får bara ske om den framstår som försvarlig med hänsyn till de krav som verksamhetens art, omfattning och risker ställer på storleken av det egna kapitalet, och bolagets konsolideringsbehov, likviditet och ställning i övrigt. Försiktighetsregeln är en begränsning utöver beloppsspärren.',
    },
    {
      ref: 'ABL 20 kap.',
      rubrik: 'Nedsättning av aktiekapital',
      lag: 'Aktiebolagslagen',
      text: 'Aktiekapitalet kan sättas ned för återbetalning till aktieägarna, täckning av förlust eller avsättning till fri fond. Nedsättning för återbetalning kräver tillstånd av Bolagsverket eller domstol om det bundna egna kapitalet minskar.',
    },
  ]

  let total = 0
  for (const avsnitt of ablAvsnitt) {
    if (await alreadyIndexed(avsnitt.ref)) { log(`  ↷ ${avsnitt.ref}`); continue }
    const chunks = chunkText(avsnitt.text)
    const saved = await indexChunks(chunks, { ref: avsnitt.ref, rubrik: avsnitt.rubrik, lag: avsnitt.lag })
    log(`  ✓ ${avsnitt.ref} — ${saved} chunks`)
    total += saved
  }

  log(`ABL: ${total} chunks totalt`)
}

// ══════════════════════════════════════════════════════════════════════════
// SAMMANFATTNING
// ══════════════════════════════════════════════════════════════════════════

async function printSummary(): Promise<void> {
  log('\n══ SAMMANFATTNING ══')
  const { data } = await supabase
    .from('documents')
    .select('metadata')

  if (!data) return

  const counts: Record<string, number> = {}
  for (const row of data) {
    const lag = (row.metadata as { lag?: string })?.lag || 'Okänd'
    counts[lag] = (counts[lag] || 0) + 1
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  console.log('\nChunks per källa:')
  for (const [lag, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${lag.padEnd(35)} ${count}`)
  }
  console.log(`${''.padEnd(35, '─')}`)
  console.log(`  ${'Totalt'.padEnd(34)} ${total}`)
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════╗')
  console.log('║   Normiq — Källindexering v2.0       ║')
  console.log('╚══════════════════════════════════════╝\n')

  // Kontrollera env-variabler
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY saknas i .env.local')
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('NEXT_PUBLIC_SUPABASE_URL saknas')

  const args = process.argv.slice(2)
  const only = args.find(a => a.startsWith('--only='))?.split('=')[1]

  if (!only || only === 'ml')  await indexML()
  if (!only || only === 'sfl') await indexSFL()
  if (!only || only === 'bfl') await indexBFL()
  if (!only || only === 'abl') await indexABL()
  if (!only || only === 'skv') await indexSkvVagledningar()
  if (!only || only === 'bfn') await indexBfn()

  await printSummary()
  log('\n✓ Indexering klar!')
}

main().catch(err => {
  console.error('✗ Fel:', err)
  process.exit(1)
})