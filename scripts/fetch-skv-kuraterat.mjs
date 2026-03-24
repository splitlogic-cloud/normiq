/**
 * Normiq — Kuraterat SKV-innehåll v2
 * =====================================
 * Kör: node scripts/fetch-skv-kuraterat.mjs
 *
 * UPPDATERAD 2026-03 med korrekta belopp:
 * - Prisbasbelopp 2026: 59 200 kr
 * - Traktamente 2026: 300 kr/dag heldag, 150 kr halvdag
 * - IBB 2025 (används för 2026): 80 600 kr
 * - 3:12: Nya regler från 1 jan 2026 — grundbelopp 4 IBB, löneuttagskrav slopat
 * - Kostförmån 2026: 124 kr/dag
 * - Direktavdragsgräns 2026: 29 600 kr (0,5 × 59 200)
 *
 * PRINCIP: Belopp som ändras varje år beskrivs med formel, INTE hårdkodad siffra.
 * Normiq hämtar aktuella belopp via webb-sökning vid frågetillfället.
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

const SKV_INNEHALL = [

  {
    ref: 'SKV Representation inkomstskatt',
    rubrik: 'Representation — avdragsrätt inkomstskatt',
    text: `Avdrag för representation medges endast om det finns ett omedelbart samband med verksamheten (IL 16 kap. 2 §). Kravet på omedelbart samband är strängt — allmänt goodwillskapande räcker inte.

Måltidsrepresentation: avdrag medges med högst 90 kronor exklusive moms per person och tillfälle. Beloppet avser mat och alkoholfri dryck. Alkohol är inte avdragsgillt.

Intern representation (personalfester): avdrag medges för skäliga kostnader vid högst två tillfällen per år. Avdragsgränsen är 90 kronor per person exklusive moms för mat och dryck.

Kundgåvor: avdragsgilla med högst 300 kronor exklusive moms per person och år. Gåvan ska ha ett naturligt samband med verksamheten och inte vara av alltför personlig natur.

Kulturella evenemang (teater, konserter, idrottsevenemang): avdrag medges med högst 180 kronor per person inklusive moms. Ingen avdragsrätt för moms på kulturarrangemang.

Dokumentationskrav: affärssyfte, deltagarnas namn och antal samt datum ska dokumenteras. Utan dokumentation kan hela avdraget vägras. Kvitto krävs alltid.

Jubileumsfester för anställda: avdrag för skäliga kostnader om företaget firar jämnt år (25, 50, 75 år). Ingen beloppsgräns men måste vara skäligt.`,
  },

  {
    ref: 'SKV Representation moms',
    rubrik: 'Representation — momsavdrag och beräkning',
    text: `Ingående moms på representationskostnader är avdragsgill med begränsat belopp (ML 8 kap. 9 §). Underlaget är högst 300 kr exkl. moms per person och tillfälle.

Enbart mat (12% moms): avdragsgill moms = max 36 kr/person (12% × 300 kr).

Mat + alkohol — två alternativ:
1. Proportionering: beräkna mat och alkohol separat utifrån faktiska kostnader. Mat (12%): max 12% på matdelen av 300 kr. Alkohol (25%): max 25% på alkoholdelen av 300 kr.
2. Schablon: avdrag med 46 kr per person och tillfälle. Kräver att kostnad överstiger 300 kr exkl. moms OCH att debiterad moms är minst 46 kr per person.

Enbart alkohol (25% moms): avdragsgill moms = 0 kr. Alkohol ger aldrig momsavdrag utan mat.

OBS — fr.o.m. 1 april 2026: livsmedelsmoms sänks från 12% till 6% för livsmedel utan servering (t.ex. catering utan dukning). Restauranger med servering: fortfarande 12%. Om 6% moms gäller på maten: ny schablon 33 kr/person (om kostnad >300 kr exkl. moms och debiterad moms ≥33 kr). 46 kr-schablonen gäller fortfarande för restauranger med servering (12% moms på mat).

Kulturarrangemang: ingen avdragsrätt för ingående moms oavsett belopp.

Bokföring: ej avdragsgill moms bokförs på konto 2641. Avdragsgill del på konto 2640. Representation ej avdragsgill inkomstskatt: konto 6072. Med begränsat inkomstskatteavdrag: konto 6071.`,
  },

  {
    ref: 'SKV Traktamente regler',
    rubrik: 'Traktamente — regler och förutsättningar',
    text: `Traktamente är ersättning för ökade levnadskostnader vid tjänsteresa (IL 12 kap. 6–21 §§). Skattefritt inrikestraktamente 2026: 300 kronor per heldag, 150 kronor per halvdag. Aktuella belopp sök alltid hos Skatteverket — de ändras varje år.

Krav för skattefritt traktamente: resan ska vara i tjänsten, övernattning ska ske (kl 00.00–06.00), avståndet till reseorten ska vara mer än 50 kilometer från bostaden OCH mer än 50 kilometer från tjänstestället.

Vanlig verksamhetsort: det område inom 50 kilometer från den anställdes tjänsteställe. Resor inom detta område ger inte rätt till skattefritt traktamente.

Tidsbegränsning — tremånadersregeln: skattefritt traktamente reduceras till 70% efter 3 månader på samma ort i följd. Reduceras till 50% efter ytterligare tid. Semester och sjukdom förlänger perioden (SKV A 2025:5 fr.o.m. 2026).

Måltidsreduktion: om arbetsgivaren betalar måltider reduceras det skattefria traktamentet med procentandelar av maximibeloppet. Kontrollera aktuella procentsatser hos SKV.

Nattraktamente: halvt traktamente (150 kr 2026) om arbetsgivaren inte betalar logi.

Utlandstraktamente: belopp fastställs per land av Skatteverket varje år.

Endagsresor utan övernattning: ger inte rätt till skattefritt traktamente.`,
  },

  {
    ref: 'SKV Milersättning regler',
    rubrik: 'Milersättning — regler och skattefria belopp',
    text: `Milersättning för tjänsteresor med privat bil är skattefri upp till Skatteverkets schablon per kilometer (IL 12 kap. 5 §). Skattefritt belopp 2026: 25 kronor per kilometer för bil. Sök "milersättning [år] skatteverket" för att verifiera aktuellt belopp.

Tjänstebil med eget drivmedel: skattefri milersättning för drivmedel vid tjänsteresor fastställs separat för bensin/diesel och el — kontrollera SKV för aktuella belopp.

Krav för skattefrihet: resan ska vara en tjänsteresa med direkt samband med arbetet. Resor mellan bostad och arbetsplats räknas INTE som tjänsteresa.

Dokumentation krävs: körjournal med datum, start- och slutpunkt, körd sträcka och syfte. Utan körjournal kan skattefrihet vägras.

Arbetsgivaren kan betala mer — överskjutande del beskattas som lön och är underlag för arbetsgivaravgifter.

Egenföretagare (enskild firma): avdrag i näringsverksamheten med schablonbeloppet per kilometer för privat bil i verksamheten.`,
  },

  {
    ref: 'SKV Bilförmån regler',
    rubrik: 'Bilförmån — beräkning och förmånsvärde',
    text: `Bilförmån uppkommer när en anställd har privat användning av arbetsgivarens bil (IL 61 kap. 5–11 §§). Förmånsvärdet beräknas schablonmässigt och baseras på prisbasbeloppet — sök "bilförmån [år] skatteverket" för aktuella siffror.

Grundformel förmånsvärde per år: 0,29 × nybilspris + statslåneräntan × 75% × nybilspris + prisbasbeloppsdelen (0,29 × prisbasbeloppet). Prisbasbelopp 2026: 59 200 kr → prisbasbeloppsdel = 17 168 kr.

Nedsättning för miljöbilar: elbilar och laddhybrider har nedsatt förmånsvärde. Reglerna justeras löpande — kontrollera aktuella regler på SKV.

Bilar äldre än 3 år men yngre än 6 år: nybilspriset sätts till 75%. Äldre än 6 år: 50%.

Drivmedelsförmån: om arbetsgivaren betalar drivmedel för privata resor tillkommer separat drivmedelsförmån.

Förmånsvärdet är underlag för arbetsgivaravgifter och beskattas som lön.`,
  },

  {
    ref: 'SKV Friskvård regler',
    rubrik: 'Friskvårdsbidrag och personalvård — skattefria förmåner',
    text: `Friskvårdsbidrag är skattefritt upp till ett maxbelopp per anställd och år (IL 11 kap. 12 §). Maxbeloppet justeras — sök "friskvårdsbidrag [år] skatteverket" för aktuellt belopp.

Godkänd friskvård: gym, simning, yoga, dans, kampsport, innebandy, tennis, golf (green fee, ej utrustning), bowling, ridning, friskvårdsmassage, kostrådgivning kopplad till motion.

Ej godkänd friskvård: spa-behandlingar utan koppling till motion, skönhetsvård, utrustning och kläder, medlemsavgifter i idrottsföreningar (ej träningsavgift), pilotkurser, motorsport.

Krav: förmånen ska erbjudas alla anställda på likartade villkor. Det räcker att alla har möjlighet — inte att alla faktiskt utnyttjar det.

Personalvård av enklare slag: kaffe, frukt, enklare förtäring på arbetsplatsen är skattefritt utan beloppsgräns om det riktar sig till alla anställda.`,
  },

  {
    ref: 'SKV Personalförmåner',
    rubrik: 'Personalförmåner — skatteplikt, undantag och belopp',
    text: `Förmåner från arbetsgivaren är som huvudregel skattepliktiga och värderas till marknadsvärdet (IL 61 kap. 2 §). Skattefria gränser justeras — kontrollera aktuella belopp hos SKV.

Skattefria förmåner (med beloppsgränser som justeras varje år):
- Friskvårdsbidrag: upp till maxbelopp/år
- Julklapp: skattefri upp till gränsbeloppet inkl. moms
- Jubileumsgåva (25, 50+ år i tjänst): skattefri upp till gränsbeloppet inkl. moms
- Minnesgåva vid pension: skattefri upp till gränsbeloppet inkl. moms
- Personalrabatt på egna varor/tjänster: skattefri upp till sedvanlig rabatt i branschen

Skattefria förmåner utan beloppsgräns (om villkor uppfylls):
- Arbetsredskap (dator, telefon) för arbetsbruk
- Fri parkering vid arbetsplatsen

Skattepliktiga förmåner:
- Kostförmån (fri lunch): schablonvärde fastställs varje år av SKV. För 2026: 124 kronor per dag
- Bostadsförmån: värde fastställs av SKV per ort och bostadstyp
- Kontanta gåvor: alltid skattepliktiga oavsett belopp

Arbetsgivaravgifter: skattepliktiga förmåner är underlag för arbetsgivaravgifter och ska redovisas i arbetsgivardeklarationen.`,
  },

  {
    ref: 'SKV 3:12 regler 2026',
    rubrik: '3:12-regler — nya regler från 2026, gränsbelopp och utdelning',
    text: `3:12-reglerna styr hur utdelning och kapitalvinst från fåmansföretag beskattas (IL 57 kap.). Reglerna ändrades kraftigt från 1 januari 2026.

VIKTIGA FÖRÄNDRINGAR FRÅN 2026:
- Förenklingsregeln och huvudregeln är BORTA — ersatta av en ny gemensam modell
- Löneuttagskravet är SLOPAT
- Karenstiden kortades från 5 till 4 år
- Ränteuppräkning på sparat utdelningsutrymme är borttagen

Kvalificerad andel: andel är kvalificerad om ägaren eller närstående under beskattningsåret eller något av de fyra föregående åren (fr.o.m. 2026) varit verksam i betydande omfattning.

NYTT GRÄNSBELOPP 2026 beräknas som summan av:
1. Grundbelopp: 4 × IBB för föregående år, fördelat lika på andelarna. IBB 2025 = 80 600 kr → grundbelopp = 322 400 kr för ensam ägare med 100% av andelarna.
2. Lönebaserat utrymme: 50% × (delägarens andel av löneunderlag − 8 IBB löneavdrag = 644 800 kr). Kan aldrig överstiga 50 × egen lön.
3. Ränta på omkostnadsbelopp: statslåneräntan (2,55% nov 2025) + 9%, men BARA på del av omkostnadsbeloppet som överstiger 100 000 kr.
4. Sparat utdelningsutrymme: rullas vidare till nominellt värde, ingen ränteuppräkning.

Utdelning inom gränsbeloppet: beskattas i kapital med 20% (2/3 × 30%).
Utdelning över gränsbeloppet: beskattas som tjänst upp till tak om 90 × IBB (7 254 000 kr baserat på IBB 2026 = 83 400 kr — sök aktuellt tak).

Flera bolag: grundbeloppet (4 IBB) fördelas proportionellt mellan alla bolag med kvalificerade andelar. Ingen valfrihet längre.`,
  },

  {
    ref: 'SKV Fåmansbolag lön vs utdelning',
    rubrik: 'Fåmansbolag — lön kontra utdelning, optimering 2026',
    text: `Valet mellan lön och utdelning i fåmansbolag påverkar den totala skattebelastningen.

Lön: beskattas som tjänst (upp till ca 52% marginalskatt inkl. arbetsgivaravgifter) men ger pensionsgrundande inkomst, sociala förmåner och möjlighet att bygga lönebaserat utrymme.

Utdelning inom gränsbeloppet: beskattas med 20% effektiv skatt. Ingen pensionsgrundande inkomst.

NYTT 2026 — löneuttagskrav slopat: du behöver inte längre ta ut en minimilön för att beräkna lönebaserat utrymme. Löneavdraget på 8 IBB (644 800 kr 2026) gäller istället.

Tumregel 2026: om bolaget har råd, ta ut lön upp till brytpunkten för statlig skatt (sök aktuellt belopp) och ta resten som utdelning inom gränsbeloppet.

Makar: löneavdraget på 8 IBB delas gemensamt och lönebaserat utrymme fördelas lika.

Närstående: barn under 18 år beskattas alltid med tjänstebeskattning på utdelning (IL 57 kap. 5 §).

Karensregel: förkortad till 4 år fr.o.m. 2026 för när andelar upphör att vara kvalificerade.`,
  },

  {
    ref: 'SKV Moms avdragsrätt',
    rubrik: 'Moms — avdragsrätt för ingående moms, regler och begränsningar',
    text: `Avdragsrätt för ingående moms gäller varor och tjänster som används i momspliktig verksamhet (ML 8 kap. 3 §).

Full avdragsrätt: förvärv som uteslutande används i momspliktig verksamhet. Avdrag yrkas i momsdeklarationen för den period inköpet gjordes.

Blandad verksamhet: om verksamheten är dels momspliktig dels momsfri gäller proportionell avdragsrätt. Fördelningsnyckeln ska vara skälig — omsättningsbaserad fördelning är vanligast.

Ej avdragsgill ingående moms:
- Personbilar och motorcyklar (om ej uteslutande i yrkesmässig trafik, uthyrning eller körkortsutbildning)
- Representation (begränsat avdrag)
- Stadigvarande bostad
- Livsmedel och drycker till anställda (undantag: personalvårdsförmåner)

Fakturakrav för avdrag: giltig momsfaktura med säljarens momsregistreringsnummer, momsbelopp per skattesats och beskattningsunderlag.

Import: sedan 2023 redovisas importmoms i momsdeklarationen (inte längre till Tullverket).

Omvänd skattskyldighet: vid köp av byggtjänster och från utländska säljare utan svensk momsregistrering är köparen skattskyldig och redovisar både utgående och ingående moms.`,
  },

  {
    ref: 'SKV Moms fakturakrav',
    rubrik: 'Moms — fakturakrav och förenklad faktura',
    text: `En momsfaktura ska uppfylla kraven i ML 11 kap. för att ge rätt till momsavdrag.

Obligatoriska uppgifter:
1. Utfärdandedatum
2. Löpnummer (unik identifikation)
3. Säljarens momsregistreringsnummer (SE + organisationsnummer + 01)
4. Säljarens och köparens namn och adress
5. Varornas eller tjänsternas mängd och art
6. Datum för tillhandahållande om det avviker från fakturadatum
7. Beskattningsunderlag per skattesats
8. Tillämpad skattesats (6%, 12% eller 25%)
9. Mervärdesskattebelopp i kronor

Förenklad faktura: får användas om beloppet understiger 4 000 kronor inklusive moms. Behöver inte innehålla köparens uppgifter.

Elektronisk faktura: godtas om mottagaren accepterar. Ska innehålla samma uppgifter.

Kreditnota: ska innehålla hänvisning till ursprungsfakturan.

Faktura i utländsk valuta: momsbeloppet ska anges i svenska kronor.`,
  },

  {
    ref: 'SKV Moms omsättningsgräns',
    rubrik: 'Moms — omsättningsgräns och frivillig registrering',
    text: `Omsättningsgräns för moms: från 1 januari 2025 är gränsen 120 000 kronor per år (höjd från 80 000 kr). Företag med momspliktig omsättning under gränsen behöver inte momsregistrera sig.

Konsekvenser av att inte registrera: ingen skyldighet att ta ut moms, men heller ingen rätt att dra av ingående moms på inköp.

Frivillig registrering: kan väljas för att få avdragsrätt för ingående moms. Lönsamt om inköpen är stora i förhållande till försäljningen.

Retroaktiv registrering: ska ske omgående när omsättningen överstiger 120 000 kr.

EU-handel: omsättningsgränsen gäller bara för inhemsk försäljning. Köp av tjänster från utländska säljare (Google, Meta) kan utlösa registreringsskyldighet oavsett omsättning.`,
  },

  {
    ref: 'SKV Moms fastighet',
    rubrik: 'Moms — fastighetsuthyrning och frivillig skattskyldighet',
    text: `Uthyrning av fastighet är som huvudregel undantagen från moms (ML 3 kap. 2 §).

Frivillig skattskyldighet: hyresvärd kan ansöka om frivillig momsregistrering för uthyrning till momspliktig verksamhet (ML 9 kap.). Krav: hyresgästen bedriver momspliktig verksamhet i lokalerna.

Fördelar: full avdragsrätt för ingående moms på fastighetskostnader (byggnation, renovering, underhåll). Kan ge stora momsåterbetalningar vid nybyggnation.

Nackdelar: moms (25%) tas ut på hyran, vilket ökar kostnaden för hyresgäster utan full avdragsrätt (banker, försäkringsbolag, sjukvård).

Jämkning: 10-årig jämkningsperiod. Om fastigheten byter användning måste tidigare avdragen ingående moms återbetalas proportionellt.

Bostadsuthyrning: aldrig momspliktig. Privatpersoner kan aldrig bli frivilligt skattskyldiga för bostadsuthyrning.`,
  },

  {
    ref: 'SKV Avskrivningar inventarier',
    rubrik: 'Avskrivningar — maskiner och inventarier',
    text: `Maskiner och inventarier skrivs av skattemässigt enligt reglerna i IL 18 kap.

30%-regeln: avdrag med 30% av det skattemässiga restvärdet (ingående restvärde + årets anskaffningar − försäljningar). Vanligaste metoden.

20%-regeln: avdrag med 20% av anskaffningsvärdet för årets och tidigare års inventarier. Används när den ger högre avdrag.

Kompletteringsregeln (direktavdrag): inventarier med ekonomisk livslängd om högst 3 år ELLER anskaffningsvärde under ett halvt prisbasbelopp (0,5 × PBB) får dras av omedelbart. Direktavdragsgräns 2026: 29 600 kr (0,5 × 59 200 kr). Gränsen ändras varje år med prisbasbeloppet.

Datorer och IT-utrustning: ekonomisk livslängd bedöms ofta till 3 år → direktavdrag möjligt oavsett belopp.

K2/K3: K2 tillåter skattemässig avskrivning utan komponentuppdelning. K3 kräver avskrivning utifrån verklig nyttjandeperiod.`,
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

Underlag: byggnadens anskaffningsvärde exklusive mark. Mark är inte avskrivningsbar.

Markinventarier (parkeringsplatser, vägar, ledningar): skrivs av som inventarier med 30%- eller 20%-regeln.

K2: avskrivning schablonmässigt utan komponentavskrivning.
K3: komponentavskrivning krävs — stomme, tak, fasad, installationer skrivs av separat.

Primäravdrag: för hyreshus förvärvade från 2019 medges extra 2% per år under de första 6 åren (totalt 12% extra).`,
  },

  {
    ref: 'SKV Periodiseringsfond',
    rubrik: 'Periodiseringsfond — regler och återföring',
    text: `Periodiseringsfond är en möjlighet att skjuta upp beskattning av vinst (IL 30 kap.).

Avsättning: aktiebolag får sätta av högst 25% av det skattemässiga resultatet. Enskild firma och handelsbolag: 30% av positiv nettoinkomst av näringsverksamhet.

Återföring: fonden ska återföras senast det sjätte taxeringsåret efter avsättningsåret. Kan återföras frivilligt tidigare.

Räntebeläggning för aktiebolag: schablonintäkt = summan av periodiseringsfonderna vid årets ingång × statslåneräntan (november föregående år) × 72%. Statslåneräntan varierar — kontrollera aktuell sats. Statslåneräntan 30 november 2025: 2,55%.

Skatteeffekt: vid 20,6% bolagsskatt ger 100 kr i avsättning en skattekredit på 20,60 kr.

Likvidation och konkurs: fonden ska återföras omedelbart.
Inkråmsöverlåtelse: fonden måste återföras. Vid andelsbyte behålls fonden i bolaget.`,
  },

  {
    ref: 'SKV Expansionsfond',
    rubrik: 'Expansionsfond — enskild firma och handelsbolag',
    text: `Expansionsfond (IL 34 kap.) gör det möjligt för enskilda firmor och handelsbolag att behålla kapital i verksamheten till lägre skattekostnad.

Avsättning: skatt betalas med expansionsfondsskatt om 20,6%. Kapitalet efter skatt kan användas i verksamheten.

Maximal avsättning: 128,21% av kapitalunderlaget (tillgångar minus skulder). Kan inte överstiga positivt resultat.

Skatteeffekt: i stället för full marginalskatt (upp till 52%) betalar man 20,6% vid avsättning. Resterande 31,4% betalas när fonden återförs.

Återföring: sker frivilligt eller när verksamheten upphör. Expansionsfondsskatten återbetalas.

Jämförelse: periodiseringsfond = skattekredit (ingen skatt nu, full skatt vid återföring). Expansionsfond = permanent lägre skatt för kapital som stannar i verksamheten.`,
  },

  {
    ref: 'SKV Arbetsgivaravgifter',
    rubrik: 'Arbetsgivaravgifter — satser och underlag',
    text: `Arbetsgivare betalar arbetsgivaravgifter på ersättningar till anställda. Satserna kan ändras — sök "arbetsgivaravgift [år] skatteverket" för aktuella procentsatser.

Fullständig arbetsgivaravgift 2026 (born 1959 och senare): 31,42% på kontant lön och skattepliktiga förmåner.

Fördelning 2026:
- Ålderspensionsavgift: 10,21%
- Sjukförsäkringsavgift: 3,55%
- Föräldraförsäkringsavgift: 2,60%
- Arbetsmarknadsavgift: 2,64%
- Allmän löneavgift: 11,62%
- Övriga: 0,80%

Nedsättning äldre (born 1958 eller tidigare 2026): bara ålderspensionsavgift 10,21%.
Nedsättning unga (born 2004 och senare 2026): lägre avgift t.o.m. månaden de fyller 23 år.

Egenavgifter (enskild firma, aktiv): ca 28,97%. Lägre för äldre och yngre.

Underlag: kontant lön, skattepliktiga förmåner, sjuklön, semesterersättning. Skattefria ersättningar (traktamente inom schablon, skattefri milersättning) ingår INTE.`,
  },

  {
    ref: 'SKV Okvalificerade andelar karenstid',
    rubrik: 'Fåmansbolag — karenstid, okvalificerade andelar och skattesats',
    text: `När andelar i ett fåmansföretag upphör att vara kvalificerade gäller en karenstid innan de kan beskattas som vanliga onoterade aktier.

Karenstid fr.o.m. 2026: 4 år (förkortad från 5 år). Under dessa 4 år förblir andelarna kvalificerade och beskattas enligt 3:12-reglerna (IL 57 kap.). Det spelar ingen roll om ägaren slutar arbeta i bolaget — karenstiden löper ändå.

Karenstiden startar: när företaget upphör att vara ett fåmansföretag, eller när ägaren och närstående inte längre är verksamma i betydande omfattning.

EFTER karenstiden — okvalificerade onoterade andelar:
Utdelning och kapitalvinst beskattas då som okvalificerade andelar i onoterat bolag. Skattesatsen är 5/6 × 30% = 25% effektiv skatt (IL 42 kap. 15 a §). OBS: Skattesatsen är 25% — INTE 30%. 30% är skattesatsen för kapitalinkomster generellt, men för onoterade okvalificerade andelar gäller en reducering till 5/6 av vinsten som beskattas, vilket ger 25% effektiv skatt.

Under karenstiden — trädabolag: utdelning och kapitalvinst beskattas fortfarande enligt 3:12 (20% upp till gränsbeloppet, tjänst däröver). Vanlig strategi är att inte dela ut under karenstiden utan låta pengarna vara kvar i bolaget.

Exempel: ägaren säljer alla aktier i sitt fåmansbolag 2026. Om bolaget slutar vara fåmansföretag börjar 4-årig karenstid. Fr.o.m. 2030 beskattas eventuell kvarvarande kapitalvinst med 25% (ej 20% eller 30%).`,
  },


    rubrik: 'Kapitalvinst — försäljning av aktier och värdepapper',
    text: `Kapitalvinst vid försäljning av aktier beskattas i inkomstslaget kapital med 30% (IL 44–48 kap.).

Beräkning: kapitalvinst = försäljningspris − omkostnadsbelopp − försäljningskostnader.

Genomsnittsmetoden: omkostnadsbeloppet = genomsnittligt anskaffningsvärde per aktie för samtliga aktier av samma slag och sort. Räknas om vid nyköp.

Schablonmetoden (20%-regeln): omkostnadsbeloppet sätts till 20% av försäljningspriset. Används när verkligt anskaffningsvärde är okänt eller ger lägre avdrag.

Onoterade aktier (ej kvalificerade): kapitalvinst beskattas med 25% effektiv skatt (5/6 × 30%).

Kapitalförlust: avdragsgill till 70% mot kapitalvinster och kapitalinkomster.

ISK: schablonbeskattning — ingen kapitalvinstskatt vid försäljning. Schablonskatt på kontovärdet istället.

Aktiefållan: kapitalförluster på onoterade aktier är bara avdragsgilla mot kapitalvinster på aktier och aktiefonder.`,
  },

  {
    ref: 'SKV Kapitalvinst fastighet',
    rubrik: 'Kapitalvinst — försäljning av privatbostad och näringsfastighet',
    text: `Kapitalvinst vid försäljning av privatbostad beskattas med 22% (IL 45–46 kap.). Beräkning: vinst = försäljningspris − anskaffningsutgift − förbättringsutgifter − försäljningskostnader.

Schablonavdrag för bostadsrätt: 50 000 kr dras av från beskattningsunderlaget.

Uppskov: vid försäljning av permanentbostad kan vinsten skjutas upp om man köper ny bostad. Löpande schablonintäkt tas upp varje år — sök aktuell procentsats hos SKV.

Förbättringsutgifter: avdrag för ny-, till- och ombyggnad samt förbättrande reparationer. Kräver kvitton och dokumentation.

Näringsfastighet: kapitalvinst beskattas med 27% (9/10 × 30%). Värdeminskningsavdrag återförs vid försäljningen.

Bodelning och arv: utlöser normalt inte kapitalvinstbeskattning — kontinuitetsprincipen gäller.`,
  },

  {
    ref: 'SKV ROT RUT',
    rubrik: 'ROT- och RUT-avdrag — regler och belopp',
    text: `ROT och RUT är skattereduktioner för hushållsarbete (IL 67 kap.). Tak justeras av riksdagen — sök "ROT RUT avdrag [år] skatteverket" för aktuella belopp.

ROT-avdrag (reparation, ombyggnad, tillbyggnad): 30% av arbetskostnaden exklusive moms. Max 50 000 kr per person och år (fr.o.m. 2023).

Godkänt ROT: reparation och underhåll, om- och tillbyggnad av bostad (villa, bostadsrätt, fritidshus). Arbetet ska utföras i eller i nära anslutning till bostaden.

Ej godkänt ROT: nyproduktion, material, maskinhyra, markarbeten, fritidshus utomlands.

RUT-avdrag: 50% av arbetskostnaden exklusive moms. Max 75 000 kr per person och år (höjt 2024).

Godkänt RUT: städning, fönsterputs, trädgårdsarbete, barnpassning, personlig omsorg, it-tjänster, flytt, häst- och hundpassning, läxhjälp.

Gemensamt: utföraren måste vara godkänd för F-skatt. Köparen betalar sin andel (70% ROT, 50% RUT) — utföraren söker resten från SKV. Kombinationstak ROT + RUT: max 75 000 kr/år (varav ROT max 50 000 kr).`,
  },

  {
    ref: 'SKV Bokföring grundregler',
    rubrik: 'Bokföring — grundläggande regler och krav',
    text: `Bokföringsskyldiga är aktiebolag, handelsbolag, ekonomiska föreningar och enskilda firmor med nettoomsättning över 3 miljoner kronor (BFL 1 kap. 2 §).

Löpande bokföring: alla affärshändelser bokförs löpande. Kontanta transaktioner: senast påföljande arbetsdag. Övriga: senast inom rimlig tid (normalt 2 veckor).

Verifikationer: varje affärshändelse dokumenteras med verifikation (kvitto, faktura, kontoutdrag) med datum, belopp, motpart och vad affärshändelsen avser.

Kontantmetoden: tillåten för verksamheter under 3 miljoner kr/år. Affärshändelser bokförs när betalning sker. Vid räkenskapsårets slut bokförs ändå alla obetalda fordringar och skulder.

Faktureringsmetoden: affärshändelser bokförs när faktura utfärdas eller mottas. Obligatorisk för verksamheter över 3 miljoner kr/år.

BAS-kontoplanen: 1xxx = tillgångar, 2xxx = skulder/eget kapital, 3xxx = intäkter, 4–7xxx = kostnader, 8xxx = finansiella poster.

Arkivering: räkenskapsinformation ska bevaras i 7 år efter räkenskapsårets utgång (BFL 7 kap.).`,
  },

  {
    ref: 'SKV Bokföring kontering',
    rubrik: 'Bokföring — vanliga konteringar och BAS-konton',
    text: `Vanliga konteringar i BAS-kontoplanen:

Inköp av varor (25% moms):
Debet 4010 Inköp av varor + Debet 2640 Ingående moms / Kredit 2440 Leverantörsskulder

Försäljning av tjänster (25% moms):
Debet 1510 Kundfordringar / Kredit 3040 Försäljning tjänster + Kredit 2610 Utgående moms

Löneutbetalning:
Debet 7010 Löner / Kredit 1930 Bankkonto
Debet 7510 Arbetsgivaravgifter / Kredit 2731 Personalskatt + Kredit 2732 Sociala avgifter

Representation extern (restaurang 12% moms, ej avdragsgill inkomstskatt):
Debet 6072 Representation ej avdragsgill / Kredit 2440
Debet 2641 Ingående moms ej avdragsgill / Kredit 2440

Inköp inventarie under direktavdragsgränsen (0,5 × prisbasbeloppet):
Debet 5410 Förbrukningsinventarier + Debet 2640 Ingående moms / Kredit 1930

Inköp inventarie ÖVER direktavdragsgränsen:
Debet 1220 Inventarier + Debet 2640 Ingående moms / Kredit 2440
Avskrivning: Debet 7832 Avskrivning inventarier / Kredit 1229 Ackumulerade avskrivningar`,
  },

  {
    ref: 'SKV Inkurans lagervärdering',
    rubrik: 'Inkurans — lagervärdering och skattemässigt avdrag',
    text: `Inkurans innebär att varor minskat i värde p.g.a. svinn, skador, teknisk föråldring eller säsongsvariationer (IL 17 kap.).

Lägsta värdets princip: lager tas upp till det lägsta av anskaffningsvärdet och verkligt värde (nettoförsäljningsvärde).

97%-regeln: skattemässigt får lager tas upp till lägst 97% av det lägsta av anskaffningsvärde och nettoförsäljningsvärde. Generell inkuransreserv = 3%.

Ytterligare inkurans: medges om verklig inkurans är högre och styrks med: inventarielistor, fotografier, kassationsprotokoll, prislistor som visar värdeminskning.

Branscher med hög inkurans: mode, elektronik, livsmedel kan medges högre avdrag om det dokumenteras.

Värderingsmetod: FIFO (first in, first out). Lägsta värdets princip gäller per enskild vara.`,
  },

  {
    ref: 'SKV Hemkontor avdrag',
    rubrik: 'Hemkontor och arbetsrum — avdragsregler',
    text: `Avdrag för arbetsrum i bostaden kräver att utrymmet uteslutande eller så gott som uteslutande används för arbetet (IL 12 kap. 26 §).

Anställd: avdrag medges bara om arbetsgivaren inte tillhandahåller arbetsplats och arbetet kräver ett avskilt utrymme. Avdraget beräknas schablonmässigt som hyresvärde för liknande utrymme i orten.

Enskild firma: avdrag medges om rummet används i verksamheten. Beräknas som skälig del av boendekostnader (hyra, ränta, uppvärmning, el).

Aktiebolag — hyra av arbetsrum från delägare: bolaget kan hyra arbetsrum om hyran är marknadsmässig. För delägaren beskattas hyran som kapitalinkomst (villa) eller tjänst (bostadsrätt).

Bredband: arbetsgivare kan skattefritt bekosta bredband om det behövs för arbetet.`,
  },

  {
    ref: 'SKV Uthyrning privatbostad',
    rubrik: 'Uthyrning — privatbostad, skatt och avdrag',
    text: `Inkomst av uthyrning av privatbostad beskattas i inkomstslaget kapital med 30% (IL 42 kap. 30 §).

Schablonavdrag: 40 000 kronor per år plus 20% av hyresinkomsten. Avdraget kan aldrig ge underskott.

Exempel: hyresinkomst 120 000 kr. Avdrag: 40 000 + 24 000 = 64 000 kr. Skattepliktig inkomst: 56 000 kr. Skatt: 16 800 kr (30%).

Uthyrning via plattformar (Airbnb): samma regler. Plattformen rapporterar till SKV fr.o.m. 2023 (DAC7). Inkomsten ska deklareras.

Bostadsrätt: styrelsen måste godkänna uthyrning. Skattas på överskott ovan schablonavdrag.

Moms: uthyrning av bostäder är momsfri.

Näringsfastighet: beskattas i inkomst av näringsverksamhet. Verkliga kostnader avdragsgilla.`,
  },

  {
    ref: 'SKV Dubbel bosättning',
    rubrik: 'Dubbel bosättning — avdrag för ökade levnadskostnader',
    text: `Avdrag för dubbel bosättning medges när en anställd måste bo på arbetsorten och behåller sin permanenta bostad på annan ort (IL 12 kap. 18–22 §§).

Krav: den skattskyldige måste ha sitt egentliga bo och hemvist på annan ort än arbetsorten, och det ska vara skäligt att behålla dubbel bosättning med hänsyn till make/maka/sambo och barn.

Avdragsrätt: skäliga merkostnader för bostad på arbetsorten. Normalt hyra för bostad av normal standard.

Tidsbegränsning: avdrag medges i högst 5 år för gifta/sambo och i högst 2 år för ensamstående.

Hemresor: avdrag för en hemresa per vecka. Beräknas som billigaste färdmedel eller faktisk kostnad.

Arbetsgivarersättning: om arbetsgivaren betalar är ersättningen skattefri om den inte överstiger avdragsgilla belopp.`,
  },
]

async function run() {
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║  Normiq — SKV Kuraterat Innehåll v2         ║')
  console.log(`║  ${SKV_INNEHALL.length} ämnen — korrekta 2026-belopp           ║`)
  console.log('╚══════════════════════════════════════════════╝\n')

  if (!process.env.OPENAI_API_KEY) { console.error('✗ OPENAI_API_KEY saknas'); process.exit(1) }

  let total = 0
  for (let i = 0; i < SKV_INNEHALL.length; i++) {
    const item = SKV_INNEHALL[i]
    process.stdout.write(`[${i+1}/${SKV_INNEHALL.length}] ${item.rubrik.slice(0, 55)}... `)
    const n = await indexItem(item)
    console.log(`✓ ${n} chunks`)
    total += n
    await sleep(300)
  }

  const { data } = await supabase.from('documents').select('metadata').eq('metadata->>lag', 'Skatteverkets vägledning')

  console.log('\n╔══════════════════════════════════════════════╗')
  console.log(`║  Chunks indexerade: ${String(total).padEnd(24)} ║`)
  console.log(`║  SKV totalt i DB:   ${String(data?.length || 0).padEnd(24)} ║`)
  console.log('╚══════════════════════════════════════════════╝')
}

run().catch(err => { console.error('\n✗ Fel:', err.message); process.exit(1) })
