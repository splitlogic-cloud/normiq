type Regel = {
  typ: 'avdragsgräns' | 'skattesats' | 'schablonbelopp' | 'tidsgräns' | 'villkor' | 'kontering' | 'klassificering'
  villkor?: string[]
  gräns?: { belopp: number; enhet: string; exklMoms?: boolean; perPerson?: boolean; perÅr?: boolean }
  satser?: { namn: string; procent: number }[]
  undantag?: string[]
  källa: string
}

export type Rule = {
  ref: string
  rubrik: string
  text: string
  regel?: Regel
}

export const rules: Rule[] = [
  // ── SKATT ────────────────────────────────────────────────────────────────

  {
    ref: 'IL 16:2',
    rubrik: 'Representation — avdragsrätt',
    text: 'Utgifter för representation är avdragsgilla om de har omedelbart samband med näringsverksamheten. Avdrag medges med högst 90 kronor per person och tillfälle exklusive moms för måltidsrepresentation. För kundgåvor medges avdrag med högst 300 kronor per person och år exklusive moms. För kultur och underhållning (teater, idrottsevenemang) medges avdrag med högst 180 kronor per person.',
    regel: {
      typ: 'avdragsgräns',
      villkor: ['omedelbart samband med näringsverksamheten', 'ej privat karaktär'],
      gräns: { belopp: 90, enhet: 'kr/person/tillfälle', exklMoms: true },
      undantag: ['kundgåvor max 300 kr/person/år', 'kultur/underhållning max 180 kr/person'],
      källa: 'IL 16 kap. 2 §',
    },
  },

  {
    ref: 'ML 8:9',
    rubrik: 'Moms på representation',
    text: 'Avdragsrätt för ingående moms vid representation föreligger på underlag upp till 90 kronor per person exklusive moms. Moms på alkohol är aldrig avdragsgill. Ingen momsavdragsrätt för kultur och underhållning.',
    regel: {
      typ: 'avdragsgräns',
      villkor: ['representationen är avdragsgill'],
      gräns: { belopp: 90, enhet: 'kr/person', exklMoms: true },
      undantag: ['alkohol: ingen momsavdragsrätt', 'kultur/underhållning: ingen momsavdragsrätt'],
      källa: 'ML 8 kap. 9 §',
    },
  },

  {
    ref: 'IL 57:2',
    rubrik: 'Fåmansbolag — kvalificerad andel',
    text: 'En andel är kvalificerad om ägaren eller närstående varit verksam i betydande omfattning under beskattningsåret eller något av de fem föregående åren. Fåmansföretag = fyra eller färre delägare äger mer än 50% av rösterna.',
    regel: {
      typ: 'villkor',
      villkor: ['verksam i betydande omfattning', 'under innevarande eller senaste 5 år', 'ägare eller närstående'],
      källa: 'IL 57 kap. 2 §',
    },
  },

  {
    ref: 'IL 57:10',
    rubrik: 'Fåmansbolag — gränsbelopp schablonmetoden',
    text: 'Schablonbeloppet 2024: 204 325 kr (2,75 × IBB 74 300 kr). Schablonbeloppet 2025: 209 550 kr (2,75 × IBB 76 200 kr). Utdelning upp till gränsbeloppet beskattas som kapital med 20% (2/3 × 30%). Förenklingsregeln och huvudregeln kan inte kombineras samma år för samma bolag.',
    regel: {
      typ: 'schablonbelopp',
      villkor: ['kvalificerad andel', 'fåmansbolag'],
      gräns: { belopp: 209550, enhet: 'kr/år 2025', perPerson: false },
      satser: [{ namn: 'kapitalskatt på utdelning inom gränsbelopp', procent: 20 }],
      undantag: ['kan ej kombineras med huvudregeln samma år'],
      källa: 'IL 57 kap. 10 §',
    },
  },

  {
    ref: 'IL 57:11',
    rubrik: 'Fåmansbolag — gränsbelopp huvudregeln',
    text: 'Gränsbelopp = omkostnadsbeloppet × (statslåneräntan + 9%) + lönebaserat utrymme. Lönebaserat utrymme = 50% av kontanta löner i bolaget. Krav på löneuttag: lägst det lägsta av 9,6 IBB (713 280 kr 2024) eller 6 IBB + 5% av totala löner.',
    regel: {
      typ: 'villkor',
      villkor: ['löneuttag minst 9,6 IBB eller 6 IBB + 5% av totala löner', 'kvalificerad andel'],
      källa: 'IL 57 kap. 11 §',
    },
  },

  {
    ref: 'IL 57:20',
    rubrik: 'Fåmansbolag — utdelning över gränsbeloppet',
    text: 'Utdelning över gränsbeloppet beskattas som tjänst, max 90 IBB (6 687 000 kr 2024) per person. Belopp däröver beskattas som kapital med 30%. Sparat utdelningsutrymme räknas upp med statslåneräntan + 3 procentenheter.',
    regel: {
      typ: 'skattesats',
      villkor: ['utdelning överstiger gränsbeloppet'],
      satser: [
        { namn: 'tjänstebeskattning upp till 90 IBB', procent: 52 },
        { namn: 'kapitalskatt över 90 IBB', procent: 30 },
      ],
      källa: 'IL 57 kap. 20 §',
    },
  },

  {
    ref: 'IL 57:22',
    rubrik: 'Fåmansbolag — kapitalvinst kvalificerade andelar',
    text: 'Kapitalvinst upp till sparat utdelningsutrymme beskattas som kapital med 20%. Resterande vinst beskattas till 2/3 som tjänst (max 100 IBB). Överskjutande del beskattas som kapital med 30%.',
    regel: {
      typ: 'skattesats',
      satser: [
        { namn: 'kapital inom sparat utrymme', procent: 20 },
        { namn: 'tjänst upp till 100 IBB', procent: 52 },
        { namn: 'kapital över 100 IBB', procent: 30 },
      ],
      källa: 'IL 57 kap. 22 §',
    },
  },

  {
    ref: 'SKV 3:12',
    rubrik: 'Fåmansbolag — lön eller utdelning, praktisk guide',
    text: 'Optimalt löneuttag för att maximera lönebaserat utrymme: ta ut lön motsvarande 6 IBB + 5% av totala löner, men minst 9,6 IBB (713 280 kr 2024). Utdelning upp till gränsbeloppet beskattas med 20%. Spara utdelningsutrymme om du inte behöver pengarna i år.',
    regel: {
      typ: 'schablonbelopp',
      villkor: ['fåmansbolag', 'aktiv ägare'],
      gräns: { belopp: 713280, enhet: 'kr minimiuttag 2024' },
      källa: 'SKV 3:12',
    },
  },

  {
    ref: 'ML 1:1',
    rubrik: 'Moms — skatteplikt och satser',
    text: 'Normalskattesats: 25%. Reducerad 12%: livsmedel, restaurang, hotell, camping. Reducerad 6%: böcker, tidningar, persontransport, konserter, idrottsevenemang. Momsfritt: sjukvård, tandvård, utbildning, bank, försäkring, fastighetsuthyrning.',
    regel: {
      typ: 'skattesats',
      satser: [
        { namn: 'normalskattesats', procent: 25 },
        { namn: 'reducerad (livsmedel, restaurang, hotell)', procent: 12 },
        { namn: 'reducerad (böcker, tidningar, transport)', procent: 6 },
        { namn: 'momsfritt (sjukvård, utbildning, bank)', procent: 0 },
      ],
      källa: 'ML 1 kap. 1 §',
    },
  },

  {
    ref: 'ML 3:1',
    rubrik: 'Moms — fakturakrav',
    text: 'Momsfaktura ska innehålla: datum, löpnummer, säljarens momsregnr, köparens namn/adress, varornas art och mängd, beskattningsunderlag per skattesats, skattesats, momsbelopp. Förenklad faktura (under 4 000 kr inkl. moms) behöver inte köparens uppgifter.',
    regel: {
      typ: 'villkor',
      villkor: ['datum', 'löpnummer', 'momsregistreringsnummer', 'köparens uppgifter', 'beskattningsunderlag', 'skattesats', 'momsbelopp'],
      undantag: ['förenklad faktura under 4 000 kr inkl. moms: köparens uppgifter ej krav'],
      källa: 'ML 3 kap. 1 §',
    },
  },

  {
    ref: 'SFL 3:1',
    rubrik: 'F-skatt — regler och egenavgifter',
    text: 'F-skatt innebär att innehavaren betalar sin egen preliminärskatt och egenavgifter. Utbetalaren gör inte skatteavdrag. Egenavgifter 2024: 28,97% på aktiv näringsverksamhet.',
    regel: {
      typ: 'skattesats',
      satser: [{ namn: 'egenavgifter aktiv näringsverksamhet 2024', procent: 28.97 }],
      källa: 'SFL 3 kap. 1 §',
    },
  },

  {
    ref: 'IL 11:1',
    rubrik: 'Löneförmåner — skattefria förmåner',
    text: 'Friskvårdsbidrag skattefritt upp till 5 000 kr/år om det erbjuds alla anställda. Julklapp skattefritt upp till 500 kr inkl. moms. Jubileumsgåva skattefri upp till 1 500 kr. Minnesgåva vid pension skattefri upp till 15 000 kr.',
    regel: {
      typ: 'avdragsgräns',
      satser: [],
      gräns: { belopp: 5000, enhet: 'kr/år friskvård', perPerson: true, perÅr: true },
      undantag: ['julklapp max 500 kr', 'jubileumsgåva max 1 500 kr', 'minnesgåva max 15 000 kr'],
      källa: 'IL 11 kap. 1 §',
    },
  },

  {
    ref: 'SKV Inkurans',
    rubrik: 'Inkurans — lagervärdering och avdrag',
    text: 'Lager får tas upp till lägst 97% av det lägsta av anskaffningsvärde och nettoförsäljningsvärde (97%-regeln). Ytterligare inkuransavdrag medges om verklig inkurans kan styrkas med dokumentation.',
    regel: {
      typ: 'schablonbelopp',
      villkor: ['varulagret värderas till lägsta värdets princip'],
      gräns: { belopp: 97, enhet: '% av lagervärdet (minst)' },
      undantag: ['ytterligare avdrag vid styrkt inkurans'],
      källa: 'SKV Inkurans',
    },
  },

  {
    ref: 'IL 16:36',
    rubrik: 'Hemkontor — avdragsrätt',
    text: 'Avdrag för arbetsrum i bostaden medges om rummet används uteslutande för arbetet. Schablonbelopp: 2 000 kr/år för egna hem, 4 000 kr/år för hyresrätt.',
    regel: {
      typ: 'avdragsgräns',
      villkor: ['uteslutande användning för arbete', 'arbetsgivare tillhandahåller ej arbetsrum'],
      gräns: { belopp: 4000, enhet: 'kr/år hyresrätt' },
      undantag: ['egna hem: max 2 000 kr/år'],
      källa: 'IL 16 kap. 36 §',
    },
  },

  // ── BOKFÖRING & REDOVISNING ──────────────────────────────────────────────

  {
    ref: 'BFL 5:1',
    rubrik: 'Bokföring — verifikationer och arkivering',
    text: 'Varje affärshändelse ska dokumenteras med verifikation. Innehåll: datum, löpnummer, belopp, motpart, vad affärshändelsen avser. Verifikationer ska bevaras i 7 år efter kalenderåret räkenskapsåret avslutades.',
    regel: {
      typ: 'villkor',
      villkor: ['datum', 'löpnummer', 'belopp', 'motpart', 'affärshändelsens art'],
      gräns: { belopp: 7, enhet: 'år arkivering' },
      källa: 'BFL 5 kap. 1 §',
    },
  },

  {
    ref: 'BFN K2',
    rubrik: 'K2 — när det gäller och förenklingsregler',
    text: 'K2 (BFNAR 2016:10) gäller för mindre aktiebolag och ekonomiska föreningar. Förenklingar: ingen komponentavskrivning, periodisering ej nödvändig under 5 000 kr (7 000 kr fr.o.m. 2026), schablonmässiga avskrivningar.',
    regel: {
      typ: 'klassificering',
      villkor: ['mindre aktiebolag', 'ej moderbolag i koncern', 'max 50 anställda eller max 40 Mkr balansomslutning eller max 80 Mkr omsättning'],
      gräns: { belopp: 5000, enhet: 'kr periodiseringsgräns (7 000 kr fr.o.m. 2026)' },
      källa: 'BFNAR 2016:10',
    },
  },

  {
    ref: 'BFN K3',
    rubrik: 'K3 — när det gäller och skillnader mot K2',
    text: 'K3 (BFNAR 2012:1) är huvudregelverket. Måste användas av: större företag, moderbolag i koncern, företag som väljer bort K2. Kräver komponentavskrivning på byggnader, uppskjuten skatt ska redovisas.',
    regel: {
      typ: 'klassificering',
      villkor: ['större företag', 'eller moderbolag i koncern', 'eller frivilligt val'],
      källa: 'BFNAR 2012:1',
    },
  },

  {
    ref: 'BFN K2',
    rubrik: 'K2 — avskrivningar och nyttjandeperioder',
    text: 'Byggnader: 2% per år (hyreshus) eller 4% (industri). Inventarier: 20% per år linjärt. Datorer: 3–5 år. Immateriella tillgångar: max 5 år. Goodwill: max 10 år. Inventarier under halvt prisbasbelopp (26 250 kr 2024) får dras av omedelbart.',
    regel: {
      typ: 'avdragsgräns',
      satser: [
        { namn: 'hyreshus', procent: 2 },
        { namn: 'industrifastighet', procent: 4 },
        { namn: 'inventarier linjärt', procent: 20 },
      ],
      gräns: { belopp: 26250, enhet: 'kr direktavdrag inventarier 2024' },
      källa: 'BFNAR 2016:10 p.10',
    },
  },

  {
    ref: 'BAS 2024',
    rubrik: 'BAS-kontoplan — kontoklasser översikt',
    text: 'Klass 1: Tillgångar (10xx immateriella, 11-12xx byggnader, 13xx maskiner/inventarier, 14-15xx varulager/kundfordringar, 19xx kassa/bank). Klass 2: Skulder och eget kapital. Klass 3: Intäkter. Klass 4: Varuinköp. Klass 5-6: Rörelsekostnader. Klass 7: Personal. Klass 8: Finansiella poster och skatt.',
    regel: {
      typ: 'kontering',
      källa: 'BAS 2024',
    },
  },

  {
    ref: 'BAS 2024',
    rubrik: 'BAS-kontoplan — vanliga konton',
    text: '1510: Kundfordringar. 1630: Avräkning skatter/avgifter. 1650: Momsfordran. 1930: Företagskonto bank. 2081: Aktiekapital. 2091: Balanserad vinst. 2099: Årets resultat. 2440: Leverantörsskulder. 2510: Skatteskulder. 2611: Utgående moms 25%. 2640: Ingående moms. 2710: Personalskatt. 2730: Lagstadgade sociala avgifter. 3000: Försäljning tjänster. 4000: Varuinköp. 5410: Förbrukningsinventarier. 6072: Representation avdragsgill. 6071: Representation ej avdragsgill. 7010: Löner tjänstemän. 7510: Arbetsgivaravgifter. 7832: Avskrivning inventarier. 8811: Avsättning periodiseringsfond. 8910: Aktuell skatt.',
    regel: {
      typ: 'kontering',
      källa: 'BAS 2024',
    },
  },

  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — lön och arbetsgivaravgifter',
    text: 'Bruttolön bokförs: Debet 7010 Löner, Kredit 2710 Personalskatt + Kredit 1930 Nettolön. Arbetsgivaravgifter 31,42% (2024): Debet 7510, Kredit 2730.',
    regel: {
      typ: 'kontering',
      satser: [{ namn: 'arbetsgivaravgift 2024', procent: 31.42 }],
      källa: 'BAS Kontering',
    },
  },

  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — moms in och ut',
    text: 'Försäljning 25% moms: Debet 1510 Kundfordran, Kredit 3000 Försäljning, Kredit 2611 Utgående moms. Inköp med avdragsgill moms: Debet 5xxx, Debet 2640 Ingående moms, Kredit 2440.',
    regel: {
      typ: 'kontering',
      källa: 'BAS Kontering',
    },
  },

  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — representation',
    text: 'Avdragsgill representation (max 90 kr/person exkl. moms): Debet 6072, Debet 2640 (moms). Ej avdragsgill del: Debet 6071. Bokför alltid avdragsgill och ej avdragsgill del på separata konton.',
    regel: {
      typ: 'kontering',
      villkor: ['dela upp på konto 6071 och 6072'],
      gräns: { belopp: 90, enhet: 'kr/person avdragsgill del exkl. moms' },
      källa: 'BAS Kontering',
    },
  },

  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — köp och avskrivning av inventarier',
    text: 'Köp av inventarie (över 26 250 kr): Debet 1220 Inventarier, Debet 2640 Moms, Kredit 1930. Årets avskrivning 20%: Debet 7832, Kredit 1229. Under 26 250 kr: Debet 5410 direktavdrag.',
    regel: {
      typ: 'kontering',
      gräns: { belopp: 26250, enhet: 'kr gräns direktavdrag 2024' },
      källa: 'BAS Kontering',
    },
  },

  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — utdelning i aktiebolag',
    text: 'Beslutad utdelning: Debet 2091 Balanserad vinst, Kredit 2898 Skuld till aktieägare. Utbetalning netto: Debet 2898, Kredit 1930. Källskatt 30% (ej kvalificerade andelar): Debet 2898, Kredit 2710.',
    regel: {
      typ: 'kontering',
      satser: [{ namn: 'källskatt ej kvalificerade andelar', procent: 30 }],
      källa: 'BAS Kontering',
    },
  },

  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — periodiseringsfond',
    text: 'Avsättning (max 25% av skattemässig vinst): Debet 8811, Kredit 2120. Återföring efter max 6 år: Debet 2120, Kredit 8811.',
    regel: {
      typ: 'avdragsgräns',
      gräns: { belopp: 25, enhet: '% av skattemässig vinst' },
      tidsgräns: 6,
      källa: 'IL 30 kap.',
    } as Regel & { tidsgräns: number },
  },

  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — periodisering i bokslut',
    text: 'Upplupen intäkt: Debet 1790, Kredit 3xxx. Förutbetald intäkt: Debet 3xxx, Kredit 2990. Upplupen kostnad: Debet 5xxx-7xxx, Kredit 2990. Förutbetald kostnad: Debet 1790, Kredit 5xxx-7xxx. I K2: poster under 5 000 kr behöver ej periodiseras.',
    regel: {
      typ: 'kontering',
      gräns: { belopp: 5000, enhet: 'kr K2-gräns periodisering' },
      källa: 'BFNAR 2016:10 p.7',
    },
  },

  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — skatt aktiebolag',
    text: 'Bolagsskatt 20,6%: Debet 8910 Skatt årets resultat, Kredit 2510. I K2 redovisas inte uppskjuten skatt. I K3 ska uppskjuten skatt redovisas på temporära skillnader.',
    regel: {
      typ: 'skattesats',
      satser: [{ namn: 'bolagsskatt', procent: 20.6 }],
      källa: 'IL 65 kap. 10 §',
    },
  },

  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — egenavgifter enskild firma',
    text: 'Avsättning egenavgifter i bokslut: Debet 7570, Kredit 2930. Beräkning: Nettoinkomst × 28,97%. Avdrag med 25% schablon.',
    regel: {
      typ: 'skattesats',
      satser: [{ namn: 'egenavgifter 2024', procent: 28.97 }],
      källa: 'SFL 3 kap. 1 §',
    },
  },

  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — varulager och inkurans',
    text: 'Lagervärdering ökning: Debet 1460, Kredit 4990. Minskning: Debet 4990, Kredit 1460. Inkuransnedskrivning: Debet 4970, Kredit 1469. 97%-regeln ger automatisk avdragsrätt för 3% av lagervärdet.',
    regel: {
      typ: 'kontering',
      gräns: { belopp: 97, enhet: '% lägsta lagervärde' },
      källa: 'BAS Kontering',
    },
  },

  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — kundförluster',
    text: 'Konstaterad förlust: Debet 6350, Kredit 1510. Momsåtervinning: Debet 2611, Kredit 6350. Befarad förlust: Debet 6352, Kredit 1519.',
    regel: {
      typ: 'kontering',
      källa: 'BAS Kontering',
    },
  },

  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — milersättning och fordonskostnader',
    text: 'Skattefri milersättning 2024: 25 kr/mil. Debet 7331, Kredit 1930. Leasingbil: Debet 5612, Kredit 1930/2440.',
    regel: {
      typ: 'avdragsgräns',
      gräns: { belopp: 25, enhet: 'kr/mil skattefri ersättning 2024' },
      källa: 'IL 12 kap. 5 §',
    },
  },

  {
    ref: 'ÅRL 2:1',
    rubrik: 'Årsredovisning — innehåll och inlämning',
    text: 'Årsredovisning ska innehålla: förvaltningsberättelse, resultaträkning, balansräkning, noter. Ska ges in till Bolagsverket inom 7 månader från räkenskapsårets slut.',
    regel: {
      typ: 'tidsgräns',
      gräns: { belopp: 7, enhet: 'månader inlämningstid' },
      villkor: ['förvaltningsberättelse', 'resultaträkning', 'balansräkning', 'noter'],
      källa: 'ÅRL 2 kap. 1 §',
    },
  },

  {
    ref: 'ABL 17:3',
    rubrik: 'Aktiebolag — utdelning och försiktighetsregeln',
    text: 'Utdelning får inte överstiga vad som är försvarligt med hänsyn till verksamhetens krav på eget kapital (försiktighetsregeln). Kräver full täckning av bundet eget kapital.',
    regel: {
      typ: 'villkor',
      villkor: ['full täckning av bundet eget kapital', 'försvarligt med hänsyn till verksamheten'],
      källa: 'ABL 17 kap. 3 §',
    },
  },
]

// ── SÖKFUNKTION ──────────────────────────────────────────────────────────────

export function searchRules(query: string): Rule[] {
  const q = query.toLowerCase()
  const keywords = q.split(/\s+/).filter(w => w.length > 2)

  const bokforingKeywords = ['bokför', 'konter', 'debet', 'kredit', 'konto', 'bokslut', 'k2', 'k3', 'periodisering', 'avskrivning', 'balansräkning', 'resultaträkning', 'periodisera', 'upplupna', 'förutbetalda', 'lager', 'inventarie', 'årsredovisning']

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

// ── REGELKONTROLL API — Version 2 ────────────────────────────────────────────
// Används för att kontrollera transaktioner mot regelgränser
// Exempel: checkRule('representation', { belopp: 900, antalPersoner: 3 })

export type CheckResult = {
  godkänd: boolean
  regel: string
  gräns?: number
  faktiskt?: number
  enhet?: string
  meddelande: string
  källa: string
}

export function checkRule(regeltyp: string, params: Record<string, number>): CheckResult | null {
  const lowerTyp = regeltyp.toLowerCase()

  // Representation
  if (lowerTyp.includes('representation')) {
    const regel = rules.find(r => r.ref === 'IL 16:2')
    const gräns = 90
    const perPerson = params.belopp / (params.antalPersoner || 1)
    return {
      godkänd: perPerson <= gräns,
      regel: 'IL 16:2 Representation',
      gräns,
      faktiskt: Math.round(perPerson),
      enhet: 'kr/person exkl. moms',
      meddelande: perPerson <= gräns
        ? `✓ Inom avdragsgräns (${Math.round(perPerson)} kr/person ≤ ${gräns} kr)`
        : `⚠ Över avdragsgräns (${Math.round(perPerson)} kr/person > ${gräns} kr). Överskott bokförs på 6071.`,
      källa: regel?.regel?.källa || 'IL 16 kap. 2 §',
    }
  }

  // Milersättning
  if (lowerTyp.includes('mil') || lowerTyp.includes('körning')) {
    const regel = rules.find(r => r.ref === 'BAS Kontering' && r.rubrik.includes('milersättning'))
    const gräns = 25
    const ersättning = params.ersättningPerMil || params.belopp
    return {
      godkänd: ersättning <= gräns,
      regel: 'IL 12:5 Milersättning',
      gräns,
      faktiskt: ersättning,
      enhet: 'kr/mil',
      meddelande: ersättning <= gräns
        ? `✓ Inom skattefri gräns (${ersättning} kr/mil ≤ ${gräns} kr)`
        : `⚠ Över skattefri gräns (${ersättning} kr/mil > ${gräns} kr). Överskott är skattepliktig förmån.`,
      källa: regel?.regel?.källa || 'IL 12 kap. 5 §',
    }
  }

  // Periodiseringsfond
  if (lowerTyp.includes('periodiseringsfond')) {
    const gräns = 0.25
    const vinst = params.skattemässigVinst || params.belopp
    const avsättning = params.avsättning
    const maxAvsättning = vinst * gräns
    return {
      godkänd: avsättning <= maxAvsättning,
      regel: 'IL 30 kap. Periodiseringsfond',
      gräns: maxAvsättning,
      faktiskt: avsättning,
      enhet: 'kr (max 25% av skattemässig vinst)',
      meddelande: avsättning <= maxAvsättning
        ? `✓ Inom gräns (${avsättning} kr ≤ ${maxAvsättning} kr)`
        : `⚠ Över gräns (${avsättning} kr > ${maxAvsättning} kr max).`,
      källa: 'IL 30 kap.',
    }
  }

  return null
}