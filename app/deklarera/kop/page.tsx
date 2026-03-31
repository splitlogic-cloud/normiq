'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// ─── Villkorsgodkännande ──────────────────────────────────────
// Visas INNAN betalning genomförs.
// Alla fyra checkboxar måste bockas i — annars är köpknappen låst.
// ─────────────────────────────────────────────────────────────

const TERMS = [
  {
    id: 'tool',
    text: 'Jag förstår att SkattAI är ett beräkningsverktyg och inte ersätter en behörig redovisningskonsult eller revisor.',
  },
  {
    id: 'responsibility',
    text: 'Jag ansvarar fullt ut för att kontrollera att den genererade SRU-filen är korrekt innan jag lämnar in deklarationen till Skatteverket.',
  },
  {
    id: 'liability',
    text: 'Jag förstår att Normiq AB inte ansvarar för skatter, avgifter, skattetillägg eller räntor som uppkommer till följd av felaktiga uppgifter.',
  },
  {
    id: 'terms',
    text: (
      <>
        Jag har läst och accepterar{' '}
        <a
          href="/villkor"
          target="_blank"
          rel="noopener"
          style={{ color: '#C0392B', textDecoration: 'underline' }}
        >
          Normiq:s användarvillkor för SkattAI
        </a>
        .
      </>
    ),
  },
]

// Priser — anpassa efter din Stripe-konfiguration
const PLANS = [
  {
    id: 'single',
    name: 'Enskild deklaration',
    description: 'En NE-deklaration för inkomstår 2025',
    price: 495,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_SINGLE || '',
    features: ['1 SIE-filsimport', 'Fullständig NE-beräkning', 'SRU-export', 'PDF-underlag', '30 dagars historik'],
    badge: null,
  },
  {
    id: 'bureau',
    name: 'Byrå',
    description: 'Obegränsat antal klienter',
    price: 2950,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUREAU || '',
    per: 'per år',
    features: ['Obegränsat antal deklarationer', 'Alla klienters historik sparas', 'Prioriterad support', 'Tidig åtkomst till nya blanketter'],
    badge: 'Populärast',
  },
]

export default function DeklareraPricingPage() {
  const router = useRouter()
  const [accepted, setAccepted] = useState<Record<string, boolean>>({})
  const [selectedPlan, setSelectedPlan] = useState<string>('single')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allAccepted = TERMS.every(t => accepted[t.id])
  const toggleTerm = (id: string) => setAccepted(prev => ({ ...prev, [id]: !prev[id] }))

  const handleCheckout = async () => {
    if (!allAccepted) return
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login?redirect=/deklarera/kop'); return }

      const plan = PLANS.find(p => p.id === selectedPlan)
      if (!plan) return

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: plan.priceId,
          successUrl: `${window.location.origin}/deklarera?activated=true`,
          cancelUrl: `${window.location.origin}/deklarera/kop`,
          metadata: {
            plan: plan.id,
            termsAcceptedAt: new Date().toISOString(),
            termsVersion: '1.0',
          },
        }),
      })

      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError('Kunde inte starta betalning. Försök igen.')
      }
    } catch {
      setError('Ett fel uppstod. Kontakta hej@normiq.se om problemet kvarstår.')
    }

    setLoading(false)
  }

  const s = {
    page: { minHeight: '100vh', background: '#F5F0E8', fontFamily: "'Inter', system-ui, sans-serif" },
    nav: { background: '#fff', borderBottom: '1px solid #DDD8CF', height: 52, display: 'flex', alignItems: 'center', padding: '0 28px', position: 'sticky' as const, top: 0, zIndex: 100 },
    logo: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, fontWeight: 700, color: '#1A1A18' },
    logoSpan: { color: '#C0392B' },
    wrap: { maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' },
    eyebrow: { fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: '#C0392B', marginBottom: 8 },
    title: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 38, fontWeight: 700, color: '#1A1A18', lineHeight: 1.15, marginBottom: 10 },
    sub: { fontSize: 14, color: '#6A6660', lineHeight: 1.65, marginBottom: 36, maxWidth: 520 },

    // Plans
    plansRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 },
    plan: (active: boolean): React.CSSProperties => ({
      background: '#fff', border: `2px solid ${active ? '#1A1A18' : '#DDD8CF'}`, borderRadius: 4,
      padding: '20px 22px', cursor: 'pointer', position: 'relative', transition: 'border-color .15s',
    }),
    planBadge: { position: 'absolute' as const, top: -10, right: 16, background: '#1A1A18', color: '#fff', fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '3px 10px', letterSpacing: '.08em' },
    planName: { fontSize: 15, fontWeight: 600, color: '#1A1A18', marginBottom: 4 },
    planDesc: { fontSize: 12, color: '#6A6660', marginBottom: 12 },
    planPrice: { fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: '#1A1A18' },
    planPriceSub: { fontSize: 12, color: '#9A9690', marginLeft: 6 },
    planFeature: { display: 'flex', gap: 7, fontSize: 12, color: '#3A3832', marginTop: 6, alignItems: 'flex-start' },
    planCheck: { color: '#2D6A4F', flexShrink: 0, marginTop: 1 },

    // Terms
    termsBox: { background: '#fff', border: '1px solid #DDD8CF', borderRadius: 4, marginBottom: 24, overflow: 'hidden' },
    termsHeader: { padding: '12px 16px', background: '#EDE8DF', borderBottom: '1px solid #DDD8CF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    termsTitle: { fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: '#6A6660' },
    termsBadge: (ok: boolean): React.CSSProperties => ({
      fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '2px 8px', letterSpacing: '.06em',
      background: ok ? '#EFF7F2' : '#FDF0EE', color: ok ? '#2D6A4F' : '#C0392B',
      border: `1px solid ${ok ? '#B7D9C8' : '#E8C4BF'}`,
    }),
    termRow: { display: 'flex', gap: 12, padding: '13px 16px', borderBottom: '1px solid #DDD8CF', alignItems: 'flex-start', cursor: 'pointer' },
    termRowLast: { display: 'flex', gap: 12, padding: '13px 16px', alignItems: 'flex-start', cursor: 'pointer' },
    termCheck: { width: 18, height: 18, flexShrink: 0, cursor: 'pointer', accentColor: '#1A1A18', marginTop: 1 },
    termText: { fontSize: 13, color: '#1A1A18', lineHeight: 1.55 },

    // Disclaimer
    disc: { background: '#FDF5E6', border: '1px solid #E8D4A0', borderRadius: 2, padding: '10px 14px', fontSize: 12, color: '#92620A', lineHeight: 1.65, marginBottom: 24 },

    // Button
    btn: (disabled: boolean): React.CSSProperties => ({
      width: '100%', padding: '14px 20px',
      background: disabled ? '#EDE8DF' : '#1A1A18',
      color: disabled ? '#9A9690' : '#fff',
      border: 'none', fontSize: 14, fontWeight: 500,
      cursor: disabled ? 'not-allowed' : 'pointer',
      borderRadius: 2, fontFamily: 'inherit',
      transition: 'background .15s', letterSpacing: '.02em',
    }),
    btnHint: { textAlign: 'center' as const, fontSize: 11, color: '#9A9690', marginTop: 10, fontFamily: 'DM Mono, monospace', letterSpacing: '.06em' },
    error: { background: '#FDF0EE', border: '1px solid #E8C4BF', borderRadius: 2, padding: '10px 14px', fontSize: 12, color: '#C0392B', marginTop: 12 },
  }

  return (
    <div style={s.page}>
      {/* Nav */}
      <nav style={s.nav}>
        <div style={s.logo}>Normiq <span style={s.logoSpan}>Deklarera</span></div>
      </nav>

      <div style={s.wrap}>
        <div style={s.eyebrow}>Normiq · Blankett NE · Taxeringsår 2026</div>
        <h1 style={s.title}>Aktivera SkattAI</h1>
        <p style={s.sub}>
          Ladda upp din SIE-fil och generera en komplett NE-deklaration med SRU-export.
          Välj plan och godkänn villkoren för att komma igång.
        </p>

        {/* Plans */}
        <div style={s.plansRow}>
          {PLANS.map(plan => (
            <div
              key={plan.id}
              style={s.plan(selectedPlan === plan.id)}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {plan.badge && <div style={s.planBadge}>{plan.badge}</div>}
              <div style={s.planName}>{plan.name}</div>
              <div style={s.planDesc}>{plan.description}</div>
              <div>
                <span style={s.planPrice}>{plan.price.toLocaleString('sv-SE')} kr</span>
                {plan.per && <span style={s.planPriceSub}>{plan.per}</span>}
              </div>
              <div style={{ marginTop: 14 }}>
                {plan.features.map(f => (
                  <div key={f} style={s.planFeature}>
                    <span style={s.planCheck}>✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Terms */}
        <div style={s.termsBox}>
          <div style={s.termsHeader}>
            <div style={s.termsTitle}>Obligatoriskt godkännande — alla fyra måste bockas i</div>
            <div style={s.termsBadge(allAccepted)}>
              {Object.values(accepted).filter(Boolean).length}/{TERMS.length} godkända
            </div>
          </div>
          {TERMS.map((term, i) => (
            <div
              key={term.id}
              style={i < TERMS.length - 1 ? s.termRow : s.termRowLast}
              onClick={() => toggleTerm(term.id)}
            >
              <input
                type="checkbox"
                checked={!!accepted[term.id]}
                onChange={() => toggleTerm(term.id)}
                style={s.termCheck}
              />
              <div style={s.termText}>{term.text}</div>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div style={s.disc}>
          ⚠ SkattAI genererar ett deklarationsunderlag baserat på din SIE-fil och de uppgifter du anger.
          Kommunalskatt används som schablonsats (32,0%). Alla beräkningar bör granskas innan inlämning till Skatteverket.
          Vid komplexa skattefrågor — anlita en behörig redovisningskonsult.
        </div>

        {/* CTA */}
        <button
          style={s.btn(!allAccepted || loading)}
          onClick={handleCheckout}
          disabled={!allAccepted || loading}
        >
          {loading
            ? 'Startar betalning...'
            : !allAccepted
              ? `Godkänn alla ${TERMS.length} villkor för att fortsätta`
              : `Betala ${PLANS.find(p => p.id === selectedPlan)?.price.toLocaleString('sv-SE')} kr — säker betalning via Stripe`}
        </button>

        {!allAccepted && (
          <div style={s.btnHint}>
            {TERMS.length - Object.values(accepted).filter(Boolean).length} av {TERMS.length} villkor kvarstår
          </div>
        )}

        {error && <div style={s.error}>{error}</div>}

        <div style={{ textAlign: 'center', marginTop: 28, fontSize: 11, color: '#9A9690', fontFamily: 'DM Mono, monospace', lineHeight: 1.8, letterSpacing: '.04em' }}>
          Betalning hanteras av Stripe · Inga kortuppgifter lagras av Normiq<br />
          Frågor? hej@normiq.se
        </div>
      </div>
    </div>
  )
}
