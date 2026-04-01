/**
 * Normiq — Automatisk källuppdatering
 * =====================================
 * Använder Riksdagens officiella API för lagtext
 * och SKV rättslig vägledning för skatteinfo.
 * Körs varje natt kl 02:00 via Inngest cron.
 */

import { inngest } from '@/lib/inngest'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { Resend } from 'resend'

// ── KÄLLOR ────────────────────────────────────────────────────────────────

// Riksdagen öppna data — lagtext via SFS-nummer
// URL-format är stabilt och versionerat
const LAGAR = [
  { sfs: '1999:1229', ref: 'IL',  namn: 'Inkomstskattelagen' },
  { sfs: '2023:200',  ref: 'ML',  namn: 'Mervärdesskattelagen' },
  { sfs: '2011:1244', ref: 'SFL', namn: 'Skatteförfarandelagen' },
  { sfs: '1999:1078', ref: 'BFL', namn: 'Bokföringslagen' },
  { sfs: '2005:551',  ref: 'ABL', namn: 'Aktiebolagslagen' },
]

// SKV rättslig vägledning — stabila avsnitt-URL:er
// Hämtas från www4.skatteverket.se/rattsligvagledning som har stabil struktur
const SKV_VAGLEDNING = [
  { ref: 'SKV-moms-allmant',      url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/2940.html',   rubrik: 'Moms — allmänt' },
  { ref: 'SKV-momssatser',        url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/2941.html',   rubrik: 'Momssatser' },
  { ref: 'SKV-representation',    url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/1508.html',   rubrik: 'Representation' },
  { ref: 'SKV-traktamente',       url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/1600.html',   rubrik: 'Traktamente' },
  { ref: 'SKV-personalformaner',  url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/1400.html',   rubrik: 'Personalförmåner' },
  { ref: 'SKV-utdelning-3-12',    url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/3300.html',   rubrik: 'Utdelning fåmansföretag 3:12' },
  { ref: 'SKV-bokforing',         url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/200.html',    rubrik: 'Bokföring' },
  { ref: 'SKV-avdrag-naringsliv', url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/1100.html',   rubrik: 'Avdrag i näringsverksamhet' },
]

// ── INSTÄLLNINGAR ─────────────────────────────────────────────────────────

const CHUNK_SIZE    = 400
const CHUNK_OVERLAP = 80
const BATCH_SIZE    = 5
const DELAY_MS      = 400

// ── HJÄLPFUNKTIONER ───────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function chunkText(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    const chunk = words.slice(i, i + CHUNK_SIZE).join(' ').trim()
    if (chunk.length > 50) chunks.push(chunk)
  }
  return chunks
}

function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Normiq/2.0 (normiq.se; legal indexing)',
        'Accept': 'text/html',
        'Accept-Language': 'sv-SE,sv;q=0.9',
      },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return ''
    return stripHtml(await res.text())
  } catch {
    return ''
  }
}

// Hämtar lagtext via Riksdagen rkrattsbaser — det som bekräftat fungerar
async function fetchLag(sfs: string): Promise<string> {
  const url = `https://rkrattsbaser.gov.se/sfst?bet=${sfs}`
  return fetchText(url)
}

// ── KÄRN-LOGIK: indexera en källa ─────────────────────────────────────────

async function indexSource(params: {
  ref: string
  text: string
  url: string
  rubrik: string
  lag: string
}): Promise<{ ref: string; status: string; chunks: number; error: string }> {
  const { ref, text, url, rubrik, lag } = params

  if (!text || text.length < 300) {
    return { ref, status: 'failed', chunks: 0, error: `För lite text: ${text.length} tecken` }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

  const hash = hashText(text)

  // Kolla om oförändrad
  const { data: existing } = await supabase
    .from('source_versions')
    .select('content_hash')
    .eq('ref', ref)
    .single()

  if (existing?.content_hash === hash) {
    return { ref, status: 'unchanged', chunks: 0, error: '' }
  }

  // Radera gamla chunks
  await supabase.from('documents').delete().eq('metadata->>ref', ref)

  // Chunka och embedda
  const chunks = chunkText(text)
  let saved = 0

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    try {
      const embRes = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch,
      })
      const rows = batch.map((content, j) => ({
        content,
        metadata: { ref, rubrik, lag },
        embedding: embRes.data[j].embedding,
      }))
      const { error } = await supabase.from('documents').insert(rows)
      if (!error) saved += batch.length
      else console.error(`Insert error: ${error.message}`)
    } catch (e) {
      console.error(`Embed error batch ${i}: ${e}`)
    }
    await sleep(DELAY_MS)
  }

  // Spara hash
  await supabase.from('source_versions').upsert({
    ref,
    content_hash: hash,
    url,
    updated_at: new Date().toISOString(),
  })

  return { ref, status: saved > 0 ? 'updated' : 'failed', chunks: saved, error: saved === 0 ? 'Inga chunks sparade' : '' }
}

// ── INNGEST-FUNKTION ──────────────────────────────────────────────────────

export const updateSources = inngest.createFunction(
  {
    id: 'update-sources',
    name: 'Nattlig källuppdatering',
    concurrency: { limit: 1 },
    triggers: [{ cron: '0 1 * * *' }],
  },
  async ({ step }) => {

    // Steg 1: En lag i taget (undviker timeout)
    const ilResult = await step.run('index-IL', () =>
      fetchLag('1999:1229').then(text => indexSource({ ref: 'IL', text, url: 'https://rkrattsbaser.gov.se/sfst?bet=1999:1229', rubrik: 'Inkomstskattelagen', lag: 'Inkomstskattelagen' }))
    )
    const mlResult = await step.run('index-ML', () =>
      fetchLag('2023:200').then(text => indexSource({ ref: 'ML', text, url: 'https://rkrattsbaser.gov.se/sfst?bet=2023:200', rubrik: 'Mervärdesskattelagen', lag: 'Mervärdesskattelagen' }))
    )
    const sflResult = await step.run('index-SFL', () =>
      fetchLag('2011:1244').then(text => indexSource({ ref: 'SFL', text, url: 'https://rkrattsbaser.gov.se/sfst?bet=2011:1244', rubrik: 'Skatteförfarandelagen', lag: 'Skatteförfarandelagen' }))
    )
    const bflResult = await step.run('index-BFL', () =>
      fetchLag('1999:1078').then(text => indexSource({ ref: 'BFL', text, url: 'https://rkrattsbaser.gov.se/sfst?bet=1999:1078', rubrik: 'Bokföringslagen', lag: 'Bokföringslagen' }))
    )
    const ablResult = await step.run('index-ABL', () =>
      fetchLag('2005:551').then(text => indexSource({ ref: 'ABL', text, url: 'https://rkrattsbaser.gov.se/sfst?bet=2005:551', rubrik: 'Aktiebolagslagen', lag: 'Aktiebolagslagen' }))
    )

    // Steg 2: SKV rättslig vägledning — en i taget
    const skvResults: Record<string, { ref: string; status: string; chunks: number; error: string }> = {}
    for (const sida of SKV_VAGLEDNING) {
      const result = await step.run(`index-${sida.ref}`, () =>
        fetchText(sida.url).then(text => indexSource({
          ref: sida.ref,
          text,
          url: sida.url,
          rubrik: sida.rubrik,
          lag: 'Skatteverkets vägledning',
        }))
      )
      skvResults[sida.ref] = result
    }

    // Steg 3: Rapport
    await step.run('send-report', async () => {
      const lagResults = [ilResult, mlResult, sflResult, bflResult, ablResult]
      const allResults = [...lagResults, ...Object.values(skvResults)]

      const updated  = allResults.filter(r => r.status === 'updated')
      const failed   = allResults.filter(r => r.status === 'failed')
      const unchanged = allResults.filter(r => r.status === 'unchanged')
      const totalChunks = updated.reduce((s, r) => s + r.chunks, 0)

      if (updated.length === 0 && failed.length === 0) {
        return { message: 'Inga ändringar', unchanged: unchanged.length }
      }

      const resend = new Resend(process.env.RESEND_API_KEY!)
      await resend.emails.send({
        from: 'Normiq <hej@normiq.se>',
        to: 'hej@normiq.se',
        subject: updated.length > 0
          ? `✓ Normiq: ${updated.length} källfiler uppdaterade (${totalChunks} chunks)`
          : `⚠ Normiq: ${failed.length} källfiler misslyckades`,
        html: `
          <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 32px;background:#F5F3EE">
            <div style="font-family:monospace;font-size:24px;font-weight:600;color:#0A0A0C;margin-bottom:24px">
              normi<span style="color:#C0321A">q</span>
            </div>
            <h2 style="font-size:20px;color:#0A0A0C;margin-bottom:20px">
              Källuppdatering — ${new Date().toLocaleDateString('sv-SE')}
            </h2>
            ${updated.length > 0 ? `
            <div style="background:#EEF6F1;border:1px solid #BFD9CC;border-radius:6px;padding:16px 20px;margin-bottom:16px">
              <div style="font-family:monospace;font-size:11px;color:#2E6644;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">
                Uppdaterat (${updated.length}) — ${totalChunks} chunks
              </div>
              ${updated.map(r => `<div style="font-size:13px;color:#2E6644;margin:4px 0">✓ ${r.ref} — ${r.chunks} chunks</div>`).join('')}
            </div>` : ''}
            ${failed.length > 0 ? `
            <div style="background:#FDF4F3;border:1px solid rgba(192,50,26,.2);border-radius:6px;padding:16px 20px;margin-bottom:16px">
              <div style="font-family:monospace;font-size:11px;color:#C0321A;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">
                Misslyckades (${failed.length})
              </div>
              ${failed.map(r => `<div style="font-size:13px;color:#C0321A;margin:4px 0">✕ ${r.ref}${r.error ? ` — ${r.error}` : ''}</div>`).join('')}
            </div>` : ''}
            <div style="font-family:monospace;font-size:11px;color:#CCC;margin-top:24px">
              Oförändrade: ${unchanged.length} · ${new Date().toISOString()}
            </div>
          </div>`,
      })

      return { updated: updated.length, failed: failed.length, unchanged: unchanged.length, totalChunks }
    })

    return {
      IL: ilResult, ML: mlResult, SFL: sflResult, BFL: bflResult, ABL: ablResult,
      skv: skvResults,
    }
  }
)

export const triggerSourceUpdate = inngest.createFunction(
  {
    id: 'trigger-source-update',
    name: 'Manuell källuppdatering',
    triggers: [{ event: 'normiq/sources.update' }],
  },
  async ({ step }) => {
    await step.invoke('run-update', { function: updateSources, data: {} })
  }
)