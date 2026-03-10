import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// SKV-sidor med belopp som uppdateras varje år
const SIDOR = [
  {
    url: 'https://www.skatteverket.se/privat/skatter/arbeteochinkomst/traktamentenochresekostnader/traktamente.4.html',
    ref: 'SKV Traktamente',
    rubrik: 'Traktamente — skattefria belopp',
  },
  {
    url: 'https://www.skatteverket.se/foretagochorganisationer/arbetsgivare/lonochersattning/traktamente.4.html',
    ref: 'SKV Traktamente Arbetsgivare',
    rubrik: 'Traktamente — arbetsgivarens regler',
  },
  {
    url: 'https://www.skatteverket.se/privat/skatter/arbeteochinkomst/traktamentenochresekostnader/milersattning.4.html',
    ref: 'SKV Milersättning',
    rubrik: 'Milersättning — skattefria belopp',
  },
  {
    url: 'https://www.skatteverket.se/foretagochorganisationer/arbetsgivare/lonochersattning/formaner/bilforman.4.html',
    ref: 'SKV Bilförmån',
    rubrik: 'Bilförmån — beräkning och belopp',
  },
  {
    url: 'https://www.skatteverket.se/privat/skatter/arbeteochinkomst/askattsedelochskattekolumner/grundavdrag.4.html',
    ref: 'SKV Grundavdrag',
    rubrik: 'Grundavdrag — belopp per år',
  },
  {
    url: 'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/fastigheterochbyggnader/forsaljningavfastighet/kapitalvinstberakning.4.html',
    ref: 'SKV Kapitalvinst',
    rubrik: 'Kapitalvinst fastighet — beräkning',
  },
  {
    url: 'https://www.skatteverket.se/foretagochorganisationer/arbetsgivare/lonochersattning/skatteavdragocharbetsgivaravgifter/arbetsgivaravgifter.4.html',
    ref: 'SKV Arbetsgivaravgifter',
    rubrik: 'Arbetsgivaravgifter — satser och regler',
  },
  {
    url: 'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/famansforetag/utdelningochlosenfranfamansforetag.4.html',
    ref: 'SKV 3:12',
    rubrik: '3:12-regler — utdelning fåmansbolag',
  },
  {
    url: 'https://www.skatteverket.se/foretagochorganisationer/arbetsgivare/lonochersattning/formaner/personalvard.4.html',
    ref: 'SKV Friskvård',
    rubrik: 'Friskvårdsbidrag och personalvård — regler',
  },
  {
    url: 'https://www.skatteverket.se/foretagochorganisationer/moms/momsregler.4.html',
    ref: 'SKV Moms',
    rubrik: 'Moms — satser och regler',
  },
  {
    url: 'https://www.skatteverket.se/foretagochorganisationer/arbetsgivare/lonochersattning/traktamente/utlandstraktamente.4.html',
    ref: 'SKV Utlandstraktamente',
    rubrik: 'Utlandstraktamente — belopp per land',
  },
  {
    url: 'https://www.skatteverket.se/privat/fastigheterochbostad/rotochrutarbete.4.html',
    ref: 'SKV ROT RUT',
    rubrik: 'ROT och RUT — avdragsregler och belopp',
  },
]

async function fetchPage(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Normiq/1.0)' }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()

    // Extrahera text från HTML — ta bort taggar
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // Ta bara relevant del — max 6000 tecken från mitten av sidan
    const start = Math.max(0, text.indexOf('kr') - 500)
    return text.slice(start, start + 6000)
  } catch (err) {
    console.error(`Fel vid hämtning av ${url}:`, err.message)
    return null
  }
}

async function embed(text) {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000)
  })
  return res.data[0].embedding
}

async function run() {
  console.log(`Hämtar ${SIDOR.length} SKV-sidor...\n`)

  for (const sida of SIDOR) {
    process.stdout.write(`Hämtar ${sida.ref}... `)
    const text = await fetchPage(sida.url)

    if (!text || text.length < 100) {
      console.log('❌ Tom sida, hoppar över')
      continue
    }

    const content = `[${sida.ref}] — ${sida.rubrik}\nKälla: ${sida.url}\n\n${text}`
    const embedding = await embed(content)

    // Ta bort gamla versionen av denna ref
    await supabase
      .from('documents')
      .delete()
      .eq('metadata->>ref', sida.ref)

    const { error } = await supabase.from('documents').insert({
      content,
      metadata: {
        ref: sida.ref,
        rubrik: sida.rubrik,
        källa: 'Skatteverket',
        url: sida.url,
        uppdaterad: new Date().toISOString(),
      },
      embedding,
    })

    if (error) {
      console.log(`❌ Fel: ${error.message}`)
    } else {
      console.log(`✓ (${text.length} tecken)`)
    }

    await new Promise(r => setTimeout(r, 500))
  }

  console.log('\n✅ Klart! SKV-sidor indexerade.')
}

run()