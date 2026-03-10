import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { searchDocuments } from '@/lib/embed'
import { searchRules } from '@/lib/rules'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function classifyRisk(question: string, sources: { ref: string; text: string }[]): {
  level: 'LÅG' | 'MEDEL' | 'HÖG'
  reason: string
} {
  const q = question.toLowerCase()

  const hogSignals = [
    'fåmansbolag', '3:12', 'kvalificerad andel', 'verksamhet i betydande',
    'underprisöverlåtelse', 'förtäckt utdelning', 'skatteflykt', 'genomsyn',
    'internprissättning', 'cfc', 'utflyttning', 'fusion', 'likvidation',
    'omstrukturering', 'generationsskifte'
  ]

  const medelSignals = [
    'representation', 'förmån', 'bilförmån', 'tjänstebil', 'hemkontor',
    'periodisering', 'inkurans', 'nedskrivning', 'koncernbidrag',
    'ränteavdrag', 'kapitalvinst', 'uppskov', 'rot', 'rut', 'traktamente',
    'uthyrning', 'dubbel bosättning'
  ]

  if (hogSignals.some(s => q.includes(s))) {
    return { level: 'HÖG', reason: 'Frågan berör ett område med hög komplexitet och individuella bedömningar. Konsultera en skatteexpert.' }
  }
  if (medelSignals.some(s => q.includes(s))) {
    return { level: 'MEDEL', reason: 'Tydliga regler men med vanliga undantag. Verifiera att grundförutsättningarna stämmer i ditt fall.' }
  }

  const sourceTexts = sources.map(s => s.text.toLowerCase()).join(' ')
  if (sourceTexts.includes('beroende på') || sourceTexts.includes('om') || sourceTexts.includes('kan')) {
    return { level: 'MEDEL', reason: 'Regelverket innehåller villkor som kan variera. Stäm av mot din specifika situation.' }
  }

  return { level: 'LÅG', reason: 'Tydlig regel med väldefinierat tillämpningsområde.' }
}

function verifyAgainstSources(answer: string, sources: { ref: string; text: string }[]): boolean {
  if (sources.length === 0) return false
  return sources.some(s => answer.includes(s.ref.split(' ')[0]))
}

function detectQuestionType(q: string): 'bokforing' | 'skatt' | 'generell' {
  const q2 = q.toLowerCase()
  const bokforing = ['bokför', 'konter', 'debet', 'kredit', 'konto', 'bokslut', 'k2', 'k3', 'periodisera', 'avskrivning', 'balansräkning', 'resultaträkning', 'årsredovisning', 'lager', 'inventarie', 'periodisering', 'upplupna', 'förutbetalda', 'kundförlust', 'inkurans']
  const skatt = ['skatt', 'moms', 'avdrag', 'f-skatt', 'fåmansbolag', '3:12', 'utdelning', 'förmån', 'representation', 'rot', 'rut', 'kapitalvinst', 'inkomstskatt', 'arbetsgivaravgift', 'egenavgift', 'gränsbelopp', 'traktamente', 'milersättning', 'uthyrning']
  if (bokforing.some(w => q2.includes(w))) return 'bokforing'
  if (skatt.some(w => q2.includes(w))) return 'skatt'
  return 'generell'
}

// Belopp som uppdateras varje år — webb-sökning triggas automatiskt
function needsWebSearch(question: string): boolean {
  const q = question.toLowerCase()
  const årsbelopp = [
    'traktamente', 'milersättning', 'prisbasbelopp', 'ibb', 'inkomstbasbelopp',
    'gränsbelopp', 'schablonbelopp', 'friskvård', 'förmånsvärde', 'bilförmån',
    'arbetsgivaravgift', 'egenavgift', 'grundavdrag', 'jobbskatteavdrag',
    'rot', 'rut', 'uthyrning', 'schablon', 'basbelopp', 'förenklingsregeln',
    '2026', 'i år', 'aktuell', 'nuvarande', 'gäller nu'
  ]
  return årsbelopp.some(s => q.includes(s))
}

export async function POST(req: Request) {
  const { messages, sessionId } = await req.json()
  const lastQuestion = messages[messages.length - 1].content
  const questionType = detectQuestionType(lastQuestion)
  const useWebSearch = needsWebSearch(lastQuestion)

  // ── STEG 1: RETRIEVAL ────────────────────────────────────────────────────
  let retrievedSources: { ref: string; rubrik: string; text: string; similarity?: number }[] = []
  let usedFallback = false

  try {
    const vectorResults = await searchDocuments(lastQuestion, 12)
    if (vectorResults && vectorResults.length > 0 && vectorResults[0].similarity > 0.15) {
      retrievedSources = vectorResults.map((r: {
        content: string
        metadata: { ref: string; rubrik: string }
        similarity: number
      }) => ({
        ref: r.metadata?.ref || 'REF',
        rubrik: r.metadata?.rubrik || '',
        text: r.content,
        similarity: r.similarity,
      }))
    } else {
      throw new Error('no vector results')
    }
  } catch {
    usedFallback = true
    const manualResults = searchRules(lastQuestion)
    retrievedSources = manualResults.map(r => ({ ref: r.ref, rubrik: r.rubrik, text: r.text }))
  }

  if (questionType === 'bokforing') {
    const manuellaRegler = searchRules(lastQuestion)
    for (const r of manuellaRegler) {
      if (!retrievedSources.find(s => s.ref === r.ref)) {
        retrievedSources.push({ ref: r.ref, rubrik: r.rubrik, text: r.text })
      }
    }
  }

  const sourceRefs = retrievedSources.map(s => s.ref)

  // ── STEG 2: RISKKLASSNING ────────────────────────────────────────────────
  const risk = classifyRisk(lastQuestion, retrievedSources)

  // ── STEG 3: KÄLLKONTEXT ──────────────────────────────────────────────────
  const källkontext = retrievedSources
    .map(s => `[${s.ref}] — ${s.rubrik}\n${s.text}`)
    .join('\n\n---\n\n')

  const bokforingExtra = questionType === 'bokforing' ? `

EXTRA FÖR BOKFÖRINGSFRÅGOR:
- Ange alltid BAS-kontonummer med kontonamn (t.ex. Debet 7010 Löner)
- Visa konteringsrader: Debet XXXX Kontonamn / Kredit XXXX Kontonamn
- Förklara om K2 och K3 ger olika svar
- Var konkret med siffror i exemplet` : ''

  const webSearchInstruktion = useWebSearch ? `

VIKTIGT — WEBB-SÖKNING:
Frågan gäller belopp eller regler som uppdateras varje år. 
Använd web_search för att hämta aktuella belopp för 2026 direkt från Skatteverket INNAN du svarar.
Sök på: "skatteverket [ämne] 2026"
Ange alltid vilket år beloppet gäller och länka till källan.` : ''

  // ── STEG 4: LLM MED WEBB-SÖKNING ────────────────────────────────────────
  const system = `Du är Normiq — ett söksystem för svenska skatte- och redovisningsregler.

DIN UPPGIFT:
Du har fått relevanta källtexter hämtade från svensk lagstiftning. Din uppgift är att förklara vad dessa källor säger om frågan — inte att ge råd eller skriva fritt.

Du hittar svaret i källorna. Om källorna inte räcker — och frågan gäller belopp som ändras varje år — använd web_search för att hämta aktuell information från Skatteverket.

TILLGÄNGLIGA KÄLLOR:
${källkontext}

${usedFallback ? 'OBS: Källorna kommer från det manuella regelindexet — ej vektorsökning.' : ''}${bokforingExtra}${webSearchInstruktion}

SVARSFORMAT — använd exakt dessa separatorer:

## [Rubrik]

[Förklara vad källorna säger. Citera med exakt lagrum [IL 57 kap. 10 §]. Ange alltid vilket år ett belopp gäller.]

---FÖRENKLAT---
Enkelt uttryckt: [2-3 meningar vad reglerna innebär i praktiken]

---EXEMPEL---
Exempel: [Konkret exempel med siffror${questionType === 'bokforing' ? '. Visa konteringsrader.' : '.'}]

Källor: [kommaseparerad lista med exakta ref]
Risk: ${risk.level} — ${risk.reason}

REGLER:
1. Håll dig STRIKT till källtexterna — lägg inte till information som inte finns där
2. Om källorna inte täcker frågan och webb-sökning inte ger svar: säg det explicit
3. Risk-raden är ALLTID sista raden
4. Citera alltid med exakt lagrum [IL 16 kap. 2 §]
5. Ange alltid årstal på belopp (t.ex. "290 kr/dygn 2026")
6. Svara på svenska`

  // Webb-sökning aktiveras automatiskt för årsbelopp
  const tools: Anthropic.Tool[] = useWebSearch ? [
    {
      name: 'web_search',
      // @ts-expect-error — web_search_20250305 är ett giltigt type-värde
      type: 'web_search_20250305',
    }
  ] : []

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2000,
    system,
    ...(tools.length > 0 && { tools }),
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  })

  // Extrahera text — kan innehålla tool_use block om webb-sökning användes
  const answer = response.content
    .filter(block => block.type === 'text')
    .map(block => block.type === 'text' ? block.text : '')
    .join('')

  // ── STEG 5: VERIFIERING ──────────────────────────────────────────────────
  const verified = verifyAgainstSources(answer, retrievedSources)
  const finalAnswer = verified
    ? answer
    : answer + '\n\n_OBS: Svaret kunde inte verifieras fullt ut mot källtexterna. Kontrollera med originalkällan._'

  // ── STEG 6: SPARA ────────────────────────────────────────────────────────
  try {
    const { data: inserted } = await supabase
      .from('queries')
      .insert({
        question: lastQuestion,
        answer: finalAnswer,
        sources: sourceRefs,
        risk_level: risk.level,
        session_id: sessionId || 'anonymous',
      })
      .select('id')
      .single()

    return Response.json({
      content: finalAnswer,
      sources: sourceRefs,
      risk_level: risk.level,
      query_id: inserted?.id,
      verified,
      web_search_used: useWebSearch,
    })
  } catch {
    return Response.json({
      content: finalAnswer,
      sources: sourceRefs,
      risk_level: risk.level,
      query_id: null,
      verified,
      web_search_used: useWebSearch,
    })
  }
}