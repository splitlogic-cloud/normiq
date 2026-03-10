import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── ALLA PRIMÄRKÄLLOR ────────────────────────────────────────────────────────
const KÄLLOR = [

  // SKATTEVERKET — Privatpersoner
  { url: 'https://www.skatteverket.se/privat/skatter/arbeteochinkomst/traktamentenochresekostnader/traktamente.4.html', ref: 'SKV Traktamente', rubrik: 'Traktamente — skattefria belopp' },
  { url: 'https://www.skatteverket.se/privat/skatter/arbeteochinkomst/traktamentenochresekostnader/milersattning.4.html', ref: 'SKV Milersättning', rubrik: 'Milersättning — skattefri ersättning' },
  { url: 'https://www.skatteverket.se/privat/fastigheterochbostad/uthyrningavdinbostad.4.html', ref: 'SKV Uthyrning bostad', rubrik: 'Uthyrning av bostad — skatt och avdrag' },
  { url: 'https://www.skatteverket.se/privat/fastigheterochbostad/rotochrutarbete.4.html', ref: 'SKV ROT RUT', rubrik: 'ROT och RUT — avdragsregler och belopp' },
  { url: 'https://www.skatteverket.se/privat/skatter/arbeteochinkomst/askattsedelochskattekolumner/grundavdrag.4.html', ref: 'SKV Grundavdrag', rubrik: 'Grundavdrag — belopp per inkomstnivå' },
  { url: 'https://www.skatteverket.se/privat/skatter/arbeteochinkomst/traktamentenochresekostnader/resekostnaderarbete.4.html', ref: 'SKV Reseavdrag', rubrik: 'Reseavdrag — regler och belopp' },
  { url: 'https://www.skatteverket.se/privat/skatter/arbeteochinkomst/traktamentenochresekostnader/dubbelbosattning.4.html', ref: 'SKV Dubbel bosättning', rubrik: 'Dubbel bosättning — avdragsregler' },
  { url: 'https://www.skatteverket.se/privat/skatter/kapital/vinsterochforluster/aktierochfonder.4.html', ref: 'SKV Aktier fonder', rubrik: 'Aktier och fonder — kapitalvinst och ISK' },
  { url: 'https://www.skatteverket.se/privat/skatter/kapital/vinsterochforluster/bostad.4.html', ref: 'SKV Bostad kapitalvinst', rubrik: 'Kapitalvinst bostad — beräkning och uppskov' },
  { url: 'https://www.skatteverket.se/privat/skatter/kapital/rantor.4.html', ref: 'SKV Ränteavdrag', rubrik: 'Ränteavdrag — regler och begränsningar' },
  { url: 'https://www.skatteverket.se/privat/etjansterochblanketter/svarpavanligafragor/privatpersoner.4.html', ref: 'SKV FAQ Privat', rubrik: 'Vanliga skattefrågor privatpersoner' },

  // SKATTEVERKET — Företag
  { url: 'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/famansforetag/utdelningochlosenfranfamansforetag.4.html', ref: 'SKV 3:12', rubrik: '3:12-regler — utdelning och lön fåmansbolag' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/famansforetag/beraknagrансbeloppet.4.html', ref: 'SKV Gränsbelopp', rubrik: 'Gränsbelopp — beräkning förenklingsregeln och huvudregeln' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/arbetsgivare/lonochersattning/formaner/bilforman.4.html', ref: 'SKV Bilförmån', rubrik: 'Bilförmån — beräkning och förmånsvärde' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/arbetsgivare/lonochersattning/formaner/drivmedelsforman.4.html', ref: 'SKV Drivmedelsförmån', rubrik: 'Drivmedelsförmån — beräkning' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/arbetsgivare/lonochersattning/formaner/bostadsforman.4.html', ref: 'SKV Bostadsförmån', rubrik: 'Bostadsförmån — förmånsvärde' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/arbetsgivare/lonochersattning/formaner/personalvard.4.html', ref: 'SKV Friskvård', rubrik: 'Friskvårdsbidrag och personalvård — regler' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/arbetsgivare/lonochersattning/formaner/jubileumsgavorochminnsgavor.4.html', ref: 'SKV Gåvor anställda', rubrik: 'Gåvor till anställda — skattefria gränser' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/arbetsgivare/lonochersattning/traktamente.4.html', ref: 'SKV Traktamente Arbetsgivare', rubrik: 'Traktamente — arbetsgivarens regler' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/arbetsgivare/lonochersattning/traktamente/utlandstraktamente.4.html', ref: 'SKV Utlandstraktamente', rubrik: 'Utlandstraktamente — belopp per land' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/arbetsgivare/lonochersattning/skatteavdragocharbetsgivaravgifter/arbetsgivaravgifter.4.html', ref: 'SKV Arbetsgivaravgifter', rubrik: 'Arbetsgivaravgifter — satser och regler' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/hemmakontor.4.html', ref: 'SKV Hemkontor', rubrik: 'Hemkontor — avdragsregler' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/moms/momsregler.4.html', ref: 'SKV Moms regler', rubrik: 'Moms — regler och satser' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/moms/representationmoms.4.html', ref: 'SKV Representation moms', rubrik: 'Representation — momsavdrag' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/representation.4.html', ref: 'SKV Representation', rubrik: 'Representation — avdragsregler' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/periodiseringsfond.4.html', ref: 'SKV Periodiseringsfond', rubrik: 'Periodiseringsfond — regler och gränser' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/expansionsfond.4.html', ref: 'SKV Expansionsfond', rubrik: 'Expansionsfond — regler enskild firma' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/egenavgifter.4.html', ref: 'SKV Egenavgifter', rubrik: 'Egenavgifter — satser och beräkning' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/inkurans.4.html', ref: 'SKV Inkurans', rubrik: 'Inkurans — lagervärdering och avdrag' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/rakenskaperochbokforing.4.html', ref: 'SKV Bokföring', rubrik: 'Bokföring — regler och krav' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/nystartadforetag/fskatt.4.html', ref: 'SKV F-skatt', rubrik: 'F-skatt — regler och ansökan' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/aktieochhandelsbolag/utdelningaktier.4.html', ref: 'SKV Utdelning', rubrik: 'Utdelning aktiebolag — regler och skatt' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/konkursochlikvidation.4.html', ref: 'SKV Likvidation', rubrik: 'Likvidation och konkurs — skattefrågor' },

  // RIKSDAGEN — Lagtext via API
  { url: 'https://lagen.nu/1999:1229', ref: 'IL', rubrik: 'Inkomstskattelagen — fulltext' },
  { url: 'https://lagen.nu/1994:200', ref: 'ML', rubrik: 'Mervärdesskattelagen — fulltext' },
  { url: 'https://lagen.nu/1999:1078', ref: 'SFL', rubrik: 'Skatteförfarandelagen — fulltext' },
  { url: 'https://lagen.nu/1999:1078', ref: 'BFL', rubrik: 'Bokföringslagen — fulltext' },

  // BFN — Normgivning
  { url: 'https://www.bfn.se/regelgivning/k-regelverken/k2-regler/', ref: 'BFN K2', rubrik: 'K2 — regelverk för mindre företag' },
  { url: 'https://www.bfn.se/regelgivning/k-regelverken/k3-regler/', ref: 'BFN K3', rubrik: 'K3 — huvudregelverk' },
  { url: 'https://www.bfn.se/regelgivning/k-regelverken/k1-regler/', ref: 'BFN K1', rubrik: 'K1 — enskild firma förenklat' },

  // FAR — Vägledningar (öppna delar)
  { url: 'https://www.far.se/kunskapsutveckling/redovisning/', ref: 'FAR Redovisning', rubrik: 'FAR — redovisningsvägledningar' },
]

// ── HJÄLPFUNKTIONER ──────────────────────────────────────────────────────────

async function fetchPage(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Normiq/1.0; +https://normiq.vercel.app)',
        'Accept-Language': 'sv-SE,sv;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    return cleanHtml(html)
  } catch (err) {
    return null
  }
}

function cleanHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s([.,;:])/g, '$1')
    .trim()
    .slice(0, 8000)
}

async function embed(text) {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  })
  return res.data[0].embedding
}

async function upsert(källa) {
  const { ref, rubrik, url, text } = källa
  const content = `[${ref}] — ${rubrik}\nKälla: ${url}\nUppdaterad: ${new Date().toLocaleDateString('sv-SE')}\n\n${text}`
  const embedding = await embed(content)

  await supabase.from('documents').delete().eq('metadata->>ref', ref)

  const { error } = await supabase.from('documents').insert({
    content,
    metadata: {
      ref,
      rubrik,
      url,
      källa: url.includes('skatteverket') ? 'Skatteverket' : url.includes('bfn') ? 'BFN' : url.includes('riksdagen') ? 'Riksdagen' : 'Övrigt',
      uppdaterad: new Date().toISOString(),
    },
    embedding,
  })

  return error ? `❌ ${error.message}` : `✓`
}

// ── HUVUDFLÖDE ───────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n🔄 Normiq — uppdaterar alla regelkällor`)
  console.log(`📋 ${KÄLLOR.length} källor att hämta\n`)

  let ok = 0
  let fel = 0

  for (const källa of KÄLLOR) {
    process.stdout.write(`  ${källa.ref.padEnd(30)} `)
    const text = await fetchPage(källa.url)

    if (!text || text.length < 200) {
      console.log(`⚠️  Tom sida`)
      fel++
      continue
    }

    const status = await upsert({ ...källa, text })
    console.log(`${status} (${text.length} tecken)`)
    if (status === '✓') ok++ else fel++

    await new Promise(r => setTimeout(r, 600))
  }

  console.log(`\n✅ Klart — ${ok} uppdaterade, ${fel} misslyckades`)
  console.log(`⏱  ${new Date().toLocaleString('sv-SE')}\n`)
}

run()