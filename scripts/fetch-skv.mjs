import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { config } from 'dotenv'

config({ path: '.env.local' })

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim()
}

function chunkText(text, maxLen = 800) {
  const chunks = []
  const sentences = text.split(/(?<=[.!?])\s+/)
  let current = ''
  for (const s of sentences) {
    if (s.length > maxLen) {
      if (current.trim().length > 100) { chunks.push(current.trim()); current = '' }
      for (let i = 0; i < s.length; i += maxLen) chunks.push(s.slice(i, i + maxLen))
      continue
    }
    const candidate = current ? current + ' ' + s : s
    if (candidate.length > maxLen && current.length > 100) {
      chunks.push(current.trim()); current = s
    } else { current = candidate }
  }
  if (current.trim().length > 100) chunks.push(current.trim())
  return chunks
}

async function storeChunks(chunks, metadata) {
  let ok = 0
  for (const chunk of chunks) {
    try {
      const input = `${metadata.ref} — ${metadata.rubrik}: ${chunk}`.slice(0, 8000)
      const emb = await openai.embeddings.create({ model: 'text-embedding-3-small', input })
      await supabase.from('documents').insert({ content: chunk, metadata, embedding: emb.data[0].embedding })
      ok++
      await sleep(150)
    } catch { process.stdout.write('!') }
  }
  return ok
}

// ── Riksdagens API — officiell lagtext ──────────────────────────────
async function fetchRiksdagen(dokId, ref, rubrik) {
  // Prova flera URL-format
  const urls = [
    `https://data.riksdagen.se/dokument/${dokId}.text`,
    `https://data.riksdagen.se/dokument/${dokId}.html`,
    `https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/${dokId}/?text=true`,
  ]

  console.log(`\n${rubrik}`)
  for (const url of urls) {
    try {
      console.log(`  → ${url}`)
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Normiq/1.0', 'Accept': 'text/html,text/plain' },
        signal: AbortSignal.timeout(20000)
      })
      if (!res.ok) { console.log(`     HTTP ${res.status}`); continue }
      const raw = await res.text()
      const text = raw.startsWith('<') ? stripHtml(raw) : raw
      if (text.length < 500) { console.log(`     För lite text (${text.length})`); continue }
      const chunks = chunkText(text)
      console.log(`     ${chunks.length} chunks`)
      const n = await storeChunks(chunks, { ref, rubrik, lag: rubrik, sfs: ref })
      console.log(`     ✓ ${n} sparade`)
      return n
    } catch (err) { console.log(`     ✗ ${err.message}`) }
  }
  return 0
}

// ── Manuella SKV-texter ──────────────────────────────────────────────
const SKV_MANUELLA = [
  {
    ref: 'SKV 3:12',
    rubrik: 'Fåmansföretag — gränsbelopp 2024 och 2025',
    text: `Schablonbeloppet (förenklingsregeln) för inkomstår 2024 uppgår till 204 325 kronor (2,75 × inkomstbasbeloppet 74 300 kr). Schablonbeloppet för 2025 uppgår till 209 550 kronor (2,75 × inkomstbasbeloppet 76 200 kr).

Förenklingsregeln innebär att gränsbeloppet beräknas till ett schablonbelopp lika för alla delägare. Schablonbeloppet fördelas lika på andelarna. Förenklingsregeln och huvudregeln kan inte kombineras samma år för samma bolag.

Huvudregeln ger ofta högre gränsbelopp för den som tagit ut marknadsmässig lön. Gränsbelopp = omkostnadsbeloppet × (statslåneräntan + 9%) + lönebaserat utrymme. Lönebaserat utrymme = 50% av kontanta löner i bolaget och dotterbolag. Krav på löneuttag: lägst det lägsta av 9,6 IBB (713 280 kr för 2024) eller 6 IBB + 5% av totala löner.

Utdelning upp till gränsbeloppet beskattas som kapital med 20% skatt (2/3 × 30%). Utdelning över gränsbeloppet beskattas som tjänst, max 90 IBB (6 687 000 kr 2024) per person. Belopp däröver beskattas som kapital med 30%.

Sparat utdelningsutrymme räknas upp med statslåneräntan + 3 procentenheter. Vid kapitalvinst på kvalificerade andelar beskattas vinst upp till sparat utrymme som kapital med 20%, resten som tjänst till 2/3 (max 100 IBB), överskjutande del som kapital med 30%.`,
  },
  {
    ref: 'SKV Rep',
    rubrik: 'Representation — avdragsregler och moms 2024',
    text: `Avdrag för måltidsrepresentation medges med högst 90 kronor exklusive moms per person och tillfälle. Avser enbart mat och dryck. Ingen avdragsrätt för alkohol separat.

Ingående moms är avdragsgill på underlag upp till 90 kr/person exkl. moms (22,50 kr i avdragsgill moms vid 25%).

Kundgåvor: avdragsgilla med högst 300 kronor exklusive moms per person och år. Gåvan ska ha ett naturligt samband med verksamheten.

Intern representation (personalfester): avdrag för skäliga kostnader, normalt max 2 tillfällen per år. Ingående moms avdragsgill upp till 90 kr/person exkl. moms för mat och dryck.

Kultur och underhållning (teaterbiljetter, idrottsevenemang): avdragsgilla med högst 180 kronor per person. Ingen momsavdragsrätt.

Dokumentationskrav: notera syfte, deltagare och affärsanknytning. Kvitto krävs alltid. Utan dokumentation kan avdrag vägras.`,
  },
  {
    ref: 'SKV Moms',
    rubrik: 'Moms — fakturakrav och avdragsrätt',
    text: `Avdragsrätt för ingående moms gäller varor och tjänster i momspliktig verksamhet. Vid blandad verksamhet (momspliktig + momsfri) gäller proportionell avdragsrätt.

Momssatser: 25% (normalskattesats), 12% (livsmedel, restaurang, hotelrum), 6% (böcker, tidningar, persontransport, konserter).

Fakturakrav för momsfaktura: utfärdandedatum, löpnummer, säljarens momsregnr (SE + orgnr + 01), köparens namn/adress, varornas/tjänsternas art och mängd, beskattningsunderlag per skattesats, skattesats, momsbelopp i kronor.

Förenklad faktura (under 4 000 kr inkl. moms): behöver inte innehålla köparens uppgifter.

Omvänd skattskyldighet gäller för byggtjänster och vid köp från utländska företag utan svensk momsregistrering.

Redovisningsmetoder: faktureringsmetoden (moms vid fakturadatum) eller bokslutsmetoden (moms vid betalning, tillåts för verksamhet under 3 mkr/år).`,
  },
  {
    ref: 'SKV Inkurans',
    rubrik: 'Inkurans — lagervärdering och skattemässigt avdrag',
    text: `Inkurans innebär att varor minskat i värde p.g.a. svinn, skador, teknisk föråldring, modellskiften eller säsongsvariationer. Inkurant lager får tas upp till lägre värde än anskaffningsvärdet.

Skattemässigt får lager tas upp till lägst 97% av det lägsta av anskaffningsvärdet och nettoförsäljningsvärdet — den s.k. 97-procentsregeln (generell inkuransreserv).

Ytterligare inkuransavdrag medges om verklig inkurans kan styrkas med dokumentation: inventeringslistor, fotografier, kassationsprotokoll, prislistor som visar värdeminskning.

Branscher med hög inkurans (mode, elektronik, livsmedel) kan medges högre avdrag om detta styrks. Inkuransbedömning ska ske per balansdagen. Osäljbara varor skrivs ned till noll.

Värderingsmetod: FIFO (first in, first out) eller viktad genomsnittskostnad. Lägsta värdets princip gäller — det lägsta av anskaffningsvärde och verkligt värde.`,
  },
  {
    ref: 'SKV Förmån',
    rubrik: 'Förmåner — bilförmån, friskvård och övriga förmåner',
    text: `Bilförmån beräknas schablonmässigt: 0,29% per månad av nybilspriset + 1% av prisbasbeloppet × 12, med justering för drivmedel och ålder. Elbilar och laddhybrider har nedsatt förmånsvärde t.o.m. 2026.

Kostförmån (fri lunch): 105 kronor per dag 2024. Beskattas som tjänsteinkomst.

Friskvårdsbidrag: upp till 5 000 kronor per år är skattefritt om det avser enklare friskvård (gym, simning, yoga) och erbjuds alla anställda på likartade villkor.

Datorförmån: arbetsgivardator för arbetsbruk är skattefri om privat användning är begränsad och inte utgör en påtaglig privat förmån.

Personalrabatt på varor/tjänster arbetsgivaren säljer är skattefri upp till sedvanlig rabatt i branschen.

Jubileumsgåvor: skattefria upp till 1 500 kronor inkl. moms vid 25, 50 eller fler år i tjänst. Minnesgåva vid pension: skattefri upp till 15 000 kronor inkl. moms.

Julklapp från arbetsgivaren: skattefri upp till 500 kronor inkl. moms.`,
  },
  {
    ref: 'SKV F-skatt',
    rubrik: 'F-skatt och egenavgifter — regler 2024',
    text: `F-skatt innebär att innehavaren själv betalar preliminärskatt och egenavgifter. Utbetalaren gör inte skatteavdrag och betalar inte arbetsgivaravgifter.

Godkännande söks hos Skatteverket. Krav: personen ska bedriva eller avse att bedriva näringsverksamhet. F-skattsedel kan återkallas vid missbruk.

Preliminärskatt betalas den 12:e varje månad (17:e vid e-betalning), baserat på debiterad preliminärskatt. Eget förslag till preliminär inkomstdeklaration kan lämnas för anpassning.

Egenavgifter 2024: 28,97% på aktiv näringsverksamhet. För dem som fyllt 66 år: 14,57%. Nedsättning med 7,5% för den del av inkomsten som överstiger ett halvt prisbasbelopp.

FA-skatt: kombination av A-skatt (på lön) och F-skatt (på företagsinkomst). Arbetsgivaren drar skatt på lönen men inte på fakturainkomsten.

Överskjutande preliminärskatt betalas tillbaka vid slutlig skatteuträkning. Kvarskatt over 30 000 kr medför kostnadsränta.`,
  },
  {
    ref: 'SKV Avskrivning',
    rubrik: 'Avskrivningar — maskiner, inventarier och byggnader',
    text: `Maskiner och inventarier: räkenskapsenlig avskrivning tillåter avdrag med 30% av det skattemässiga restvärdet per år (30%-regeln), alternativt 20% av årets anskaffningsvärde + ingående restvärde (20%-regeln).

Kompletteringsregeln: inventarier med ekonomisk livslängd max 3 år eller anskaffningsvärde under ett halvt prisbasbelopp (26 250 kr 2024) får dras av omedelbart.

Byggnader: avdrag medges med 2–5% per år beroende på byggnadstyp. Hyreshus: 2%, industribyggnad: 4%, kiosk/bensinstation: 5%. Markinventarier kan skrivas av som inventarier.

K2-förenkling: avskrivning på byggnader och mark kan göras med 1,5–4% schablonmässigt utan komponentavskrivning.

K3-regler: komponentavskrivning krävs för byggnader — varje väsentlig komponent (stomme, tak, installationer) skrivs av separat efter sin nyttjandeperiod.`,
  },
  {
    ref: 'SKV Moms',
    rubrik: 'Moms — omsättningsgräns och frivillig skattskyldighet',
    text: `Omsättningsgräns: företag med skattepliktig omsättning under 120 000 kronor per år kan välja att inte momsregistrera sig (fr.o.m. 2025 höjt från 80 000 kr). Väljer man att inte registrera sig får man inte heller dra av ingående moms.

Frivillig skattskyldighet för fastighetsuthyrning: hyresvärdar kan ansöka om frivillig momsregistrering för uthyrning till momspliktig verksamhet. Krav: hyresgästen bedriver momspliktig verksamhet i lokalerna.

Jämkning av ingående moms: vid investering i fastighet eller kapitalvara (inköpspris över 200 000 kr exkl. moms) sker jämkning om användningen förändras inom 10 år (fastighet) eller 5 år (kapitalvara).

Import och export: export av varor och tjänster till kund utanför EU är momsfri (nollskattesats). Gemenskapsinterna förvärv (köp från EU-land) hanteras med förvärvsbeskattning.`,
  },
]

async function storeManuella() {
  console.log('\n── Manuella SKV-texter (högkvalitet) ────────')
  let total = 0
  for (const item of SKV_MANUELLA) {
    console.log(`\n${item.rubrik}`)
    const chunks = chunkText(item.text)
    const n = await storeChunks(chunks, { ref: item.ref, rubrik: item.rubrik, lag: 'Skatteverkets vägledning', sfs: 'SKV' })
    console.log(`  ✓ ${n} chunks`)
    total += n
    await sleep(300)
  }
  return total
}

// ── Riksdagens dokument-ID:n för de viktigaste lagarna ───────────────
const RIKSDAGEN_LAGAR = [
  { id: 'sfs-1999-1229', ref: 'IL', rubrik: 'Inkomstskattelagen 1999:1229' },
  { id: 'sfs-2023-200',  ref: 'ML', rubrik: 'Mervärdesskattelagen 2023:200' },
  { id: 'sfs-1999-1078', ref: 'BFL', rubrik: 'Bokföringslagen 1999:1078' },
  { id: 'sfs-2005-551',  ref: 'ABL', rubrik: 'Aktiebolagslagen 2005:551' },
  { id: 'sfs-2011-1244', ref: 'SFL', rubrik: 'Skatteförfarandelagen 2011:1244' },
]

async function run() {
  console.log('\n╔════════════════════════════════════════════╗')
  console.log('║   Normiq — SKV + Riksdagen import          ║')
  console.log('╚════════════════════════════════════════════╝')

  let total = 0

  total += await storeManuella()

  console.log('\n── Riksdagens API ────────────────────────────')
  for (const lag of RIKSDAGEN_LAGAR) {
    total += await fetchRiksdagen(lag.id, lag.ref, lag.rubrik)
    await sleep(2000)
  }

  console.log('\n╔════════════════════════════════════════════╗')
  console.log(`║  Totalt: ${String(total).padEnd(5)} chunks indexerade         ║`)
  console.log('╚════════════════════════════════════════════╝\n')
}

run().catch(err => { console.error('\n✗ Fel:', err.message); process.exit(1) })