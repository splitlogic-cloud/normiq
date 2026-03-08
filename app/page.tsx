'use client'

import { useState, useRef, useEffect } from 'react'

const LAG_URLS: Record<string, string> = {
  IL: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/inkomstskattelag-19991229_sfs-1999-1229/',
  ML: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/mervardesskatteklag-20232_sfs-2023-200/',
  SFL: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/skatteforfarandelag-20111244_sfs-2011-1244/',
  BFL: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/bokforingslag-19991078_sfs-1999-1078/',
  ABL: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/aktiebolagslag-2005551_sfs-2005-551/',
  SKV: 'https://www.skatteverket.se/rattsinformation/stallningstaganden.4.html',
}

const RULES = [
  { ref: 'IL 16:2', label: 'Representation' },
  { ref: 'ML 8:1', label: 'Moms representation' },
  { ref: 'IL 11:1', label: 'Löneförmåner' },
  { ref: 'IL 57:10', label: 'Fåmansbolag 3:12' },
  { ref: 'IL 67:4', label: 'ROT-avdrag' },
  { ref: 'SFL 3:1', label: 'F-skatt' },
  { ref: 'ML 1:1', label: 'Moms på tjänster' },
  { ref: 'BFL 5:1', label: 'Bokföring & kvitton' },
  { ref: 'IL 16:36', label: 'Hemkontor' },
  { ref: 'ABL 17:3', label: 'Utdelning aktiebolag' },
]

const SUGGESTIONS = [
  'Hur beskattas utdelning från fåmansbolag?',
  'Är representation avdragsgill?',
  'Hur fungerar F-skatt?',
  'Vad gäller för moms på konsulttjänster?',
]

type Message = {
  role: 'user' | 'assistant'
  content: string
}

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
    .filter(l => l !== sourceLine && l !== riskLine)
    .join('\n')
    .trim()
  const simplified = simplifiedParts[1]
    ? simplifiedParts[1].split('---EXEMPEL---')[0].trim()
    : ''
  const example = exampleParts[1]
    ? exampleParts[1]
        .split('\n')
        .filter(l => !l.toLowerCase().startsWith('källor:') && !l.toLowerCase().startsWith('risk:'))
        .join('\n')
        .trim()
    : ''
  return { body, simplified, example, sources: sourceLine, riskLine }
}

function formatBody(text: string) {
  if (!text) return null

  // Rendera markdown-liknande formattering
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      elements.push(<div key={key++} style={{ height: 8 }} />)
      continue
    }

    // Rubrik ##
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={key++} className="cg" style={{ fontSize: 32, fontWeight: 600, color: '#0A0A0C', marginBottom: 16, marginTop: 8, lineHeight: 1.2 }}>
          {trimmed.replace('## ', '')}
        </h2>
      )
      continue
    }

    // Rubrik ###
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={key++} className="cg" style={{ fontSize: 24, fontWeight: 600, color: '#0A0A0C', marginBottom: 12, marginTop: 16, lineHeight: 1.2 }}>
          {trimmed.replace('### ', '')}
        </h3>
      )
      continue
    }

    // Bullet point
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      const content = trimmed.replace(/^[-•]\s+/, '')
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'flex-start' }}>
          <span style={{ color: '#C0321A', flexShrink: 0, marginTop: 2 }}>→</span>
          <span className="mono" style={{ fontSize: 18, color: '#333', lineHeight: 1.8 }}>{renderInline(content)}</span>
        </div>
      )
      continue
    }

    // Numrerad lista
    if (/^\d+\.\s/.test(trimmed)) {
      const num = trimmed.match(/^(\d+)\./)?.[1]
      const content = trimmed.replace(/^\d+\.\s/, '')
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'flex-start' }}>
          <span className="mono" style={{ color: '#C0321A', flexShrink: 0, fontSize: 13, marginTop: 3, minWidth: 20 }}>{num}.</span>
          <span className="mono" style={{ fontSize: 18, color: '#333', lineHeight: 1.8 }}>{renderInline(content)}</span>
        </div>
      )
      continue
    }

    // Vanligt stycke
    elements.push(
      <p key={key++} className="mono" style={{ fontSize: 18, color: '#1a1a1a', lineHeight: 1.95, marginBottom: 12 }}>
        {renderInline(trimmed)}
      </p>
    )
  }

  return <>{elements}</>
}

function renderInline(text: string): React.ReactNode {
  // Hantera [IL xx §] referenser + **bold**
  const parts = text.split(/(\[(?:IL|ML|SFL|BFL|ABL|SKV)[^\]]+\]|\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('[') && part.endsWith(']')) {
      const inner = part.slice(1, -1)
      const law = inner.split(' ')[0]
      const url = LAG_URLS[law]
      return url
        ? <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#C0321A', textDecoration: 'none', fontFamily: 'DM Mono, monospace', fontSize: '0.85em', border: '1px solid rgba(192,50,26,.3)', padding: '2px 7px', borderRadius: 3, whiteSpace: 'nowrap' }}>[{inner}]</a>
        : <span key={i} style={{ color: '#C0321A', fontFamily: 'DM Mono, monospace', fontSize: '0.85em' }}>[{inner}]</span>
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: '#0A0A0C', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text?: string) {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    const newMessages: Message[] = [...messages, { role: 'user', content: q }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()
      const answerText = data.content || data.answer || 'Inget svar mottaget.'
      setMessages([...newMessages, { role: 'assistant', content: answerText }])
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Ett fel uppstod. Försök igen.' }])
    }
    setLoading(false)
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
        .rule-item {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 20px; cursor: pointer; border-radius: 6px;
          transition: background .15s; text-decoration: none;
        }
        .rule-item:hover { background: rgba(192,50,26,.06); }
        .suggestion-btn {
          padding: 22px 26px; border: 1px solid #E0DDD6; background: white;
          cursor: pointer; text-align: left; border-radius: 10px;
          transition: all .2s; font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 20px; color: '#333'; line-height: 1.4;
        }
        .suggestion-btn:hover {
          border-color: #C0321A; background: #FDF9F8;
          transform: translateY(-2px); box-shadow: 0 6px 24px rgba(192,50,26,.08);
        }
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
        .input-wrap:focus-within {
          border-color: #0A0A0C;
          box-shadow: 0 4px 28px rgba(0,0,0,.08);
        }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:none; } }
        @keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }
        .msg-in { animation: fadeUp .45s both; }
        .typing span {
          display: inline-block; width: 8px; height: 8px;
          border-radius: 50%; background: #C0321A; margin: 0 3px;
          animation: pulse 1.3s ease-in-out infinite;
        }
        .typing span:nth-child(2) { animation-delay: .22s; }
        .typing span:nth-child(3) { animation-delay: .44s; }
        .answer-body p { margin-bottom: 14px; }
        .answer-body h2 { font-family: 'Cormorant Garamond', serif; font-size: 28px; font-weight: 600; margin-bottom: 16px; margin-top: 4px; color: #0A0A0C; }
        .answer-body h3 { font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 600; margin-bottom: 12px; margin-top: 16px; color: #0A0A0C; }
        .answer-body ul, .answer-body ol { padding-left: 20px; margin-bottom: 14px; }
        .answer-body li { margin-bottom: 6px; }
        .answer-body strong { color: #0A0A0C; font-weight: 600; }
      `}</style>

      {/* SIDEBAR */}
      {sidebarOpen && (
        <aside style={{ width: 290, background: 'white', borderRight: '1px solid #E0DDD6', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid #E0DDD6' }}>
            <a href="/landing" style={{ textDecoration: 'none' }}>
              <div className="cg" style={{ fontSize: 30, fontWeight: 600, color: '#0A0A0C', letterSpacing: '-.02em', lineHeight: 1 }}>
                Normi<span style={{ color: '#C0321A' }}>q</span>
              </div>
            </a>
            <div className="mono" style={{ fontSize: 11, color: '#BBB', letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 8 }}>Citation-first AI</div>
          </div>

          <div style={{ padding: '20px 16px 8px' }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#CCC', paddingLeft: 8, marginBottom: 6 }}>Regelindex</div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
            {RULES.map(r => (
              <div key={r.ref} className="rule-item" onClick={() => sendMessage(`Förklara ${r.label} — ${r.ref}`)}>
                <span className="mono" style={{ fontSize: 11, background: '#F5F3EE', color: '#C0321A', padding: '4px 9px', borderRadius: 4, letterSpacing: '.04em', flexShrink: 0 }}>{r.ref}</span>
                <span style={{ fontSize: 16, color: '#333', fontFamily: 'Georgia, serif' }}>{r.label}</span>
              </div>
            ))}
          </div>

          <div style={{ padding: '18px 22px', borderTop: '1px solid #E0DDD6' }}>
            <div className="mono" style={{ fontSize: 11, color: '#CCC', lineHeight: 1.8 }}>
              Baseras på IL, ML, BFL, SFL & ABL.<br />
              <span style={{ color: '#C0321A' }}>Konsultera alltid skatteexpert.</span>
            </div>
          </div>
        </aside>
      )}

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* TOP BAR */}
        <div style={{ padding: '20px 48px', borderBottom: '1px solid #E0DDD6', display: 'flex', alignItems: 'center', gap: 18, background: 'white' }}>
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
          <span className="cg" style={{ fontSize: 24, color: '#999', fontWeight: 400, letterSpacing: '-.01em' }}>Skatt & Redovisning</span>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="mono"
              style={{ marginLeft: 'auto', background: 'none', border: '1px solid #E0DDD6', borderRadius: 6, padding: '6px 16px', fontSize: 11, color: '#AAA', cursor: 'pointer', letterSpacing: '.08em', textTransform: 'uppercase', transition: 'all .2s' }}
              onMouseEnter={e => { (e.currentTarget.style.borderColor = '#0A0A0C'); (e.currentTarget.style.color = '#0A0A0C') }}
              onMouseLeave={e => { (e.currentTarget.style.borderColor = '#E0DDD6'); (e.currentTarget.style.color = '#AAA') }}
            >
              Ny fråga
            </button>
          )}
        </div>

        {/* MESSAGES */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '56px 80px' }}>
          {messages.length === 0 ? (
            <div style={{ maxWidth: 800, margin: '0 auto', paddingTop: 48 }}>
              <div className="mono" style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: '#C0321A', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ display: 'block', width: 24, height: 1.5, background: '#C0321A' }}/>
                Citation-first AI
              </div>
              <h1 className="cg" style={{ fontSize: 'clamp(56px,6vw,88px)', color: '#0A0A0C', marginBottom: 20, lineHeight: .95, letterSpacing: '-.03em' }}>
                Vad vill du veta?
              </h1>
              <p className="mono" style={{ fontSize: 17, color: '#AAA', marginBottom: 64, lineHeight: 1.9 }}>
                Ställ en fråga om skatt, moms eller redovisning — med källhänvisning i svaret
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} className="suggestion-btn" onClick={() => sendMessage(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 48 }}>
              {messages.map((m, i) => {
                if (m.role === 'user') {
                  return (
                    <div key={i} className="msg-in" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div className="cg" style={{
                        background: '#0A0A0C', color: 'white',
                        padding: '22px 32px', borderRadius: '16px 16px 4px 16px',
                        fontSize: 26, lineHeight: 1.35, maxWidth: '75%'
                      }}>
                        {m.content}
                      </div>
                    </div>
                  )
                }

                const { body, simplified, example, sources, riskLine } = parseAnswer(m.content)
                const riskColor = getRiskColor(riskLine)
                const riskText = riskLine.replace(/^risk:\s*/i, '')

                return (
                  <div key={i} className="msg-in">
                    <div style={{ background: 'white', border: '1px solid #E0DDD6', borderRadius: '4px 16px 16px 16px', padding: '36px 40px' }}>

                      {/* Main body */}
                      <div className="answer-body mono" style={{ fontSize: 18, color: '#1a1a1a', lineHeight: 1.95 }}>
                        {formatBody(body)}
                      </div>

                      {/* Simplified */}
                      {simplified && (
                        <div style={{ marginTop: 28, padding: '24px 28px', background: '#F5F3EE', borderRadius: 12, borderLeft: '3px solid #0A0A0C' }}>
                          <div className="mono" style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.14em', textTransform: 'uppercase', color: '#AAA', marginBottom: 12 }}>Enkelt uttryckt</div>
                          <div className="mono" style={{ fontSize: 17, color: '#333', lineHeight: 1.9 }}>
                            {simplified.replace(/^enkelt uttryckt:\s*/i, '').trim()}
                          </div>
                        </div>
                      )}

                      {/* Example */}
                      {example && (
                        <div style={{ marginTop: 14, padding: '24px 28px', background: '#FDF4F3', borderRadius: 12, borderLeft: '3px solid #C0321A' }}>
                          <div className="mono" style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.14em', textTransform: 'uppercase', color: '#C0321A', marginBottom: 12 }}>Praktiskt exempel</div>
                          <div className="mono" style={{ fontSize: 17, color: '#444', lineHeight: 1.9 }}>
                            {example.replace(/^exempel:\s*/i, '').trim()}
                          </div>
                        </div>
                      )}

                      {/* Footer — sources + risk */}
                      {(sources || riskLine) && (
                        <div style={{ marginTop: 28, paddingTop: 22, borderTop: '1px solid #F0EDE6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                          {sources && (
                            <div className="mono" style={{ fontSize: 13, color: '#BBB', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                              <span style={{ color: '#DDD', letterSpacing: '.06em' }}>KÄLLOR</span>
                              {sources.replace(/^källor:\s*/i, '').split(',').map((s, idx) => {
                                const trimmed = s.trim()
                                const law = trimmed.split(' ')[0]
                                const url = LAG_URLS[law]
                                return (
                                  <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {idx > 0 && <span style={{ color: '#E8E4DC' }}>·</span>}
                                    {url
                                      ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#C0321A', textDecoration: 'none', transition: 'opacity .2s' }} onMouseEnter={e => (e.currentTarget.style.opacity = '.7')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>{trimmed}</a>
                                      : <span style={{ color: '#888' }}>{trimmed}</span>
                                    }
                                  </span>
                                )
                              })}
                            </div>
                          )}
                          {riskLine && (
                            <div className="mono" style={{ fontSize: 13, color: riskColor, background: `${riskColor}15`, padding: '6px 16px', borderRadius: 20, letterSpacing: '.06em', flexShrink: 0 }}>
                              ● {riskText}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {loading && (
                <div className="msg-in">
                  <div style={{ background: 'white', border: '1px solid #E0DDD6', borderRadius: '4px 16px 16px 16px', padding: '28px 36px', display: 'inline-block' }}>
                    <div className="typing"><span/><span/><span/></div>
                  </div>
                </div>
              )}
              <div ref={bottomRef}/>
            </div>
          )}
        </div>

        {/* INPUT */}
        <div style={{ padding: '24px 80px 36px', background: '#F5F3EE', borderTop: '1px solid #E0DDD6' }}>
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <div className="input-wrap">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="Skriv din fråga om skatt eller redovisning..."
                rows={1}
                style={{
                  flex: 1, border: 'none', background: 'transparent', resize: 'none',
                  fontFamily: 'DM Mono, monospace', fontSize: 18, color: '#1a1a1a',
                  lineHeight: 1.6, padding: 0, maxHeight: 180, overflowY: 'auto'
                }}
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
            <div className="mono" style={{ fontSize: 12, color: '#CCC', textAlign: 'center', marginTop: 14, letterSpacing: '.04em' }}>
              Baseras på IL, ML, BFL, SFL & ABL — verifiera alltid med en skatteexpert
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}