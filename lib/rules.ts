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
    text: 'Måltidsrepresentation (lunch, middag, supé) är INTE avdragsgill inkomstskattemässigt sedan 2017. Avdrag medges endast för enklare förtäring (kaffe, te, bullar, frukt, enklare smörgås som ej ersätter måltid) med högst 60 kr/person exkl. moms. Kundgåvor: max 300 kr/person/år exkl. moms. Kringkostnader (lokal, underhållning, teater, golf): max 180 kr/person exkl. moms. Representation måste ha omedelbart samband med näringsverksamheten.',
    regel: {
      typ: 'avdragsgräns',
      villkor: ['omedelbart samband med näringsverksamheten', 'ej privat karaktär'],
      gräns: { belopp: 60, enhet: 'kr/person enklare förtäring exkl. moms' },
      undantag: [
        'måltid (lunch/middag/supé): 0 kr avdrag inkomstskattemässigt',
        'kundgåvor max 300 kr/person/år exkl. moms',
        'kringkostnader max 180 kr/person exkl. moms',
      ],
      källa: 'IL 16 kap. 2 §',
    },
  },

  {
    ref: 'ML 8:9',
    rubrik: 'Moms på representation',
    text: 'Momsavdrag vid representationsmåltid medges på underlag upp till 300 kr/person exkl. moms (ger ca 36 kr moms vid 12%, eller 46 kr om starköl ingår). Inkomstskattemässigt är måltiden ändå inte avdragsgill — men momsen får lyftas. Enklare förtäring: fullt momsavdrag upp till 60 kr/person. Kringkostnader: momsavdrag på underlag upp till 180 kr/person exkl. moms. Alkohol och sprit: aldrig momsavdragsgill.',
    regel: {
      typ: 'avdragsgräns',
      villkor: ['representationen har omedelbart samband med verksamheten', 'momspliktig verksamhet'],
      gräns: { belopp: 300, enhet: 'kr/person momsbas måltid exkl. moms' },
      undantag: [
        'alkohol/sprit: ingen momsavdragsrätt',
        'kringkostnader: max 180 kr/person momsbas exkl. moms',
        'enklare förtäring: full momsavdragsrätt upp till 60 kr/person',
      ],
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
    rubrik: 'Fåmansbolag — grundbelopp (del av gränsbelopp)',
    text: 'Grundbeloppet 2026: 4 IBB = 322 400 kr (IBB 2026 = 80 600 kr). Grundbeloppet tillfaller ägare av kvalificerade andelar vid årets ingång. Utdelning upp till gränsbeloppet beskattas som kapital med 20 %. Gränsbeloppet kan bestå av upp till fyra delar: (1) grundbelopp, (2) lönebaserat utrymme, (3) sparat utdelningsutrymme, (4) ränta på omkostnadsbelopp. OBS: Tidigare kallades grundbeloppet "schablonbelopp" och beräknades som 2,75 × IBB — denna regel gäller fr.o.m. 2026.',
    regel: {
      typ: 'schablonbelopp',
      villkor: ['kvalificerad andel', 'fåmansbolag', 'ägde andelar vid årets ingång'],
      gräns: { belopp: 322400, enhet: 'kr/år 2026', perPerson: false },
      satser: [{ namn: 'kapitalskatt på utdelning inom gränsbelopp', procent: 20 }],
      källa: 'IL 57 kap. 10 §',
    },
  },

  {
    ref: 'IL 57:11',
    rubrik: 'Fåmansbolag — lönebaserat utrymme (del av gränsbelopp)',
    text: 'Lönebaserat utrymme 2026: 50% av (totala kontanta löner i bolaget − 8 IBB). 8 IBB 2026 = 644 800 kr. Om bolaget betalat ut löner understigande 644 800 kr finns inget lönebaserat utrymme. Ränta på omkostnadsbelopp: om omkostnadsbeloppet överstiger 100 000 kr får den överskjutande delen räknas upp med statslåneräntan + 9 procentenheter. Sparat utdelningsutrymme räknas upp med statslåneräntan + 3 procentenheter varje år.',
    regel: {
      typ: 'villkor',
      villkor: ['löner överstiger 644 800 kr (8 IBB 2026)', 'kvalificerad andel'],
      källa: 'IL 57 kap. 11 §',
    },
  },

  {
    ref: 'IL 57:20',
    rubrik: 'Fåmansbolag — utdelning över gränsbeloppet',
    text: 'Utdelning över gränsbeloppet beskattas som tjänst, max 90 IBB per person. Belopp däröver beskattas som kapital med 30%. Sparat utdelningsutrymme räknas upp med statslåneräntan + 3 procentenheter.',
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
    rubrik: 'Fåmansbolag — praktisk guide utdelning 2026',
    text: 'Gränsbeloppet består av upp till fyra delar: (1) Grundbelopp: 4 IBB = 322 400 kr (alla kvalificerade ägare). (2) Lönebaserat utrymme: 50% av löner över 644 800 kr (8 IBB). (3) Sparat utdelningsutrymme från tidigare år (uppräknat med SLR + 3%). (4) Ränta på omkostnadsbelopp över 100 000 kr (SLR + 9%). Förutsättningar: andelar ägda vid årets ingång, beslut på bolagsstämma. Utdelning inom gränsbeloppet: 20% skatt. Utdelning över: tjänsteskatt upp till 90 IBB, därefter 30% kapital.',
    regel: {
      typ: 'schablonbelopp',
      villkor: ['fåmansbolag', 'aktiv ägare', 'kvalificerade andelar vid årets ingång'],
      källa: 'SKV 3:12',
    },
  },

  {
    ref: 'IL 57:ÖVERSIKT',
    rubrik: '3:12 — utdelningsutrymme, alla fyra delar (2026)',
    text: `Gränsbeloppet för lågbeskattad utdelning (20% kapitalskatt) består av upp till fyra delar:

1. GRUNDBELOPP: 4 IBB = 322 400 kr (IBB 2026 = 80 600 kr). Tillfaller alla som äger kvalificerade andelar vid årets ingång.

2. LÖNEBASERAT UTRYMME: (Totala kontanta löner i bolaget − 644 800 kr) × 50%. Om bolaget betalat ut mindre än 644 800 kr (8 IBB) finns inget lönebaserat utrymme.

3. SPARAT UTDELNINGSUTRYMME: Outnyttjat gränsbelopp från tidigare år rullar vidare och räknas upp med statslåneräntan + 3 procentenheter varje år.

4. RÄNTA PÅ OMKOSTNADSBELOPP: Om omkostnadsbeloppet (normalt = aktiekapitalet) överstiger 100 000 kr får den överskjutande delen räknas upp med statslåneräntan + 9 procentenheter.

FÖRUTSÄTTNINGAR: (a) Kvalificerade andelar i fåmansföretag (≤4 delägare med >50% av rösterna). (b) Andelarna ägda vid årets ingång. (c) Utdelning beslutas på årsstämma eller extra bolagsstämma.

Utdelning ÖVER gränsbeloppet beskattas som tjänst upp till 90 IBB, därefter 30% kapital.`,
    regel: {
      typ: 'villkor',
      villkor: ['kvalificerade andelar', 'fåmansföretag', 'ägde andelar vid årets ingång'],
      satser: [
        { namn: 'utdelning inom gränsbeloppet', procent: 20 },
        { namn: 'utdelning över gränsbeloppet (tjänst, max 90 IBB)', procent: 52 },
        { namn: 'utdelning över 90 IBB', procent: 30 },
      ],
      källa: 'IL 57 kap. 10–20 §§',
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
    text: 'F-skatt innebär att innehavaren betalar sin egen preliminärskatt och egenavgifter. Utbetalaren gör inte skatteavdrag. Egenavgifter 2026: 28,97% på aktiv näringsverksamhet.',
    regel: {
      typ: 'skattesats',
      satser: [{ namn: 'egenavgifter aktiv näringsverksamhet 2026', procent: 28.97 }],
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
    text: 'K2 (BFNAR 2016:10) gäller för mindre aktiebolag och ekonomiska föreningar. Förenklingar: ingen komponentavskrivning, periodisering ej nödvändig under 7 000 kr (fr.o.m. 2026, tidigare 5 000 kr), schablonmässiga avskrivningar. OBS: vissa företag får inte längre tillämpa K2 fr.o.m. räkenskapsår efter 31 dec 2025 — se BFN BFNAR 2025:3.',
    regel: {
      typ: 'klassificering',
      villkor: ['mindre aktiebolag', 'ej moderbolag i koncern', 'max 50 anställda eller max 40 Mkr balansomslutning eller max 80 Mkr omsättning'],
      gräns: { belopp: 7000, enhet: 'kr periodiseringsgräns fr.o.m. 2026' },
      undantag: [
        'bostadsrättsföreningar → K3 obligatoriskt fr.o.m. 2026',
        'fastighetsbolag ≥75% omsättning → K3 fr.o.m. 2026',
        'utländska filialer → K3 fr.o.m. 2026',
        'kryptotillgångar → K3 fr.o.m. 2026',
      ],
      källa: 'BFNAR 2016:10',
    },
  },

  {
    ref: 'BFN K3',
    rubrik: 'K3 — när det gäller och skillnader mot K2',
    text: 'K3 (BFNAR 2012:1) är huvudregelverket. Måste användas av: större företag, moderbolag i koncern, företag som väljer bort K2. Fr.o.m. räkenskapsår efter 31 dec 2025 även obligatoriskt för bostadsrättsföreningar, fastighetsbolag med ≥75% omsättning från byggnader, bolag med utländska filialer och bolag med kryptotillgångar. Kräver komponentavskrivning på byggnader, uppskjuten skatt ska redovisas.',
    regel: {
      typ: 'klassificering',
      villkor: ['större företag', 'eller moderbolag i koncern', 'eller frivilligt val', 'eller obligatorisk övergång fr.o.m. 2026'],
      källa: 'BFNAR 2012:1',
    },
  },

  {
    ref: 'BFN BFNAR 2025:3',
    rubrik: 'K2 → K3-övergång 2026 — obligatorisk för vissa företag',
    text: 'Fr.o.m. räkenskapsår som inleds efter 31 dec 2025 får följande företag INTE längre tillämpa K2 utan måste byta till K3: (1) Bostadsrättsföreningar och bostadsföreningar. (2) Fastighetsbolag där byggnader normalt genererar ≥75% av nettoomsättningen. (3) Företag med en eller flera utländska filialer. (4) Företag som haft kryptotillgångar (direkta innehav). Nystartade företag efter 30 juni 2025 vars räkenskapsår avslutas 31 dec 2026 eller senare ska tillämpa K3 direkt. Periodiseringsgränsen i K2 höjs till 7 000 kr fr.o.m. 2026.',
    regel: {
      typ: 'villkor',
      villkor: [
        'Bostadsrättsföreningar → K3 obligatoriskt fr.o.m. 2026',
        'Fastighetsbolag ≥75% omsättning från byggnader → K3',
        'Bolag med utländska filialer → K3',
        'Bolag med kryptotillgångar (direkta innehav) → K3',
      ],
      undantag: [
        'Lättnadsregeln för vissa små fastighetsbolag',
        'Bostadsaktiebolag (ej bostadsrättsföreningar) — omfattas ej av tvångsbyte',
      ],
      källa: 'BFNAR 2025:3, BFNAR 2016:10',
    },
  },

  {
    ref: 'BFN K2',
    rubrik: 'K2 — avskrivningar och nyttjandeperioder',
    text: 'Byggnader: 2% per år (hyreshus) eller 4% (industri). Inventarier: 20% per år linjärt. Datorer: 3–5 år. Immateriella tillgångar: max 5 år. Goodwill: max 10 år. Inventarier under halvt prisbasbelopp (ca 26 250 kr) får dras av omedelbart.',
    regel: {
      typ: 'avdragsgräns',
      satser: [
        { namn: 'hyreshus', procent: 2 },
        { namn: 'industrifastighet', procent: 4 },
        { namn: 'inventarier linjärt', procent: 20 },
      ],
      gräns: { belopp: 26250, enhet: 'kr direktavdrag inventarier' },
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
    text: 'Bruttolön bokförs: Debet 7010 Löner, Kredit 2710 Personalskatt + Kredit 1930 Nettolön. Arbetsgivaravgifter 31,42% (2026): Debet 7510, Kredit 2730.',
    regel: {
      typ: 'kontering',
      satser: [{ namn: 'arbetsgivaravgift 2026', procent: 31.42 }],
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
    text: 'Måltidsrepresentation (lunch/middag): INGEN inkomstskatteavdragsrätt. Momsavdrag medges på underlag upp till 300 kr/person exkl. moms (ca 36 kr moms per person). Bokför hela beloppet på konto 6071 (ej avdragsgill). Ingående moms på 2640. Enklare förtäring (kaffe, bullar — max 60 kr/person exkl. moms): Debet 6072 + Debet 2640 moms, Kredit 1930/2440. Kringkostnader lokal/underhållning (max 180 kr/person exkl. moms): Debet 6072 + Debet 2640.',
    regel: {
      typ: 'kontering',
      villkor: ['måltid → 6071 (ej avdragsgill)', 'enklare förtäring max 60 kr/person → 6072', 'kringkostnader max 180 kr/person → 6072'],
      gräns: { belopp: 60, enhet: 'kr/person avdragsgill enklare förtäring exkl. moms' },
      undantag: ['måltid: 0 kr inkomstskatteavdrag, men momsavdrag på 300 kr/person', 'kringkostnader max 180 kr/person på 6072'],
      källa: 'BAS Kontering, IL 16 kap. 2 §, ML 8 kap. 9 §',
    },
  },

  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — köp och avskrivning av inventarier',
    text: 'Köp av inventarie (över 26 250 kr): Debet 1220 Inventarier, Debet 2640 Moms, Kredit 1930. Årets avskrivning 20%: Debet 7832, Kredit 1229. Under 26 250 kr: Debet 5410 direktavdrag.',
    regel: {
      typ: 'kontering',
      gräns: { belopp: 26250, enhet: 'kr gräns direktavdrag' },
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
      källa: 'IL 30 kap.',
    } as Regel & { tidsgräns: number },
  },

  {
    ref: 'BAS Kontering',
    rubrik: 'Kontering — periodisering i bokslut',
    text: 'Upplupen intäkt: Debet 1790, Kredit 3xxx. Förutbetald intäkt: Debet 3xxx, Kredit 2990. Upplupen kostnad: Debet 5xxx-7xxx, Kredit 2990. Förutbetald kostnad: Debet 1790, Kredit 5xxx-7xxx. I K2: poster under 7 000 kr behöver ej periodiseras (fr.o.m. 2026, tidigare 5 000 kr).',
    regel: {
      typ: 'kontering',
      gräns: { belopp: 7000, enhet: 'kr K2-gräns periodisering fr.o.m. 2026' },
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
      satser: [{ namn: 'egenavgifter 2026', procent: 28.97 }],
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
    text: 'Skattefri milersättning 2026: 25 kr/mil (egen bil). Debet 7331, Kredit 1930. Leasingbil: Debet 5612, Kredit 1930/2440.',
    regel: {
      typ: 'avdragsgräns',
      gräns: { belopp: 25, enhet: 'kr/mil skattefri ersättning 2026' },
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
    const perPerson = params.belopp / (params.antalPersoner || 1)
    const momsbas = 300
    const enklFörtäringGräns = 60
    const ärMåltid = params.måltid === 1 || perPerson > enklFörtäringGräns

    if (ärMåltid) {
      // Måltid — ej avdragsgill inkomstskatt, men momsavdrag på max 300 kr/person
      const momsAvdrag = Math.round(Math.min(perPerson, momsbas) * 0.12)
      const antal = params.antalPersoner || 1
      return {
        godkänd: false, // aldrig avdragsgill inkomstskatt för måltid
        regel: 'IL 16:2 Representation — måltid',
        gräns: 0,
        faktiskt: Math.round(perPerson),
        enhet: 'kr/person (0 kr inkomstskatteavdrag)',
        meddelande: `⚠ Måltidsrepresentation är ej avdragsgill inkomstskattemässigt (sedan 2017). Bokför hela beloppet på konto 6071. Momsavdrag medges på max 300 kr/person exkl. moms (ca ${momsAvdrag} kr moms/person = ${momsAvdrag * antal} kr totalt för ${antal} person${antal > 1 ? 'er' : ''}). Total kostnad: ${Math.round(perPerson * antal)} kr.`,
        källa: 'IL 16 kap. 2 §, ML 8 kap. 9 §',
      }
    } else {
      // Enklare förtäring
      const antal = params.antalPersoner || 1
      return {
        godkänd: perPerson <= enklFörtäringGräns,
        regel: 'IL 16:2 Representation — enklare förtäring',
        gräns: enklFörtäringGräns,
        faktiskt: Math.round(perPerson),
        enhet: 'kr/person exkl. moms',
        meddelande: perPerson <= enklFörtäringGräns
          ? `✓ Inom avdragsgräns för enklare förtäring (${Math.round(perPerson)} kr/person ≤ ${enklFörtäringGräns} kr exkl. moms). Bokför på konto 6072.`
          : `⚠ Över gräns för enklare förtäring (${Math.round(perPerson)} kr/person > ${enklFörtäringGräns} kr). Del upp till ${enklFörtäringGräns} kr/person på 6072, överskott på 6071.`,
        källa: 'IL 16 kap. 2 §',
      }
    }
  }

  // Milersättning
  if (lowerTyp.includes('mil') || lowerTyp.includes('körning')) {
    const gräns = 25
    const ersättning = params.ersättningPerMil || params.belopp
    return {
      godkänd: ersättning <= gräns,
      regel: 'IL 12:5 Milersättning',
      gräns,
      faktiskt: ersättning,
      enhet: 'kr/mil',
      meddelande: ersättning <= gräns
        ? `✓ Inom skattefri gräns (${ersättning} kr/mil ≤ ${gräns} kr/mil)`
        : `⚠ Över skattefri gräns (${ersättning} kr/mil > ${gräns} kr/mil). Överskott ${ersättning - gräns} kr/mil är skattepliktig lön.`,
      källa: 'IL 12 kap. 5 §',
    }
  }

  // Periodiseringsfond
  if (lowerTyp.includes('periodiseringsfond')) {
    const gräns = 0.25
    const vinst = params.skattemässigVinst || params.belopp
    const avsättning = params.avsättning
    const maxAvsättning = Math.round(vinst * gräns)
    return {
      godkänd: avsättning <= maxAvsättning,
      regel: 'IL 30 kap. Periodiseringsfond',
      gräns: maxAvsättning,
      faktiskt: avsättning,
      enhet: 'kr (max 25% av skattemässig vinst)',
      meddelande: avsättning <= maxAvsättning
        ? `✓ Inom gräns. Avsättning ${avsättning} kr ≤ max ${maxAvsättning} kr (25% av ${vinst} kr). Debet 8811, Kredit 2120.`
        : `⚠ Över gräns. ${avsättning} kr > max ${maxAvsättning} kr (25% av ${vinst} kr). Minska avsättningen med ${avsättning - maxAvsättning} kr.`,
      källa: 'IL 30 kap.',
    }
  }

  return null
}