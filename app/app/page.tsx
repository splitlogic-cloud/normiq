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
  'Hur beskattas utdelning från fåmansbolag?',
  'Är representation avdragsgill?',
  'Hur fungerar F-skatt?',
  'Vad gäller inkurans på lager?',
]

type Message = {
  role: 'user' | 'assistant'
  content: string
  queryId?: string
  feedback?: 1 | -1 | null
}
type HistoryItem = { id: string; question: string; created_at: string }

function getRiskColor(risk: string) {
  if (risk.includes('HÖG')) return '#C0321A'
  if (risk.includes('MEDEL')) return '#C8A217'
  return '#3A7A52'
}

function parseAnswer(content: string) {
  if (!content || typeof content !== 'string') {
    return { body: 'Ett fel uppstod. Försök igen.', simplified: '', example: '', sources: '', riskLine: '' }
  }
  const lines = content.split('\n')
  const sourceLine = lines.find(l => l.toLowerCase().startsWith('källor:')) || ''
  const riskLine = lines.find(l => l.toLowerCase().startsWith('risk:')) || ''
  const simplifiedParts = content.split('---FÖRENKLAT---')
  const exampleParts = content.split('---EXEMPEL---')
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
      return url
        ? <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#C0321A', textDecoration: 'none', fontFamily: 'DM Mono, monospace', fontSize: '0.85em', border: '1px solid rgba(192,50,26,.3)', padding: '2px 7px', borderRadius: 3, whiteSpace: 'nowrap' }}>[{inner}]</a>
        : <span key={i} style={{ color: '#C0321A', fontFamily: 'DM Mono, monospace', fontSize: '0.85em' }}>[{inner}]</span>
    }
    return <span key={i}>{part}</span>
  })
}

function formatBody(text: string) {
  if (!text) return null
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) { elements.push(<div key={key++} style={{ height: 8 }} />); continue }
    if (trimmed.startsWith('## ')) {
      elements.push(<h2 key={key++} style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 600, color: '#0A0A0C', margin: '4px 0 16px', lineHeight: 1.2 }}>{trimmed.slice(3)}</h2>)
      continue
    }
    if (trimmed.startsWith('### ')) {
      elements.push(<h3 key={key++} style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 600, color: '#0A0A0C', margin: '16px 0 10px', lineHeight: 1.2 }}>{trimmed.slice(4)}</h3>)
      continue
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'flex-start' }}>
          <span style={{ color: '#C0321A', flexShrink: 0, marginTop: 3, fontSize: 12 }}>→</span>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 17, color: '#333', lineHeight: 1.8 }}>{renderInline(trimmed.replace(/^[-•]\s+/, ''))}</span>
        </div>
      )
      continue
    }
    if (/^\d+\.\s/.test(trimmed)) {
      const num = trimmed.match(/^(\d+)\./)?.[1]
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'flex-start' }}>
          <span style={{ fontFamily: 'DM Mono, monospace', color: '#C0321A', flexShrink: 0, fontSize: 13, marginTop: 3, minWidth: 20 }}>{num}.</span>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 17, color: '#333', lineHeight: 1.8 }}>{renderInline(trimmed.replace(/^\d+\.\s/, ''))}</span>
        </div>
      )
      continue
    }
    elements.push(<p key={key++} style={{ fontFamily: 'DM Mono, monospace', fontSize: 17, color: '#1a1a1a', lineHeight: 1.95, marginBottom: 10 }}>{renderInline(trimmed)}</p>)
  }
  return <>{elements}</>
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 2) return 'Just nu'
  if (mins < 60) return `${mins} min sedan`
  if (hours < 24) return `${hours} tim sedan`
  if (days < 7) return `${days} dagar sedan`
  return new Date(dateStr).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [sessionId] = useState(() => crypto.randomUUID())
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('queries')
      .select('id, question, created_at')
      .eq('session_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
    if (data) setHistory(data)
  }

  async function sendMessage(text?: string) {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    const newMessages: Message[] = [...messages, { role: 'user', content: q }]
    setMessages(newMessages)
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, sessionId: user?.id || sessionId }),
      })
      const data = await res.json()
      const answerText = data.content || data.answer || 'Inget svar mottaget.'
      setMessages([...newMessages, {
        role: 'assistant',
        content: answerText,
        queryId: data.query_id,
        feedback: null,
      }])
      await loadHistory()
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Ett fel uppstod. Försök igen.' }])
    }
    setLoading(false)
  }

  async function handleFeedback(msgIndex: number, rating: 1 | -1) {
    const msg = messages[msgIndex]
    if (!msg || msg.feedback !== null && msg.feedback !== undefined) return

    // Optimistisk uppdatering
    setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, feedback: rating } : m))

    const question = messages[msgIndex - 1]?.content || ''
    const { data: { user } } = await supabase.auth.getUser()

    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query_id: msg.queryId,
        question,
        answer: msg.content,
        rating,
        session_id: user?.id || sessionId,
      }),
    })
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F5F3EE', fontFamily: 'Georgia, serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .cg { font-family: 'Cormorant Garamond', Georgia, serif; }
        .mono { font-family: 'DM Mono', monospace; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #D0CCC4; border-radius: 2px; }
        .hist-item {
          padding: 12px 16px; cursor: pointer; border-radius: 8px;
          transition: background .15s; border: 1px solid transparent;
        }
        .hist-item:hover { background: rgba(192,50,26,.05); border-color: rgba(192,50,26,.1); }
        .suggestion-btn {
          padding: 22px 26px; border: 1px solid #E0DDD6; background: white;
          cursor: pointer; text-align: left; border-radius: 10px;
          transition: all .2s; font-family: 'Cormorant Garamond', serif;
          font-size: 20px; color: #333; line-height: 1.4;
        }
        .suggestion-btn:hover { border-color: #C0321A; background: #FDF9F8; transform: translateY(-2px); box-shadow: 0 6px 24px rgba(192,50,26,.08); }
        .send-btn {
          width: 56px; height: 56px; background: #0A0A0C; border: none;
          border-radius: 10px; cursor: pointer; display: flex;
          align-items: center; justify-content: center; flex-shrink: 0;
          transition: background .2s, transform .15s;
        }
        .send-btn:hover { background: #C0321A; transform: translateY(-1px); }
        .send-btn:disabled { opacity: .35; cursor: not-allowed; transform: none; }
        textarea:focus { outline: none; }
        .input-wrap {
          display: flex; gap: 12px; align-items: flex-end;
          background: white; border: 1.5px solid #E0DDD6;
          border-radius: 14px; padding: 16px 18px;
          transition: border-color .2s, box-shadow .2s;
        }
        .input-wrap:focus-within { border-color: #0A0A0C; box-shadow: 0 4px 28px rgba(0,0,0,.08); }
        .top-btn {
          background: none; border: 1px solid #E0DDD6; border-radius: 6px;
          padding: 7px 16px; font-family: DM Mono, monospace; font-size: 11px;
          color: #AAA; cursor: pointer; letter-spacing: .08em; text-transform: uppercase;
          transition: all .2s;
        }
        .top-btn:hover { border-color: #0A0A0C; color: #0A0A0C; }
        .top-btn.danger:hover { border-color: #C0321A; color: #C0321A; }
        .feedback-btn {
          padding: 5px 14px; border-radius: 20px; border: 1px solid #E0DDD6;
          background: white; cursor: pointer; font-size: 15px;
          transition: all .15s; line-height: 1;
        }
        .feedback-btn:hover { transform: scale(1.1); }
        .feedback-btn.active-up { background: #3A7A52; border-color: #3A7A52; }
        .feedback-btn.active-down { background: #C0321A; border-color: #C0321A; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:none; } }
        @keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }
        .msg-in { animation: fadeUp .45s both; }
        .typing span { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #C0321A; margin: 0 3px; animation: pulse 1.3s ease-in-out infinite; }
        .typing span:nth-child(2) { animation-delay: .22s; }
        .typing span:nth-child(3) { animation-delay: .44s; }
      `}</style>

      {/* SIDEBAR */}
      {sidebarOpen && (
        <aside style={{ width: 300, background: 'white', borderRight: '1px solid #E0DDD6', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid #E0DDD6' }}>
            <a href="/landing" style={{ textDecoration: 'none' }}>
              <div className="cg" style={{ fontSize: 30, fontWeight: 600, color: '#0A0A0C', letterSpacing: '-.02em', lineHeight: 1 }}>
                Normi<span style={{ color: '#C0321A' }}>q</span>
              </div>
            </a>
            <div className="mono" style={{ fontSize: 11, color: '#BBB', letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 6 }}>Citation-first AI</div>
          </div>

          <div style={{ padding: '16px 16px 8px' }}>
            <button
              onClick={() => setMessages([])}
              style={{ width: '100%', padding: '12px 16px', background: '#F5F3EE', border: '1px solid #E0DDD6', borderRadius: 8, fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#666', cursor: 'pointer', textAlign: 'left', letterSpacing: '.06em', textTransform: 'uppercase', transition: 'all .2s', display: 'flex', alignItems: 'center', gap: 10 }}
              onMouseEnter={e => { e.currentTarget.style.background = '#0A0A0C'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#0A0A0C' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#F5F3EE'; e.currentTarget.style.color = '#666'; e.currentTarget.style.borderColor = '#E0DDD6' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Ny konversation
            </button>
          </div>

          <div style={{ padding: '12px 16px 4px' }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#CCC', paddingLeft: 4 }}>Tidigare frågor</div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
            {history.length === 0 ? (
              <div className="mono" style={{ fontSize: 12, color: '#DDD', padding: '12px 12px', lineHeight: 1.7 }}>
                Dina frågor sparas här automatiskt
              </div>
            ) : (
              history.map(item => (
                <div key={item.id} className="hist-item" onClick={() => sendMessage(item.question)}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: '#333', lineHeight: 1.4, marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {item.question}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: '#CCC' }}>{timeAgo(item.created_at)}</div>
                </div>
              ))
            )}
          </div>

          <div style={{ padding: '16px 20px', borderTop: '1px solid #E0DDD6' }}>
            <div className="mono" style={{ fontSize: 11, color: '#CCC', lineHeight: 1.8 }}>
              IL · ML · BFL · SFL · ABL<br />
              <span style={{ color: '#C0321A' }}>Konsultera alltid skatteexpert.</span>
            </div>
          </div>
        </aside>
      )}

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* TOP BAR */}
        <div style={{ padding: '16px 40px', borderBottom: '1px solid #E0DDD6', display: 'flex', alignItems: 'center', gap: 16, background: 'white' }}>
          <button
            onClick={() => setSidebarOpen(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 6, color: '#AAA', transition: 'color .2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#0A0A0C')}
            onMouseLeave={e => (e.currentTarget.style.color = '#AAA')}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span className="cg" style={{ fontSize: 22, color: '#999', fontWeight: 400 }}>Skatt & Redovisning</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="top-btn danger" onClick={logout}>Logga ut</button>
          </div>
        </div>

        {/* MESSAGES */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '48px 60px' }}>
          {messages.length === 0 ? (
            <div style={{ maxWidth: 800, margin: '0 auto', paddingTop: 40 }}>
              <div className="mono" style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: '#C0321A', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ display: 'block', width: 24, height: 1.5, background: '#C0321A' }}/>
                Citation-first AI
              </div>
              <h1 className="cg" style={{ fontSize: 'clamp(52px,5.5vw,80px)', color: '#0A0A0C', marginBottom: 20, lineHeight: .95, letterSpacing: '-.03em' }}>
                Vad vill du veta?
              </h1>
              <p className="mono" style={{ fontSize: 16, color: '#AAA', marginBottom: 56, lineHeight: 1.9 }}>
                Ställ en fråga om skatt, moms eller redovisning — med källhänvisning i svaret
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} className="suggestion-btn" onClick={() => sendMessage(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 40 }}>
              {messages.map((m, i) => {
                if (m.role === 'user') {
                  return (
                    <div key={i} className="msg-in" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div className="cg" style={{ background: '#0A0A0C', color: 'white', padding: '20px 28px', borderRadius: '16px 16px 4px 16px', fontSize: 24, lineHeight: 1.35, maxWidth: '75%' }}>
                        {m.content}
                      </div>
                    </div>
                  )
                }

                const { body, simplified, example, sources, riskLine } = parseAnswer(m.content)
                const riskColor = getRiskColor(riskLine)

                return (
                  <div key={i} className="msg-in">
                    <div style={{ background: 'white', border: '1px solid #E0DDD6', borderRadius: '4px 16px 16px 16px', padding: '32px 36px' }}>

                      <div>{formatBody(body)}</div>

                      {simplified && (
                        <div style={{ marginTop: 24, padding: '22px 26px', background: '#F5F3EE', borderRadius: 10, borderLeft: '3px solid #0A0A0C' }}>
                          <div className="mono" style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.14em', textTransform: 'uppercase', color: '#AAA', marginBottom: 10 }}>Enkelt uttryckt</div>
                          <div className="mono" style={{ fontSize: 16, color: '#333', lineHeight: 1.9 }}>
                            {renderInline(simplified.replace(/^enkelt uttryckt:\s*/i, '').trim())}
                          </div>
                        </div>
                      )}

                      {example && (
                        <div style={{ marginTop: 12, padding: '22px 26px', background: '#FDF4F3', borderRadius: 10, borderLeft: '3px solid #C0321A' }}>
                          <div className="mono" style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.14em', textTransform: 'uppercase', color: '#C0321A', marginBottom: 10 }}>Praktiskt exempel</div>
                          <div className="mono" style={{ fontSize: 16, color: '#444', lineHeight: 1.9 }}>
                            {renderInline(example.replace(/^exempel:\s*/i, '').trim())}
                          </div>
                        </div>
                      )}

                      {/* Footer med källor, risk och feedback */}
                      <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #F0EDE6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        
                        {/* Källor */}
                        {sources && (
                          <div className="mono" style={{ fontSize: 12, color: '#BBB', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ color: '#DDD', letterSpacing: '.06em' }}>KÄLLOR</span>
                            {sources.replace(/^källor:\s*/i, '').split(',').map((s, idx) => {
                              const trimmed = s.trim()
                              const law = trimmed.split(' ')[0]
                              const url = LAG_URLS[law]
                              return (
                                <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  {idx > 0 && <span style={{ color: '#E8E4DC' }}>·</span>}
                                  {url
                                    ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#C0321A', textDecoration: 'none' }}>{trimmed}</a>
                                    : <span style={{ color: '#888' }}>{trimmed}</span>
                                  }
                                </span>
                              )
                            })}
                          </div>
                        )}

                        {/* Risk + Feedback */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          {riskLine && (
                            <div className="mono" style={{ fontSize: 12, color: riskColor, background: `${riskColor}15`, padding: '5px 14px', borderRadius: 20, letterSpacing: '.06em', whiteSpace: 'nowrap' }}>
                              ● {riskLine.replace(/^risk:\s*/i, '')}
                            </div>
                          )}

                          {/* Feedback-knappar */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {m.feedback == null ? (
                              <>
                                <button
                                  className={`feedback-btn`}
                                  onClick={() => handleFeedback(i, 1)}
                                  title="Bra svar"
                                >👍</button>
                                <button
                                  className={`feedback-btn`}
                                  onClick={() => handleFeedback(i, -1)}
                                  title="Dåligt svar"
                                >👎</button>
                              </>
                            ) : (
                              <div className="mono" style={{ fontSize: 11, color: m.feedback === 1 ? '#3A7A52' : '#C0321A', background: m.feedback === 1 ? '#3A7A5215' : '#C0321A15', padding: '4px 12px', borderRadius: 20 }}>
                                {m.feedback === 1 ? '✓ Tack!' : '✗ Noterat — vi förbättrar det'}
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
                  <div style={{ background: 'white', border: '1px solid #E0DDD6', borderRadius: '4px 16px 16px 16px', padding: '24px 32px', display: 'inline-block' }}>
                    <div className="typing"><span/><span/><span/></div>
                  </div>
                </div>
              )}
              <div ref={bottomRef}/>
            </div>
          )}
        </div>

        {/* INPUT */}
        <div style={{ padding: '20px 60px 28px', background: '#F5F3EE', borderTop: '1px solid #E0DDD6' }}>
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <div className="input-wrap">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Skriv din fråga om skatt eller redovisning..."
                rows={1}
                style={{ flex: 1, border: 'none', background: 'transparent', resize: 'none', fontFamily: 'DM Mono, monospace', fontSize: 17, color: '#1a1a1a', lineHeight: 1.6, padding: 0, maxHeight: 180, overflowY: 'auto' }}
                onInput={e => {
                  const t = e.target as HTMLTextAreaElement
                  t.style.height = 'auto'
                  t.style.height = Math.min(t.scrollHeight, 180) + 'px'
                }}
              />
              <button className="send-btn" onClick={() => sendMessage()} disabled={loading || !input.trim()}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
            <div className="mono" style={{ fontSize: 11, color: '#CCC', textAlign: 'center', marginTop: 12, letterSpacing: '.04em' }}>
              Baseras på IL · ML · BFL · SFL · ABL — verifiera alltid med en skatteexpert
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}