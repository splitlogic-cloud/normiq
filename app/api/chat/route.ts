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
    'traktamente', 'milersättning', 'resetraktamente', 'nattraktamente',
    'prisbasbelopp', 'ibb', 'inkomstbasbelopp', 'basbelopp',
    'gränsbelopp', 'schablonbelopp', 'förenklingsregeln', 'grundbelopp',
    'friskvård', 'friskvårdsbidrag',
    'förmånsvärde', 'bilförmån', 'förmånsbil',
    'arbetsgivaravgift', 'egenavgift',
    'grundavdrag', 'jobbskatteavdrag',
    'rot', 'rut', 'schablon',
    '3:12', 'fåmansbolag', 'fåmansföretag', 'utdelning', 'lönebaserat',
    'kostförmån', 'julklapp', 'jubileumsgåva', 'minnesgåva',
    'direktavdrag', 'kompletteringsregeln',
    'uppskov', 'uthyrning',
    '2026', 'i år', 'aktuell', 'nuvarande', 'gäller nu', 'aktuellt belopp',
  ]
  return årsbelopp.some(s => q.includes(s))
}

// ── KÄLLVIKTNING ─────────────────────────────────────────────────────────
function boostScore(r: { metadata: { lag?: string }; similarity: number }): number {
  const lag = r.metadata?.lag?.toLowerCase() || ''
  if (lag.includes('skatteverket') || lag.includes('skv')) return r.similarity * 1.4
  if (lag.includes('bfn') || lag.includes('normgivning'))   return r.similarity * 1.2
  if (lag.includes('mervärdes'))                            return r.similarity * 1.1
  return r.similarity
}

// ── RETRY-LOGIK FÖR 529 OVERLOADED ───────────────────────────────────────
async function createMessageWithRetry(params: Parameters<typeof client.messages.create>[0], maxRetries = 3): Promise<Anthropic.Message> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await client.messages.create({ ...params, stream: false }) as Anthropic.Message
    } catch (err: unknown) {
      const isOverloaded = (err as { status?: number })?.status === 529
      if (isOverloaded && attempt < maxRetries) {
        const delay = attempt * 2000
        console.log(`Anthropic overloaded, retry ${attempt}/${maxRetries} efter ${delay}ms`)
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      throw err
    }
  }
  throw new Error('Max retries exceeded')
}

export async function POST(req: Request) {
  const { messages, sessionId } = await req.json()
  const lastQuestion = messages[messages.length - 1].content
  const questionType = detectQuestionType(lastQuestion)
  const useWebSearch = needsWebSearch(lastQuestion)

  const id = sessionId || req.headers.get('x-forwarded-for') || 'anonymous'
  const { allowed, remaining } = checkRateLimit(id)
  if (!allowed) {
    return Response.json(
      { content: 'Du har ställt för många frågor på kort tid. Vänta en minut och försök igen.' },
      { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
    )
  }

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

  let retrievedSources: { ref: string; rubrik: string; text: string; similarity?: number }[] = []
  let usedFallback = false

  try {
    const vectorResults = await searchDocuments(lastQuestion, 20)
    if (vectorResults && vectorResults.length > 0 && vectorResults[0].similarity > 0.2) {
      const boosted = vectorResults
        .map((r: { content: string; metadata: { ref: string; rubrik: string; lag?: string }; similarity: number }) => ({
          ...r,
          boostedScore: boostScore(r),
        }))
        .sort((a: { boostedScore: number }, b: { boostedScore: number }) => b.boostedScore - a.boostedScore)
        .slice(0, 14)
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
  const risk = classifyRisk(lastQuestion, retrievedSources)

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
Ange alltid vilket år beloppet gäller.` : ''

  const system = `Du är Normiq — ett söksystem för svenska skatte- och redovisningsregler.

DIN UPPGIFT:
Du har fått relevanta källtexter hämtade från svensk lagstiftning och Skatteverkets vägledningar. Din uppgift är att ge ett fullständigt, praktiskt användbart svar baserat på dessa källor.

VIKTIGT:
1. Syntetisera informationen från ALLA relevanta källtexter
2. Ge ett komplett svar som täcker hela frågan
3. Prioritera Skatteverkets vägledningar och praxis framför ren lagtext
4. Om källorna inte täcker frågan fullt ut — säg det kort i en mening och hänvisa till Skatteverket. Spekulera aldrig och förklara inte dina egna begränsningar.
5. Ange alltid beloppsgränser och procentsatser explicit

TILLGÄNGLIGA KÄLLOR:
${källkontext}

${usedFallback ? 'OBS: Källorna kommer från det manuella regelindexet — ej vektorsökning.' : ''}${bokforingExtra}${webSearchInstruktion}

SVARSFORMAT:

## [Rubrik]

[Fullständigt svar med exakta lagrum [IL 57 kap. 10 §] och årstal på belopp.]

---FÖRENKLAT---
Enkelt uttryckt: [4–7 meningar för någon utan juridisk bakgrund.]

---EXEMPEL---
Exempel: [Konkret exempel med siffror${questionType === 'bokforing' ? '. Visa konteringsrader.' : '.'}]

Källor: [kommaseparerad lista]
Risk: ${risk.level} — ${risk.reason}

REGLER:
1. Ge alltid ett komplett svar — ett halvt svar är sämre än ett längre
2. Prioritera praktisk nytta: vad behöver användaren faktiskt veta?
3. Om källorna inte täcker frågan: en mening + hänvisa till skatteverket.se
4. Risk-raden är ALLTID sista raden
5. Citera alltid med exakt lagrum [IL 16 kap. 2 §]
6. Ange alltid årstal på belopp
7. Svara på svenska
8. Ge aldrig långa förklaringar om varför du kan ha fel eller om dina begränsningar — om du är osäker, säg det i en mening och hänvisa till SKV`

  // @ts-expect-error — web_search_20250305 är ett giltigt type-värde
  const tools: Anthropic.Tool[] = useWebSearch ? [{ name: 'web_search', type: 'web_search_20250305' }] : []

  let response
  try {
    response = await createMessageWithRetry({
      model: 'claude-sonnet-4-5',
      max_tokens: 2500,
      system,
      ...(tools.length > 0 && { tools }),
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    })
  } catch (err: unknown) {
    const isOverloaded = (err as { status?: number })?.status === 529
    return Response.json(
      {
        content: isOverloaded
          ? 'Normiq är just nu under hög belastning. Vänta några sekunder och försök igen.'
          : 'Ett oväntat fel uppstod. Försök igen om en stund.',
      },
      { status: 503 }
    )
  }

  const answer = response.content
    .filter(block => block.type === 'text')
    .map(block => block.type === 'text' ? block.text : '')
    .join('')

  const verified = verifyAgainstSources(answer, retrievedSources)
  const finalAnswer = verified
    ? answer
    : answer + '\n\n_OBS: Svaret kunde inte verifieras fullt ut mot källtexterna. Kontrollera med originalkällan._'

  if (!useWebSearch) {
    setCached(lastQuestion, finalAnswer, sourceRefs, risk.level)
  }

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
