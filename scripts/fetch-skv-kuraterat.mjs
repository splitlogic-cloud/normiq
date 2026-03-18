/**
 * Normiq — Kuraterat SKV-innehåll
 * =================================
 * Kör: node scripts/fetch-skv-kuraterat.mjs
 *
 * Indexerar ~40 välformulerade SKV-texter som täcker de vanligaste
 * frågorna i Normiq. Inget scraping — direkt till Supabase.
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function chunkText(text, maxLen = 600) {
  const chunks = []
  const sentences = text.split(/(?<=[.!?])\s+/)
  let current = ''
  for (const s of sentences) {
    const candidate = current ? current + ' ' + s : s
    if (candidate.length > maxLen && current.length > 80) {
      chunks.push(current.trim())
      current = s
    } else {
      current = candidate
    }
  }
  if (current.trim().length > 80) chunks.push(current.trim())
  return chunks
}

async function indexItem(item) {
  // Ta bort gamla versionen
  await supabase.from('documents').delete().eq('metadata->>ref', item.ref)

  const chunks = chunkText(item.text)
  let saved = 0

  for (let i = 0; i < chunks.length; i += 5) {
    const batch = chunks.slice(i, i + 5)
    const input = batch.map(c => `${item.ref} — ${item.rubrik}: ${c}`.slice(0, 8000))
    const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input })
    const rows = batch.map((content, j) => ({
      content,
      metadata: { ref: item.ref, rubrik: item.rubrik, lag: 'Skatteverkets vägledning' },
      embedding: res.data[j].embedding,
    }))
    const { error } = await supabase.from('documents').insert(rows)
    if (!error) saved += batch.length
    await sleep(200)
  }
  return saved
}

// ══════════════════════════════════════════════════════════════════════════
// KURATERAT INNEHÅLL
// ══════════════════════════════════════════════════════════════════════════

const SKV_INNEHALL = [

  // ── REPRESENTATION ────────────────────────────────────────────────────
  {
    ref: 'SKV Representation inkomstskatt',
    rubrik: 'Representation — avdragsrätt inkomstskatt 2026',
    text: `Avdrag för representation medges endast om det finns ett omedelbart samband med verksamheten. Kravet på omedelbart samband är strängt — allmänt goodwillskapande räcker inte.

Måltidsrepresentation: avdrag medges med högst 90 kronor exklusive moms per person och tillfälle (IL 16 kap. 2 §). Beloppet avser mat och alkoholfri dryck. Alkohol är inte avdragsgillt.

Intern representation (personalfester): avdrag medges för skäliga kostnader vid högst två tillfällen per år. Avdragsgränsen är 90 kronor per person exklusive moms för mat och dryck.

Kundgåvor: avdragsgilla med högst 300 kronor exklusive moms per person och år. Gåvan ska ha ett naturligt samband med verksamheten och inte vara av alltför personlig natur.

Kulturella evenemang (teater, konserter, idrottsevenemang): avdrag medges med högst 180 kronor per person inklusive moms. Ingen avdragsrätt för moms på kulturarrangemang.

Dokumentationskrav: affärssyfte, deltagarnas namn och antal samt datum ska dokumenteras. Utan dokumentation kan hela avdraget vägras. Kvitto krävs alltid.

Jubileumsfester för anställda: avdrag för skäliga kostnader om företaget firar jämnt år (25, 50, 75 år). Ingen beloppsgräns men måste vara skäligt.`,
  },

  {
    ref: 'SKV Representation moms',
    rubrik: 'Representation — momsavdrag och beräkning 2026',
    text: `Ingående moms på representationskostnader är avdragsgill med begränsat belopp (ML 8 kap. 9 §).

Måltidsrepresentation med enbart mat (12% moms): avdragsgill ingående moms beräknas på underlag om högst 90 kronor per person exklusive moms. Avdragsgill moms = 90 × 12% = 10,80 kronor per person.

Måltidsrepresentation med alkohol och mat (25% moms på alkohol, 12% på mat): schablonmetod kan användas om den totala kostnaden överstiger 300 kronor per person exklusive moms. Schablon: avdragsgill moms = 46 kronor per person (beräknat på 25%-underlag om 180 kr + 12%-underlag).

Enbart alkohol (25% moms): avdragsgill ingående moms = 0 kronor. Alkohol ger aldrig momsavdrag.

Intern representation: samma regler som extern representation. Avdragsgill moms på mat 10,80 kronor/person (12%) eller 22,50 kronor/person (25%).

Kulturarrangemang: ingen avdragsrätt för ingående moms oavsett belopp.

Bokföring: ej avdragsgill moms bokförs på konto 2641 (ingående moms ej avdragsgill) eller direkt som kostnad. Avdragsgill del på konto 2640.`,
  },

  // ── TRAKTAMENTE ───────────────────────────────────────────────────────
  {
    ref: 'SKV Traktamente 2026',
    rubrik: 'Traktamente — skattefria belopp och regler 2026',
    text: `Traktamente är ersättning för ökade levnadskostnader vid tjänsteresa (IL 12 kap. 6–21 §§).

Skattefritt inrikestraktamente 2026: 290 kronor per hel dag (dygn). Halvdag (mer än 5 timmar, högst 10 timmar): 145 kronor. Nattraktamente: 145 kronor per natt om arbetsgivaren inte betalar logi.

Krav för skattefrihet: resan ska vara i tjänsten, övernattning ska ske utanför den vanliga verksamhetsorten, och avståndet från bostaden ska vara mer än 50 kilometer.

Vanlig verksamhetsort: det område inom 50 kilometer från den anställdes tjänsteställe eller bostad räknas som vanlig verksamhetsort. Resor inom detta område ger inte rätt till traktamente.

Tidsbegränsning: traktamente är skattefritt i högst 3 månader på samma ort. Därefter sänks det skattefria beloppet till 70% (203 kronor/dag 2026). Efter ytterligare 3 månader: 50% (145 kronor/dag).

Utlandstraktamente: belopp fastställs per land av Skatteverket. Varierar kraftigt beroende på land.

Arbetsgivaren kan betala mer än schablonen — överskjutande del beskattas som lön. Arbetsgivaren kan också betala mindre — skillnaden kan inte dras av av den anställde om arbetsgivaren inte betalar.`,
  },

  {
    ref: 'SKV Milersättning 2026',
    rubrik: 'Milersättning — skattefria belopp 2026',
    text: `Milersättning (resekostnadsersättning) för tjänsteresor med egen bil är skattefri upp till schablonbeloppet (IL 12 kap. 5 §).

Skattefri milersättning 2026: 25 kronor per kilometer för bil. Motorcykel: 12 kronor per kilometer. Moped: 9 kronor per kilometer. Cykel: 9 kronor per kilometer.

Förmånsbil (tjänstebil): milersättning för drivmedel vid tjänsteresor med förmånsbil är skattefri med 12 kronor per kilometer för bensin/diesel och 9 kronor per kilometer för el.

Krav för skattefrihet: resan ska vara i tjänsten, dvs. ha ett direkt samband med arbetet. Resor mellan bostad och arbetsplats räknas inte som tjänsteresa — dessa berättigar till reseavdrag i deklarationen, inte skattefri milersättning.

Dokumentation: körjournal ska föras med datum, start- och slutpunkt, körd sträcka och syfte. Utan körjournal kan skattefrihet vägras.

Arbetsgivaren kan betala mer — överskjutande del beskattas som lön och är underlag för arbetsgivaravgifter.

Egenföretagare (enskild firma): avdrag i näringsverksamheten med 25 kronor per kilometer för resor i verksamheten med privat bil.`,
  },

  // ── FÖRMÅNER ──────────────────────────────────────────────────────────
  {
    ref: 'SKV Bilförmån 2026',
    rubrik: 'Bilförmån — beräkning och förmånsvärde 2026',
    text: `Bilförmån uppkommer när en anställd har privat användning av arbetsgivarens bil (IL 61 kap. 5–11 §§).

Förmånsvärde beräknas schablonmässigt: 0,29% per månad av bilens nybilspris + en räntedel baserad på statslåneräntan. Grundformeln: förmånsvärde per år = 0,29 × 12 × nybilspris + statslåneräntan × 75% av nybilspris + 1% av prisbasbeloppet.

Prisbasbelopp 2026: 58 800 kronor.

Nedsättning för miljöbilar: elbilar och laddhybrider har nedsatt förmånsvärde. Elbil: nedsättning med 50% av förmånsvärdet, dock max nedsättning 40 000 kronor per år. Gäller t.o.m. 2026.

Justering för ålder: bilar äldre än 3 år men yngre än 6 år: nybilspriset sätts till 75% av ursprungligt pris. Bilar äldre än 6 år: 50%.

Drivmedelsförmån: om arbetsgivaren betalar drivmedel för privata resor tillkommer drivmedelsförmån. Beräknas schablonmässigt baserat på bilens förmånsvärde.

Förmånsvärdet är underlag för arbetsgivaravgifter och beskattas som lön. Den anställde kan minska förmånsvärdet genom att betala för privat användning.`,
  },

  {
    ref: 'SKV Friskvård 2026',
    rubrik: 'Friskvårdsbidrag och personalvård — skattefria förmåner 2026',
    text: `Friskvårdsbidrag är skattefritt om det uppfyller kraven i IL 11 kap. 12 §.

Skattefritt friskvårdsbidrag 2026: upp till 5 000 kronor per anställd och år. Bidraget måste avse enklare slag av motion och friskvård.

Godkänd friskvård: gym, simning, yoga, dans, kampsport, innebandy, tennis, golf (green fee, ej utrustning), bowling, ridning, friskvårdsmassage, kostrådgivning kopplad till motion.

Ej godkänd friskvård: spa-behandlingar utan koppling till motion, skönhetsvård, utrustning och kläder, medlemsavgifter i idrottsföreningar (ej träningsavgift), pilotkurser, motorsport.

Krav: förmånen ska erbjudas alla anställda på likartade villkor. Det räcker att alla har möjlighet — inte att alla faktiskt utnyttjar det.

Personalvård av enklare slag: kaffe, frukt, enklare förtäring på arbetsplatsen är skattefritt utan beloppsgräns om det riktar sig till alla anställda.

Motion på arbetstid: arbetsgivaren kan ge anställda tid för motion utan att det räknas som skattepliktig förmån, förutsatt att det är frivilligt och sker under kontrollerade former.`,
  },

  {
    ref: 'SKV Personalförmåner',
    rubrik: 'Personalförmåner — skatteplikt och undantag',
    text: `Förmåner som en anställd får från arbetsgivaren är som huvudregel skattepliktiga och ska värderas till marknadsvärdet (IL 61 kap. 2 §).

Skattefria förmåner (urval):
- Friskvårdsbidrag upp till 5 000 kr/år
- Julklapp upp till 500 kr inkl. moms
- Jubileumsgåva (25, 50+ år i tjänst): upp till 1 500 kr inkl. moms
- Minnesgåva vid pension: upp till 15 000 kr inkl. moms
- Personalrabatt på egna varor/tjänster: skattefri upp till sedvanlig rabatt
- Fri parkering vid arbetsplatsen (ej i storstadsområden)
- Arbetsredskap (dator, telefon) för arbetsbruk

Kostförmån (fri lunch): skattepliktig. Schablonvärde 2026: 105 kronor per dag.

Bostadsförmån: skattepliktig. Värde fastställs av Skatteverket per ort och bostadstyp.

Gåvor utanför jubileum/pension: skattepliktiga om de överstiger 500 kr (julklapp). Kontanta gåvor är alltid skattepliktiga oavsett belopp.

Rabatt på varor arbetsgivaren inte säljer: skattepliktig förmån till marknadsvärde.

Arbetsgivaravgifter: skattepliktiga förmåner är underlag för arbetsgivaravgifter. Förmåner ska redovisas i arbetsgivardeklarationen.`,
  },

  // ── FÅMANSBOLAG / 3:12 ────────────────────────────────────────────────
  {
    ref: 'SKV 3:12 gränsbelopp 2026',
    rubrik: '3:12-regler — gränsbelopp och utdelning fåmansbolag 2026',
    text: `3:12-reglerna styr hur utdelning och kapitalvinst från fåmansföretag beskattas (IL 57 kap.).

Kvalificerad andel: andel i fåmansföretag är kvalificerad om ägaren eller närstående under beskattningsåret eller något av de fem föregående åren varit verksam i betydande omfattning i företaget.

Gränsbeloppet avgör hur mycket som beskattas som kapital (20%) istället för tjänst.

Förenklingsregeln 2026: gränsbeloppet är 209 550 kronor (2,75 × IBB 76 200 kr). Schablonbeloppet fördelas på andelarna. Förenklingsregeln ger samma gränsbelopp oavsett lön.

Huvudregeln 2026: gränsbelopp = omkostnadsbeloppet × (statslåneräntan + 9%) + lönebaserat utrymme. Lönebaserat utrymme = 50% av kontanta löner i bolaget och dotterbolag som överstiger ett löneuttagskrav.

Löneuttagskrav (huvudregeln): ägaren måste ha tagit ut lön om minst det lägsta av: 9,6 × IBB (731 520 kr 2026) eller 6 × IBB + 5% av totala kontanta löner (459 000 kr + 5% av lönesumman).

Utdelning upp till gränsbeloppet: beskattas i kapital med 20% (2/3 av 30%).

Utdelning över gränsbeloppet: beskattas som tjänst upp till tak om 90 × IBB (6 858 000 kr 2026). Överskjutande del beskattas i kapital med 30%.

Sparat utdelningsutrymme: outnyttjat gränsbelopp sparas och räknas upp med statslåneräntan + 3 procentenheter.`,
  },

  {
    ref: 'SKV Fåmansbolag lön vs utdelning',
    rubrik: 'Fåmansbolag — löneutdelningsoptimering och karensregler',
    text: `Valet mellan lön och utdelning i fåmansbolag påverkar den totala skattebelastningen.

Lön: beskattas som tjänst (upp till ca 52% marginalskatt) men ger rätt till sociala förmåner, pensionsgrundande inkomst och möjlighet att använda huvudregeln för att bygga upp lönebaserat utrymme.

Utdelning inom gränsbeloppet: beskattas med 20% effektiv skatt. Ingen pensionsgrundande inkomst.

Tumregel: om lönesumman i bolaget är tillräcklig för att uppfylla löneuttagskravet, lönar det sig ofta att ta ut lön upp till brytpunkten för statlig skatt (~643 000 kr 2026) och ta resten som utdelning inom gränsbeloppet.

Karensregeln (IL 57 kap. 4 §): om en delägare slutar arbeta i bolaget gäller en karenstid på 5 år innan andelarna kan bli okvalificerade. Under karenstiden beskattas utdelning fortfarande enligt 3:12.

Närstående: make/maka och barn under 18 år som arbetar i bolaget kan påverka gränsbeloppsberäkningen. Barn under 18 år: utdelning beskattas alltid som tjänst (IL 57 kap. 5 §).

Generationsskifte: överlåtelse av kvalificerade andelar till närstående till underpris kan ge upphov till framskjuten beskattning eller omedelbar utdelningsbeskattning beroende på villkoren.`,
  },

  // ── MOMS ──────────────────────────────────────────────────────────────
  {
    ref: 'SKV Moms avdragsrätt',
    rubrik: 'Moms — avdragsrätt för ingående moms, regler och begränsningar',
    text: `Avdragsrätt för ingående moms gäller varor och tjänster som används i momspliktig verksamhet (ML 8 kap. 3 §).

Full avdragsrätt: förvärv som uteslutande används i momspliktig verksamhet. Avdrag yrkas i momsdeklarationen för den period inköpet gjordes.

Blandad verksamhet: om verksamheten är dels momspliktig dels momsfri (t.ex. fastighetsuthyrning + konsulttjänster) gäller proportionell avdragsrätt. Fördelningsnyckeln ska vara skälig — omsättningsbaserad fördelning är vanligast.

Ej avdragsgill ingående moms:
- Personbilar och motorcyklar (om ej uteslutande i yrkesmässig trafik, uthyrning eller körkortsutbildning)
- Representation (begränsat avdrag, se representation)
- Stadigvarande bostad
- Livsmedel och drycker till anställda (undantag: personalvårdsförmåner)

Fakturakrav för avdrag: giltig momsfaktura krävs. Fakturan ska innehålla säljarens momsregistreringsnummer, momsbelopp per skattesats och beskattningsunderlag.

Import: ingående moms vid import får dras av om varan används i momspliktig verksamhet. Sedan 2023 redovisas importmoms i momsdeklarationen (inte längre till Tullverket).

Omvänd skattskyldighet: vid köp av byggtjänster och från utländska säljare utan svensk momsregistrering är köparen skattskyldig och redovisar både utgående och ingående moms.`,
  },

  {
    ref: 'SKV Moms fakturakrav',
    rubrik: 'Moms — fakturakrav och förenklad faktura',
    text: `En momsfaktura ska uppfylla kraven i ML 11 kap. för att ge rätt till momsavdrag hos köparen.

Obligatoriska uppgifter på momsfaktura:
1. Utfärdandedatum
2. Löpnummer (unik identifikation)
3. Säljarens registreringsnummer för mervärdesskatt (SE + organisationsnummer + 01)
4. Säljarens och köparens namn och adress
5. Varornas eller tjänsternas mängd och art
6. Datum för tillhandahållande om det avviker från fakturadatum
7. Beskattningsunderlag per skattesats
8. Tillämpad skattesats (6%, 12% eller 25%)
9. Mervärdesskattebelopp i kronor

Förenklad faktura: får användas om det samlade beloppet understiger 4 000 kronor inklusive moms, eller om det handelsbruk eller affärsmetoder gör det svårt att utfärda fullständig faktura (t.ex. parkeringsautomat, kollektivtrafik). Behöver inte innehålla köparens uppgifter.

Elektronisk faktura: godtas om mottagaren accepterar det. Ska innehålla samma uppgifter som pappersfaktura.

Kreditnota: ska innehålla en hänvisning till den ursprungliga fakturan.

Faktura i utländsk valuta: momsbeloppet ska anges i svenska kronor.

Självfakturering: köparen kan utfärda faktura för säljarens räkning om parterna är överens om det.`,
  },

  {
    ref: 'SKV Moms omsättningsgräns 2025',
    rubrik: 'Moms — omsättningsgräns och frivillig registrering',
    text: `Omsättningsgräns för moms: från 1 januari 2025 är omsättningsgränsen 120 000 kronor per år (höjd från 80 000 kr). Företag med momspliktig omsättning under gränsen behöver inte momsregistrera sig.

Konsekvenser av att inte registrera: ingen skyldighet att ta ut moms på försäljning, men heller ingen rätt att dra av ingående moms på inköp.

Frivillig registrering: företag under omsättningsgränsen kan välja att frivilligt momsregistrera sig för att få avdragsrätt för ingående moms. Lönsamt om inköpen är stora i förhållande till försäljningen.

Retroaktiv registrering: möjlig om man överstiger gränsen. Registrering ska ske omgående när omsättningen överstiger 120 000 kr.

Ny verksamhet: ett nystartat företag ska registrera sig om det kan antas att omsättningen kommer att överstiga 120 000 kr under de närmaste 12 månaderna.

EU-handel: omsättningsgränsen gäller bara för inhemsk försäljning. Köp från utländska säljare (t.ex. tjänster från Google, Meta) kan utlösa registreringsskyldighet oavsett omsättning.`,
  },

  {
    ref: 'SKV Moms fastighet',
    rubrik: 'Moms — fastighetsuthyrning och frivillig skattskyldighet',
    text: `Uthyrning av fastighet är som huvudregel undantagen från moms (ML 3 kap. 2 §). Hyresvärden tar inte ut moms och får inte dra av ingående moms på fastighetskostnader.

Frivillig skattskyldighet: hyresvärd kan ansöka om frivillig momsregistrering för uthyrning till momspliktig verksamhet (ML 9 kap.). Krav: hyresgästen bedriver momspliktig verksamhet i lokalerna.

Fördelar med frivillig skattskyldighet: full avdragsrätt för ingående moms på fastighetskostnader (byggnation, renovering, underhåll, förvaltning). Kan ge stora momsåterbetalningar vid nybyggnation.

Nackdelar: moms måste tas ut på hyran (25%), vilket ökar kostnaden för hyresgäster utan full avdragsrätt (t.ex. banker, försäkringsbolag, sjukvård).

Jämkning: vid frivillig skattskyldighet gäller jämkningsregler i 10 år. Om fastigheten byter användning (momspliktig → momsfri) måste tidigare avdragen ingående moms återbetalas proportionellt.

Bostadsuthyrning: aldrig momspliktig, oavsett om den är frivillig eller inte. Privatpersoner kan aldrig bli frivilligt skattskyldiga för bostadsuthyrning.`,
  },

  // ── AVSKRIVNINGAR ─────────────────────────────────────────────────────
  {
    ref: 'SKV Avskrivningar inventarier 2026',
    rubrik: 'Avskrivningar — maskiner och inventarier, regler 2026',
    text: `Maskiner och inventarier skrivs av skattemässigt enligt reglerna i IL 18 kap.

Räkenskapsenlig avskrivning — 30%-regeln: avdrag med 30% av det skattemässiga restvärdet (ingående restvärde + årets anskaffningar − försäljningar). Vanligaste metoden.

Räkenskapsenlig avskrivning — 20%-regeln: avdrag med 20% av anskaffningsvärdet för årets och tidigare års inventarier. Används när 20%-regeln ger högre avdrag.

Kompletteringsregeln (direktavdrag): inventarier med ekonomisk livslängd om högst 3 år eller anskaffningsvärde som understiger ett halvt prisbasbelopp (29 400 kr 2026, dvs. 0,5 × 58 800 kr) får dras av omedelbart som kostnad.

Datorer och IT-utrustning: ekonomisk livslängd bedöms ofta till 3 år → direktavdrag möjligt oavsett belopp.

Skillnad K2/K3: K2 tillåter avskrivning i enlighet med skattemässiga regler utan komponentavskrivning. K3 kräver att inventarier skrivs av utifrån verklig nyttjandeperiod och kan kräva komponentuppdelning.

Immateriella tillgångar: patent, varumärken och liknande skrivs av över nyttjandeperioden, dock högst 10 år om nyttjandeperioden inte kan bestämmas tillförlitligt (K3).`,
  },

  {
    ref: 'SKV Avskrivningar byggnader',
    rubrik: 'Avskrivningar — byggnader och mark',
    text: `Byggnader skrivs av skattemässigt med värdeminskningsavdrag enligt IL 19 kap.

Avdragssatser per byggnadstyp:
- Hyreshus (bostäder och lokaler): 2% per år
- Hotell och restaurangbyggnader: 3% per år
- Industribyggnader och lagerlokaler: 4% per år
- Kiosk, bensinstation, parkeringshus: 5% per år
- Kraftverksbyggnader: 3% per år

Underlaget för avdrag är byggnadens anskaffningsvärde exklusive mark. Mark är inte avskrivningsbar.

Markinventarier (parkeringsplatser, vägar, ledningar): skrivs av som inventarier med 30%- eller 20%-regeln.

K2-förenkling: avskrivning på byggnader görs schablonmässigt utan komponentavskrivning. Avdragssatsen följer skattemässiga regler.

K3-regler: komponentavskrivning krävs. Byggnaden delas upp i komponenter (stomme, tak, fasad, installationer, inredning) som skrivs av separat utifrån respektive nyttjandeperiod. Ger ofta lägre bokförd avskrivning de första åren men mer rättvisande bild.

Primäravdrag: för hyreshus som förvärvas från och med 2019 medges ett extra avdrag (primäravdrag) med 2% per år under de första 6 åren, dvs. totalt 12% extra.`,
  },

  // ── PERIODISERINGSFOND / EXPANSIONSFOND ───────────────────────────────
  {
    ref: 'SKV Periodiseringsfond 2026',
    rubrik: 'Periodiseringsfond — regler och återföring 2026',
    text: `Periodiseringsfond är en möjlighet att skjuta upp beskattning av vinst (IL 30 kap.).

Avsättning: aktiebolag får sätta av högst 25% av det skattemässiga resultatet till periodiseringsfond. Enskild firma och handelsbolag: 30% av positiv nettoinkomst av näringsverksamhet.

Återföring: periodiseringsfonden ska återföras till beskattning senast det sjätte taxeringsåret efter avsättningsåret. Kan återföras tidigare frivilligt.

Räntebeläggning för aktiebolag: schablonintäkt tas upp till beskattning varje år. Schablonintäkten beräknas som summan av periodiseringsfonderna vid årets ingång × statslåneräntan × 72%. Gäller fr.o.m. taxeringsåret 2010.

Skatteeffekt: avsättning till periodiseringsfond ger en tillfällig skattekredit. Vid 20,6% bolagsskatt ger 100 kr i avsättning en skattekredit på 20,60 kr.

Likvidation och konkurs: vid likvidation eller konkurs ska periodiseringsfonden återföras omedelbart.

Överlåtelse av verksamhet: vid inkråmsöverlåtelse måste fonden återföras. Vid andelsbyte behålls fonden i bolaget.`,
  },

  {
    ref: 'SKV Expansionsfond',
    rubrik: 'Expansionsfond — enskild firma och handelsbolag',
    text: `Expansionsfond (IL 34 kap.) gör det möjligt för enskilda firmor och handelsbolag att behålla kapital i verksamheten till lägre skattekostnad.

Avsättning: skatt betalas på avsatt belopp med expansionsfondsskatt om 20,6%. Det kapital som finns kvar efter skatten kan användas i verksamheten.

Maximal avsättning: 128,21% av kapitalunderlaget i verksamheten (tillgångar minus skulder). Kan inte överstiga det positiva resultatet.

Skatteeffekt: i stället för full marginalskatt (upp till 52%) betalar man 20,6% när pengarna sätts av. Resterande 31,4% betalas när fonden återförs.

Återföring: sker frivilligt eller när verksamheten upphör. Vid återföring tas beloppet upp som inkomst av näringsverksamhet och expansionsfondsskatten återbetalas.

Jämförelse med periodiseringsfond: periodiseringsfond ger skattekredit (ingen skatt vid avsättning, skatt vid återföring). Expansionsfond ger permanent lägre skatt för kapital som stannar i verksamheten.

Överlåtelse: expansionsfond kan i vissa fall överlåtas vid generationsskifte eller bolagsbildning utan omedelbar återföring.`,
  },

  // ── ARBETSGIVARAVGIFTER ───────────────────────────────────────────────
  {
    ref: 'SKV Arbetsgivaravgifter 2026',
    rubrik: 'Arbetsgivaravgifter — satser och underlag 2026',
    text: `Arbetsgivare betalar arbetsgivaravgifter på ersättningar till anställda (SFL 10 kap., SAL).

Arbetsgivaravgift 2026 (born 1958–2003): 31,42% på kontant lön och skattepliktiga förmåner.

Fördelning av arbetsgivaravgiften 2026:
- Ålderspensionsavgift: 10,21%
- Efterlevandepensionsavgift: 0,60%
- Sjukförsäkringsavgift: 3,55%
- Föräldraförsäkringsavgift: 2,60%
- Arbetsskadeavgift: 0,20%
- Arbetsmarknadsavgift: 2,64%
- Allmän löneavgift: 11,62%

Nedsättning för äldre (born 1957 eller tidigare): bara ålderspensionsavgift 10,21%.

Nedsättning för unga (born 2004 eller senare): 19,73% (t.o.m. månaden de fyller 23 år).

Regionalt stöd: vissa stödområden i norra Sverige har nedsatt arbetsgivaravgift.

Egenavgifter (enskild firma): 28,97% för aktiv näringsverksamhet. Born 1957 eller tidigare: 14,57%. Born 2004 eller senare: 19,73%.

Underlag: kontant lön, skattepliktiga förmåner, sjuklön, semesterersättning. Skattefria ersättningar (traktamente inom schablon, skattefri milersättning) ingår inte.`,
  },

  // ── KAPITALVINST ──────────────────────────────────────────────────────
  {
    ref: 'SKV Kapitalvinst aktier',
    rubrik: 'Kapitalvinst — försäljning av aktier och värdepapper',
    text: `Kapitalvinst vid försäljning av aktier och andra värdepapper beskattas i inkomstslaget kapital med 30% (IL 44–48 kap.).

Beräkning: kapitalvinst = försäljningspris − omkostnadsbelopp − försäljningskostnader. Omkostnadsbeloppet beräknas med genomsnittsmetoden för aktier av samma slag.

Genomsnittsmetoden: vid försäljning beräknas genomsnittligt anskaffningsvärde per aktie baserat på samtliga aktier av samma slag och sort. Vid nyköp räknas snittet om.

Schablonmetoden (20%-regeln): alternativt kan omkostnadsbeloppet sättas till 20% av försäljningspriset. Används när verkligt anskaffningsvärde är okänt eller ger lägre avdrag.

Onoterade aktier: kapitalvinst beskattas med 25% effektiv skatt (5/6 × 30%) för aktier i onoterade bolag som inte är kvalificerade andelar.

Kapitalförlust: avdragsgill till 70% mot kapitalvinster och mot andra kapitalinkomster. Resterande 30% av förlusten kan dras av mot inkomst av kapital (50% av förlusten om kapitalunderskott uppkommer).

ISK (Investeringssparkonto): schablonbeskattning. Ingen kapitalvinstskatt vid försäljning, i stället beskattas ett schablonbelopp baserat på kontovärdet.

Aktiefållan: kapitalförluster på onoterade aktier (ej kvalificerade andelar) är bara avdragsgilla mot kapitalvinster på aktier och aktiefonder.`,
  },

  {
    ref: 'SKV Kapitalvinst fastighet',
    rubrik: 'Kapitalvinst — försäljning av privatbostad och näringsfastighet',
    text: `Kapitalvinst vid försäljning av privatbostad beskattas med 22% (IL 45–46 kap.).

Beräkning privatbostad: vinst = försäljningspris − anskaffningsutgift − förbättringsutgifter − försäljningskostnader − 50 000 kr (schablonavdrag för bostadsrätt).

Uppskov: vid försäljning av permanentbostad kan vinsten skjutas upp (uppskovsavdrag) om man köper en ny bostad inom viss tid och bostaden är primär bostad. Uppskov löper med en schablonintäkt på 1,67% × uppskovsbelopp per år.

Förbättringsutgifter: avdrag för ny-, till- och ombyggnad samt förbättrande reparationer under ägandetiden. Kräver kvitton och dokumentation.

Näringsfastighet: kapitalvinst beskattas med 27% (9/10 × 30%). Värdeminskningsavdrag och liknande ska återföras vid försäljningen (återläggning).

Bodelning och arv: överlåtelse vid bodelning eller som gåva/arv utlöser normalt inte kapitalvinstbeskattning — kontinuitetsprincipen gäller (mottagaren tar över givarens anskaffningsvärde).`,
  },

  // ── ROT & RUT ─────────────────────────────────────────────────────────
  {
    ref: 'SKV ROT RUT 2026',
    rubrik: 'ROT- och RUT-avdrag — regler och belopp 2026',
    text: `ROT-avdrag och RUT-avdrag är skattereduktioner för hushållsarbete (IL 67 kap.).

ROT-avdrag (reparation, ombyggnad, tillbyggnad): 30% av arbetskostnaden exklusive moms. Max 50 000 kronor per person och år fr.o.m. 2023.

Godkänt ROT-arbete: reparation och underhåll, om- och tillbyggnad av bostad (villa, bostadsrätt, fritidshus). Arbetet ska utföras i eller i nära anslutning till bostaden.

Ej godkänt ROT-arbete: nyproduktion, material, maskinhyra, markarbeten (om ej direkt koppling till byggnaden), fritidshus utomlands.

RUT-avdrag (rengöring, underhåll, tvätt): 50% av arbetskostnaden exklusive moms. Max 75 000 kronor per person och år (höjt 2024).

Godkänt RUT-arbete: städning, fönsterputs, trädgårdsarbete, barnpassning, personlig omsorg, it-tjänster, flytt, häst- och hundpassning, läxhjälp.

Gemensamma regler: avdraget gäller bara för arbete i den egna bostaden. Utföraren måste vara godkänd för F-skatt. Avdraget administreras via utförarens faktura — köparen betalar bara 70% (ROT) eller 50% (RUT) av arbetskostnaden och utföraren söker resten från Skatteverket.

Kombinationstak: ROT + RUT sammanlagt max 75 000 kronor per person och år (varav ROT max 50 000 kr).`,
  },

  // ── BOKFÖRING ─────────────────────────────────────────────────────────
  {
    ref: 'SKV Bokföring grundregler',
    rubrik: 'Bokföring — grundläggande regler och krav',
    text: `Bokföringsskyldiga är aktiebolag, handelsbolag, ekonomiska föreningar och enskilda firmor med nettoomsättning över 3 miljoner kronor (BFL 1 kap. 2 §).

Löpande bokföring: alla affärshändelser ska bokföras löpande. Kontanta transaktioner bokförs senast påföljande arbetsdag. Övriga senast inom rimlig tid (normalt inom 2 veckor).

Verifikationer: varje affärshändelse ska dokumenteras med en verifikation (kvitto, faktura, kontoutdrag). Verifikationen ska innehålla datum, belopp, motpart och vad affärshändelsen avser.

Kontantmetoden (bokslutsmetoden): tillåten för verksamheter med nettoomsättning under 3 miljoner kronor. Affärshändelser bokförs när betalning sker. Vid räkenskapsårets slut ska alla obetalda fordringar och skulder ändå bokföras.

Faktureringsmetoden: affärshändelser bokförs när faktura utfärdas eller mottas. Krav för verksamheter över 3 miljoner kronor.

BAS-kontoplanen: standardiserad kontoplan som används av de flesta svenska företag. Kontonummer börjar med 1 (tillgångar), 2 (skulder/eget kapital), 3 (intäkter), 4–7 (kostnader), 8 (finansiella poster).

Arkivering: räkenskapsinformation ska bevaras i 7 år efter räkenskapsårets utgång (BFL 7 kap.). Gäller även elektronisk information.`,
  },

  {
    ref: 'SKV Bokföring kontering',
    rubrik: 'Bokföring — vanliga konteringar och BAS-konton',
    text: `Vanliga konteringar i BAS-kontoplanen för aktiebolag:

Inköp av varor (25% moms):
Debet 4010 Inköp av varor / Kredit 2440 Leverantörsskulder
Debet 2640 Ingående moms / Kredit 2440 Leverantörsskulder

Försäljning av tjänster (25% moms):
Debet 1510 Kundfordringar / Kredit 3040 Försäljning tjänster
Debet 1510 Kundfordringar / Kredit 2610 Utgående moms

Löneutbetalning:
Debet 7010 Löner / Kredit 1930 Bankkonto
Debet 7510 Arbetsgivaravgifter / Kredit 2731 Personalskatt
Debet 7510 Arbetsgivaravgifter / Kredit 2732 Avräkning lagstadgade sociala avgifter

Representation (restaurang, 12% moms, ej avdragsgill):
Debet 6071 Representation avdragsgill / Kredit 2440 Leverantörsskulder
Debet 2641 Ingående moms ej avdragsgill / Kredit 2440

Inköp av inventarie under direktavdragsgränsen:
Debet 5410 Förbrukningsinventarier / Kredit 1930 Bankkonto
Debet 2640 Ingående moms / Kredit 1930

Inköp av inventarie över direktavdragsgränsen:
Debet 1220 Inventarier / Kredit 2440 Leverantörsskulder
Debet 2640 Ingående moms / Kredit 2440
(Avskrivning: Debet 7832 Avskrivning inventarier / Kredit 1229 Ackumulerade avskrivningar)`,
  },

  {
    ref: 'SKV Inkurans lagervärdering',
    rubrik: 'Inkurans — lagervärdering och skattemässigt avdrag',
    text: `Inkurans innebär att varor minskat i värde p.g.a. svinn, skador, teknisk föråldring, modellskiften eller säsongsvariationer (IL 17 kap.).

Lägsta värdets princip: lager ska tas upp till det lägsta av anskaffningsvärdet och verkligt värde (nettoförsäljningsvärde).

97%-regeln: skattemässigt får lager tas upp till lägst 97% av det lägsta av anskaffningsvärdet och nettoförsäljningsvärdet för samtliga varor. Den generella inkuransreserven är alltså 3%.

Ytterligare inkuransavdrag: medges om verklig inkurans är högre och kan dokumenteras. Dokumentation: inventarielistor med specificering av inkuranta varor, fotografier, kassationsprotokoll, prislistor som visar värdeminskning.

Branscher med hög inkurans: mode (säsongsvaror), elektronik (teknisk föråldring), livsmedel (datum) kan medges högre inkurans om det styrks.

Värderingsmetod: FIFO (first in, first out) ska tillämpas. Lägsta värdets princip gäller per enskild vara, inte per lagerkategori.

Pågående arbeten: tjänsteföretag värderar pågående arbeten till nedlagda kostnader (successiv vinstavräkning eller färdigställandemetoden).`,
  },

  // ── HEMKONTOR / ARBETSRUM ─────────────────────────────────────────────
  {
    ref: 'SKV Hemkontor avdrag',
    rubrik: 'Hemkontor och arbetsrum — avdragsregler',
    text: `Avdrag för arbetsrum i bostaden är begränsat och kräver att utrymmet uteslutande eller så gott som uteslutande används för arbetet (IL 12 kap. 26 §).

Anställd: avdrag medges bara om arbetsgivaren inte tillhandahåller arbetsplats och arbetet kräver ett avskilt utrymme. Avdraget beräknas schablonmässigt — hyresvärde för liknande utrymme i orten.

Enskild firma: avdrag för arbetsrum i bostaden medges om rummet används i verksamheten. Avdrag beräknas som en skälig del av boendekostnader (hyra, ränta, uppvärmning, el).

Aktiebolag — hyra av arbetsrum av delägare: bolaget kan hyra arbetsrum av delägaren. Hyran är avdragsgill för bolaget om den är marknadsmässig. För delägaren beskattas hyran som inkomst av kapital (villa) eller tjänst (bostadsrätt där bolaget inte har hyresavtal med föreningen).

Hemarbete under corona/pandemi: Skatteverket accepterade generösare avdrag under pandemin. Normala regler gäller fr.o.m. 2023.

Bredband: arbetsgivare kan skattefritt bekosta bredband om det behövs för arbetet. Om privat nytta finns kan värdet av den privata användningen vara skattepliktig.`,
  },

  // ── UTHYRNING ─────────────────────────────────────────────────────────
  {
    ref: 'SKV Uthyrning privatbostad',
    rubrik: 'Uthyrning — privatbostad, skatt och avdrag',
    text: `Inkomst av uthyrning av privatbostad beskattas i inkomstslaget kapital med 30% (IL 42 kap. 30 §).

Schablonavdrag: avdrag medges med 40 000 kronor per år plus 20% av hyresinkomsten. Avdraget kan aldrig ge underskott.

Exempel: hyresinkomst 120 000 kr. Avdrag: 40 000 + 20% × 120 000 = 64 000 kr. Skattepliktig inkomst: 56 000 kr. Skatt: 16 800 kr (30%).

Uthyrning via plattformar (Airbnb): same regler. Plattformen rapporterar till Skatteverket fr.o.m. 2023 (DAC7-direktivet). Inkomsten ska deklareras.

Uthyrning av villa/fritidshus: om hela bostaden hyrs ut gäller schablonavdraget. Om del av bostaden hyrs ut beräknas intäkten proportionellt.

Bostadsrätt — uthyrning: styrelsen måste godkänna uthyrning. Bostadsrättsinnehavaren beskattas för överskottet ovan schablonavdrag.

Moms: uthyrning av bostäder är momsfri. Ingen momsregistrering krävs.

Näringsfastighet: uthyrning av näringsfastighet beskattas i inkomst av näringverksamhet. Verkliga kostnader är avdragsgilla (inga schabloner).`,
  },

  // ── DUBBEL BOSÄTTNING ────────────────────────────────────────────────
  {
    ref: 'SKV Dubbel bosättning',
    rubrik: 'Dubbel bosättning — avdrag för ökade levnadskostnader',
    text: `Avdrag för dubbel bosättning medges för ökade levnadskostnader när en anställd måste bo på arbetsorten och behåller sin permanenta bostad på annan ort (IL 12 kap. 18–22 §§).

Krav: den skattskyldige måste ha sitt egentliga bo och hemvist på en annan ort än arbetsorten, och det ska vara skäligt att behålla dubbel bosättning med hänsyn till make/maka/sambo och barn.

Avdragsrätt: skäliga merkostnader för bostad på arbetsorten. Normalt hyra eller boendekostnad för en bostad av normal standard.

Tidsbegränsning: avdrag medges i högst 5 år för gifta/sambo och i högst 2 år för ensamstående.

Hemresor: avdrag medges för en hemresa per vecka under den tid dubbel bosättning godkänns. Beräknas som billigaste färdmedel eller faktisk kostnad för tåg/flyg.

Arbetsgivarersättning: om arbetsgivaren betalar för dubbel bosättning är ersättningen skattefri om den inte överstiger avdragsgilla belopp.

Nytt arbete: avdrag för dubbel bosättning kan medges även om man bytt arbete och inte hunnit flytta familjen ännu.`,
  },

]

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════

async function run() {
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║  Normiq — SKV Kuraterat Innehåll            ║')
  console.log(`║  ${SKV_INNEHALL.length} ämnen att indexera                      ║`)
  console.log('╚══════════════════════════════════════════════╝\n')

  if (!process.env.OPENAI_API_KEY) {
    console.error('✗ OPENAI_API_KEY saknas i .env.local')
    process.exit(1)
  }

  let total = 0
  let i = 0

  for (const item of SKV_INNEHALL) {
    i++
    process.stdout.write(`[${i}/${SKV_INNEHALL.length}] ${item.rubrik.slice(0, 55)}... `)
    const n = await indexItem(item)
    console.log(`✓ ${n} chunks`)
    total += n
    await sleep(300)
  }

  // Kontrollera totalen
  const { data } = await supabase
    .from('documents')
    .select('metadata')
    .eq('metadata->>lag', 'Skatteverkets vägledning')

  console.log('\n╔══════════════════════════════════════════════╗')
  console.log(`║  Chunks indexerade denna körning: ${String(total).padEnd(10)} ║`)
  console.log(`║  SKV-chunks totalt i databasen:   ${String(data?.length || 0).padEnd(10)} ║`)
  console.log('╚══════════════════════════════════════════════╝')
}

run().catch(err => {
  console.error('\n✗ Fel:', err.message)
  process.exit(1)
})
