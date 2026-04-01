/**
 * Normiq — Automatisk källuppdatering
 * =====================================
 * Inngest-jobb som körs varje natt kl 02:00.
 * Hämtar ny lagtext från Riksdagen + Skatteverket,
 * jämför med befintligt innehåll via hash,
 * och indexerar om bara det som ändrats.
 */

import { inngest } from '@/lib/inngest'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { Resend } from 'resend'

// ── KLIENTER ──────────────────────────────────────────────────────────────
// Initieras inuti funktionen för att säkerställa att env-variabler är laddade

function getClients() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  const resend = new Resend(process.env.RESEND_API_KEY!)
  return { supabase, openai, resend }
}

// ── KONSTANTER ────────────────────────────────────────────────────────────

const CHUNK_SIZE = 400
const CHUNK_OVERLAP = 80
const BATCH_SIZE = 5
const DELAY_MS = 400

const LAGAR = [
  { sfs: '1999:1229', kortnamn: 'IL',  lag: 'Inkomstskattelagen' },
  { sfs: '2023:200',  kortnamn: 'ML',  lag: 'Mervärdesskattelagen' },
  { sfs: '2011:1244', kortnamn: 'SFL', lag: 'Skatteförfarandelagen' },
  { sfs: '1999:1078', kortnamn: 'BFL', lag: 'Bokföringslagen' },
  { sfs: '2005:551',  kortnamn: 'ABL', lag: 'Aktiebolagslagen' },
]

const SKV_SIDOR = [
  { url: 'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/moms.4.html', ref: 'SKV moms', rubrik: 'Skatteverkets momsregler', lag: 'Skatteverkets vägledning' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/representation.4.html', ref: 'SKV representation', rubrik: 'Representation — avdragsregler', lag: 'Skatteverkets vägledning' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/traktamenteocharesersattning.4.html', ref: 'SKV traktamente', rubrik: 'Traktamente och reseersättning', lag: 'Skatteverkets vägledning' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/arbetsgivare/lonochersattning/personalfrmaner.4.html', ref: 'SKV personalförmåner', rubrik: 'Personalförmåner', lag: 'Skatteverkets vägledning' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/skatterochavdrag/avdragforhemmakontorocharbetsrum.4.html', ref: 'SKV hemkontor', rubrik: 'Hemkontor och arbetsrum', lag: 'Skatteverkets vägledning' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/foretaaetslagsochbolagsformer/aktiebolag/utdelningochloneriactiebolag.4.html', ref: 'SKV utdelning', rubrik: 'Utdelning och löner i aktiebolag', lag: 'Skatteverkets vägledning' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/drivaforetag/bokforing.4.html', ref: 'SKV bokföring', rubrik: 'Bokföring', lag: 'Skatteverkets vägledning' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/moms/momssatser.4.html', ref: 'SKV momssatser', rubrik: 'Momssatser — gällande regler', lag: 'Skatteverkets vägledning' },
  { url: 'https://www.skatteverket.se/foretagochorganisationer/moms/momsrestaurang.4.html', ref: 'SKV restaurangmoms', rubrik: 'Moms på restaurang och take away', lag: 'Skatteverkets vägledning' },
]

// ── HJÄLPFUNKTIONER ───────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function chunkText(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  let i = 0
  while (i < words.length) {
    const chunk = words.slice(i, i + CHUNK_SIZE).join(' ')
    if (chunk.trim().length > 30) chunks.push(chunk.trim())
    i += CHUNK_SIZE - CHUNK_OVERLAP
  }
  return chunks
}

function hashContent(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s{3,}/g, ' ')
    .trim()
}

async function fetchUrl(url: string, timeout = 25000): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Normiq/2.0 (normiq.se; legal-text indexing)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'sv-SE,sv;q=0.9',
      },
      signal: AbortSignal.timeout(timeout),
    })
    if (!res.ok) return ''
    const html = await res.text()
    return extractTextFromHtml(html)
  } catch {
    return ''
  }
}

async function fetchRiksdagen(sfs: string): Promise<string> {
  const slug = sfs.replace(':', '-')
  const urls = [
    `https://rkrattsbaser.gov.se/sfst?bet=${sfs}`,
    `https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/${slug}/`,
    `https://data.riksdagen.se/dokument/${slug}.html`,
  ]
  for (const url of urls) {
    const text = await fetchUrl(url)
    if (text.length > 500) return text
    await sleep(500)
  }
  return ''
}

type IndexResult = {
  ref: string
  status: 'updated' | 'unchanged' | 'failed'
  chunks?: number
  error?: string
}

async function processSource(
  ref: string,
  text: string,
  url: string,
  metadata: { ref: string; rubrik: string; lag: string }
): Promise<IndexResult> {
  const { supabase, openai } = getClients()

  if (!text || text.length < 200) {
    return { ref, status: 'failed', error: `För lite text (${text.length} tecken)` }
  }

  const hash = hashContent(text)

  // Kolla om innehållet ändrats
  const { data: existing } = await supabase
    .from('source_versions')
    .select('content_hash')
    .eq('ref', ref)
    .single()

  if (existing?.content_hash === hash) {
    return { ref, status: 'unchanged' }
  }

  // Ta bort gamla chunks
  await supabase.from('documents').delete().eq('metadata->>ref', ref)

  const chunks = chunkText(text)
  let saved = 0

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    try {
      const res = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch,
      })
      const rows = batch.map((content, j) => ({
        content,
        metadata,
        embedding: res.data[j].embedding,
      }))
      const { error } = await supabase.from('documents').insert(rows)
      if (!error) saved += batch.length
    } catch (err) {
      console.error(`Embedding fel batch ${i}: ${err}`)
    }
    await sleep(DELAY_MS)
  }

  // Spara ny hash
  await supabase
    .from('source_versions')
    .upsert({
      ref,
      content_hash: hash,
      url,
      updated_at: new Date().toISOString(),
    })

  return { ref, status: 'updated', chunks: saved }
}

// ── INNGEST-FUNKTIONER ────────────────────────────────────────────────────

export const updateSources = inngest.createFunction(
  {
    id: 'update-sources',
    name: 'Nattlig källuppdatering',
    concurrency: { limit: 1 },
    triggers: [{ cron: '0 1 * * *' }],
  },
  async ({ step }) => {

    // Steg 1: Lagar från Riksdagen
    const lagarResults: IndexResult[] = await step.run('index-lagar', async () => {
      const results: IndexResult[] = []
      for (const lag of LAGAR) {
        const text = await fetchRiksdagen(lag.sfs)
        const result = await processSource(
          lag.kortnamn,
          text,
          `https://rkrattsbaser.gov.se/sfst?bet=${lag.sfs}`,
          { ref: lag.kortnamn, rubrik: lag.lag, lag: lag.lag }
        )
        results.push(result)
        await sleep(1000)
      }
      return results
    })

    // Steg 2: SKV-sidor
    const skvResults: IndexResult[] = await step.run('index-skv', async () => {
      const results: IndexResult[] = []
      for (const sida of SKV_SIDOR) {
        const text = await fetchUrl(sida.url)
        const result = await processSource(
          sida.ref,
          text,
          sida.url,
          { ref: sida.ref, rubrik: sida.rubrik, lag: sida.lag }
        )
        results.push(result)
        await sleep(500)
      }
      return results
    })

    // Steg 3: Rapport
    const reportResult = await step.run('send-report', async () => {
      const { resend } = getClients()
      const allResults = [...lagarResults, ...skvResults]

      const updated = allResults.filter(r => r.status === 'updated')
      const failed = allResults.filter(r => r.status === 'failed')
      const unchanged = allResults.filter(r => r.status === 'unchanged')
      const totalChunks = updated.reduce((sum, r) => sum + (r.chunks ?? 0), 0)

      if (updated.length === 0 && failed.length === 0) {
        return { message: 'Inga ändringar', unchanged: unchanged.length }
      }

      const subject = updated.length > 0
        ? `✓ Normiq: ${updated.length} källfiler uppdaterade (${totalChunks} chunks)`
        : `⚠ Normiq: ${failed.length} källfiler misslyckades`

      await resend.emails.send({
        from: 'Normiq <hej@normiq.se>',
        to: 'hej@normiq.se',
        subject,
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 32px; background: #F5F3EE;">
            <div style="font-size: 24px; font-weight: 600; color: #0A0A0C; margin-bottom: 24px; font-family: monospace;">
              normi<span style="color: #C0321A;">q</span>
            </div>
            <h2 style="font-size: 20px; color: #0A0A0C; margin-bottom: 20px;">
              Källuppdatering — ${new Date().toLocaleDateString('sv-SE')}
            </h2>

            ${updated.length > 0 ? `
            <div style="background: #EEF6F1; border: 1px solid #BFD9CC; border-radius: 6px; padding: 16px 20px; margin-bottom: 16px;">
              <div style="font-family: monospace; font-size: 11px; color: #2E6644; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 8px;">
                Uppdaterat (${updated.length}) — ${totalChunks} chunks
              </div>
              ${updated.map(r => `<div style="font-size: 13px; color: #2E6644; margin: 4px 0;">✓ ${r.ref} — ${r.chunks} chunks</div>`).join('')}
            </div>` : ''}

            ${failed.length > 0 ? `
            <div style="background: #FDF4F3; border: 1px solid rgba(192,50,26,.2); border-radius: 6px; padding: 16px 20px; margin-bottom: 16px;">
              <div style="font-family: monospace; font-size: 11px; color: #C0321A; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 8px;">
                Misslyckades (${failed.length})
              </div>
              ${failed.map(r => `<div style="font-size: 13px; color: #C0321A; margin: 4px 0;">✕ ${r.ref}${r.error ? ` — ${r.error}` : ''}</div>`).join('')}
            </div>` : ''}

            <div style="font-family: monospace; font-size: 11px; color: #CCC; margin-top: 24px;">
              Oförändrade: ${unchanged.length} · ${new Date().toISOString()}
            </div>
          </div>
        `,
      })

      return { updated: updated.length, failed: failed.length, unchanged: unchanged.length, totalChunks }
    })

    return { lagar: lagarResults, skv: skvResults, report: reportResult }
  }
)

export const triggerSourceUpdate = inngest.createFunction(
  {
    id: 'trigger-source-update',
    name: 'Manuell källuppdatering',
    triggers: [{ event: 'normiq/sources.update' }],
  },
  async ({ step }) => {
    await step.invoke('run-update', {
      function: updateSources,
      data: {},
    })
  }
)