import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

config({ path: '.env.local' });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const REGLER = [
  // ── INKOMSTSKATTELAGEN ────────────────────────────────────────────
  {
    ref: 'IL 1 kap. 1 §', rubrik: 'Skattskyldighet — allmänt', lag: 'Inkomstskattelagen',
    text: `Bestämmelserna i denna lag gäller för fysiska personer och juridiska personer. Fysiska personer som är bosatta i Sverige är obegränsat skattskyldiga. Obegränsat skattskyldiga ska betala skatt på alla sina inkomster i Sverige och från utlandet.`
  },
  {
    ref: 'IL 13 kap. 1 §', rubrik: 'Näringsverksamhet — definition', lag: 'Inkomstskattelagen',
    text: `Till inkomstslaget näringsverksamhet räknas inkomster och utgifter på grund av näringsverksamhet. Med näringsverksamhet avses förvärvsverksamhet som bedrivs yrkesmässigt och självständigt. Vid bedömningen ska särskilt beaktas om den skattskyldige har flera uppdragsgivare, om den skattskyldige kan ta emot uppdrag från obegränsat antal personer och om den skattskyldige har egna anställda.`
  },
  {
    ref: 'IL 14 kap. 2 §', rubrik: 'Bokföringsmässiga grunder', lag: 'Inkomstskattelagen',
    text: `Resultatet av näringsverksamhet ska beräknas enligt bokföringsmässiga grunder. Inkomster ska tas upp som intäkt och utgifter dras av som kostnad det beskattningsår som de hänför sig till enligt god redovisningssed, om inte något annat är särskilt föreskrivet i lag.`
  },
  {
    ref: 'IL 16 kap. 1 §', rubrik: 'Kostnader i näringsverksamhet — allmänt', lag: 'Inkomstskattelagen',
    text: `Utgifter för att förvärva och bibehålla inkomster ska dras av som kostnad. Ränteutgifter och kapitalförluster ska dras av även om de inte är sådana utgifter. Utdelningar ska inte dras av.`
  },
  {
    ref: 'IL 16 kap. 2 §', rubrik: 'Representation — avdragsrätt', lag: 'Inkomstskattelagen',
    text: `Utgifter för representation och liknande ändamål ska dras av bara om de har omedelbart samband med näringsverksamheten, såsom då det är fråga om förhandlingar, jubileum, personalvård eller liknande. Avdrag medges inte för utgifter för sprit och vin. Avdrag för måltidsutgifter medges med högst 90 kronor per person och tillfälle exklusive moms. Lag (2016:1055).`
  },
  {
    ref: 'IL 16 kap. 7 §', rubrik: 'Resor i näringsverksamhet', lag: 'Inkomstskattelagen',
    text: `Utgifter för resor i näringsverksamheten ska dras av. Utgifter för resor med egen bil dras av med 25 kronor per kilometer. Utgifter för resor mellan bostaden och arbetsplatsen dras av bara om avståndet är minst fem kilometer och den skattskyldige regelmässigt gör tidsvinster på minst två timmar jämfört med kollektivtrafik.`
  },
  {
    ref: 'IL 16 kap. 36 §', rubrik: 'Hemkontor — avdragsrätt', lag: 'Inkomstskattelagen',
    text: `Avdrag medges för utgifter för arbetsrum i bostaden om rummet används uteslutande eller så gott som uteslutande för arbetet och den skattskyldige saknar annat arbetsrum. Avdraget beräknas schablonmässigt eller på faktisk kostnad. För eget hem medges avdrag med 2 000 kronor per år som schablon.`
  },
  {
    ref: 'IL 11 kap. 1 §', rubrik: 'Löneförmåner — skatteplikt', lag: 'Inkomstskattelagen',
    text: `Löner, arvoden, förmåner och andra ersättningar för arbete ska tas upp som intäkt. Som intäkt räknas också ersättningar och förmåner som erhålls i form av varor, tjänster eller andra tillgångar. Detta gäller oavsett om ersättningen betalas kontant eller i annan form.`
  },
  {
    ref: 'IL 11 kap. 8 §', rubrik: 'Fri kost — förmånsvärde', lag: 'Inkomstskattelagen',
    text: `Förmån av fri kost värderas till genomsnittspriset för en lunch på orten. Skatteverket fastställer årligen normalvärdet. För år 2024 är förmånsvärdet för en lunch 125 kronor, frukost 62 kronor och middag 125 kronor. Fri kost vid representation beskattas inte om den är av enklare slag.`
  },
  {
    ref: 'IL 11 kap. 11 §', rubrik: 'Personalvårdsförmåner — skattefrihet', lag: 'Inkomstskattelagen',
    text: `Förmåner av mindre värde som riktar sig till hela personalen och som är av enklare slag är skattefria personalvårdsförmåner. Hit räknas enklare motion och friskvård, förfriskningar och enklare förtäring på arbetsplatsen, samt möjlighet att använda arbetsplatsens lokaler för hobby eller liknande. Friskvårdsbidrag är skattefritt upp till 5 000 kronor per år.`
  },
  {
    ref: 'IL 20 kap. 1 §', rubrik: 'Värdeminskningsavdrag — inventarier', lag: 'Inkomstskattelagen',
    text: `Utgifter för att anskaffa inventarier ska dras av genom årliga värdeminskningsavdrag. Avdrag medges med 30 procent av avskrivningsunderlaget per år (räkenskapsenlig avskrivning). Inventarier av mindre värde eller kort livslängd får dras av omedelbart. Gränsen för omedelbart avdrag är 28 650 kronor (2024).`
  },
  {
    ref: 'IL 22 kap. 1 §', rubrik: 'Uttag ur näringsverksamhet', lag: 'Inkomstskattelagen',
    text: `Med uttag avses att den skattskyldige tillgodogör sig en tillgång från näringsverksamheten för privat bruk eller för gåva. Uttag ska behandlas som om tillgången avyttrats mot en ersättning som motsvarar marknadsvärdet. Undantag gäller för uttag av kontanta medel.`
  },
  {
    ref: 'IL 42 kap. 1 §', rubrik: 'Utdelning — skatteplikt', lag: 'Inkomstskattelagen',
    text: `Utdelning på andelar i svenska aktiebolag och andra svenska juridiska personer ska tas upp som intäkt av kapital. Utdelning är skattepliktig det år den kan disponeras. För fåmansföretag gäller särskilda regler enligt 57 kap (3:12-reglerna).`
  },
  {
    ref: 'IL 57 kap. 1 §', rubrik: 'Fåmansföretag — 3:12-reglerna', lag: 'Inkomstskattelagen',
    text: `Utdelning och kapitalvinst på kvalificerade andelar i fåmansföretag ska till viss del tas upp i inkomstslaget tjänst istället för kapital. Med fåmansföretag avses aktiebolag där fyra eller färre delägare äger andelar som motsvarar mer än 50 procent av rösterna. Gränsbeloppet beräknas enligt förenklingsregeln eller huvudregeln.`
  },
  {
    ref: 'IL 57 kap. 11 §', rubrik: 'Fåmansföretag — förenklingsregeln', lag: 'Inkomstskattelagen',
    text: `Enligt förenklingsregeln uppgår gränsbeloppet till 2,75 inkomstbasbelopp fördelat på samtliga andelar i företaget. För 2024 är inkomstbasbeloppet 76 200 kronor, vilket ger ett gränsbelopp om 209 550 kronor per företag. Förenklingsregeln får bara användas för andelar i ett företag.`
  },
  {
    ref: 'IL 67 kap. 6 §', rubrik: 'ROT-avdrag', lag: 'Inkomstskattelagen',
    text: `Skattereduktion för husarbete (ROT) medges med 30 procent av arbetskostnaden för reparation, konvertering och tillbyggnad av bostad. Taket är 50 000 kronor per person och år. Avdraget gäller enbart arbetskostnad, inte material. Arbetet ska utföras i eller i nära anslutning till bostaden.`
  },
  {
    ref: 'IL 67 kap. 11 §', rubrik: 'RUT-avdrag', lag: 'Inkomstskattelagen',
    text: `Skattereduktion för hushållsarbete (RUT) medges med 50 procent av arbetskostnaden för städning, barnpassning, trädgårdsarbete och liknande hushållsnära tjänster. Taket är 75 000 kronor per person och år för personer under 65 år, och 150 000 kronor för personer 65 år och äldre.`
  },

  // ── MERVÄRDESSKATTELAGEN ──────────────────────────────────────────
  {
    ref: 'ML 1 kap. 1 §', rubrik: 'Moms — skatteplikt och skattesatser', lag: 'Mervärdesskattelagen',
    text: `Mervärdesskatt ska betalas vid skattepliktig omsättning av varor och tjänster inom landet. Normalskattesatsen är 25 procent. Reducerad skattesats 12 procent gäller bl.a. livsmedel, restaurang- och cateringtjänster samt hotell. Reducerad skattesats 6 procent gäller bl.a. böcker, tidningar och persontransport. Konsulttjänster beskattas med 25 procent.`
  },
  {
    ref: 'ML 3 kap. 1 §', rubrik: 'Momsfri omsättning — undantag', lag: 'Mervärdesskattelagen',
    text: `Från skatteplikt undantas omsättning av bl.a. fastigheter, bank- och finansieringstjänster, försäkringstjänster, sjukvård, tandvård, social omsorg och utbildning. Den som omsätter sådana tjänster har inte rätt till avdrag för ingående moms på förvärv som används i den verksamheten.`
  },
  {
    ref: 'ML 7 kap. 1 §', rubrik: 'Momsregistrering — omsättningsgräns', lag: 'Mervärdesskattelagen',
    text: `En beskattningsbar person är skyldig att registrera sig för mervärdesskatt om den skattepliktiga omsättningen överstiger 80 000 kronor per beskattningsår. Frivillig registrering är möjlig även under gränsen. Den som inte är registrerad får inte debitera moms och har inte rätt till avdrag för ingående moms.`
  },
  {
    ref: 'ML 8 kap. 1 §', rubrik: 'Avdragsrätt ingående moms', lag: 'Mervärdesskattelagen',
    text: `En beskattningsbar person får göra avdrag för ingående skatt som hänför sig till förvärv i den momspliktige verksamheten. Avdragsrätt föreligger inte för förvärv som används för privat konsumtion eller för momsfri verksamhet. För blandad verksamhet ska avdraget fördelas proportionellt.`
  },
  {
    ref: 'ML 8 kap. 9 §', rubrik: 'Avdragsbegränsning — representation', lag: 'Mervärdesskattelagen',
    text: `Avdrag för ingående moms på representation medges med högst 46 kronor per person och tillfälle för måltider (motsvarande 25% moms på 90 kr avdragsunderlag enligt IL 16:2). Avdrag medges inte för alkohol. För hotell och konferens medges fullt avdrag om det har samband med verksamheten.`
  },
  {
    ref: 'ML 8 kap. 15 §', rubrik: 'Avdragsbegränsning — personbil', lag: 'Mervärdesskattelagen',
    text: `Avdrag för ingående moms vid anskaffning av personbil medges inte om bilen används privat. Används bilen uteslutande i momspliktig verksamhet medges fullt avdrag. Vid blandad användning medges avdrag proportionellt. För hyra av personbil gäller att 50 procent av momsen är avdragsgill om bilen används i verksamheten.`
  },
  {
    ref: 'ML 10 kap. 1 §', rubrik: 'Momsdeklaration — redovisningsperioder', lag: 'Mervärdesskattelagen',
    text: `Mervärdesskatt redovisas per beskattningsperiod. Företag med omsättning över 40 miljoner kronor redovisar månadsvis. Företag med omsättning mellan 1 och 40 miljoner redovisar kvartalsvis. Företag med omsättning under 1 miljon kronor kan redovisa årligen i inkomstdeklarationen.`
  },
  {
    ref: 'ML 13 kap. 1 §', rubrik: 'Omvänd skattskyldighet — byggtjänster', lag: 'Mervärdesskattelagen',
    text: `Vid omsättning av byggtjänster mellan momsregistrerade företag gäller omvänd skattskyldighet. Det innebär att köparen redovisar och betalar momsen istället för säljaren. Omvänd skattskyldighet gäller för tjänster som avser fastighet, byggnad eller anläggning inklusive mark.`
  },

  // ── SKATTEFÖRFARANDELAGEN ─────────────────────────────────────────
  {
    ref: 'SFL 3 kap. 1 §', rubrik: 'F-skatt — definition och syfte', lag: 'Skatteförfarandelagen',
    text: `F-skatt innebär att den som har godkännande för F-skatt själv betalar sin preliminärskatt och egenavgifter. Utbetalaren av ersättning behöver då inte göra skatteavdrag eller betala arbetsgivaravgifter. Godkännande för F-skatt söks hos Skatteverket och beviljas den som bedriver eller har för avsikt att bedriva näringsverksamhet.`
  },
  {
    ref: 'SFL 10 kap. 1 §', rubrik: 'Arbetsgivaravgifter — skyldighet', lag: 'Skatteförfarandelagen',
    text: `Den som betalar ut ersättning för arbete till en person utan F-skatt ska betala arbetsgivaravgifter. Arbetsgivaravgifterna uppgår till 31,42 procent på ersättningen för personer under 66 år. Reducerade avgifter gäller för unga (15-18 år) och äldre (66 år och äldre). Avgifterna betalas månadsvis via arbetsgivardeklaration.`
  },
  {
    ref: 'SFL 11 kap. 1 §', rubrik: 'Skatteavdrag — preliminärskatt', lag: 'Skatteförfarandelagen',
    text: `Den som betalar ut lön eller annan ersättning för arbete ska göra skatteavdrag för preliminär skatt. Skatteavdrag ska göras med det belopp som framgår av skattetabell eller enligt de regler Skatteverket fastställt. Avdraget ska redovisas och betalas in till Skatteverket månadsvis.`
  },
  {
    ref: 'SFL 26 kap. 1 §', rubrik: 'Inkomstdeklaration — tidsgränser', lag: 'Skatteförfarandelagen',
    text: `Fysiska personer och dödsbon ska lämna inkomstdeklaration senast den 2 maj året efter beskattningsåret. Juridiska personer ska lämna deklaration senast den 1 juli (vid räkenskapsår som slutar 31 december). Anstånd kan beviljas om det finns särskilda skäl. Förseningsavgift tas ut vid sen deklaration.`
  },
  {
    ref: 'SFL 49 kap. 1 §', rubrik: 'Skattetillägg — felaktig uppgift', lag: 'Skatteförfarandelagen',
    text: `Skattetillägg tas ut om den skattskyldige lämnat en oriktig uppgift i en deklaration eller annat dokument. Skattetillägget uppgår normalt till 40 procent av den skatt som skulle ha undandragits. Reducerat skattetillägg på 20 procent gäller om den oriktiga uppgiften rättats eller hade kunnat rättas med ledning av kontrollmaterial. Befrielse kan medges om felet är ursäktligt.`
  },
  {
    ref: 'SFL 66 kap. 1 §', rubrik: 'Omprövning — begäran av den skattskyldige', lag: 'Skatteförfarandelagen',
    text: `Den skattskyldige får begära omprövning av ett beslut hos Skatteverket. Begäran ska ha kommit in till Skatteverket senast det sjätte året efter utgången av det kalenderår då beskattningsåret gick ut. Skatteverket är skyldigt att ompröva beslutet om den skattskyldige begär det inom denna tid.`
  },

  // ── BOKFÖRINGSLAGEN ───────────────────────────────────────────────
  {
    ref: 'BFL 1 kap. 1 §', rubrik: 'Bokföringsskyldighet — vilka omfattas', lag: 'Bokföringslagen',
    text: `Bokföringsskyldighet gäller för alla som bedriver näringsverksamhet, oavsett om det är aktiebolag, handelsbolag, enskild firma eller ekonomisk förening. Stiftelser och ideella föreningar är bokföringsskyldiga om de bedriver näringsverksamhet eller har tillgångar överstigande 1,5 miljoner kronor.`
  },
  {
    ref: 'BFL 4 kap. 1 §', rubrik: 'Löpande bokföring — tidsgränser', lag: 'Bokföringslagen',
    text: `Affärshändelser ska bokföras så snart det kan ske. Kontanta in- och utbetalningar ska bokföras senast påföljande arbetsdag. Övriga affärshändelser ska bokföras så snart det är praktiskt möjligt, normalt inom 14 dagar. Årsredovisning och bokslut ska upprättas inom sex månader efter räkenskapsårets slut.`
  },
  {
    ref: 'BFL 5 kap. 1 §', rubrik: 'Verifikationer — krav på innehåll', lag: 'Bokföringslagen',
    text: `Varje affärshändelse ska dokumenteras med en verifikation. Verifikationen ska innehålla uppgift om när den har sammanställts, när affärshändelsen inträffat, vad denna avser, vilket belopp den gäller och vilken motpart den berör. Kvitton och fakturor utgör verifikationer om de uppfyller kraven.`
  },
  {
    ref: 'BFL 7 kap. 1 §', rubrik: 'Arkivering — bevarandetid', lag: 'Bokföringslagen',
    text: `Räkenskapsinformation ska bevaras i sju år efter utgången av det kalenderår då räkenskapsåret avslutades. Materialet ska bevaras i Sverige och vara tillgängligt för kontroll. Elektronisk lagring är tillåten om materialet kan tas fram i läsbar form och inte kan förändras.`
  },
  {
    ref: 'BFL 6 kap. 1 §', rubrik: 'Årsredovisning — skyldighet', lag: 'Bokföringslagen',
    text: `Aktiebolag, ekonomiska föreningar och handelsbolag med juridisk person som delägare är skyldiga att upprätta årsredovisning. Årsredovisningen ska bestå av balansräkning, resultaträkning, noter och förvaltningsberättelse. Större företag ska även upprätta kassaflödesanalys.`
  },
]

async function embedText(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

async function run() {
  console.log(`Startar import av ${REGLER.length} paragrafer...\n`)

  // Rensa gamla manuella regler (valfritt)
  // await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  let success = 0
  let failed = 0

  for (const regel of REGLER) {
    try {
      process.stdout.write(`Laddar upp ${regel.ref}...`)
      const embedding = await embedText(`${regel.rubrik}: ${regel.text}`)

      const { error } = await supabase.from('documents').insert({
        content: regel.text,
        metadata: { ref: regel.ref, rubrik: regel.rubrik, lag: regel.lag },
        embedding,
      })

      if (error) throw error
      console.log(' ✓')
      success++

      // Vänta lite för att inte trigga rate limits
      await new Promise(r => setTimeout(r, 200))
    } catch (err) {
      console.log(` ✗ ${err.message}`)
      failed++
    }
  }

  console.log(`\nKlart! ${success} uppladdade, ${failed} misslyckades.`)
}

run()