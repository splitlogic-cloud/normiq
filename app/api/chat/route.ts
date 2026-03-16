import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { searchDocuments } from '@/lib/embed'
import { searchRules } from '@/lib/rules'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── RATE LIMITING ─────────────────────────────────────────────────────────
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20
const RATE_WINDOW = 60_000

function checkRateLimit(sessionId: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(sessionId)
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(sessionId, { count: 1, resetAt: now + RATE_WINDOW })
    return { allowed: true, remaining: RATE_LIMIT - 1 }
  }
  if (entry.count >= RATE_LIMIT) return { allowed: false, remaining: 0 }
  entry.count++
  return { allowed: true, remaining: RATE_LIMIT - entry.count }
}

// ── SVARSCACHE ────────────────────────────────────────────────────────────
const answerCache = new Map<string, { answer: string; sources: string[]; risk_level: string; cachedAt: number }>()
const CACHE_TTL = 60 * 60_000

function getCached(question: string) {
  const key = question.trim().toLowerCase()
  const entry = answerCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > CACHE_TTL) { answerCache.delete(key); return null }
  return entry
}

function setCached(question: string, answer: string, sources: string[], risk_level: string) {
  const key = question.trim().toLowerCase()
  answerCache.set(key, { answer, sources, risk_level, cachedAt: Date.now() })
  if (answerCache.size > 500) {
    const oldest = [...answerCache.entries()].sort((a, b) => a[1].cachedAt - b[1].cachedAt)[0]
    answerCache.delete(oldest[0])
  }
}

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
    'milersättning', 'uthyrning', 'dubbel bosättning'
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

// ── KÄLLVIKTNING ─────────────────────────────────────────────────────────
// SKV-vägledningar och praxis är mer praktiskt användbara än ren lagtext.
// Vi boostar deras relevans så de inte drunknar i IL-massan.
function boostScore(r: { metadata: { lag?: string }; similarity: number }): number {
  const lag = r.metadata?.lag?.toLowerCase() || ''
  if (lag.includes('skatteverket') || lag.includes('skv')) return r.similarity * 1.4
  if (lag.includes('bfn') || lag.includes('normgivning'))   return r.similarity * 1.2
  if (lag.includes('mervärdes'))                            return r.similarity * 1.1
  return r.similarity
}

export async function POST(req: Request) {
  const { messages, sessionId } = await req.json()
  const lastQuestion = messages[messages.length - 1].content
  const questionType = detectQuestionType(lastQuestion)
  const useWebSearch = needsWebSearch(lastQuestion)

  // ── RATE LIMIT ───────────────────────────────────────────────────────────
  const id = sessionId || req.headers.get('x-forwarded-for') || 'anonymous'
  const { allowed, remaining } = checkRateLimit(id)
  if (!allowed) {
    return Response.json(
      { content: 'Du har ställt för många frågor på kort tid. Vänta en minut och försök igen.' },
      { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
    )
  }

  // ── CACHE ────────────────────────────────────────────────────────────────
  if (!useWebSearch) {
    const cached = getCached(lastQuestion)
    if (cached) {
      return Response.json({
        content: cached.answer,
        sources: cached.sources,
        risk_level: cached.risk_level,
        query_id: null,
        verified: true,
        from_cache: true,
      }, { headers: { 'X-RateLimit-Remaining': String(remaining) } })
    }
  }

  // ── STEG 1: RETRIEVAL ────────────────────────────────────────────────────
  // Hämtar fler chunks (20) och boostar SKV/BFN/ML så de inte drunknar i IL
  let retrievedSources: { ref: string; rubrik: string; text: string; similarity?: number }[] = []
  let usedFallback = false

  try {
    const vectorResults = await searchDocuments(lastQuestion, 20)

    if (vectorResults && vectorResults.length > 0 && vectorResults[0].similarity > 0.2) {
      // Sortera om med viktning
      const boosted = vectorResults
        .map((r: { content: string; metadata: { ref: string; rubrik: string; lag?: string }; similarity: number }) => ({
          ...r,
          boostedScore: boostScore(r),
        }))
        .sort((a: { boostedScore: number }, b: { boostedScore: number }) => b.boostedScore - a.boostedScore)
        .slice(0, 14) // Ta de 14 bästa efter viktning

      retrievedSources = boosted.map((r: {
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

  // ── STEG 4: LLM ──────────────────────────────────────────────────────────
  const system = `Du är Normiq — ett söksystem för svenska skatte- och redovisningsregler.

DIN UPPGIFT:
Du har fått relevanta källtexter hämtade från svensk lagstiftning och Skatteverkets vägledningar. Din uppgift är att ge ett fullständigt, praktiskt användbart svar baserat på dessa källor.

VIKTIGT: Källtexterna ger dig lagstiftningens ramverk. Du ska:
1. Syntetisera informationen från ALLA relevanta källtexter — inte bara den första
2. Ge ett komplett svar som täcker hela frågan, inte bara ett lagrum
3. Prioritera Skatteverkets vägledningar och praxis framför ren lagtext när båda finns
4. Fylla ut med välkänd, etablerad praxis på området om källorna är knapphändiga — men markera tydligt vad som är praxis vs lagtext
5. Om en fråga har beloppsgränser eller procentsatser — ange dem alltid explicit

TILLGÄNGLIGA KÄLLOR (prioritera SKV och BFN framför ren lagtext):
${källkontext}

${usedFallback ? 'OBS: Källorna kommer från det manuella regelindexet — ej vektorsökning.' : ''}${bokforingExtra}${webSearchInstruktion}

SVARSFORMAT — använd exakt dessa separatorer:

## [Rubrik som sammanfattar svaret]

[Ge ett fullständigt svar. Förklara regelns innebörd, tillämpningsområde, viktiga gränsvärden och vanliga undantag. Citera med exakt lagrum [IL 57 kap. 10 §]. Ange alltid vilket år ett belopp gäller. Använd gärna kortare stycken och dela upp svaret logiskt. Var inte rädd för att ge ett längre svar om frågan kräver det.]

---FÖRENKLAT---
Enkelt uttryckt: [4–7 meningar för någon utan juridisk bakgrund. Inkludera:
- Vad regeln innebär konkret i praktiken
- Vanliga missförstånd eller fallgropar
- Vad man behöver tänka på eller dokumentera
- Viktiga undantag eller gränsdragningar]

---EXEMPEL---
Exempel: [Konkret exempel med siffror${questionType === 'bokforing' ? '. Visa konteringsrader.' : '. Visa hur regeln tillämpas steg för steg.'}]

Källor: [kommaseparerad lista med exakta ref]
Risk: ${risk.level} — ${risk.reason}

REGLER:
1. Ge alltid ett komplett svar — ett halvt svar är sämre än ett längre
2. Prioritera praktisk nytta: vad behöver användaren faktiskt veta?
3. Om källorna inte täcker frågan: säg det och hänvisa till Skatteverket
4. Risk-raden är ALLTID sista raden
5. Citera alltid med exakt lagrum [IL 16 kap. 2 §]
6. Ange alltid årstal på belopp (t.ex. "290 kr/dygn 2026")
7. Svara på svenska`

  // @ts-expect-error — web_search_20250305 är ett giltigt type-värde
  const tools: Anthropic.Tool[] = useWebSearch ? [{ name: 'web_search', type: 'web_search_20250305' }] : []

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2500, // Ökat från 2000 för mer fullständiga svar
    system,
    ...(tools.length > 0 && { tools }),
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  })

  const answer = response.content
    .filter(block => block.type === 'text')
    .map(block => block.type === 'text' ? block.text : '')
    .join('')

  // ── STEG 5: VERIFIERING ──────────────────────────────────────────────────
  const verified = verifyAgainstSources(answer, retrievedSources)
  const finalAnswer = verified
    ? answer
    : answer + '\n\n_OBS: Svaret kunde inte verifieras fullt ut mot källtexterna. Kontrollera med originalkällan._'

  if (!useWebSearch) {
    setCached(lastQuestion, finalAnswer, sourceRefs, risk.level)
  }

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