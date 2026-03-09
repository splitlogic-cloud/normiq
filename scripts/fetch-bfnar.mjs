import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const BFNAR_TEXTS = [
  {
    ref: 'BFNAR 2016:10 K2 p.2.1',
    rubrik: 'K2 — tillämpningsområde',
    text: 'BFNAR 2016:10 (K2) tillämpas av mindre aktiebolag och ekonomiska föreningar som inte är moderföretag i en koncern som ska upprätta koncernredovisning. Ett företag är mindre om det inte uppfyller mer än ett av följande villkor två år i rad: fler än 50 anställda, mer än 40 Mkr i balansomslutning, mer än 80 Mkr i nettoomsättning.',
  },
  {
    ref: 'BFNAR 2016:10 K2 p.10',
    rubrik: 'K2 — avskrivningar och nyttjandeperioder',
    text: 'Avskrivning ska ske linjärt över tillgångens nyttjandeperiod. Om nyttjandeperioden inte kan bestämmas tillförlitligt ska den bestämmas till 5 år för immateriella tillgångar och goodwill till 10 år. Byggnader skrivs av med 2% (hyreshus) eller 4% (industri). Inventarier 20% per år. Datorer och IT-utrustning 3–5 år. Förbrukningsinventarier under halva prisbasbeloppet (26 250 kr 2024) får kostnadsföras direkt.',
  },
  {
    ref: 'BFNAR 2016:10 K2 p.7',
    rubrik: 'K2 — periodisering, förenklingsregel',
    text: 'Förutbetalda kostnader och upplupna intäkter av mindre värde behöver inte redovisas. Med mindre värde menas belopp understigande 5 000 kr per post (fr.o.m. 2026 höjs gränsen till 7 000 kr). Inkomster och utgifter ska periodiseras om de avser annat räkenskapsår och är av väsentlig betydelse.',
  },
  {
    ref: 'BFNAR 2016:10 K2 p.4',
    rubrik: 'K2 — värdering av tillgångar',
    text: 'Anläggningstillgångar värderas till anskaffningsvärde minskat med avskrivningar och nedskrivningar. Omsättningstillgångar värderas till det lägsta av anskaffningsvärde och nettoförsäljningsvärde (lägsta värdets princip). K2 tillåter inte komponentavskrivning — hela tillgången skrivs av på en gång.',
  },
  {
    ref: 'BFNAR 2016:10 K2 p.17',
    rubrik: 'K2 — eget kapital och vinstdisposition',
    text: 'Aktiekapitalet ska vara minst 25 000 kr. Reservfonden är bundet eget kapital. Årets resultat förs till fritt eget kapital (balanserat resultat). Utdelning kräver att det finns täckning för bundet eget kapital efter utdelningen. Förslag till vinstdisposition ska lämnas i förvaltningsberättelsen.',
  },
  {
    ref: 'BFNAR 2016:10 K2 p.18',
    rubrik: 'K2 — årsredovisning, förenklad resultaträkning',
    text: 'K2 tillåter förkortad resultaträkning med start i bruttoresultat för detaljhandel och tillverkning. Kostnadsslagsindelad eller funktionsindelad resultaträkning. Balansräkning med specificerade poster. Notkrav är begränsade jämfört med K3 — t.ex. krävs inte kassaflödesanalys.',
  },
  {
    ref: 'BFNAR 2012:1 K3 p.1',
    rubrik: 'K3 — tillämpningsområde och syfte',
    text: 'BFNAR 2012:1 (K3) är det allmänna rådet för årsredovisning och koncernredovisning. Ska tillämpas av: större företag, moderföretag i koncern oavsett storlek, företag som frivilligt väljer K3. K3 ger en mer rättvisande bild än K2 och kräver mer detaljerade upplysningar.',
  },
  {
    ref: 'BFNAR 2012:1 K3 p.17',
    rubrik: 'K3 — komponentavskrivning',
    text: 'Materiella anläggningstillgångar med betydande delar som har väsentligt skilda nyttjandeperioder ska delas upp i komponenter och skrivas av separat (komponentavskrivning). Gäller framförallt byggnader: stomme, tak, fasad, installationer kan ha olika nyttjandeperioder. K2 tillåter inte komponentavskrivning.',
  },
  {
    ref: 'BFNAR 2012:1 K3 p.29',
    rubrik: 'K3 — uppskjuten skatt',
    text: 'K3 kräver redovisning av uppskjuten skatt på temporära skillnader mellan redovisade och skattemässiga värden. Uppskjuten skattefordran redovisas om det är sannolikt att den kan utnyttjas. K2 redovisar inte uppskjuten skatt. Skillnaden påverkar eget kapital och årets resultat.',
  },
  {
    ref: 'BFNAR 2012:1 K3 p.11',
    rubrik: 'K3 — aktivering av utvecklingskostnader',
    text: 'Enligt K3 får utgifter för utveckling aktiveras som immateriell tillgång om det är sannolikt att de framtida ekonomiska fördelarna tillfaller företaget och anskaffningsvärdet kan beräknas tillförlitligt. K2 tillåter inte aktivering av egenutvecklade immateriella tillgångar.',
  },
  {
    ref: 'BFNAR 2012:1 K3 p.21',
    rubrik: 'K3 — kassaflödesanalys',
    text: 'Större företag som tillämpar K3 ska upprätta kassaflödesanalys. Indirekt metod: utgångspunkt i resultat före skatt, justering för poster som inte ingår i kassaflödet. Direkt metod: specificerar in- och utbetalningar. Kassaflödet delas upp i: löpande verksamhet, investeringsverksamhet, finansieringsverksamhet.',
  },
]

async function embed(text) {
  const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text })
  return res.data[0].embedding
}

async function run() {
  console.log(`Indexerar ${BFNAR_TEXTS.length} BFNAR-regler...`)
  for (const rule of BFNAR_TEXTS) {
    const content = `${rule.ref} — ${rule.rubrik}\n${rule.text}`
    const embedding = await embed(content)
    const { error } = await supabase.from('documents').insert({
      content,
      metadata: { ref: rule.ref, rubrik: rule.rubrik, källa: 'BFNAR' },
      embedding,
    })
    if (error) console.error('Fel:', rule.ref, error.message)
    else console.log('✓', rule.ref)
    await new Promise(r => setTimeout(r, 300))
  }
  console.log('Klart!')
}

run()