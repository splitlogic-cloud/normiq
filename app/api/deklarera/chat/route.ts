import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { searchDocuments } from '@/lib/embed'
import { searchRules } from '@/lib/rules'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Service role för library-sökning (behöver läsa aktiva svar)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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

// ── LIBRARY-SÖKNING ───────────────────────────────────────────────────────
// Söker i kunskapsbiblioteket efter verifierade svar.
// Använder enkel strängmatchning + trigram-likhetscheck.
// Om similarity > 0.85 returneras bibliotekssvaret direkt.

const LIBRARY_SIMILARITY_THRESHOLD = 0.85

function stringSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().trim().replace(/[?!.,]/g, '')
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return 1

  // Jacccard-likhet på ord
  const wordsA = new Set(na.split(/\s+/))
  const wordsB = new Set(nb.split(/\s+/))
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)))
  const union = new Set([...wordsA, ...wordsB])
  return intersection.size / union.size
}

async function searchLibrary(question: string): Promise<{
  answer: string
  sources: string[]
  risk_level: string
  library_id: string
} | null> {
  try {
    // Hämta aktiva, verifierade svar från library
    const { data: libraryItems } = await supabaseAdmin
      .from('library')
      .select('id, question, answer, sources, risk_level, use_count')
      .eq('active', true)
      .not('verified_by', 'is', null)
      .order('use_count', { ascending: false })
      .limit(200)

    if (!libraryItems || libraryItems.length === 0) return null

    // Hitta bäst matchande fråga
    let bestMatch = null
    let bestScore = 0

    for (const item of libraryItems) {
      const score = stringSimilarity(question, item.question)
      if (score > bestScore) {
        bestScore = score
        bestMatch = item
      }
    }

    if (bestScore >= LIBRARY_SIMILARITY_THRESHOLD && bestMatch) {
      // Öka use_count
      await supabaseAdmin
        .from('library')
        .update({ use_count: (bestMatch.use_count || 0) + 1 })
        .eq('id', bestMatch.id)

      return {
        answer: bestMatch.answer,
        sources: bestMatch.sources || [],
        risk_level: bestMatch.risk_level || 'LÅG',
        library_id: bestMatch.id,
      }
    }

    return null
  } catch (err) {
    console.error('Library search error:', err)
    return null
  }
}

// ── RISK-KLASSNING ────────────────────────────────────────────────────────
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
    'friskvård', 'friskvårdsbidrag', 'förmånsvärde', 'bilförmån', 'förmånsbil',
    'arbetsgivaravgift', 'egenavgift', 'grundavdrag', 'jobbskatteavdrag',
    'rot', 'rut', 'schablon', '3:12', 'fåmansbolag', 'fåmansföretag',
    'utdelning', 'lönebaserat', 'kostförmån', 'julklapp', 'jubileumsgåva',
    'minnesgåva', 'direktavdrag', 'kompletteringsregeln', 'uppskov', 'uthyrning',
    '2026', 'i år', 'aktuell', 'nuvarande', 'gäller nu', 'aktuellt belopp',
  ]
  return årsbelopp.some(s => q.includes(s))
}

function boostScore(r: { metadata: { lag?: string }; similarity: number }): number {
  const lag = r.metadata?.lag?.toLowerCase() || ''
  if (lag.includes('skatteverket') || lag.includes('skv')) return r.similarity * 1.4
  if (lag.includes('bfn') || lag.includes('normgivning'))   return r.similarity * 1.2
  if (lag.includes('mervärdes'))                            return r.similarity * 1.1
  return r.similarity
}

async function createMessageWithRetry(params: Parameters<typeof client.messages.create>[0], maxRetries = 3): Promise<Anthropic.Message> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await client.messages.create({ ...params, stream: false }) as Anthropic.Message
    } catch (err: unknown) {
      const isOverloaded = (err as { status?: number })?.status === 529
      if (isOverloaded && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, attempt * 2000))
        continue
      }
      throw err
    }
  }
  throw new Error('Max retries exceeded')
}

function findUnsupportedNumbers(answer: string, sources: { text: string }[]): string[] {
  const sourceText = sources.map(s => s.text).join(' ')
  const percentPattern = /(\d+)\s*%/g
  const answerPercents: string[] = []
  let match
  while ((match = percentPattern.exec(answer)) !== null) {
    answerPercents.push(match[1])
  }
  const unsupported = answerPercents.filter(pct => !new RegExp(`${pct}\\s*%`).test(sourceText))
  return [...new Set(unsupported)]
}

function verifyAgainstSources(answer: string, sources: { ref: string; text: string }[]): boolean {
  if (sources.length === 0) return false
  return sources.some(s => answer.includes(s.ref.split(' ')[0]))
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────

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

  // ── STEG 1: Sök i kunskapsbiblioteket ────────────────────────────────────
  // Verifierade svar från biblioteket är mer tillförlitliga än Claude-genererade
  if (!useWebSearch) {
    const libraryHit = await searchLibrary(lastQuestion)
    if (libraryHit) {
      // Spara som query för historik
      const { data: inserted } = await supabase
        .from('queries')
        .insert({
          question: lastQuestion,
          answer: libraryHit.answer,
          sources: libraryHit.sources,
          risk_level: libraryHit.risk_level,
          session_id: sessionId || 'anonymous',
        })
        .select('id')
        .single()

      return Response.json({
        content: libraryHit.answer,
        sources: libraryHit.sources,
        risk_level: libraryHit.risk_level,
        query_id: inserted?.id,
        verified: true,
        from_library: true,
      }, { headers: { 'X-RateLimit-Remaining': String(remaining) } })
    }
  }

  // ── STEG 2: Kolla in-memory cache ────────────────────────────────────────
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

  // ── STEG 3: Vektorsökning i documents ────────────────────────────────────
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
  const källkontext = retrievedSources.map(s => `[${s.ref}] — ${s.rubrik}\n${s.text}`).join('\n\n---\n\n')

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
Ange alltid vilket år beloppet gäller.
Du får BARA använda belopp och procentsatser som du hämtar via web_search eller som finns i källtexterna ovan.` : ''

  const system = `Du är Normiq — ett källbaserat söksystem för svenska skatte- och redovisningsregler.

DIN UPPGIFT:
Du har fått relevanta källtexter hämtade från svensk lagstiftning och Skatteverkets vägledningar. Din uppgift är att förklara vad källtexterna säger — inte vad du tror eller minns.

═══════════════════════════════════════════════════════
ABSOLUTA REGLER — BRYTS ALDRIG:

1. ANVÄND BARA SIFFROR FRÅN KÄLLTEXTERNA
   Procentsatser, belopp och gränsvärden får ENDAST hämtas från källtexterna nedan
   eller från web_search (om aktiverat). Du får aldrig ange en procentsats eller
   ett belopp som inte explicit finns i källtexterna. Inte ens om du "vet" svaret.

2. OM KÄLLAN SAKNAS — SÄG DET
   Om källtexterna inte innehåller svar på frågan: skriv en mening om att du inte
   hittar källstöd och hänvisa till skatteverket.se. Spekulera aldrig.

3. INGA PÅHITTADE REGELÄNDRINGAR
   Ange aldrig att en regel har ändrats om det inte explicit framgår av källtexterna.
   Skriv inte "från [år] gäller..." om det inte finns i källan.

4. MOMSSATSER ÄR KÄNSLIGA
   Gällande momssatser i Sverige: 25%, 12%, 6%, 0%.
   Om du vill ange en momssats måste den finnas i källtexterna.
   Om källorna inte nämner momssatsen — ange den inte.
═══════════════════════════════════════════════════════

TILLGÄNGLIGA KÄLLOR:
${källkontext}

${usedFallback ? 'OBS: Källorna kommer från det manuella regelindexet — ej vektorsökning.' : ''}${bokforingExtra}${webSearchInstruktion}

SVARSFORMAT:

## [Rubrik]

[Svar baserat ENBART på källtexterna ovan. Ange exakta lagrum [IL 57 kap. 10 §].]

---FÖRENKLAT---
Enkelt uttryckt: [4–7 meningar för någon utan juridisk bakgrund.]

---EXEMPEL---
Exempel: [Konkret exempel med siffror${questionType === 'bokforing' ? '. Visa konteringsrader.' : '.'}]

Källor: [kommaseparerad lista]
Risk: ${risk.level} — ${risk.reason}

YTTERLIGARE REGLER:
- Ge alltid ett komplett svar — ett halvt svar är sämre än ett längre
- Risk-raden är ALLTID sista raden
- Svara på svenska
- Om du är osäker: en mening + hänvisa till skatteverket.se`

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

  const unsupportedNumbers = findUnsupportedNumbers(answer, retrievedSources)
  const hasUnsupportedClaims = unsupportedNumbers.length > 0 && !useWebSearch
  const verified = verifyAgainstSources(answer, retrievedSources)

  let finalAnswer = answer
  if (hasUnsupportedClaims) {
    finalAnswer = answer + `\n\n⚠️ _Obs: Svaret innehåller värden (${unsupportedNumbers.map(n => n + '%').join(', ')}) som inte kunde verifieras mot källtexterna. Kontrollera alltid mot [Skatteverket](https://skatteverket.se) innan du agerar._`
  } else if (!verified) {
    finalAnswer = answer + '\n\n_OBS: Svaret kunde inte verifieras fullt ut mot källtexterna. Kontrollera med originalkällan._'
  }

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