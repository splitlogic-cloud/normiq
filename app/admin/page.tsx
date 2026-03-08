'use client'

import { useState } from 'react'

const LAGAR = [
  { lag: 'Inkomstskattelagen', short: 'IL' },
  { lag: 'Mervärdesskattelagen', short: 'ML' },
  { lag: 'Skatteförfarandelagen', short: 'SFL' },
  { lag: 'Bokföringslagen', short: 'BFL' },
  { lag: 'Skatteverkets ställningstaganden', short: 'SKV' },
]

export default function Admin() {
  const [text, setText] = useState('')
  const [ref, setRef] = useState('')
  const [rubrik, setRubrik] = useState('')
  const [lag, setLag] = useState('Inkomstskattelagen')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [count, setCount] = useState(0)

  async function upload() {
    if (!text.trim() || !ref.trim() || !rubrik.trim()) return
    setStatus('loading')

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, ref, rubrik, lag }),
      })

      if (!res.ok) throw new Error()
      setStatus('done')
      setCount(c => c + 1)
      setText('')
      setRef('')
      setRubrik('')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8', fontFamily: "'Inter', sans-serif", padding: '40px 24px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.03em', color: '#0A0A0C' }}>
            Normi<span style={{ color: '#C0321A' }}>q</span> Admin
          </div>
          <div style={{ fontSize: '13px', color: '#AAA', marginTop: '4px' }}>Ladda upp lagtexter till regelindexet</div>
          {count > 0 && (
            <div style={{ marginTop: '12px', fontSize: '13px', color: '#2A7A4B', background: '#F3FDF7', padding: '8px 14px', borderRadius: '8px', display: 'inline-block' }}>
              ✓ {count} paragrafer uppladdade denna session
            </div>
          )}
        </div>

        {/* Form */}
        <div style={{ background: '#fff', border: '1px solid #EBEBEB', borderRadius: '16px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Lag */}
          <div>
            <label style={labelStyle}>Lag</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {LAGAR.map(l => (
                <button key={l.lag} onClick={() => setLag(l.lag)}
                  style={{ padding: '8px 16px', borderRadius: '20px', border: '1px solid', fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s',
                    borderColor: lag === l.lag ? '#0A0A0C' : '#EBEBEB',
                    background: lag === l.lag ? '#0A0A0C' : '#fff',
                    color: lag === l.lag ? '#fff' : '#444' }}>
                  {l.short}
                </button>
              ))}
            </div>
          </div>

          {/* Ref */}
          <div>
            <label style={labelStyle}>Referens</label>
            <input value={ref} onChange={e => setRef(e.target.value)}
              placeholder="t.ex. IL 16 kap. 2 §"
              style={inputStyle} />
          </div>

          {/* Rubrik */}
          <div>
            <label style={labelStyle}>Rubrik</label>
            <input value={rubrik} onChange={e => setRubrik(e.target.value)}
              placeholder="t.ex. Representation — avdragsrätt"
              style={inputStyle} />
          </div>

          {/* Text */}
          <div>
            <label style={labelStyle}>Lagtext</label>
            <textarea value={text} onChange={e => setText(e.target.value)}
              placeholder="Klistra in lagtexten här — en paragraf eller ett ställningstagande..."
              rows={10}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7 }} />
            <div style={{ fontSize: '11px', color: '#CCC', marginTop: '6px' }}>
              {text.split(' ').filter(Boolean).length} ord · systemet delar automatiskt upp lång text i chunks
            </div>
          </div>

          {/* Button */}
          <button onClick={upload} disabled={status === 'loading' || !text.trim() || !ref.trim() || !rubrik.trim()}
            style={{ padding: '14px', background: status === 'loading' ? '#EEE' : '#0A0A0C', color: status === 'loading' ? '#AAA' : '#fff',
              border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 600, cursor: status === 'loading' ? 'default' : 'pointer', transition: 'background 0.15s' }}>
            {status === 'loading' ? 'Laddar upp och skapar vektorer...' : 'Ladda upp till regelindexet →'}
          </button>

          {status === 'done' && (
            <div style={{ fontSize: '13px', color: '#2A7A4B', background: '#F3FDF7', padding: '12px 16px', borderRadius: '8px' }}>
              ✓ Uppladdat! Paragrafen är nu sökbar i Normiq.
            </div>
          )}
          {status === 'error' && (
            <div style={{ fontSize: '13px', color: '#C0321A', background: '#FDF4F3', padding: '12px 16px', borderRadius: '8px' }}>
              Något gick fel. Kontrollera att alla fält är ifyllda och försök igen.
            </div>
          )}
        </div>

        {/* Guide */}
        <div style={{ marginTop: '32px', background: '#fff', border: '1px solid #EBEBEB', borderRadius: '16px', padding: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#444', marginBottom: '12px' }}>Var hittar jag lagtexterna?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: 'Inkomstskattelagen (IL)', url: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/inkomstskattelag-19991229_sfs-1999-1229/' },
              { label: 'Mervärdesskattelagen (ML)', url: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/mervardesskatteklag-20232_sfs-2023-200/' },
              { label: 'Skatteförfarandelagen (SFL)', url: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/skatteforfarandelag-20111244_sfs-2011-1244/' },
              { label: 'SKV Ställningstaganden', url: 'https://www.skatteverket.se/rattsinformation/stallningstaganden.4.html' },
            ].map(l => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '13px', color: '#C0321A', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                → {l.label}
              </a>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: '#AAA', marginBottom: '8px'
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px', fontSize: '14px', border: '1px solid #EBEBEB',
  borderRadius: '10px', outline: 'none', fontFamily: 'inherit', color: '#222',
  background: '#FAFAF8', boxSizing: 'border-box'
}