/**
 * Normiq — Automatisk källuppdatering
 * =====================================
 * Begränsar chunks per källa för att undvika Vercel 60s timeout.
 * IL/ML etc är stora lagar — vi indexerar bara de mest relevanta delarna.
 */

import { inngest } from '@/lib/inngest'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { Resend } from 'resend'

// ── INSTÄLLNINGAR ─────────────────────────────────────────────────────────

const CHUNK_SIZE    = 600   // Större chunks = färre API-anrop
const CHUNK_OVERLAP = 100
const BATCH_SIZE    = 10    // Fler per batch = snabbare
const DELAY_MS      = 200
const MAX_CHUNKS    = 80    // Max chunks per källa — undviker timeout
const MAX_TEXT_LEN  = 120_000 // Max tecken att indexera per källa

// ── KÄLLOR ────────────────────────────────────────────────────────────────

const LAGAR = [
  { sfs: '1999:1229', ref: 'IL',  namn: 'Inkomstskattelagen' },
  { sfs: '2023:200',  ref: 'ML',  namn: 'Mervärdesskattelagen' },
  { sfs: '2011:1244', ref: 'SFL', namn: 'Skatteförfarandelagen' },
  { sfs: '1999:1078', ref: 'BFL', namn: 'Bokföringslagen' },
  { sfs: '2005:551',  ref: 'ABL', namn: 'Aktiebolagslagen' },
]

const SKV_VAGLEDNING = [
  { ref: 'SKV-representation',   url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/1508.html',  rubrik: 'Representation' },
  { ref: 'SKV-traktamente',      url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/1600.html',  rubrik: 'Traktamente' },
  { ref: 'SKV-personalformaner', url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/1400.html',  rubrik: 'Personalförmåner' },
  { ref: 'SKV-utdelning-3-12',   url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/3300.html',  rubrik: 'Utdelning fåmansföretag 3:12' },
  { ref: 'SKV-avdrag',           url: 'https://www4.skatteverket.se/rattsligvagledning/edition/2026.1/1100.html',  rubrik: 'Avdrag i näringsverksamhet' },
]

// ── HJÄLPFUNKTIONER ───────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function chunkText(text: string): string[] {
  // Begränsa texten tidigt
  const limited = text.slice(0, MAX_TEXT_LEN)
  const words = limited.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  for (let i = 0; i < words.length && chunks.length < MAX_CHUNKS; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    const chunk = words.slice(i, i + CHUNK_SIZE).join(' ').trim()
    if (chunk.length > 50) chunks.push(chunk)
  }
  return chunks
}

function hashText(text: string): string {
  return createHash('sha256').update(text.slice(0, 10000)).digest('hex').slice(0, 16)
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
        'User-Agent': 'Normiq/2.0 (normiq.se)',
        'Accept': 'text/html',
        'Accept-Language': 'sv-SE,sv;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return ''
    return stripHtml(await res.text())
  } catch {
    return ''
  }
}

type IndexResult = {
  ref: string
  status: 'updated' | 'unchanged' | 'failed'
  chunks: number
  error: string
}

async function indexSource(params: {
  ref: string
  text: string
  url: string
  rubrik: string
  lag: string
}): Promise<IndexResult> {
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
      console.error(`Embed error: ${e}`)
    }
    await sleep(DELAY_MS)
  }

  // Spara hash oavsett — så vi inte försöker igen i onödan
  await supabase.from('source_versions').upsert({
    ref,
    content_hash: hash,
    url,
    updated_at: new Date().toISOString(),
  })

  if (saved === 0) {
    return { ref, status: 'failed', chunks: 0, error: 'Embedding misslyckades' }
  }

  return { ref, status: 'updated', chunks: saved, error: '' }
}

// ── INNGEST ───────────────────────────────────────────────────────────────

export const updateSources = inngest.createFunction(
  {
    id: 'update-sources',
    name: 'Nattlig källuppdatering',
    concurrency: { limit: 1 },
    triggers: [{ cron: '0 1 * * *' }],
  },
  async ({ step }) => {

    // Lagar — ett steg per lag
    const ilResult  = await step.run('index-IL',  () => fetchText(`https://rkrattsbaser.gov.se/sfst?bet=1999:1229`).then(t => indexSource({ ref: 'IL',  text: t, url: 'https://rkrattsbaser.gov.se/sfst?bet=1999:1229', rubrik: 'Inkomstskattelagen',   lag: 'Inkomstskattelagen' })))
    const mlResult  = await step.run('index-ML',  () => fetchText(`https://rkrattsbaser.gov.se/sfst?bet=2023:200`).then(t =>  indexSource({ ref: 'ML',  text: t, url: 'https://rkrattsbaser.gov.se/sfst?bet=2023:200',  rubrik: 'Mervärdesskattelagen',  lag: 'Mervärdesskattelagen' })))
    const sflResult = await step.run('index-SFL', () => fetchText(`https://rkrattsbaser.gov.se/sfst?bet=2011:1244`).then(t => indexSource({ ref: 'SFL', text: t, url: 'https://rkrattsbaser.gov.se/sfst?bet=2011:1244', rubrik: 'Skatteförfarandelagen', lag: 'Skatteförfarandelagen' })))
    const bflResult = await step.run('index-BFL', () => fetchText(`https://rkrattsbaser.gov.se/sfst?bet=1999:1078`).then(t => indexSource({ ref: 'BFL', text: t, url: 'https://rkrattsbaser.gov.se/sfst?bet=1999:1078', rubrik: 'Bokföringslagen',        lag: 'Bokföringslagen' })))
    const ablResult = await step.run('index-ABL', () => fetchText(`https://rkrattsbaser.gov.se/sfst?bet=2005:551`).then(t =>  indexSource({ ref: 'ABL', text: t, url: 'https://rkrattsbaser.gov.se/sfst?bet=2005:551',  rubrik: 'Aktiebolagslagen',      lag: 'Aktiebolagslagen' })))

    // SKV — ett steg per sida
    const skvResults: IndexResult[] = []
    for (const sida of SKV_VAGLEDNING) {
      const result = await step.run(`index-${sida.ref}`, () =>
        fetchText(sida.url).then(t => indexSource({
          ref: sida.ref,
          text: t,
          url: sida.url,
          rubrik: sida.rubrik,
          lag: 'Skatteverkets vägledning',
        }))
      )
      skvResults.push(result)
    }

    // Rapport
    await step.run('send-report', async () => {
      const all = [ilResult, mlResult, sflResult, bflResult, ablResult, ...skvResults]
      const updated   = all.filter(r => r.status === 'updated')
      const failed    = all.filter(r => r.status === 'failed')
      const unchanged = all.filter(r => r.status === 'unchanged')
      const total     = updated.reduce((s, r) => s + r.chunks, 0)

      if (updated.length === 0 && failed.length === 0) {
        return { unchanged: unchanged.length }
      }

      const resend = new Resend(process.env.RESEND_API_KEY!)
      await resend.emails.send({
        from: 'Normiq <hej@normiq.se>',
        to: 'hej@normiq.se',
        subject: updated.length > 0
          ? `✓ Normiq: ${updated.length} källfiler uppdaterade (${total} chunks)`
          : `⚠ Normiq: ${failed.length} misslyckades`,
        html: `
          <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 32px;background:#F5F3EE">
            <div style="font-family:monospace;font-size:24px;font-weight:600;color:#0A0A0C;margin-bottom:24px">
              normi<span style="color:#C0321A">q</span>
            </div>
            <h2 style="font-size:20px;color:#0A0A0C;margin-bottom:20px">Källuppdatering — ${new Date().toLocaleDateString('sv-SE')}</h2>
            ${updated.length > 0 ? `<div style="background:#EEF6F1;border:1px solid #BFD9CC;border-radius:6px;padding:16px 20px;margin-bottom:16px">
              <div style="font-family:monospace;font-size:11px;color:#2E6644;text-transform:uppercase;margin-bottom:8px">Uppdaterat (${updated.length}) — ${total} chunks</div>
              ${updated.map(r => `<div style="font-size:13px;color:#2E6644;margin:4px 0">✓ ${r.ref} — ${r.chunks} chunks</div>`).join('')}
            </div>` : ''}
            ${failed.length > 0 ? `<div style="background:#FDF4F3;border:1px solid rgba(192,50,26,.2);border-radius:6px;padding:16px 20px;margin-bottom:16px">
              <div style="font-family:monospace;font-size:11px;color:#C0321A;text-transform:uppercase;margin-bottom:8px">Misslyckades (${failed.length})</div>
              ${failed.map(r => `<div style="font-size:13px;color:#C0321A;margin:4px 0">✕ ${r.ref}${r.error ? ` — ${r.error}` : ''}</div>`).join('')}
            </div>` : ''}
            <div style="font-family:monospace;font-size:11px;color:#CCC;margin-top:24px">Oförändrade: ${unchanged.length} · ${new Date().toISOString()}</div>
          </div>`,
      })
      return { updated: updated.length, failed: failed.length, unchanged: unchanged.length, total }
    })

    return { IL: ilResult, ML: mlResult, SFL: sflResult, BFL: bflResult, ABL: ablResult, skv: skvResults }
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