import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8,application/pdf',
  'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
  'Connection': 'keep-alive',
}

// ── DIREKTA KÄLLOR — verifierade URLer ──────────────────────────────────────
const DIREKTA = [

  // ── SKV PDFer — primärkällor ──────────────────────────────────────────────
  {
    url: 'https://www.skatteverket.se/download/18.1522bf3f19aea8075ba3285/1767885159120/belopp-och-procentsatser-for-inkomstaret-2026.pdf',
    ref: 'SKV Belopp 2026', rubrik: 'Alla belopp och procentsatser 2026 — arbetsgivaravgifter, traktamente, representation, gåvor, moms, rot/rut', typ: 'pdf', källa: 'Skatteverket',
  },
  {
    url: 'https://www.skatteverket.se/download/18.262c54c219391f2e9634df4/1736339078938/skatteavdrag-och-arbetsgivaravgifter-skv401-utgava30.pdf',
    ref: 'SKV 401', rubrik: 'Skatteavdrag och arbetsgivaravgifter 2026 — förmåner, bilförmån, bostadsförmån, traktamente', typ: 'pdf', källa: 'Skatteverket',
  },
  {
    url: 'https://www.skatteverket.se/download/18.7da1d2e118be03f8e4f36f2/1708607303743/traktamenten-och-andra-kostnadsersattningar-skv354-utgava-34.pdf',
    ref: 'SKV 354', rubrik: 'Traktamente och kostnadsersättningar — regler och belopp', typ: 'pdf', källa: 'Skatteverket',
  },

  // ── SKV Rättslig vägledning — senaste utgåvan ─────────────────────────────
  {
    url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2025.2/24.html',
    ref: 'SKV Rättslig vägledning', rubrik: 'Rättslig vägledning — regler och ställningstaganden senaste utgåvan', typ: 'html', källa: 'Skatteverket',
  },

  // ── SKV webbsidor — belopp och procent ───────────────────────────────────
  {
    url: 'https://www.skatteverket.se/privat/skatter/belompochprocent/2026.4.1522bf3f19aea8075ba21.html',
    ref: 'SKV Belopp webb 2026', rubrik: 'Belopp och procent 2026 — fullständig webbversion med alla avdrag', typ: 'html', källa: 'Skatteverket',
  },
  {
    url: 'https://www.skatteverket.se/privat/skatter/belompochprocent/2026/belompochprocent2026kortversion.4.1522bf3f19aea8075ba89.html',
    ref: 'SKV Belopp 2026 kort', rubrik: 'Belopp och procent 2026 — kortversion med alla satser', typ: 'html', källa: 'Skatteverket',
  },

  // ── SKV webbsidor — skatteområden ─────────────────────────────────────────
  {
    url: 'https://www.skatteverket.se/privat/skatter/arbeteochinkomst/traktamente.4.dfe345a107ebcc9baf80006547.html',
    ref: 'SKV Traktamente', rubrik: 'Traktamente — skattefria belopp och regler 2026', typ: 'html', källa: 'Skatteverket',
  },
  {
    url: 'https://skatteverket.se/privat/skatter/arbeteochinkomst/traktamente/utlandstraktamente.4.2b543913a42158acf800016035.html',
    ref: 'SKV Utlandstraktamente', rubrik: 'Utlandstraktamente — normalbelopp per land 2026', typ: 'html', källa: 'Skatteverket',
  },
  {
    url: 'https://skatteverket.se/foretag/drivaforetag/foretagsformer/famansforetag/beloppochprocentsatser.4.34f3b0b713e2cf5455b7288.html',
    ref: 'SKV 3:12 Belopp', rubrik: '3:12 fåmansbolag — gränsbelopp, schablonbelopp, lönekrav 2026', typ: 'html', källa: 'Skatteverket',
  },
  {
    url: 'https://skatteverket.se/foretag/skatterochavdrag/beloppochprocent/2026.106.1522bf3f19aea8075ba3294.html',
    ref: 'SKV Belopp Företag 2026', rubrik: 'Belopp och procent företag 2026 — representation, bilförmån, milersättning', typ: 'html', källa: 'Skatteverket',
  },

  // ── SKV broschyrsidor — hittar inbyggda PDF-länkar ────────────────────────
  {
    url: 'https://skatteverket.se/privat/etjansterochblanketter/broschyrer.106.233f91f71260075abe880009543.html',
    ref: 'SKV Broschyrer index', rubrik: 'Skatteverkets alla broschyrer — index', typ: 'html-index', källa: 'Skatteverket',
  },
  {
    url: 'https://www.skatteverket.se/foretag/etjansterochblanketter/blanketterbroschyrer/broschyrer/omrade/kassaregister.4.233f91f71260075abe8800095391.html',
    ref: 'SKV Broschyrer Företag', rubrik: 'Skatteverkets broschyrer för företag — index', typ: 'html-index', källa: 'Skatteverket',
  },

  // ── BFN — normgivning ─────────────────────────────────────────────────────
{
    url: 'https://www.bfn.se/wp-content/uploads/vl12-1-k3-kons.pdf',
    ref: 'BFN K3', rubrik: 'K3 BFNAR 2012:1 — årsredovisning och koncernredovisning fulltext', typ: 'pdf', källa: 'BFN',
  },
  {
    url: 'https://www.bfn.se/wp-content/uploads/vl23-1-brf.pdf',
    ref: 'BFN K3 BRF', rubrik: 'K3 kompletterande regler bostadsrättsföreningar BFNAR 2023:1', typ: 'pdf', källa: 'BFN',
  },
  {
    url: 'https://www.bfn.se/redovisningsregler/beslutade-redovisningsregler/',
    ref: 'BFN Beslutade regler', rubrik: 'BFN — alla beslutade redovisningsregler K2 K3 senaste ändringar', typ: 'html', källa: 'BFN',
  },
  {
    url: 'https://www.bfn.se/fragor-och-svar/andringar-i-k2-och-k3-fran-2026/',
    ref: 'BFN K2 K3 2026', rubrik: 'BFN — ändringar i K2 och K3 från 2026 FAQ', typ: 'html', källa: 'BFN',
  },
  {
    url: 'https://www.bfn.se/informationsmaterial/vagledningar/',
    ref: 'BFN Vägledningar', rubrik: 'BFN — alla vägledningar K1 K2 K3', typ: 'html', källa: 'BFN',
  },
  {
    url: 'https://www.bfn.se/om-bokforingsnamnden/k-projektet/kategori-2/',
    ref: 'BFN K2 regler', rubrik: 'BFN K2 — BFNAR 2016:10 årsredovisning mindre företag regler', typ: 'html', källa: 'BFN',
  },

  // ── Riksdagen — lagtext via lagen.nu ─────────────────────────────────────
  {
    url: 'https://lagen.nu/1999:1229#K16P2S1',
    ref: 'IL 16:2', rubrik: 'Inkomstskattelagen 16 kap 2 § — representation avdragsrätt', typ: 'html', källa: 'Riksdagen',
  },
  {
    url: 'https://lagen.nu/1999:1229#K57',
    ref: 'IL 57', rubrik: 'Inkomstskattelagen 57 kap — fåmansföretag kvalificerade andelar', typ: 'html', källa: 'Riksdagen',
  },
  {
    url: 'https://lagen.nu/1994:200',
    ref: 'ML', rubrik: 'Mervärdesskattelagen — fulltext', typ: 'html', källa: 'Riksdagen',
  },
  {
    url: 'https://lagen.nu/1999:1078',
    ref: 'SFL', rubrik: 'Skatteförfarandelagen — fulltext', typ: 'html', källa: 'Riksdagen',
  },
  {
    url: 'https://lagen.nu/1999:1078',
    ref: 'BFL', rubrik: 'Bokföringslagen — fulltext', typ: 'html', källa: 'Riksdagen',
  },
  {
    url: 'https://lagen.nu/2005:551',
    ref: 'ABL', rubrik: 'Aktiebolagslagen — fulltext', typ: 'html', källa: 'Riksdagen',
  },
]

// ── HÄMTA HTML ───────────────────────────────────────────────────────────────
async function fetchHtml(url) {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) })
    if (!res.ok) { console.log('  HTTP ' + res.status); return null }
    const html = await res.text()
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000)
  } catch (err) { console.log('  FEL: ' + err.message); return null }
}

// ── HÄMTA HTML OCH EXTRAHERA PDF-LÄNKAR ──────────────────────────────────────
async function fetchHtmlAndPdfLinks(url) {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) })
    if (!res.ok) { console.log('  HTTP ' + res.status); return { text: null, pdfLinks: [] } }
    const html = await res.text()
    const base = new URL(url).origin

    const pdfLinks = []
    const regex = /href="([^"]*\.pdf[^"]*)"/gi
    let match
    while ((match = regex.exec(html)) !== null) {
      const href = match[1]
      const full = href.startsWith('http') ? href : base + href
      // Bara relevanta SKV-nummer och aktuella år
      const relevant = /skv[_-]?(3[0-9]{2}|4[0-9]{2}|5[0-9]{2}|354|401|283|295|352)/i.test(full)
        || /belopp.*2026|2026.*belopp/i.test(full)
        || /bfnar/i.test(full)
      if (relevant) { pdfLinks.push(full) }
    }

    const text = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000)

    return { text, pdfLinks: [...new Set(pdfLinks)] }
  } catch (err) { console.log('  FEL: ' + err.message); return { text: null, pdfLinks: [] } }
}

// ── HÄMTA PDF ────────────────────────────────────────────────────────────────
async function fetchPdf(url) {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30000) })
    if (!res.ok) { console.log('  HTTP ' + res.status); return null }
    const buffer = await res.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    let raw = ''
    for (let i = 0; i < Math.min(bytes.length, 800000); i++) {
      const c = bytes[i]
      if (c >= 32 && c < 127) { raw += String.fromCharCode(c) }
      else if (c === 10 || c === 13) { raw += ' ' }
    }

    // Extrahera textsträngar från PDF-format
    const parts = []
    const re = /\(([^)]{3,300})\)\s*T[jJ]/g
    let m
    while ((m = re.exec(raw)) !== null) {
      const p = m[1].replace(/\\[nrt]/g, ' ').replace(/\\\(/g, '(').replace(/\\\)/g, ')').trim()
      if (p.length > 4 && /[a-zA-ZåäöÅÄÖ]{2}/.test(p)) { parts.push(p) }
    }

    const result = parts.join(' ').replace(/\s+/g, ' ').trim()
    if (result.length > 300) { return result.slice(0, 8000) }

    // Fallback — rå text
    return raw.replace(/[^\x20-\x7EåäöÅÄÖ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000)
  } catch (err) { console.log('  FEL: ' + err.message); return null }
}

// ── EMBED ────────────────────────────────────────────────────────────────────
async function embed(text) {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  })
  return res.data[0].embedding
}

// ── UPSERT ───────────────────────────────────────────────────────────────────
async function upsert(ref, rubrik, url, text, källa) {
  if (!text || text.length < 100) { return 'tom' }
  const content = '[' + ref + '] — ' + rubrik + '\nKälla: ' + url + '\nUppdaterad: ' + new Date().toLocaleDateString('sv-SE') + '\n\n' + text.slice(0, 7500)
  const embedding = await embed(content)
  await supabase.from('documents').delete().eq('metadata->>ref', ref)
  const { error } = await supabase.from('documents').insert({
    content,
    metadata: { ref, rubrik, url, källa, uppdaterad: new Date().toISOString() },
    embedding,
  })
  if (error) { console.log('  SUPABASE: ' + error.message); return 'fel' }
  return 'ok'
}

function extractRef(url) {
  const f = url.split('/').pop().replace('.pdf', '')
  const skv = f.match(/skv[\-_]?(\d+)/i)
  if (skv) { return { ref: 'SKV ' + skv[1], rubrik: f.replace(/-/g, ' ') } }
  const bfnar = f.match(/bfnar[_-]?(\d{4})[_-]?(\d+)/i)
  if (bfnar) { return { ref: 'BFNAR ' + bfnar[1] + ':' + bfnar[2], rubrik: f.replace(/-/g, ' ') } }
  return { ref: f.slice(0, 40), rubrik: f.replace(/-/g, ' ').slice(0, 80) }
}

// ── HUVUDFLÖDE ───────────────────────────────────────────────────────────────
async function run() {
  console.log('\nNormiq — hämtar alla regelkällor\n')
  let ok = 0, fel = 0, tom = 0
  const crawledPdfs = []

  for (const k of DIREKTA) {
    process.stdout.write('  ' + k.ref.padEnd(32) + ' ')

    let text = null

    if (k.typ === 'pdf') {
      text = await fetchPdf(k.url)
      const status = await upsert(k.ref, k.rubrik, k.url, text, k.källa)
      if (status === 'ok') { console.log('ok (' + (text ? text.length : 0) + ')'); ok++ }
      else if (status === 'tom') { console.log('tom'); tom++ }
      else { fel++ }

    } else if (k.typ === 'html-index') {
      // Hämta sidan och samla PDF-länkar för senare indexering
      const result = await fetchHtmlAndPdfLinks(k.url)
      if (result.pdfLinks.length > 0) {
        crawledPdfs.push(...result.pdfLinks)
        console.log('hittade ' + result.pdfLinks.length + ' PDFer')
      } else {
        console.log('0 PDFer')
      }
      tom++

    } else {
      text = await fetchHtml(k.url)
      const status = await upsert(k.ref, k.rubrik, k.url, text, k.källa)
      if (status === 'ok') { console.log('ok (' + (text ? text.length : 0) + ')'); ok++ }
      else if (status === 'tom') { console.log('tom'); tom++ }
      else { fel++ }
    }

    await new Promise(function(r) { setTimeout(r, 700) })
  }

  // Indexera crawlade PDFer
  if (crawledPdfs.length > 0) {
    console.log('\n=== CRAWLADE PDFER (' + [...new Set(crawledPdfs)].length + ' st) ===\n')
    for (const pdfUrl of [...new Set(crawledPdfs)]) {
      const { ref, rubrik } = extractRef(pdfUrl)
      process.stdout.write('  ' + ref.padEnd(32) + ' ')
      const text = await fetchPdf(pdfUrl)
      const källa = pdfUrl.includes('skatteverket') ? 'Skatteverket' : pdfUrl.includes('bfn') ? 'BFN' : 'Riksdagen'
      const status = await upsert(ref, rubrik, pdfUrl, text, källa)
      if (status === 'ok') { console.log('ok (' + (text ? text.length : 0) + ')'); ok++ }
      else if (status === 'tom') { console.log('tom'); tom++ }
      else { fel++ }
      await new Promise(function(r) { setTimeout(r, 700) })
    }
  }

  console.log('\nKlart — ' + ok + ' ok, ' + tom + ' tomma, ' + fel + ' fel')
  console.log(new Date().toLocaleString('sv-SE') + '\n')
}

run()