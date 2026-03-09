export const rules = [
  // ── SKATT ────────────────────────────────────────────────────────
  {
    ref: 'IL 16:2',
    rubrik: 'Representation — avdragsrätt',
    text: 'Utgifter för representation är avdragsgilla om de har omedelbart samband med näringsverksamheten. Avdrag medges med högst 90 kronor per person och tillfälle exklusive moms för måltidsrepresentation. För kundgåvor medges avdrag med högst 300 kronor per person och år exklusive moms. För kultur och underhållning (teater, idrottsevenemang) medges avdrag med högst 180 kronor per person.',
  },
  {
    ref: 'ML 8:9',
    rubrik: 'Moms på representation',
    text: 'Avdragsrätt för ingående moms vid representation föreligger på underlag upp till 90 kronor per person exklusive moms. Moms på alkohol är aldrig avdragsgill. Ingen momsavdragsrätt för kultur och underhållning.',
  },
  {
    ref: 'IL 57:2',
    rubrik: 'Fåmansbolag — kvalificerad andel',
    text: 'En andel är kvalificerad om ägaren eller närstående varit verksam i betydande omfattning under beskattningsåret eller något av de fem föregående åren. Fåmansföretag = fyra eller färre delägare äger mer än 50% av rösterna.',
  },
  {
    ref: 'IL 57:10',
    rubrik: 'Fåmansbolag — gränsbelopp schablonmetoden',
    text: 'Schablonbeloppet 2024: 204 325 kr (2,75 × IBB 74 300 kr). Schablonbeloppet 2025: 209 550 kr (2,75 × IBB 76 200 kr). Utdelning upp till gränsbeloppet beskattas som kapital med 20% (2/3 × 30%). Förenklingsregeln och huvudregeln kan inte kombineras samma år för samma bolag.',
  },
  {
    ref: 'IL 57:11',
    rubrik: 'Fåmansbolag — gränsbelopp huvudregeln',
    text: 'Gränsbelopp = omkostnadsbeloppet × (statslåneräntan + 9%) + lönebaserat utrymme. Lönebaserat utrymme = 50% av kontanta löner i bolaget. Krav på löneuttag: lägst det lägsta av 9,6 IBB (713 280 kr 2024) eller 6 IBB + 5% av totala löner.',
  },
  {
    ref: 'IL 57:20',
    rubrik: 'Fåmansbolag — utdelning över gränsbeloppet',
    text: 'Utdelning över gränsbeloppet beskattas som tjänst, max 90 IBB (6 687 000 kr 2024) per person. Belopp däröver beskattas som kapital med 30%. Sparat utdelningsutrymme räknas upp med statslåneräntan + 3 procentenheter.',
  },
  {
    ref: 'IL 57:22',
    rubrik: 'Fåmansbolag — kapitalvinst kvalificerade andelar',
    text: 'Kapitalvinst upp till sparat utdelningsutrymme beskattas som kapital med 20%. Resterande vinst beskattas till 2/3 som tjänst (max 100 IBB). Överskjutande del beskattas som kapital med 30%.',
  },
  {
    ref: 'SKV 3:12',
    rubrik: 'Fåmansbolag — lön eller utdelning, praktisk guide',
    text: 'Optimalt löneuttag för att maximera lönebaserat utrymme: ta ut lön motsvarande 6 IBB + 5% av totala löner, men minst 9,6 IBB (713 280 kr 2024). Utdelning upp till gränsbeloppet beskattas med 20% — betydligt lägre än tjänsteinkomst (ca 32-57%). Spara utdelningsutrymme om du inte behöver pengarna i år.',
  },
  {
    ref: 'ML 1:1',
    rubrik: 'Moms — skatteplikt och satser',
    text: 'Normalskattesats: 25%. Reducerad 12%: livsmedel, restaurang, hotell, camping. Reducerad 6%: böcker, tidningar, persontransport, konserter, idrottsevenemang. Momsfritt: sjukvård, tandvård, utbildning, bank, försäkring, fastighetsuthyrning (om inte frivillig registrering).',
  },
  {
    ref: 'ML 3:1',
    rubrik: 'Moms — fakturakrav',
    text: 'Momsfaktura ska innehålla: datum, löpnummer, säljarens momsregnr (SE+orgnr+01), köparens namn/adress, varornas art och mängd, beskattningsunderlag per skattesats, skattesats, momsbelopp. Förenklad faktura (under 4 000 kr inkl. moms) behöver inte köparens uppgifter.',
  },
  {
    ref: 'SFL 3:1',
    rubrik: 'F-skatt — regler och egenavgifter',
    text: 'F-skatt innebär att innehavaren betalar sin egen preliminärskatt och egenavgifter. Utbetalaren gör inte skatteavdrag. Egenavgifter 2024: 28,97% på aktiv näringsverksamhet. FA-skatt = kombination av A-skatt på lön och F-skatt på företagsinkomst.',
  },
  {
    ref: 'IL 11:1',
    rubrik: 'Löneförmåner — skatteplikt och skattefria förmåner',
    text: 'Alla löner, arvoden och förmåner är skattepliktiga. Bilförmån beräknas schablonmässigt. Friskvårdsbidrag skattefritt upp till 5 000 kr/år om det erbjuds alla anställda. Julklapp skattefritt upp till 500 kr inkl. moms. Jubileumsgåva skattefri upp till 1 500 kr. Minnesgåva vid pension skattefri upp till 15 000 kr.',
  },
  {
    ref: 'SKV Inkurans',
    rubrik: 'Inkurans — lagervärdering och avdrag',
    text: 'Lager får tas upp till lägst 97% av det lägsta av anskaffningsvärde och nettoförsäljningsvärde (97%-regeln). Ytterligare inkuransavdrag medges om verklig inkurans kan styrkas med dokumentation: inventeringslistor, foton, kassationsprotokoll. Värdering: FIFO eller viktad genomsnittskostnad.',
  },
  {
    ref: 'IL 16:36',
    rubrik: 'Hemkontor — avdragsrätt',
    text: 'Avdrag för arbetsrum i bostaden medges om rummet används uteslutande för arbetet och arbetsgivaren inte tillhandahåller arbetsrum. Schablonbelopp: 2 000 kr/år för egna hem, 4 000 kr/år för hyresrätt. Enskilda näringsidkare kan ha rätt till större avdrag baserat på faktisk andel av bostadsyta.',
  },

  // ── BOKFÖRING & REDOVISNING ───────────────────────────────────────
  {
    ref: 'BFL 5:1',
    rubrik: 'Bokföring — verifikationer och arkivering',
    text: 'Varje affärshändelse ska dokumenteras med verifikation. Innehåll: datum, löpnummer, belopp, motpart, vad affärshändelsen avser. Verifikationer ska bevaras i 7 år efter kalenderåret räkenskapsåret avslutades. Kontanta in- och utbetalningar bokförs senast påföljande arbetsdag.',
  },
  {
    ref: 'BFN K2',
    rubrik: 'K2 — när det gäller och förenklingsregler',
    text: 'K2 (BFNAR 2016:10) gäller för mindre aktiebolag och ekonomiska föreningar. Förenklingar: ingen komponentavskrivning, periodisering ej nödvändig under 5 000 kr (7 000 kr fr.o.m. 2026), schablonmässiga avskrivningar. K2 ska tillämpas i sin helhet — man kan inte blanda K2 och K3. Kan inte användas av moderbolag i större koncern.',
  },
  {
    ref: 'BFN K3',
    rubrik: 'K3 — när det gäller och skillnader mot K2',
    text: 'K3 (BFNAR 2012:1) är huvudregelverket. Måste användas av: större företag, moderbolag i koncern, företag som väljer bort K2. Kräver komponentavskrivning på byggnader, aktivering av utvecklingskostnader möjlig, mer detaljerade upplysningar. K3 ger ofta mer rättvisande bild men är mer komplex.',
  },
  {
    ref: 'BFN K2',
    rubrik: 'K2 — avskrivningar och nyttjandeperioder',
    text: 'Byggnader: 2% per år (hyreshus) eller 4% (industri). Inventarier: 20% per år linjärt, eller 25-30% på restvärde. Datorer: 3-5 år. Immateriella tillgångar: max 5 år om inte längre kan visas. Goodwill: max 10 år i K2. Inventarier under halvt prisbasbelopp (26 250 kr 2024) får dras av omedelbart.',
  },
  {
    ref: 'BAS 2024',
    rubrik: 'BAS-kontoplan — kontoklasser översikt',
    text: 'Klass 1: Tillgångar (10xx immateriella, 11-12xx byggnader, 13xx maskiner/inventarier, 14-15xx varulager/kundfordringar, 19xx kassa/bank). Klass 2: Skulder och eget kapital (20xx eget kapital, 23xx långfristiga skulder, 24xx skatteskulder, 26-27xx kortfristiga skulder, 28xx leverantörsskulder). Klass 3: Intäkter. Klass 4: Varuinköp. Klass 5-6: Rörelsekostnader. Klass 7: Personal. Klass 8: Finansiella poster och skatt.',
  },
  {
    ref: 'BAS 2024',
    rubrik: 'BAS-kontoplan — vanliga konton',
    text: '1510: Kundfordringar. 1630: Avräkning skatter/avgifter. 1650: Momsfordran. 1930: Företagskonto bank. 2081: Aktiekapital. 2091: Balanserad vinst. 2099: Årets resultat. 2440: Leverantörsskulder. 2510: Skatteskulder. 2611: Utgående moms 25%. 2640: Ingående moms. 2710: Personalskatt. 2730: Lagstadgade sociala avgifter. 3000: Försäljning tjänster. 4000: Varuinköp. 5410: Förbrukningsinventarier. 6072: Representation avdragsgill. 6071: Representation ej avdragsgill. 7010: Löner tjänstemän. 7510: Arbetsgivaravgifter. 7832: Avskrivning inventarier. 8811: Avsättning periodiseringsfond. 8910: Aktuell skatt.',
  },
  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — lön och arbetsgivaravgifter',
    text: 'Bruttolön bokförs: Debet 7010 Löner, Kredit 2710 Personalskatt + Kredit 1930 Nettolön (bank). Arbetsgivaravgifter 31,42% (2024): Debet 7510 Arbetsgivaravgifter, Kredit 2730 Skuld arbetsgivaravgifter. Betalning till Skatteverket: Debet 2710 + Debet 2730, Kredit 1930.',
  },
  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — moms in och ut',
    text: 'Försäljning 25% moms: Debet 1510 Kundfordran (inkl. moms), Kredit 3000 Försäljning (exkl. moms), Kredit 2611 Utgående moms. Inköp med avdragsgill moms: Debet 5xxx/4xxx (exkl. moms), Debet 2640 Ingående moms, Kredit 2440 Leverantörsskuld. Momsredovisning: Debet 2611, Kredit 2640. Skillnad betalas/erhålls: mot konto 1630.',
  },
  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — representation',
    text: 'Avdragsgill representation (max 90 kr/person exkl. moms): Debet 6072 Representation avdragsgill, Debet 2640 Ingående moms (avdragsgill del), Kredit 1930/2440. Ej avdragsgill del: Debet 6071 Representation ej avdragsgill, Kredit 1930/2440. Bokför alltid avdragsgill och ej avdragsgill del på separata konton.',
  },
  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — köp och avskrivning av inventarier',
    text: 'Köp av inventarie (över 26 250 kr): Debet 1220 Inventarier, Debet 2640 Ingående moms, Kredit 1930/2440. Årets avskrivning 20%: Debet 7832 Avskrivning inventarier, Kredit 1229 Ackumulerade avskrivningar. Inventarie under 26 250 kr: Debet 5410 Förbrukningsinventarier (direktavdrag), Debet 2640 Moms, Kredit 1930/2440.',
  },
  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — utdelning i aktiebolag',
    text: 'Beslutad utdelning på stämma: Debet 2091 Balanserad vinst, Kredit 2898 Skuld till aktieägare. Utbetalning netto: Debet 2898, Kredit 1930. Källskatt 30% (ej kvalificerade andelar): Debet 2898, Kredit 2710. Utdelning kvalificerade andelar (3:12) beskattas hos mottagaren — bolaget betalar ingen källskatt.',
  },
  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — periodiseringsfond och bokslutsdispositioner',
    text: 'Avsättning periodiseringsfond (max 25% av skattemässig vinst): Debet 8811 Avsättning periodiseringsfond, Kredit 2120 Periodiseringsfond. Återföring efter max 6 år: Debet 2120, Kredit 8811. Skattemässig överavskrivning utöver plan: Debet 8850 Förändring överavskrivningar, Kredit 2150 Ackumulerade överavskrivningar.',
  },
  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — periodisering i bokslut',
    text: 'Upplupen intäkt (intjänad ej fakturerad): Debet 1790 Upplupen intäkt, Kredit 3xxx Intäkt. Förutbetald intäkt (fakturerad ej intjänad): Debet 3xxx, Kredit 2990 Förutbetald intäkt. Upplupen kostnad (kostnad uppkommen ej fakturerad): Debet 5xxx-7xxx, Kredit 2990 Upplupen kostnad. Förutbetald kostnad (betald ej förbrukad): Debet 1790, Kredit 5xxx-7xxx. I K2 behöver poster under 5 000 kr inte periodiseras.',
  },
  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — varulager och inkurans i bokslut',
    text: 'Lagervärdering (ökning): Debet 1460 Lager, Kredit 4990 Förändring lager. Lagervärdering (minskning): Debet 4990, Kredit 1460. Inkuransnedskrivning: Debet 4970 Inkurans, Kredit 1469 Nedskrivning lager. Skattemässigt: 97%-regeln ger automatisk avdragsrätt för 3% av lagervärdet.',
  },
  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — kundförluster',
    text: 'Konstaterad kundförlust: Debet 6350 Kundförluster, Kredit 1510 Kundfordringar. Momsåtervinning: Debet 2611 Utgående moms, Kredit 6350 (eller 1510). Befarad kundförlust: Debet 6352 Befarade förluster, Kredit 1519 Reserv osäkra fordringar. Kreditfaktura: Debet 2440, Kredit 3000 + Kredit 2611.',
  },
  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — egenavgifter enskild firma',
    text: 'Avsättning egenavgifter i bokslut: Debet 7570 Egenavgifter, Kredit 2930 Upplupna egenavgifter. Beräkning: Nettoinkomst × 28,97%. Avdrag för egenavgifter medges med 25% schablon på inkomsten. Betalning: Debet 2930, Kredit 1930.',
  },
  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — skatt aktiebolag',
    text: 'Bolagsskatt 20,6%: Debet 8910 Skatt årets resultat, Kredit 2510 Skatteskuld. Betalning: Debet 2510, Kredit 1930. I K2 redovisas inte uppskjuten skatt. I K3 ska uppskjuten skatt redovisas på temporära skillnader mellan redovisningsvärde och skattemässigt värde.',
  },
  {
    ref: 'ÅRL 2:1',
    rubrik: 'Årsredovisning — innehåll och inlämning',
    text: 'Årsredovisning ska innehålla: förvaltningsberättelse, resultaträkning, balansräkning, noter. Större företag även kassaflödesanalys. Förvaltningsberättelsen ska beskriva verksamheten, väsentliga händelser, förväntad utveckling och vinstdisposition. Ska ges in till Bolagsverket inom 7 månader från räkenskapsårets slut. Förseningsavgift utgår vid sen inlämning.',
  },
  {
    ref: 'ABL 17:3',
    rubrik: 'Aktiebolag — utdelning och försiktighetsregeln',
    text: 'Utdelning beslutas av bolagsstämman och får inte överstiga vad som är försvarligt med hänsyn till verksamhetens krav på eget kapital (försiktighetsregeln). Kräver full täckning av bundet eget kapital. Styrelsen föreslår utdelning i förvaltningsberättelsen. Olovlig utdelning ska återbäras.',
  },
  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — milersättning och fordonskostnader',
    text: 'Skattefri milersättning 2024: 25 kr/mil för bil. Kontering: Debet 7331 Skattefri milersättning, Kredit 1930. Överskjutande del är skattepliktig förmån. Leasingbil: Debet 5612 Leasingavgift, Kredit 1930/2440. Drivmedel tjänstebil: Debet 5611, Kredit 1930.',
  },
]

export function searchRules(query: string) {
  const q = query.toLowerCase()
  const keywords = q.split(/\s+/).filter(w => w.length > 2)

  const bokforingKeywords = ['bokför', 'konter', 'debet', 'kredit', 'konto', 'bokslut', 'k2', 'k3', 'bas', 'periodisering', 'avskrivning', 'balansräkning', 'resultaträkning', 'periodisera', 'upplupna', 'förutbetalda', 'lager', 'inventarie', 'årsredovisning']

  const scored = rules.map(rule => {
    const haystack = `${rule.ref} ${rule.rubrik} ${rule.text}`.toLowerCase()
    let score = 0
    for (const kw of keywords) {
      if (haystack.includes(kw)) score++
      if (rule.rubrik.toLowerCase().includes(kw)) score += 2
      if (rule.ref.toLowerCase().includes(kw)) score += 3
    }
    for (const bk of bokforingKeywords) {
      if (q.includes(bk) && haystack.includes(bk)) score += 2
    }
    return { rule, score }
  })

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(s => s.rule)
}