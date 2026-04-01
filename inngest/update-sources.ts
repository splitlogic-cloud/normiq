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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const resend = new Resend(process.env.RESEND_API_KEY)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CHUNK_SIZE = 400
const CHUNK_OVERLAP = 80
const BATCH_SIZE = 5
const DELAY_MS = 300

// ── HJÄLPFUNKTIONER ───────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function chunkText(text: string, maxWords = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  let i = 0
  while (i < words.length) {
    const chunk = words.slice(i, i + maxWords).join(' ')
    if (chunk.trim().length > 30) chunks.push(chunk.trim())
    i += maxWords - overlap
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
    .replace(/\s{3,}/g, '\n\n')
    .trim()
}

// ── VERSIONSHANTERING ─────────────────────────────────────────────────────

async function getStoredHash(ref: string): Promise<string | null> {
  const { data } = await supabase
    .from('source_versions')
    .select('content_hash')
    .eq('ref', ref)
    .single()
  return data?.content_hash ?? null
}

async function setStoredHash(ref: string, hash: string, url: string) {
  await supabase
    .from('source_versions')
    .upsert({ ref, content_hash: hash, url, updated_at: new Date().toISOString() })
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  })
  return res.data.map(d => d.embedding)
}

async function deleteAndReindex(
  ref: string,
  chunks: string[],
  metadata: { ref: string; rubrik: string; lag: string }
): Promise<number> {
  // Ta bort gamla chunks för detta lagrum
  await supabase.from('documents').delete().eq('metadata->>ref', ref)

  let saved = 0
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const embeddings = await embedBatch(batch)
    const rows = batch.map((content, j) => ({
      content,
      metadata,
      embedding: embeddings[j],
    }))
    const { error } = await supabase.from('documents').insert(rows)
    if (!error) saved += batch.length
    await sleep(DELAY_MS)
  }
  return saved
}

// ── HÄMTA RIKSDAGEN ───────────────────────────────────────────────────────

async function fetchRiksdagen(sfsNummer: string): Promise<string> {
  const slug = sfsNummer.replace(':', '-')
  const urls = [
    `https://rkrattsbaser.gov.se/sfst?bet=${sfsNummer}`,
    `https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/${slug}/`,
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Normiq/2.0 (normiq.se)' },
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) continue
      const html = await res.text()
      const text = extractTextFromHtml(html)
      if (text.length > 500) return text
    } catch { continue }
  }
  return ''
}

// ── HÄMTA SKV-SIDA ────────────────────────────────────────────────────────

async function fetchSkvPage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Normiq/2.0 (normiq.se)',
        'Accept': 'text/html',
        'Accept-Language': 'sv-SE,sv;q=0.9',
      },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return ''
    const html = await res.text()
    return extractTextFromHtml(html)
  } catch { return '' }
}

// ── KÄLLOR ATT BEVAKA ─────────────────────────────────────────────────────

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
  // Momssatser — kritisk sida
  { url: 'https://www.skatteverket.se/foretagochorganisationer/moms/momssatser.4.html', ref: 'SKV momssatser', rubrik: 'Momssatser — gällande regler', lag: 'Skatteverkets vägledning' },
  // Take away-moms specifikt
  { url: 'https://www.skatteverket.se/foretagochorganisationer/moms/momsrestaurang.4.html', ref: 'SKV restaurangmoms', rubrik: 'Moms på restaurang och take away', lag: 'Skatteverkets vägledning' },
]

// ── HUVUDFUNKTION ─────────────────────────────────────────────────────────

export const updateSources = inngest.createFunction(
  {
    id: 'update-sources',
    name: 'Nattlig källuppdatering',
    concurrency: { limit: 1 },
    triggers: [{ cron: '0 1 * * *' }],
  },
  async ({ step, logger }) => {
    const report: {
      updated: string[]
      unchanged: string[]
      failed: string[]
      totalChunks: number
    } = { updated: [], unchanged: [], failed: [], totalChunks: 0 }

    // ── Steg 1: Uppdatera lagar från Riksdagen ──
    await step.run('index-lagar', async () => {
      for (const lag of LAGAR) {
        try {
          logger.info(`Hämtar ${lag.lag}...`)
          const text = await fetchRiksdagen(lag.sfs)
          if (!text) { report.failed.push(lag.lag); continue }

          const hash = hashContent(text)
          const storedHash = await getStoredHash(lag.kortnamn)

          if (hash === storedHash) {
            logger.info(`${lag.lag}: oförändrad`)
            report.unchanged.push(lag.lag)
            continue
          }

          // Nytt innehåll — indexera om
          const chunks = chunkText(text)
          const saved = await deleteAndReindex(lag.kortnamn, chunks, {
            ref: lag.kortnamn,
            rubrik: lag.lag,
            lag: lag.lag,
          })
          await setStoredHash(lag.kortnamn, hash, `https://rkrattsbaser.gov.se/sfst?bet=${lag.sfs}`)
          report.updated.push(`${lag.lag} (${saved} chunks)`)
          report.totalChunks += saved
          logger.info(`${lag.lag}: uppdaterad med ${saved} chunks`)
          await sleep(2000)
        } catch (err) {
          logger.error(`Fel vid ${lag.lag}: ${err}`)
          report.failed.push(lag.lag)
        }
      }
    })

    // ── Steg 2: Uppdatera SKV-sidor ──
    await step.run('index-skv', async () => {
      for (const sida of SKV_SIDOR) {
        try {
          logger.info(`Hämtar ${sida.ref}...`)
          const text = await fetchSkvPage(sida.url)
          if (!text || text.length < 200) { report.failed.push(sida.ref); continue }

          const hash = hashContent(text)
          const storedHash = await getStoredHash(sida.ref)

          if (hash === storedHash) {
            logger.info(`${sida.ref}: oförändrad`)
            report.unchanged.push(sida.ref)
            continue
          }

          const chunks = chunkText(text)
          const saved = await deleteAndReindex(sida.ref, chunks, {
            ref: sida.ref,
            rubrik: sida.rubrik,
            lag: sida.lag,
          })
          await setStoredHash(sida.ref, hash, sida.url)
          report.updated.push(`${sida.ref} (${saved} chunks)`)
          report.totalChunks += saved
          logger.info(`${sida.ref}: uppdaterad med ${saved} chunks`)
          await sleep(500)
        } catch (err) {
          logger.error(`Fel vid ${sida.ref}: ${err}`)
          report.failed.push(sida.ref)
        }
      }
    })

    // ── Steg 3: Skicka rapport via Resend ──
    await step.run('send-report', async () => {
      const hasUpdates = report.updated.length > 0
      const hasFailed = report.failed.length > 0

      if (!hasUpdates && !hasFailed) {
        logger.info('Inga ändringar — skickar ingen rapport')
        return
      }

      const subject = hasUpdates
        ? `✓ Normiq: ${report.updated.length} källfiler uppdaterade`
        : `⚠ Normiq: Källuppdatering misslyckades för ${report.failed.length} källor`

      await resend.emails.send({
        from: 'Normiq <hej@normiq.se>',
        to: 'hej@normiq.se',
        subject,
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 32px; background: #F5F3EE;">
            <div style="font-family: monospace; font-size: 24px; font-weight: 600; color: #0A0A0C; margin-bottom: 24px;">
              normi<span style="color: #C0321A;">q</span>
            </div>
            <h2 style="font-size: 20px; color: #0A0A0C; margin-bottom: 20px;">Nattlig källuppdatering — ${new Date().toLocaleDateString('sv-SE')}</h2>

            ${report.updated.length > 0 ? `
            <div style="background: #EEF6F1; border: 1px solid #BFD9CC; border-radius: 6px; padding: 16px 20px; margin-bottom: 16px;">
              <div style="font-family: monospace; font-size: 11px; color: #2E6644; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 8px;">Uppdaterat (${report.updated.length})</div>
              ${report.updated.map(s => `<div style="font-size: 13px; color: #2E6644; margin: 4px 0;">✓ ${s}</div>`).join('')}
            </div>` : ''}

            ${report.unchanged.length > 0 ? `
            <div style="background: white; border: 1px solid #E0DDD6; border-radius: 6px; padding: 16px 20px; margin-bottom: 16px;">
              <div style="font-family: monospace; font-size: 11px; color: #AAA; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 8px;">Oförändrat (${report.unchanged.length})</div>
              ${report.unchanged.map(s => `<div style="font-size: 13px; color: #AAA; margin: 4px 0;">— ${s}</div>`).join('')}
            </div>` : ''}

            ${report.failed.length > 0 ? `
            <div style="background: #FDF4F3; border: 1px solid rgba(192,50,26,.2); border-radius: 6px; padding: 16px 20px; margin-bottom: 16px;">
              <div style="font-family: monospace; font-size: 11px; color: #C0321A; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 8px;">Misslyckades (${report.failed.length})</div>
              ${report.failed.map(s => `<div style="font-size: 13px; color: #C0321A; margin: 4px 0;">✕ ${s}</div>`).join('')}
            </div>` : ''}

            <div style="font-family: monospace; font-size: 11px; color: #CCC; margin-top: 24px;">
              Totalt indexerade chunks: ${report.totalChunks}<br/>
              Kördes: ${new Date().toISOString()}
            </div>
          </div>
        `,
      })
    })

    return report
  }
)

// ── MANUELL TRIGGER (för testning) ────────────────────────────────────────
// Anropas via: POST /api/inngest med event { name: 'normiq/sources.update' }
export const triggerSourceUpdate = inngest.createFunction(
  { id: 'trigger-source-update', name: 'Manuell källuppdatering', triggers: [{ event: 'normiq/sources.update' }] },
  async ({ step }) => {
    await step.invoke('run-update', {
      function: updateSources,
      data: {},
    })
  }
)