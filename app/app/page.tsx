'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

const LAG_URLS: Record<string, string> = {
  IL: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/inkomstskattelag-19991229_sfs-1999-1229/',
  ML: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/mervardesskatteklag-20232_sfs-2023-200/',
  SFL: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/skatteforfarandelag-20111244_sfs-2011-1244/',
  BFL: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/bokforingslag-19991078_sfs-1999-1078/',
  ABL: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/aktiebolagslag-2005551_sfs-2005-551/',
  SKV: 'https://www.skatteverket.se/rattsinformation/stallningstaganden.4.html',
}

const SUGGESTIONS = [
  'Hur mycket kan jag ta ut i utdelning från mitt fåmansbolag?',
  'Vad gäller för representation och avdragsrätt?',
  'Hur bokför jag en faktura med 25% moms?',
  'Vad är skillnaden mellan K2 och K3?',
]

type Message = {
  role: 'user' | 'assistant'
  content: string
  queryId?: string
  feedback?: 1 | -1 | null
}

type HistoryItem = {
  id: string
  question: string
  answer: string
  sources: string[]
  risk_level: string
  created_at: string
}

function getRiskColor(risk: string) {
  if (risk.includes('HÖG'))   return { text: '#A02818', bg: '#FAF0EE', border: '#E8C8C0' }
  if (risk.includes('MEDEL')) return { text: '#7A6010', bg: '#F9F6EE', border: '#E0D4A8' }
  return                              { text: '#2E6644', bg: '#EFF6F2', border: '#BFD9CC' }
}

// ── FIX: extrahera verklig risk-nivå ur svarstexten ──────────────────────
function extractRiskLevel(content: string): string {
  const line = content.split('\n').find(l => l.toLowerCase().startsWith('risk:')) || ''
  if (line.includes('HÖG'))   return 'HÖG'
  if (line.includes('MEDEL')) return 'MEDEL'
  if (line.includes('LÅG'))   return 'LÅG'
  return ''
}

function parseAnswer(content: string) {
  if (!content || typeof content !== 'string') {
    return { body: 'Ett fel uppstod. Försök igen.', simplified: '', example: '', sources: '', riskLine: '' }
  }
  const lines = content.split('\n')
  const sourceLine = lines.find(l => l.toLowerCase().startsWith('källor:')) || ''
  const riskLine   = lines.find(l => l.toLowerCase().startsWith('risk:'))   || ''
  const simplifiedParts = content.split('---FÖRENKLAT---')
  const exampleParts    = content.split('---EXEMPEL---')
  const body = simplifiedParts[0]
    .split('\n')
    .filter(l => l.trim() !== sourceLine.trim() && l.trim() !== riskLine.trim())
    .join('\n').trim()
  const simplified = simplifiedParts[1]
    ? simplifiedParts[1].split('---EXEMPEL---')[0]
        .split('\n')
        .filter(l => !l.toLowerCase().startsWith('källor:') && !l.toLowerCase().startsWith('risk:'))
        .join('\n').trim()
    : ''
  const example = exampleParts[1]
    ? exampleParts[1].split('\n')
        .filter(l => !l.toLowerCase().startsWith('källor:') && !l.toLowerCase().startsWith('risk:'))
        .join('\n').trim()
    : ''
  return { body, simplified, example, sources: sourceLine, riskLine }
}

function isBookkeepingQuestion(content: string) {
  const q = content.toLowerCase()
  return ['bokför','konter','debet','kredit','bokslut','periodisera','avskrivning','inventarie','lager','upplupna','förutbetalda'].some(w => q.includes(w))
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\[(?:IL|ML|SFL|BFL|ABL|SKV)[^\]]+\])/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: '#0A0A0C', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('[') && part.endsWith(']')) {
      const inner = part.slice(1, -1)
      const law = inner.split(' ')[0]
      const url = LAG_URLS[law]
      const badgeStyle: React.CSSProperties = {
        color: '#C0321A',
        textDecoration: 'none',
        fontFamily: 'DM Mono, monospace',
        fontSize: '0.84em',
        border: '1px solid rgba(192,50,26,.25)',
        borderBottom: '2px solid rgba(192,50,26,.45)',
        padding: '2px 7px 2px 5px',
        borderRadius: 3,
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
      }
      return url
        ? <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={badgeStyle}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(192,50,26,.07)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
          >
            <span style={{ opacity: 0.65, fontSize: '0.9em' }}>§</span>{inner}
          </a>
        : <span key={i} style={{ ...badgeStyle, cursor: 'default' }}>
            <span style={{ opacity: 0.65, fontSize: '0.9em' }}>§</span>{inner}
          </span>
    }
    return <span key={i}>{part}</span>
  })
}

function isTableBlock(lines: string[]): boolean {
  return lines.length >= 2 && lines[0].includes('|') && lines[1].replace(/[\s|:-]/g, '') === ''
}

function renderTable(lines: string[], key: number): React.ReactNode {
  const rows = lines
    .filter((_, i) => i !== 1)
    .map(l => l.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1))
  const [header, ...body] = rows
  return (
    <div key={key} style={{ overflowX: 'auto', margin: '12px 0 18px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1.5px solid #0A0A0C' }}>
            {header.map((h, i) => (
              <th key={i} style={{ padding: '9px 16px', textAlign: 'left', fontFamily: 'DM Mono, monospace', fontWeight: 500, color: '#0A0A0C', fontSize: 11, letterSpacing: '.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid #F0EDE6', background: ri % 2 === 0 ? 'white' : '#FAFAF8' }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '10px 16px', fontFamily: 'Georgia, serif', fontSize: 14, color: ci === 0 ? '#333' : '#555', lineHeight: 1.65 }}>
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatBody(text: string) {
  if (!text) return null
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.startsWith('|') && lines[i + 1] && lines[i + 1].replace(/[\s|:-]/g, '') === '') {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i])
        i++
      }
      if (isTableBlock(tableLines)) {
        elements.push(renderTable(tableLines, key++))
        continue
      }
    }

    if (!trimmed) { elements.push(<div key={key++} style={{ height: 6 }} />); i++; continue }

    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={key++} style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 26, fontWeight: 600, color: '#0A0A0C', margin: '4px 0 14px', lineHeight: 1.1, letterSpacing: '-.01em' }}>
          {trimmed.slice(3)}
        </h2>
      )
      i++; continue
    }
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={key++} style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 20, fontWeight: 600, color: '#0A0A0C', margin: '14px 0 8px', lineHeight: 1.2 }}>
          {trimmed.slice(4)}
        </h3>
      )
      i++; continue
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'flex-start' }}>
          <span style={{ color: '#C0321A', flexShrink: 0, marginTop: 5, fontSize: 10, fontFamily: 'DM Mono, monospace' }}>→</span>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#333', lineHeight: 1.8 }}>{renderInline(trimmed.replace(/^[-•]\s+/, ''))}</span>
        </div>
      )
      i++; continue
    }
    if (/^\d+\.\s/.test(trimmed)) {
      const num = trimmed.match(/^(\d+)\./)?.[1]
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'flex-start' }}>
          <span style={{ fontFamily: 'DM Mono, monospace', color: '#C0321A', flexShrink: 0, fontSize: 11, marginTop: 4, minWidth: 18 }}>{num}.</span>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#333', lineHeight: 1.8 }}>{renderInline(trimmed.replace(/^\d+\.\s/, ''))}</span>
        </div>
      )
      i++; continue
    }
    elements.push(
      <p key={key++} style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#1a1a1a', lineHeight: 1.9, marginBottom: 10 }}>
        {renderInline(trimmed)}
      </p>
    )
    i++
  }
  return <>{elements}</>
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 2)   return 'Just nu'
  if (mins < 60)  return `${mins} min sedan`
  if (hours < 24) return `${hours} tim sedan`
  if (days < 7)   return `${days} d sedan`
  return new Date(dateStr).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

export default function App() {
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [history, setHistory]     = useState<HistoryItem[]>([])
  const [popular, setPopular]     = useState<{ question: string; count: number }[]>([])
  const [sessionId]               = useState(() => crypto.randomUUID())
  const [queryCount, setQueryCount] = useState(0)
  const FREE_LIMIT = 10
  const showUpgradeNudge = queryCount >= Math.floor(FREE_LIMIT * 0.7)
  const bottomRef                 = useRef<HTMLDivElement>(null)
  const textareaRef               = useRef<HTMLTextAreaElement>(null)
  const supabase                  = createClient()

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { loadHistory(); loadPopular() }, [])

  async function loadHistory() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('queries')
      .select('id, question, answer, sources, risk_level, created_at')
      .eq('session_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
    if (data) setHistory(data)
  }

  async function loadPopular() {
    const { data } = await supabase.from('queries').select('question').order('created_at', { ascending: false }).limit(200)
    if (!data) return
    const counts: Record<string, number> = {}
    for (const row of data) {
      const q = row.question.trim().toLowerCase()
      counts[q] = (counts[q] || 0) + 1
    }
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([question, count]) => ({ question: question.charAt(0).toUpperCase() + question.slice(1), count }))
    setPopular(sorted)
  }

  function loadFromHistory(item: HistoryItem) {
    setMessages([
      { role: 'user', content: item.question },
      { role: 'assistant', content: item.answer, queryId: item.id, feedback: null },
    ])
  }

  async function sendMessage(text?: string) {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    const newMessages: Message[] = [...messages, { role: 'user', content: q }]
    setMessages(newMessages)
    setLoading(true)
    setQueryCount(c => c + 1)
    const { data: { user } } = await supabase.auth.getUser()
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, sessionId: user?.id || sessionId }),
      })
      const data = await res.json()
      const answerText = data.content || data.answer || 'Inget svar mottaget.'
      setMessages([...newMessages, { role: 'assistant', content: answerText, queryId: data.query_id, feedback: null }])
      await loadHistory()
      await loadPopular()
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Ett fel uppstod. Försök igen.' }])
    }
    setLoading(false)
  }

  async function handleFeedback(msgIndex: number, rating: 1 | -1) {
    const msg = messages[msgIndex]
    if (!msg || (msg.feedback !== null && msg.feedback !== undefined)) return
    setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, feedback: rating } : m))
    const question = messages[msgIndex - 1]?.content || ''
    const { data: { user } } = await supabase.auth.getUser()
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query_id: msg.queryId, question, answer: msg.content, rating, session_id: user?.id || sessionId }),
    })
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F5F3EE', fontFamily: 'Georgia, serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .cg   { font-family: 'Cormorant Garamond', Georgia, serif; }
        .mono { font-family: 'DM Mono', monospace; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #D0CCC4; border-radius: 2px; }

        .hist-item { padding: 10px 12px; cursor: pointer; border-radius: 6px; transition: background .15s; border: 1px solid transparent; }
        .hist-item:hover { background: rgba(192,50,26,.05); border-color: rgba(192,50,26,.1); }

        .popular-item { padding: 8px 12px; cursor: pointer; border-radius: 6px; transition: all .15s; border: 1px solid #F0EDE6; background: #FAFAF8; display: flex; align-items: flex-start; gap: 8px; }
        .popular-item:hover { background: #FDF4F3; border-color: rgba(192,50,26,.2); }

        .suggestion-btn { padding: 16px 18px; border: 1px solid #E0DDD6; background: white; cursor: pointer; text-align: left; border-radius: 6px; transition: all .2s; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 18px; color: #333; line-height: 1.35; }
        .suggestion-btn:hover { border-color: #C0321A; background: #FDF9F8; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(192,50,26,.07); }

        .send-btn { width: 40px; height: 40px; background: #D0CCC4; border: none; border-radius: 7px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background .2s, transform .15s; }
        .send-btn.active { background: #C0321A; }
        .send-btn.active:hover { background: #A02818; transform: translateY(-1px); }
        .send-btn:disabled { opacity: .3; cursor: not-allowed; transform: none; }

        textarea:focus { outline: none; }
        .input-wrap { display: flex; gap: 10px; align-items: flex-end; background: white; border: 1.5px solid #E0DDD6; border-radius: 10px; padding: 11px 13px; transition: border-color .2s, box-shadow .2s; }
        .input-wrap:focus-within { border-color: #0A0A0C; box-shadow: 0 4px 24px rgba(0,0,0,.07); }

        .top-btn { background: none; border: 1px solid #E0DDD6; border-radius: 5px; padding: 6px 14px; font-family: 'DM Mono', monospace; font-size: 11px; color: #AAA; cursor: pointer; letter-spacing: .08em; text-transform: uppercase; transition: all .2s; }
        .top-btn:hover { border-color: #0A0A0C; color: #0A0A0C; }
        .top-btn.danger:hover { border-color: #C0321A; color: #C0321A; }

        .feedback-btn { width: 28px; height: 28px; border-radius: 5px; border: 1px solid #E0DDD6; background: white; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; transition: all .15s; }
        .feedback-btn:hover { border-color: #888; background: #F5F3EE; }

        @keyframes slideDown { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }
        .upgrade-nudge { animation: slideDown .3s both; }

        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:none; } }
        @keyframes pulse  { 0%,100%{opacity:.25} 50%{opacity:.9} }
        .msg-in { animation: fadeUp .3s both; }
        .typing span { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #C0321A; margin: 0 3px; animation: pulse 1.3s ease-in-out infinite; }
        .typing span:nth-child(2) { animation-delay: .22s; }
        .typing span:nth-child(3) { animation-delay: .44s; }

        .answer-table { width: 100%; border-collapse: collapse; }
        .answer-table th { padding: 9px 16px; text-align: left; font-family: 'DM Mono', monospace; font-weight: 500; font-size: 11px; letter-spacing: .07em; text-transform: uppercase; color: #0A0A0C; border-bottom: 1.5px solid #0A0A0C; white-space: nowrap; }
        .answer-table td { padding: 10px 16px; font-family: Georgia, serif; font-size: 14px; color: #444; line-height: 1.65; border-bottom: 1px solid #F0EDE6; }
        .answer-table tr:nth-child(even) td { background: #FAFAF8; }
        .answer-table tr:last-child td { border-bottom: none; }
        .answer-table tr:hover td { background: #FDF4F3; }
      `}</style>

      {/* ── SIDEBAR ─────────────────────────────────────────────── */}
      {sidebarOpen && (
        <aside style={{ width: 276, background: 'white', borderRight: '1px solid #E0DDD6', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid #E0DDD6' }}>
            <a href="/landing" style={{ textDecoration: 'none' }}>
              <span className="cg" style={{ fontSize: 27, fontWeight: 600, color: '#0A0A0C', letterSpacing: '-.02em', lineHeight: 1 }}>
                normi<span style={{ color: '#C0321A' }}>q</span>
              </span>
            </a>
          </div>

          <div style={{ padding: '10px 10px 6px' }}>
            <button
              onClick={() => setMessages([])}
              style={{ width: '100%', padding: '9px 13px', background: '#F5F3EE', border: '1px solid #E0DDD6', borderRadius: 6, fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#666', cursor: 'pointer', textAlign: 'left', letterSpacing: '.06em', textTransform: 'uppercase', transition: 'all .2s', display: 'flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={e => { e.currentTarget.style.background = '#0A0A0C'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#0A0A0C' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#F5F3EE'; e.currentTarget.style.color = '#666'; e.currentTarget.style.borderColor = '#E0DDD6' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Ny konversation
            </button>
          </div>

          {showUpgradeNudge && (
            <div className="upgrade-nudge" style={{ margin: '6px 10px 4px', padding: '11px 13px', background: 'linear-gradient(135deg, #FDF4F3 0%, #FAF0EE 100%)', border: '1px solid rgba(192,50,26,.2)', borderRadius: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="mono" style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#C0321A' }}>
                  {FREE_LIMIT - queryCount} frågor kvar
                </span>
                <div style={{ width: 48, height: 3, background: '#F0EDE6', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${(queryCount / FREE_LIMIT) * 100}%`, height: '100%', background: '#C0321A', borderRadius: 2, transition: 'width .4s' }} />
                </div>
              </div>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 12, color: '#666', lineHeight: 1.5, marginBottom: 9 }}>
                Uppgradera för obegränsade svar och prioriterad support.
              </p>
              <a
                href="/priser"
                style={{ display: 'block', textAlign: 'center', padding: '7px 12px', background: '#C0321A', color: 'white', borderRadius: 5, fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', textDecoration: 'none', transition: 'background .2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#A02818' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#C0321A' }}
              >
                Uppgradera →
              </a>
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', padding: '2px 7px 8px' }}>
            {popular.length > 0 && (
              <>
                <div className="mono" style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#CCC', padding: '8px 6px 5px' }}>Populärast</div>
                {popular.map((item, idx) => (
                  <div key={idx} className="popular-item" onClick={() => sendMessage(item.question)}>
                    <span className="mono" style={{ fontSize: 10, color: '#C0321A', flexShrink: 0, marginTop: 2 }}>{idx + 1}</span>
                    <span style={{ fontFamily: 'Georgia, serif', fontSize: 12, color: '#444', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.question}</span>
                  </div>
                ))}
                <div style={{ height: 1, background: '#F0EDE6', margin: '8px 4px' }} />
              </>
            )}
            <div className="mono" style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: '#CCC', padding: '4px 6px 5px' }}>Tidigare frågor</div>
            {history.length === 0 ? (
              <div className="mono" style={{ fontSize: 11, color: '#DDD', padding: '8px 10px', lineHeight: 1.7 }}>Dina frågor sparas här</div>
            ) : (
              history.map(item => {
                // ── FIX: läs risk ur svarstexten, inte från DB-kolumnen ──
                const displayRisk = extractRiskLevel(item.answer) || item.risk_level || ''
                const rc = getRiskColor(displayRisk)
                return (
                  <div key={item.id} className="hist-item" onClick={() => loadFromHistory(item)}>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#333', lineHeight: 1.4, marginBottom: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.question}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="mono" style={{ fontSize: 10, color: '#CCC' }}>{timeAgo(item.created_at)}</div>
                      {displayRisk && (
                        <div className="mono" style={{ fontSize: 9, color: rc.text, background: rc.bg, border: `1px solid ${rc.border}`, padding: '1px 6px', borderRadius: 3 }}>
                          {displayRisk}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div style={{ padding: '12px 16px', borderTop: '1px solid #E0DDD6' }}>
            <div className="mono" style={{ fontSize: 10, color: '#C8C4BC', lineHeight: 1.8 }}>
              IL · ML · BFL · SFL · ABL<br />
              <span style={{ color: '#C0321A' }}>Konsultera alltid skatteexpert.</span>
            </div>
          </div>
        </aside>
      )}

      {/* ── MAIN ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* TOP BAR */}
        <div style={{ padding: '13px 36px', borderBottom: '1px solid #E0DDD6', display: 'flex', alignItems: 'center', gap: 16, background: 'white' }}>
          <button
            onClick={() => setSidebarOpen(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 5, color: '#BBB', transition: 'color .2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#0A0A0C')}
            onMouseLeave={e => (e.currentTarget.style.color = '#BBB')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span className="cg" style={{ fontSize: 20, color: '#AAA', fontWeight: 400 }}>Skatt & Redovisning</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="top-btn danger" onClick={logout}>Logga ut</button>
          </div>
        </div>

        {/* MESSAGES */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '36px 48px' }}>
          {messages.length === 0 ? (
            <div style={{ maxWidth: 700, margin: '0 auto', paddingTop: 32 }}>
              <div className="mono" style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#C0321A', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'block', width: 22, height: 1.5, background: '#C0321A' }}/>
                Citation-first AI
              </div>
              <h1 className="cg" style={{ fontSize: 'clamp(40px,4.5vw,64px)', color: '#0A0A0C', marginBottom: 14, lineHeight: .94, letterSpacing: '-.03em' }}>
                Vad vill du veta?
              </h1>
              <p style={{ fontSize: 15, color: '#999', marginBottom: 36, lineHeight: 1.85 }}>
                Ställ en fråga om skatt, moms eller redovisning
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} className="suggestion-btn" onClick={() => sendMessage(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>
              {messages.map((m, i) => {
                if (m.role === 'user') {
                  return (
                    <div key={i} className="msg-in" style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 4 }}>
                      <div className="cg" style={{ background: '#0A0A0C', color: 'white', padding: '11px 18px', borderRadius: '12px 12px 4px 12px', fontSize: 19, lineHeight: 1.35, maxWidth: '58%' }}>
                        {m.content}
                      </div>
                    </div>
                  )
                }

                const { body, simplified, example, sources, riskLine } = parseAnswer(m.content)
                const rc = getRiskColor(riskLine)
                const isBokforing = isBookkeepingQuestion(messages[i - 1]?.content || '')

                return (
                  <div key={i} className="msg-in">
                    <div style={{ background: 'white', border: '1px solid #E0DDD6', borderRadius: '4px 12px 12px 12px', overflow: 'hidden' }}>

                      <div style={{ padding: '24px 28px 18px' }}>
                        {formatBody(body)}
                      </div>

                      {simplified && (
                        <div style={{ borderTop: '1px solid #F0EDE6', padding: '16px 28px', background: '#FAFAF8' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                            <div style={{ width: 2.5, height: 13, background: '#0A0A0C', borderRadius: 2 }} />
                            <div className="mono" style={{ fontSize: 10, fontWeight: 500, letterSpacing: '.13em', textTransform: 'uppercase', color: '#999' }}>Enkelt uttryckt</div>
                          </div>
                          <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#333', lineHeight: 1.85 }}>
                            {renderInline(simplified.replace(/^enkelt uttryckt:\s*/i, '').trim())}
                          </div>
                        </div>
                      )}

                      {example && (
                        <div style={{ borderTop: '1px solid #F0EDE6', padding: '16px 28px', background: '#FDF4F3' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                            <div style={{ width: 2.5, height: 13, background: '#C0321A', borderRadius: 2 }} />
                            <div className="mono" style={{ fontSize: 10, fontWeight: 500, letterSpacing: '.13em', textTransform: 'uppercase', color: '#C0321A' }}>
                              {(isBokforing || example.toLowerCase().includes('debet') || example.toLowerCase().includes('kredit')) ? 'Kontering' : 'Praktiskt exempel'}
                            </div>
                          </div>
                          <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#444', lineHeight: 1.85 }}>
                            {renderInline(example.replace(/^exempel:\s*/i, '').trim())}
                          </div>
                        </div>
                      )}

                      <div style={{ borderTop: '1px solid #F0EDE6', padding: '12px 28px', background: 'white' }}>
                        {sources && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                            <span className="mono" style={{ fontSize: 10, color: '#CCC', letterSpacing: '.08em', textTransform: 'uppercase' }}>Källor</span>
                            {sources.replace(/^källor:\s*/i, '').split(',').map((s, idx) => {
                              const trimmed = s.trim()
                              const law = trimmed.split(' ')[0]
                              const url = LAG_URLS[law]
                              return (
                                <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  {idx > 0 && <span style={{ color: '#E0DDD6' }}>·</span>}
                                  {url
                                    ? <a href={url} target="_blank" rel="noopener noreferrer"
                                        style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#C0321A', textDecoration: 'none', border: '1px solid rgba(192,50,26,.2)', borderBottom: '2px solid rgba(192,50,26,.4)', padding: '2px 7px 2px 5px', borderRadius: 3, display: 'inline-flex', alignItems: 'center', gap: 3, transition: 'background .15s' }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(192,50,26,.07)' }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
                                      >
                                        <span style={{ opacity: 0.6, fontSize: '0.85em' }}>§</span>{trimmed}
                                      </a>
                                    : <span className="mono" style={{ fontSize: 11, color: '#888' }}>{trimmed}</span>
                                  }
                                </span>
                              )
                            })}
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          {riskLine ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 5, height: 5, borderRadius: '50%', background: rc.text, flexShrink: 0, display: 'inline-block', opacity: 0.7 }} />
                              <span className="mono" style={{ fontSize: 10, color: '#AAA', letterSpacing: '.04em' }}>
                                {riskLine.replace(/^risk:\s*/i, '')}
                              </span>
                            </div>
                          ) : <div />}

                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {m.feedback == null ? (
                              <>
                                <button className="feedback-btn" onClick={() => handleFeedback(i, 1)} title="Bra svar">👍</button>
                                <button className="feedback-btn" onClick={() => handleFeedback(i, -1)} title="Dåligt svar">👎</button>
                              </>
                            ) : (
                              <div className="mono" style={{ fontSize: 10, color: m.feedback === 1 ? '#2E6644' : '#A02818', background: m.feedback === 1 ? '#EFF6F2' : '#FAF0EE', border: `1px solid ${m.feedback === 1 ? '#BFD9CC' : '#E8C8C0'}`, padding: '4px 12px', borderRadius: 4 }}>
                                {m.feedback === 1 ? 'Tack!' : 'Noterat — vi förbättrar det'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                )
              })}

              {loading && (
                <div className="msg-in">
                  <div style={{ background: 'white', border: '1px solid #E0DDD6', borderRadius: '4px 12px 12px 12px', padding: '18px 26px', display: 'inline-block' }}>
                    <div className="typing"><span/><span/><span/></div>
                  </div>
                </div>
              )}
              <div ref={bottomRef}/>
            </div>
          )}
        </div>

        {/* INPUT */}
        <div style={{ padding: '14px 48px 20px', background: '#F5F3EE', borderTop: '1px solid #E0DDD6' }}>
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div className="input-wrap">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Skriv din fråga om skatt eller redovisning..."
                rows={1}
                style={{ flex: 1, border: 'none', background: 'transparent', resize: 'none', fontFamily: 'Georgia, serif', fontSize: 15, color: '#1a1a1a', lineHeight: 1.65, padding: 0, maxHeight: 160, overflowY: 'auto' }}
                onInput={e => {
                  const t = e.target as HTMLTextAreaElement
                  t.style.height = 'auto'
                  t.style.height = Math.min(t.scrollHeight, 160) + 'px'
                }}
              />
              <button
                className={`send-btn${input.trim() ? ' active' : ''}`}
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
            <div className="mono" style={{ fontSize: 10, color: '#CCC', textAlign: 'center', marginTop: 9, letterSpacing: '.04em' }}>
              Baseras på IL · ML · BFL · SFL · ABL — verifiera alltid med en skatteexpert
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}