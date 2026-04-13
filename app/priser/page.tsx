'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function PricingContent() {
  const [billingAnnual, setBillingAnnual] = useState(false)
  const [loading, setLoading]             = useState<'monthly' | 'yearly' | null>(null)
  const [userId, setUserId]               = useState<string | null>(null)
  const [subStatus, setSubStatus]         = useState<string>('free')
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single()
      if (data?.subscription_status) setSubStatus(data.subscription_status)
    }
    load()
  }, [])

  async function handleCheckout(plan: 'monthly' | 'yearly') {
    if (!userId) { window.location.href = '/register?redirect=priser'; return }
    setLoading(plan)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ plan }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch { setLoading(null) }
  }

  async function handlePortal() {
    if (!userId) return
    setLoading('monthly')
    const res = await fetch('/api/stripe/portal', {
      method: 'POST',
      headers: { 'x-user-id': userId },
    })
    const { url } = await res.json()
    if (url) window.location.href = url
    setLoading(null)
  }

  const isActive = subStatus === 'active' || subStatus === 'trialing'
  const cancelled = searchParams.get('checkout') === 'cancelled'

  return (
    <div style={{ minHeight: '100vh', background: '#F5F3EE', fontFamily: 'Georgia, serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .cg { font-family: 'Cormorant Garamond', Georgia, serif; }
        .mono { font-family: 'DM Mono', monospace; }
        .toggle-pill { display: inline-flex; background: #E8E5DF; border-radius: 30px; padding: 4px; gap: 2px; }
        .toggle-opt { padding: 7px 18px; border-radius: 24px; border: none; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; transition: all .2s; background: transparent; color: #888; }
        .toggle-opt.active { background: white; color: #0A0A0C; box-shadow: 0 1px 4px rgba(0,0,0,.1); }
        .btn { width: 100%; padding: 14px; border: none; border-radius: 6px; font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: .1em; text-transform: uppercase; cursor: pointer; transition: background .2s; }
      `}</style>

      {/* Nav */}
      <nav style={{ background: 'white', borderBottom: '1px solid #E0DDD6', padding: '0 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/landing" style={{ textDecoration: 'none' }}>
            <span className="cg" style={{ fontSize: 26, fontWeight: 600, color: '#0A0A0C' }}>
              normi<span style={{ color: '#C0321A' }}>q</span>
            </span>
          </a>
          {userId ? (
            <a href="/app" style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#888', textDecoration: 'none', letterSpacing: '.08em', textTransform: 'uppercase' }}>← Till appen</a>
          ) : (
            <a href="/login" style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#888', textDecoration: 'none', letterSpacing: '.08em', textTransform: 'uppercase' }}>Logga in</a>
          )}
        </div>
      </nav>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '64px 24px' }}>

        {cancelled && (
          <div style={{ background: '#FEF9EC', border: '1px solid rgba(122,96,16,.2)', borderRadius: 8, padding: '14px 20px', marginBottom: 32, fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#7A6010' }}>
            Checkout avbruten — du debiterades inte.
          </div>
        )}

        {isActive && (
          <div style={{ background: '#EFF6F2', border: '1px solid #BFD9CC', borderRadius: 8, padding: '20px 24px', marginBottom: 32 }}>
            <div className="mono" style={{ fontSize: 11, color: '#2E6644', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              {subStatus === 'trialing' ? '14 dagars testperiod aktiv' : 'Aktiv prenumeration'}
            </div>
            <p style={{ fontSize: 14, color: '#2E6644', lineHeight: 1.7, marginBottom: 16 }}>
              {subStatus === 'trialing'
                ? 'Du testar Normiq gratis. Ingen betalning sker förrän testperioden är slut.'
                : 'Din Normiq Solo-prenumeration är aktiv.'}
            </p>
            <button onClick={handlePortal} style={{ background: '#2E6644', color: 'white', border: 'none', borderRadius: 5, padding: '10px 20px', fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Hantera prenumeration →
            </button>
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#C0321A', marginBottom: 12 }}>Priser</div>
          <h1 className="cg" style={{ fontSize: 'clamp(36px, 5vw, 52px)', color: '#0A0A0C', marginBottom: 12, letterSpacing: '-.02em' }}>Normiq Solo</h1>
          <p style={{ fontSize: 15, color: '#888', lineHeight: 1.7, marginBottom: 28 }}>14 dagars gratis testperiod. Inget kreditkort krävs.</p>
          <div className="toggle-pill">
            <button className={`toggle-opt ${!billingAnnual ? 'active' : ''}`} onClick={() => setBillingAnnual(false)}>Månadsvis</button>
            <button className={`toggle-opt ${billingAnnual ? 'active' : ''}`} onClick={() => setBillingAnnual(true)}>
              Årsvis <span style={{ color: '#3A7A52', marginLeft: 4 }}>−17%</span>
            </button>
          </div>
        </div>

        {/* Priskort */}
        <div style={{ background: 'white', border: '1.5px solid #0A0A0C', borderRadius: 10, padding: '40px 36px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
            <span className="cg" style={{ fontSize: 64, fontWeight: 300, color: '#0A0A0C', letterSpacing: '-.02em', lineHeight: 1 }}>
              {billingAnnual ? '124' : '149'}
            </span>
            <span className="mono" style={{ fontSize: 13, color: '#AAA' }}>kr/mån</span>
          </div>
          {billingAnnual && (
            <div className="mono" style={{ fontSize: 11, color: '#AAA', marginBottom: 6 }}>1 490 kr/år — sparar 298 kr</div>
          )}
          <div style={{ fontSize: 14, color: '#888', marginBottom: 28, lineHeight: 1.7 }}>
            1 användare · Allt ingår · Avsluta när som helst
          </div>

          <div style={{ borderTop: '1px solid #F0EDE6', paddingTop: 24, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              'Advisor — källbaserade svar med lagrum',
              'Tax Brain — transaktionsanalys',
              'Kvittoscanning med Claude Vision',
              'Riskklassning per fråga',
              'Klickbara lagrum direkt till källan',
              'Kunskapsbibliotek',
              'Nattlig källuppdatering (IL, ML, BFL, SFL, ABL)',
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ color: '#3A7A52', flexShrink: 0, fontFamily: 'DM Mono, monospace', fontSize: 12, marginTop: 1 }}>✓</span>
                <span style={{ fontSize: 14, color: '#333', lineHeight: 1.5 }}>{f}</span>
              </div>
            ))}
          </div>

          {!isActive ? (
            <button
              onClick={() => handleCheckout(billingAnnual ? 'yearly' : 'monthly')}
              disabled={!!loading}
              className="btn"
              style={{ background: loading ? '#CCC' : '#0A0A0C', color: 'white' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#C0321A' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#0A0A0C' }}>
              {loading ? 'Laddar...' : 'Starta gratis testperiod →'}
            </button>
          ) : (
            <button onClick={handlePortal} className="btn" style={{ background: '#F5F3EE', color: '#555', border: '1px solid #E0DDD6' }}>
              Hantera prenumeration →
            </button>
          )}

          <p className="mono" style={{ fontSize: 10, color: '#CCC', textAlign: 'center', marginTop: 14 }}>
            Inget kreditkort krävs för testperioden · Avsluta när som helst
          </p>
        </div>

        <p style={{ textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#AAA' }}>
          Team eller byrå? <a href="mailto:hej@normiq.se" style={{ color: '#C0321A', textDecoration: 'none' }}>Kontakta oss</a>
        </p>
      </div>
    </div>
  )
}

export default function PricingPage() {
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  )
}