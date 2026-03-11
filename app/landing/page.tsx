'use client'

import { useState } from 'react'

export default function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [billingAnnual, setBillingAnnual] = useState(false)
  const [mockStep, setMockStep] = useState(0)

  const faqs = [
    { q: 'Ersätter Normiq en skattejurist?', a: 'Nej. Normiq är ett beslutsstöd som hjälper dig att hitta relevanta källor snabbare. Slutlig bedömning görs alltid av användaren. Normiq är byggt för att underlätta research och dokumentation — inte för att ersätta professionellt omdöme.' },
    { q: 'Vilka källor bygger Normiq på?', a: 'Normiq använder strukturerade regelkällor som lagtext (IL, ML, BFL, SFL, ABL), Skatteverkets vägledningar och normgivning från BFN. Källorna uppdateras löpande.' },
    { q: 'Hur skiljer sig Normiq från generell AI?', a: 'Generella AI-verktyg försöker formulera ett svar som låter rätt. Normiq hittar först relevanta källor, verifierar mot dem, och förklarar sedan vad de faktiskt säger. AI:n skriver inte svaren fritt — den förklarar källorna.' },
    { q: 'Kan jag använda Normiq i ett byråteam?', a: 'Ja. Pro-planen täcker upp till 10 användare och är designad för att team ska kunna arbeta konsekvent.' },
    { q: 'Vad händer med mina frågor och svar?', a: 'Frågor och svar loggas för spårbarhet i ditt arbetsflöde. Din data används inte för att träna externa AI-modeller.' },
  ]

  const mockChat = [
    { role: 'user', text: 'Får jag dra av en dator i mitt AB?' },
    { role: 'assistant', text: 'Ja, om datorn används i verksamheten är den avdragsgill som inventarie enligt [IL 16:1]. Hela kostnaden kan dras av direkt om den understiger 28 650 kr (2026), annars skrivs den av över 3–5 år.', sources: 'IL 16:1 · SKV A 2025:3', risk: 'LÅG' },
  ]

  return (
    <div style={{ background: '#F5F3EE', minHeight: '100vh', fontFamily: 'Georgia, serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .cg   { font-family: 'Cormorant Garamond', Georgia, serif; }
        .mono { font-family: 'DM Mono', monospace; }

        .label {
          font-family: 'DM Mono', monospace; font-size: 10px;
          letter-spacing: .16em; text-transform: uppercase; color: #C0321A;
          display: flex; align-items: center; gap: 10px; margin-bottom: 18px;
        }
        .label::before { content: ''; display: block; width: 24px; height: 1px; background: #C0321A; }

        .nav-link { font-family: 'DM Mono', monospace; font-size: 11px; color: #888; text-decoration: none; letter-spacing: .08em; text-transform: uppercase; transition: color .2s; }
        .nav-link:hover { color: #0A0A0C; }

        .btn-primary { display: inline-flex; align-items: center; gap: 8px; background: #0A0A0C; color: white; border: none; cursor: pointer; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: .09em; text-transform: uppercase; padding: 14px 28px; border-radius: 3px; text-decoration: none; transition: background .2s, transform .15s; }
        .btn-primary:hover { background: #C0321A; transform: translateY(-1px); }

        .btn-ghost { display: inline-flex; align-items: center; gap: 8px; background: transparent; color: #555; border: 1px solid #C8C4BC; cursor: pointer; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: .09em; text-transform: uppercase; padding: 14px 28px; border-radius: 3px; text-decoration: none; transition: all .2s; }
        .btn-ghost:hover { border-color: #0A0A0C; color: #0A0A0C; }

        .feature-card { background: white; border: 1px solid #E0DDD6; border-radius: 6px; padding: 30px 28px; transition: box-shadow .25s, transform .25s; }
        .feature-card:hover { box-shadow: 0 10px 36px rgba(0,0,0,.07); transform: translateY(-3px); }

        .price-card { background: white; border: 1px solid #E0DDD6; border-radius: 6px; padding: 36px 32px; position: relative; transition: box-shadow .2s; }
        .price-card.featured { border-color: #0A0A0C; border-width: 1.5px; }
        .price-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,.08); }

        .faq-item { border-bottom: 1px solid #E0DDD6; }
        .faq-btn { width: 100%; background: none; border: none; cursor: pointer; padding: 22px 0; display: flex; justify-content: space-between; align-items: center; text-align: left; }
        .faq-q { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 21px; color: #0A0A0C; line-height: 1.2; padding-right: 24px; transition: color .2s; }
        .faq-btn:hover .faq-q { color: #C0321A; }

        .audience-card { padding: 36px 32px; border-left: 2px solid #E0DDD6; transition: border-color .25s; }
        .audience-card:hover { border-color: #C0321A; }

        .toggle-pill { display: inline-flex; background: #E8E5DF; border-radius: 30px; padding: 4px; gap: 2px; }
        .toggle-opt { padding: 7px 18px; border-radius: 24px; border: none; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; transition: all .2s; background: transparent; color: #888; }
        .toggle-opt.active { background: white; color: #0A0A0C; box-shadow: 0 1px 4px rgba(0,0,0,.1); }

        .check-row { display: flex; gap: 14px; padding: 16px 20px; border-radius: 6px; }

        .flow-box { flex: 1; min-width: 148px; border: 1px solid #E0DDD6; border-radius: 6px; padding: 22px 18px; background: #F9F8F5; transition: border-color .2s; }
        .flow-box.accent { border-color: #C0321A; background: #FDF4F3; }
        .flow-num { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .1em; color: #CCC; margin-bottom: 10px; }
        .flow-num.accent { color: #C0321A; }
        .flow-title { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 17px; font-weight: 600; color: #0A0A0C; margin-bottom: 8px; line-height: 1.2; }
        .flow-desc { font-family: Georgia, serif; font-size: 13px; color: #666; line-height: 1.75; }
        .flow-arrow { font-family: 'DM Mono', monospace; color: #C0321A; font-size: 18px; padding: 0 8px; margin-top: 28px; flex-shrink: 0; }

        /* Mock chat */
        .mock-wrap { background: white; border: 1px solid #E0DDD6; border-radius: 14px; overflow: hidden; box-shadow: 0 24px 80px rgba(0,0,0,.12); max-width: 480px; width: 100%; }
        .mock-topbar { background: #F9F8F5; border-bottom: 1px solid #E0DDD6; padding: 14px 20px; display: flex; align-items: center; gap: 10px; }
        .mock-dot { width: 10px; height: 10px; border-radius: 50%; }
        .mock-messages { padding: 24px 20px; display: flex; flex-direction: column; gap: 16px; min-height: 240px; }
        .mock-user { display: flex; justify-content: flex-end; }
        .mock-user-bubble { background: #0A0A0C; color: white; font-family: 'Cormorant Garamond', serif; font-size: 18px; padding: 12px 18px; border-radius: 12px 12px 3px 12px; max-width: 80%; line-height: 1.35; }
        .mock-assistant { background: #FAFAF8; border: 1px solid #F0EDE6; border-radius: 4px 12px 12px 12px; overflow: hidden; }
        .mock-body { padding: 16px 18px; font-family: Georgia, serif; font-size: 14px; color: #333; line-height: 1.8; }
        .mock-ref { display: inline; color: #C0321A; font-family: 'DM Mono', monospace; font-size: 11px; border: 1px solid rgba(192,50,26,.25); padding: 2px 6px; border-radius: 3px; margin: 0 2px; }
        .mock-footer { border-top: 1px solid #F0EDE6; padding: 10px 18px; display: flex; align-items: center; justify-content: space-between; }
        .mock-sources { font-family: 'DM Mono', monospace; font-size: 10px; color: #BBB; }
        .mock-risk { font-family: 'DM Mono', monospace; font-size: 10px; color: #2E6644; display: flex; align-items: center; gap: 5px; }
        .mock-risk::before { content: ''; display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #2E6644; opacity: .7; }

        /* Source logos */
        .source-logo { font-family: 'DM Mono', monospace; font-size: 11px; color: #888; letter-spacing: .06em; padding: 8px 16px; border: 1px solid #E0DDD6; border-radius: 4px; background: white; white-space: nowrap; }

        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:none; } }
        @keyframes slideIn { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:none; } }
        .a1 { animation: fadeUp .65s both; }
        .a2 { animation: fadeUp .65s .12s both; }
        .a3 { animation: fadeUp .65s .24s both; }
        .a4 { animation: fadeUp .65s .36s both; }
        .a5 { animation: fadeUp .65s .48s both; }

        /* Grain overlay */
        .grain::after {
          content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 999;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
          opacity: .4;
        }
      `}</style>

      <div className="grain" />

      {/* ── NAV ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(245,243,238,.94)', backdropFilter: 'blur(14px)', borderBottom: '1px solid #E0DDD6', padding: '0 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', height: 64, gap: 40 }}>
          <a href="/" style={{ textDecoration: 'none' }}>
            <span className="cg" style={{ fontSize: 28, fontWeight: 600, color: '#0A0A0C', letterSpacing: '-.02em', lineHeight: 1 }}>
              normi<span style={{ color: '#C0321A' }}>q</span>
            </span>
          </a>
          <div style={{ flex: 1 }} />
          <a href="#hur-det-fungerar" className="nav-link">Hur det fungerar</a>
          <a href="#funktioner" className="nav-link">Funktioner</a>
          <a href="#priser" className="nav-link">Priser</a>
          <a href="#faq" className="nav-link">FAQ</a>
          <a href="/om-oss" className="nav-link">Om oss</a>
          <a href="/login" className="nav-link">Logga in</a>
          <a href="/register" className="btn-primary" style={{ padding: '10px 20px' }}>Testa gratis</a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '96px 48px 80px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
        <div>
          <div className="label a1">Söksystem för svenska skatte- och redovisningsregler</div>
          <h1 className="cg a2" style={{ fontSize: 'clamp(44px, 5.5vw, 78px)', lineHeight: .93, letterSpacing: '-.03em', color: '#0A0A0C', marginBottom: 26 }}>
            AI:n skriver inte svaren.{' '}
            <em style={{ color: '#C0321A', fontStyle: 'italic' }}>AI:n förklarar källorna.</em>
          </h1>
          <p className="a3" style={{ fontSize: 16, color: '#555', lineHeight: 1.85, marginBottom: 12, maxWidth: 480 }}>
            Ställ en fråga om skatt, moms eller redovisning. Få ett svar med exakta lagrum — inte gissningar.
          </p>
          <p className="a3" style={{ fontSize: 14, color: '#999', lineHeight: 1.8, marginBottom: 40, maxWidth: 440 }}>
            Byggt för redovisningsbyråer och skattejurister som behöver veta vad svaret bygger på.
          </p>
          <div className="a4" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 40 }}>
            <a href="/register" className="btn-primary">
              Testa gratis
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </a>
            <a href="mailto:hej@normiq.se" className="btn-ghost">Boka demo</a>
          </div>
          <div className="a4 mono" style={{ fontSize: 11, color: '#AAA', letterSpacing: '.05em', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span>✓ Källbaserade svar</span>
            <span style={{ color: '#DDD' }}>·</span>
            <span>✓ Riskklassning</span>
            <span style={{ color: '#DDD' }}>·</span>
            <span>✓ IL · ML · BFL · SFL</span>
          </div>
        </div>

        {/* CHAT MOCKUP */}
        <div className="a5" style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="mock-wrap">
            <div className="mock-topbar">
              <div className="mock-dot" style={{ background: '#E8C8C0' }} />
              <div className="mock-dot" style={{ background: '#E8DFC0' }} />
              <div className="mock-dot" style={{ background: '#C8D9C0' }} />
              <span className="mono" style={{ fontSize: 11, color: '#CCC', marginLeft: 8, letterSpacing: '.06em' }}>Normiq · Skatt & Redovisning</span>
            </div>
            <div className="mock-messages">
              <div className="mock-user">
                <div className="mock-user-bubble">Får jag dra av en dator i mitt AB?</div>
              </div>
              <div className="mock-assistant">
                <div className="mock-body">
                  Ja, om datorn används i verksamheten är den avdragsgill som inventarie enligt <span className="mock-ref">IL 16:1</span>. Kostnaden kan dras av direkt om den understiger 28 650 kr (2026), annars skrivs den av över 3–5 år enligt <span className="mock-ref">IL 18:4</span>.
                  <div style={{ marginTop: 12, padding: '12px 0 0', borderTop: '1px solid #F0EDE6' }}>
                    <div className="mono" style={{ fontSize: 12, color: '#555', lineHeight: 1.8 }}>
                      <strong style={{ color: '#0A0A0C' }}>Enkelt uttryckt:</strong> Köper du en dator för jobbet betalar bolaget — inte du privat. Spara kvittot och notera att den används i verksamheten. Om den även används privat kan förmånsvärde uppstå.
                    </div>
                  </div>
                </div>
                <div className="mock-footer">
                  <span className="mock-sources">IL 16:1 · IL 18:4 · SKV</span>
                  <span className="mock-risk">LÅG risk</span>
                </div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid #F0EDE6', padding: '12px 16px', background: '#FAFAF8', display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, background: 'white', border: '1px solid #E0DDD6', borderRadius: 8, padding: '10px 14px', fontFamily: 'Georgia, serif', fontSize: 14, color: '#CCC' }}>
                Skriv din fråga om skatt eller redovisning...
              </div>
              <div style={{ width: 40, height: 40, background: '#0A0A0C', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF / KÄLLOR ── */}
      <section style={{ borderTop: '1px solid #E0DDD6', borderBottom: '1px solid #E0DDD6', background: 'white', padding: '28px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span className="mono" style={{ fontSize: 10, color: '#CCC', letterSpacing: '.12em', textTransform: 'uppercase', marginRight: 8 }}>Bygger på</span>
          {['Inkomstskattelagen', 'Mervärdesskattelagen', 'Bokföringslagen', 'Skatteverket', 'BFN / BFNAR', 'Riksdagen'].map(s => (
            <div key={s} className="source-logo">{s}</div>
          ))}
        </div>
      </section>

      {/* ── PROBLEM ── */}
      <section style={{ padding: '88px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div>
            <div className="label">Problemet</div>
            <h2 className="cg" style={{ fontSize: 'clamp(30px, 3.5vw, 48px)', color: '#0A0A0C', marginBottom: 22, letterSpacing: '-.02em', lineHeight: 1.08 }}>
              När svaret måste gå att försvara räcker det inte att det låter rätt
            </h2>
            <p style={{ fontSize: 15, color: '#555', lineHeight: 1.9, marginBottom: 16 }}>
              Generella AI-verktyg formulerar svar som låter övertygande — men du kan inte se vad de bygger på. I skatte- och redovisningsfrågor är det ett problem.
            </p>
            <p style={{ fontSize: 15, color: '#999', lineHeight: 1.9 }}>
              Normiq visar källan <em>innan</em> det visar svaret.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'Formulerar ett svar som låter rätt — utan källhänvisning.',
              'Du kan inte se om svaret bygger på lagtext eller träningsdata.',
              'Ingen riskbedömning — alla svar presenteras med samma säkerhet.',
            ].map((text, i) => (
              <div key={i} className="check-row" style={{ background: 'white', border: '1px solid #E0DDD6' }}>
                <span style={{ color: '#C0321A', flexShrink: 0, fontFamily: 'DM Mono, monospace', fontSize: 13 }}>✕</span>
                <span style={{ fontSize: 14, color: '#555', lineHeight: 1.7 }}>{text}</span>
              </div>
            ))}
            <div style={{ height: 4 }} />
            {[
              'Normiq visar vilket lagrum svaret bygger på.',
              'Riskklassning görs mot källorna — innan AI:n svarar.',
              'Klicka direkt till originaltexten och verifiera själv.',
            ].map((text, i) => (
              <div key={i} className="check-row" style={{ background: '#F0F7F3', border: '1px solid #D4EBE0' }}>
                <span style={{ color: '#3A7A52', flexShrink: 0, fontFamily: 'DM Mono, monospace', fontSize: 13 }}>✓</span>
                <span style={{ fontSize: 14, color: '#333', lineHeight: 1.7 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EXEMPEL ── */}
      <section style={{ background: '#0A0A0C', padding: '88px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="label" style={{ color: '#C0321A' }}>
            <span style={{ background: '#C0321A', width: 24, height: 1, display: 'block' }} />
            Så här ser ett svar ut
          </div>
          <h2 className="cg" style={{ fontSize: 'clamp(30px, 3.5vw, 48px)', color: 'white', marginBottom: 48, letterSpacing: '-.02em' }}>
            Varje svar innehåller lagrum, förklaring och riskbedömning
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {[
              {
                q: 'Hur mycket lågbeskattad utdelning kan jag ta enligt 3:12?',
                a: 'Utdelning upp till gränsbeloppet beskattas med 20 % i kapital. Gränsbeloppet består av upp till fyra delar: (1) Grundbelopp: 4 IBB = 322 400 kr (2026). (2) Lönebaserat utrymme: 50 % av löner över 8 IBB (644 800 kr). (3) Sparat utdelningsutrymme från tidigare år. (4) Ränta på omkostnadsbelopp överstigande 100 000 kr (statslåneränta + 9 %). Utdelning över gränsbeloppet beskattas som tjänst.',
                simplified: 'Du kan ta ut lågbeskattad utdelning (20 %) upp till ditt gränsbelopp. Grundbeloppet är 322 400 kr (2026) — det får alla kvalificerade ägare. Har bolaget höga löner kan du lägga till 50 % av löner som överstiger 644 800 kr. Har du inte tagit hela utrymmet tidigare år rullar det med. Du måste ha ägt aktierna vid årets ingång och utdelningen beslutas på stämman.',
                sources: 'IL 57:11 · IL 57:19 · IL 57:20',
                risk: 'HÖG',
                riskColor: '#A02818',
              },
              {
                q: 'Vad gäller för representation avseende moms?',
                a: 'Momsavdrag för representation medges på underlag om högst 300 kr per person. Mat: avdrag med 12 % = max 36 kr/person. Alkohol: avdrag med 25 % = max 75 kr/person. Ingår både mat och alkohol kan du i stället använda schablonen: 46 kr per person och tillfälle, förutsatt att kostnaden överstiger 300 kr exkl. moms per person och att momsen uppgår till minst 46 kr per person.',
                simplified: 'Du kan dra av momsen på representation upp till 300 kr per person i underlag — mat med 12 % (max 36 kr) och alkohol med 25 % (max 75 kr). Finns båda i måltiden är schablonen enklast: 46 kr per person, om kostnaden är över 300 kr och momsen minst 46 kr. Dokumentera alltid vilka som deltog och affärssyftet.',
                sources: 'ML 8:9 · SKV A 2025:2',
                risk: 'MEDEL',
                riskColor: '#7A6010',
              },
            ].map((ex, i) => (
              <div key={i} style={{ background: 'white', borderRadius: 8, overflow: 'hidden', border: '1px solid #2a2a2c' }}>
                <div style={{ padding: '20px 24px', background: '#111113', borderBottom: '1px solid #2a2a2c' }}>
                  <div className="cg" style={{ fontSize: 20, color: 'white', lineHeight: 1.3 }}>{ex.q}</div>
                </div>
                <div style={{ padding: '20px 24px 0' }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: '#333', lineHeight: 1.8, marginBottom: 16 }}>{ex.a}</div>
                  <div style={{ background: '#FAFAF8', border: '1px solid #F0EDE6', borderRadius: 6, padding: '14px 16px', marginBottom: 16 }}>
                    <div className="mono" style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#999', marginBottom: 6 }}>Enkelt uttryckt</div>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#444', lineHeight: 1.8 }}>{ex.simplified}</div>
                  </div>
                </div>
                <div style={{ padding: '12px 24px', borderTop: '1px solid #F0EDE6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="mono" style={{ fontSize: 10, color: '#C0321A' }}>{ex.sources}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: ex.riskColor, opacity: .7, display: 'inline-block' }} />
                    <span className="mono" style={{ fontSize: 10, color: '#AAA' }}>{ex.risk}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HUR DET FUNGERAR ── */}
      <section id="hur-det-fungerar" style={{ background: 'white', borderTop: '1px solid #E0DDD6', borderBottom: '1px solid #E0DDD6', padding: '88px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="label">Hur det fungerar</div>
          <h2 className="cg" style={{ fontSize: 'clamp(34px, 4vw, 54px)', color: '#0A0A0C', marginBottom: 14, letterSpacing: '-.02em' }}>Från fråga till verifierbart svar</h2>
          <p style={{ fontSize: 15, color: '#666', lineHeight: 1.85, maxWidth: 520, marginBottom: 56 }}>Källorna hittas och riskklassas innan AI:n formulerar ett enda ord.</p>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>
            {[
              { num: '01', title: 'Din fråga', desc: 'Du ställer en fråga om skatt, moms eller redovisning.', accent: false },
              { num: '02', title: 'Retrieval', desc: 'Normiq söker i strukturerade regelkällor och identifierar relevanta lagrum.', accent: false },
              { num: '03', title: 'Riskklassning', desc: 'Frågan och källorna bedöms — LÅG, MEDEL eller HÖG — innan AI:n anropas.', accent: true },
              { num: '04', title: 'AI förklarar', desc: 'AI:n sammanfattar vad källorna faktiskt säger. Inte fritt — bara källorna.', accent: false },
              { num: '05', title: 'Verifierat svar', desc: 'Du får lagrum, riskbedömning och länk till originaltexten.', accent: false },
            ].map((step, i, arr) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 152 }}>
                <div className={`flow-box ${step.accent ? 'accent' : ''}`}>
                  <div className={`flow-num ${step.accent ? 'accent' : ''}`}>{step.num}</div>
                  <div className="flow-title">{step.title}</div>
                  <div className="flow-desc">{step.desc}</div>
                </div>
                {i < arr.length - 1 && <div className="flow-arrow">→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="funktioner" style={{ padding: '88px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <div className="label">Funktioner</div>
        <h2 className="cg" style={{ fontSize: 'clamp(32px, 3.5vw, 50px)', color: '#0A0A0C', marginBottom: 12, letterSpacing: '-.02em' }}>Det du behöver för att arbeta snabbare och säkrare</h2>
        <p style={{ fontSize: 14, color: '#888', marginBottom: 52, maxWidth: 480, lineHeight: 1.85 }}>Varje funktion är byggd för professionella team som arbetar med kvalitet varje dag.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { icon: '§', title: 'Källbaserade svar', desc: 'Varje svar hänvisar till det lagrum det bygger på. Du ser alltid var svaret kommer ifrån.' },
            { icon: '◈', title: 'Riskklassning före svar', desc: 'Frågan bedöms mot källorna innan AI:n svarar. LÅG, MEDEL eller HÖG — med motivering.' },
            { icon: '▦', title: 'Auditlogg', desc: 'Frågor, svar och källor sparas automatiskt för spårbarhet och intern dokumentation.' },
            { icon: '↗', title: 'Klickbara lagrum', desc: 'Gå direkt till originaltexten när du vill verifiera. Varje lagrum är länkat.' },
            { icon: '⟳', title: 'Levande regelindex', desc: 'Strukturerat index över IL, ML, BFL, SFL, ABL och SKV-material. Uppdateras löpande.' },
            { icon: '⊞', title: 'Byggt för team', desc: 'Konsekvent kvalitet och spårbarhet oavsett vem i teamet som ställer frågan.' },
          ].map((f, i) => (
            <div key={i} className="feature-card">
              <div className="mono" style={{ fontSize: 20, color: '#C0321A', marginBottom: 14 }}>{f.icon}</div>
              <div className="cg" style={{ fontSize: 21, fontWeight: 600, color: '#0A0A0C', marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 14, color: '#666', lineHeight: 1.8 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRISER ── */}
      <section id="priser" style={{ background: 'white', borderTop: '1px solid #E0DDD6', borderBottom: '1px solid #E0DDD6', padding: '88px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="label">Priser</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 52, flexWrap: 'wrap', gap: 20 }}>
            <h2 className="cg" style={{ fontSize: 'clamp(30px, 3.5vw, 48px)', color: '#0A0A0C', letterSpacing: '-.02em' }}>Enkel prissättning för byråer och ekonomiteam</h2>
            <div className="toggle-pill">
              <button className={`toggle-opt ${!billingAnnual ? 'active' : ''}`} onClick={() => setBillingAnnual(false)}>Månadsvis</button>
              <button className={`toggle-opt ${billingAnnual ? 'active' : ''}`} onClick={() => setBillingAnnual(true)}>
                Årsvis <span style={{ color: '#3A7A52', marginLeft: 4 }}>−20%</span>
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {[
              {
                name: 'Starter',
                price: billingAnnual ? '392' : '490',
                desc: 'För dig som vill testa Normiq i praktiken.',
                features: ['1 användare', 'Källbaserade svar', 'Riskklassning', 'Auditlogg', 'Klickbara lagrum'],
                cta: 'Kom igång gratis',
                href: '/register?plan=starter',
                featured: false,
              },
              {
                name: 'Pro',
                price: billingAnnual ? '1 592' : '1 990',
                desc: 'För byråer och team som vill använda Normiq i vardagen.',
                features: ['Upp till 10 användare', 'Allt i Starter', 'Teamhistorik', 'Prioriterad support', 'Exportera svar som PDF'],
                cta: 'Starta Pro',
                href: '/register?plan=pro',
                featured: true,
              },
              {
                name: 'Enterprise',
                price: 'Offert',
                desc: 'För större organisationer med krav på integration och säkerhet.',
                features: ['Obegränsade användare', 'Allt i Pro', 'SSO / SAML', 'Dataisolering', 'SLA och dedikerad support'],
                cta: 'Kontakta oss',
                href: 'mailto:hej@normiq.se',
                featured: false,
              },
            ].map((plan, i) => (
              <div key={i} className={`price-card ${plan.featured ? 'featured' : ''}`}>
                {plan.featured && (
                  <div className="mono" style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', background: '#0A0A0C', color: 'white', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: '0 0 5px 5px' }}>
                    Mest populär
                  </div>
                )}
                <div className="mono" style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#999', marginBottom: 8 }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 10 }}>
                  <span className="cg" style={{ fontSize: 46, fontWeight: 300, color: '#0A0A0C', letterSpacing: '-.02em', lineHeight: 1 }}>{plan.price}</span>
                  {plan.price !== 'Offert' && <span style={{ fontSize: 14, color: '#AAA' }}>kr/mån</span>}
                </div>
                <div style={{ fontSize: 14, color: '#888', lineHeight: 1.7, marginBottom: 28, minHeight: 44 }}>{plan.desc}</div>
                <div style={{ borderTop: '1px solid #F0EDE6', paddingTop: 24, marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {plan.features.map((f, fi) => (
                    <div key={fi} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ color: '#3A7A52', flexShrink: 0, fontFamily: 'DM Mono, monospace', fontSize: 11, marginTop: 2 }}>✓</span>
                      <span style={{ fontSize: 13, color: '#444', lineHeight: 1.55 }}>{f}</span>
                    </div>
                  ))}
                </div>
                <a href={plan.href} className={plan.featured ? 'btn-primary' : 'btn-ghost'} style={{ width: '100%', justifyContent: 'center' }}>
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
          <p className="mono" style={{ fontSize: 11, color: '#CCC', textAlign: 'center', marginTop: 24 }}>
            Alla planer inkluderar 14 dagars gratis testperiod. Inget kreditkort krävs för att komma igång.
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ padding: '88px 48px', maxWidth: 760, margin: '0 auto' }}>
        <div className="label">Vanliga frågor</div>
        <h2 className="cg" style={{ fontSize: 'clamp(32px, 3.5vw, 50px)', color: '#0A0A0C', marginBottom: 48, letterSpacing: '-.02em' }}>FAQ</h2>
        <div style={{ borderTop: '1px solid #E0DDD6' }}>
          {faqs.map((faq, i) => (
            <div key={i} className="faq-item">
              <button className="faq-btn" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <span className="faq-q">{faq.q}</span>
                <span style={{ color: '#C0321A', flexShrink: 0, fontFamily: 'DM Mono, monospace', fontSize: 20, transition: 'transform .2s', display: 'inline-block', transform: openFaq === i ? 'rotate(45deg)' : 'none' }}>+</span>
              </button>
              {openFaq === i && <div style={{ fontSize: 14, color: '#555', lineHeight: 1.95, paddingBottom: 24 }}>{faq.a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: '#0A0A0C', padding: '96px 48px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#C0321A', marginBottom: 22 }}>Kom igång idag</div>
          <h2 className="cg" style={{ fontSize: 'clamp(36px, 4vw, 62px)', color: 'white', marginBottom: 18, letterSpacing: '-.025em', lineHeight: 1.03 }}>
            Redo att arbeta med källhänvisning i varje svar?
          </h2>
          <p style={{ fontSize: 15, color: '#666', lineHeight: 1.85, marginBottom: 44 }}>
            Testa Normiq utan kostnad i 14 dagar. Ingen betalningsinformation krävs.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/register" className="btn-primary">Testa gratis — 14 dagar</a>
            <a href="mailto:hej@normiq.se" className="btn-ghost" style={{ borderColor: '#333', color: '#666' }}>Boka demo</a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid #1a1a1c', padding: '32px 48px', background: '#0A0A0C' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <span className="cg" style={{ fontSize: 26, fontWeight: 600, color: 'white', letterSpacing: '-.02em' }}>
            normi<span style={{ color: '#C0321A' }}>q</span>
          </span>
          <div className="mono" style={{ fontSize: 11, color: '#444', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <a href="/om-oss" style={{ color: '#444', textDecoration: 'none' }}>Om oss</a>
            <a href="/login" style={{ color: '#444', textDecoration: 'none' }}>Logga in</a>
            <a href="mailto:hej@normiq.se" style={{ color: '#444', textDecoration: 'none' }}>Kontakt</a>
            <a href="/privacy" style={{ color: '#444', textDecoration: 'none' }}>Integritetspolicy</a>
            <span>© 2026 Normiq</span>
          </div>
          <div className="mono" style={{ fontSize: 10, color: '#333', letterSpacing: '.04em' }}>Konsultera alltid en skatteexpert.</div>
        </div>
      </footer>
    </div>
  )
}