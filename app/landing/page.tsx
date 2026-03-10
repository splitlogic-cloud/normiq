'use client'

import { useState } from 'react'

export default function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [billingAnnual, setBillingAnnual] = useState(false)

  const faqs = [
    {
      q: 'Ersätter Normiq en skattejurist?',
      a: 'Nej. Normiq är ett beslutsstöd som hjälper dig att hitta relevanta källor snabbare. Slutlig bedömning görs alltid av användaren. Normiq är byggt för att underlätta research och dokumentation — inte för att ersätta professionellt omdöme.',
    },
    {
      q: 'Vilka källor bygger Normiq på?',
      a: 'Normiq är byggt för svenska skatte- och redovisningsfrågor och använder strukturerade regelkällor som lagtext (IL, ML, BFL, SFL, ABL), Skatteverkets vägledningar och normgivning från BFN. Källorna uppdateras löpande.',
    },
    {
      q: 'Hur skiljer sig Normiq från generell AI?',
      a: 'Generella AI-verktyg försöker formulera ett svar som låter rätt. Normiq hittar först relevanta källor, verifierar mot dem, och förklarar sedan vad de faktiskt säger. AI:n skriver inte svaren fritt — den förklarar källorna.',
    },
    {
      q: 'Kan jag använda Normiq i ett byråteam?',
      a: 'Ja. Pro-planen täcker upp till 10 användare och är designad för att team ska kunna arbeta konsekvent. Enterprise-planen är anpassad för större organisationer med högre krav på integration och styrning.',
    },
    {
      q: 'Vad händer med mina frågor och svar?',
      a: 'Frågor och svar loggas för att skapa spårbarhet i ditt eget arbetsflöde. Din data används inte för att träna externa AI-modeller. Enterprise-planer kan förhandla ytterligare dataisolering.',
    },
  ]

  return (
    <div style={{ background: '#F5F3EE', minHeight: '100vh', fontFamily: 'Georgia, serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .cg { font-family: 'Cormorant Garamond', Georgia, serif; }
        .mono { font-family: 'DM Mono', monospace; }
        .nav-link {
          font-family: 'DM Mono', monospace; font-size: 11px; color: #888;
          text-decoration: none; letter-spacing: .08em; text-transform: uppercase;
          transition: color .2s;
        }
        .nav-link:hover { color: #0A0A0C; }
        .btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          background: #0A0A0C; color: white; border: none; cursor: pointer;
          font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: .08em;
          text-transform: uppercase; padding: 14px 28px; border-radius: 4px;
          text-decoration: none; transition: background .2s, transform .15s;
        }
        .btn-primary:hover { background: #C0321A; transform: translateY(-1px); }
        .btn-secondary {
          display: inline-flex; align-items: center; gap: 8px;
          background: transparent; color: #0A0A0C;
          border: 1px solid #C8C4BC; cursor: pointer;
          font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: .08em;
          text-transform: uppercase; padding: 14px 28px; border-radius: 4px;
          text-decoration: none; transition: all .2s;
        }
        .btn-secondary:hover { border-color: #0A0A0C; }
        .feature-card {
          background: white; border: 1px solid #E0DDD6; border-radius: 8px;
          padding: 28px; transition: box-shadow .2s, transform .2s;
        }
        .feature-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,.06); transform: translateY(-2px); }
        .price-card {
          background: white; border: 1px solid #E0DDD6; border-radius: 8px;
          padding: 36px 32px; position: relative; transition: box-shadow .2s;
        }
        .price-card.featured { border-color: #0A0A0C; border-width: 1.5px; }
        .price-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,.08); }
        .faq-item { border-bottom: 1px solid #E0DDD6; overflow: hidden; }
        .faq-btn {
          width: 100%; background: none; border: none; cursor: pointer;
          padding: 22px 0; display: flex; justify-content: space-between;
          align-items: center; text-align: left; transition: color .2s;
        }
        .faq-btn:hover .faq-q { color: #C0321A; }
        .audience-card {
          padding: 36px 32px; border-left: 2px solid #E0DDD6; transition: border-color .2s;
        }
        .audience-card:hover { border-color: #C0321A; }
        .toggle-pill {
          display: inline-flex; background: #E8E5DF; border-radius: 30px; padding: 4px; gap: 2px;
        }
        .toggle-opt {
          padding: 7px 18px; border-radius: 24px; border: none;
          font-family: 'DM Mono', monospace; font-size: 11px;
          letter-spacing: .06em; text-transform: uppercase;
          cursor: pointer; transition: all .2s;
          background: transparent; color: #888;
        }
        .toggle-opt.active { background: white; color: #0A0A0C; box-shadow: 0 1px 4px rgba(0,0,0,.1); }
        .flow-step {
          display: flex; flex-direction: column; align-items: center; gap: 12; flex: 1;
        }
        .flow-arrow {
          color: #C0321A; font-family: 'DM Mono', monospace; font-size: 20px;
          padding: 0 8px; margin-top: 24px; flex-shrink: 0;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: none; }
        }
        .hero-anim   { animation: fadeUp .7s both; }
        .hero-anim-2 { animation: fadeUp .7s .15s both; }
        .hero-anim-3 { animation: fadeUp .7s .3s  both; }
        .hero-anim-4 { animation: fadeUp .7s .45s both; }
        .cta-demo-btn {
          display: inline-flex; align-items: center; padding: 14px 28px;
          border: 1px solid #333; border-radius: 4px;
          font-family: 'DM Mono', monospace; font-size: 12px;
          letter-spacing: .08em; text-transform: uppercase;
          color: #888; text-decoration: none; transition: all .2s;
        }
        .cta-demo-btn:hover { border-color: #888; color: white; }
      `}</style>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(245,243,238,.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #E0DDD6', padding: '0 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', height: 64, gap: 40 }}>
          <a href="/" style={{ textDecoration: 'none' }}>
            <span className="cg" style={{ fontSize: 26, fontWeight: 600, color: '#0A0A0C', letterSpacing: '-.02em' }}>
              Normi<span style={{ color: '#C0321A' }}>q</span>
            </span>
          </a>
          <div style={{ flex: 1 }} />
          <a href="#hur-det-fungerar" className="nav-link">Hur det fungerar</a>
          <a href="#funktioner" className="nav-link">Funktioner</a>
          <a href="#priser" className="nav-link">Priser</a>
          <a href="#faq" className="nav-link">FAQ</a>
          <a href="/login" className="nav-link">Logga in</a>
          <a href="/register" className="btn-primary" style={{ padding: '10px 20px', fontSize: 11 }}>Testa gratis</a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 48px 88px' }}>
        <div style={{ maxWidth: 800 }}>
          <div className="mono hero-anim" style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: '#C0321A', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'block', width: 28, height: 1, background: '#C0321A' }} />
            Söksystem för svenska skatte- och redovisningsregler
          </div>

          <h1 className="cg hero-anim-2" style={{ fontSize: 'clamp(48px, 6vw, 82px)', lineHeight: .96, letterSpacing: '-.03em', color: '#0A0A0C', marginBottom: 28 }}>
            AI:n skriver inte svaren.{' '}
            <em style={{ fontStyle: 'italic', color: '#C0321A' }}>AI:n förklarar källorna.</em>
          </h1>

          <p className="mono hero-anim-3" style={{ fontSize: 15, color: '#666', lineHeight: 1.9, marginBottom: 20, maxWidth: 600 }}>
            Normiq hittar relevanta lagrum och regelkällor för din fråga — och förklarar vad de faktiskt säger. Som Google för skatte- och redovisningsregler, men med källhänvisning och riskbedömning i varje svar.
          </p>

          <p className="mono hero-anim-3" style={{ fontSize: 13, color: '#AAA', lineHeight: 1.9, marginBottom: 44, maxWidth: 560 }}>
            Byggt för redovisningsbyråer, skattejurister och ekonomiteam som behöver veta vad svaret bygger på.
          </p>

          <div className="hero-anim-4" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 48 }}>
            <a href="/register" className="btn-primary">
              Testa gratis
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </a>
            <a href="mailto:hej@normiq.se" className="btn-secondary">Boka demo</a>
          </div>

          <div className="hero-anim-4 mono" style={{ fontSize: 11, color: '#AAA', letterSpacing: '.06em', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span>✓ Källbaserade svar</span>
            <span style={{ color: '#E0DDD6' }}>·</span>
            <span>✓ Riskklassning före svar</span>
            <span style={{ color: '#E0DDD6' }}>·</span>
            <span>✓ Verifierat mot lagtext</span>
            <span style={{ color: '#E0DDD6' }}>·</span>
            <span>✓ IL · ML · BFL · SFL · ABL</span>
          </div>
        </div>
      </section>

      {/* HUR DET FUNGERAR */}
      <section id="hur-det-fungerar" style={{ background: 'white', borderTop: '1px solid #E0DDD6', borderBottom: '1px solid #E0DDD6', padding: '88px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#C0321A', marginBottom: 16 }}>Hur det fungerar</div>
          <h2 className="cg" style={{ fontSize: 'clamp(34px, 4vw, 52px)', color: '#0A0A0C', marginBottom: 16, letterSpacing: '-.02em' }}>
            Från fråga till verifierbart svar
          </h2>
          <p className="mono" style={{ fontSize: 13, color: '#666', lineHeight: 1.85, maxWidth: 540, marginBottom: 64 }}>
            Normiq följer en strikt ordning. Källorna hittas och riskklassas innan AI:n formulerar ett enda ord.
          </p>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>
            {[
              { num: '01', title: 'Din fråga', desc: 'Du ställer en fråga om skatt, moms eller redovisning.', color: '#F5F3EE', highlight: false },
              { num: '02', title: 'Retrieval', desc: 'Normiq söker i strukturerade regelkällor och identifierar relevanta lagrum.', color: '#F5F3EE', highlight: false },
              { num: '03', title: 'Riskklassning', desc: 'Frågan och källorna bedöms — LÅG, MEDEL eller HÖG — innan AI:n anropas.', color: '#FDF4F3', highlight: true },
              { num: '04', title: 'AI förklarar källorna', desc: 'AI:n sammanfattar vad de hittade källorna faktiskt säger. Inte fritt — bara källorna.', color: '#F5F3EE', highlight: false },
              { num: '05', title: 'Verifierat svar', desc: 'Svaret stäms mot källorna. Du får lagrum, riskbedömning och länk till originaltexten.', color: '#F0F7F3', highlight: false },
            ].map((step, i, arr) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 160 }}>
                <div style={{ flex: 1, background: step.color, border: `1px solid ${step.highlight ? '#C0321A' : '#E0DDD6'}`, borderRadius: 8, padding: '24px 20px' }}>
                  <div className="mono" style={{ fontSize: 11, color: step.highlight ? '#C0321A' : '#CCC', marginBottom: 10, letterSpacing: '.06em' }}>{step.num}</div>
                  <div className="cg" style={{ fontSize: 18, fontWeight: 600, color: '#0A0A0C', marginBottom: 8, lineHeight: 1.2 }}>{step.title}</div>
                  <div className="mono" style={{ fontSize: 12, color: '#666', lineHeight: 1.75 }}>{step.desc}</div>
                </div>
                {i < arr.length - 1 && (
                  <div style={{ padding: '32px 8px 0', color: '#C0321A', fontFamily: 'DM Mono, monospace', fontSize: 16, flexShrink: 0 }}>{'→'}</div>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 48, padding: '28px 36px', background: '#0A0A0C', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
            <div className="cg" style={{ fontSize: 26, color: 'white', letterSpacing: '-.01em', lineHeight: 1.2 }}>
              "Google för skatte- och redovisningsregler."
            </div>
            <div className="mono" style={{ fontSize: 12, color: '#888', lineHeight: 1.8, maxWidth: 360 }}>
              Normiq är inte en AI-rådgivare. Det är ett söksystem som visar vad reglerna faktiskt säger — med källhänvisning i varje svar.
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEMET */}
      <section style={{ padding: '88px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#C0321A', marginBottom: 16 }}>Problemet med generell AI</div>
            <h2 className="cg" style={{ fontSize: 'clamp(32px, 3.5vw, 48px)', color: '#0A0A0C', marginBottom: 20, letterSpacing: '-.02em', lineHeight: 1.1 }}>
              När svaret måste gå att försvara räcker det inte att det låter rätt
            </h2>
            <p className="mono" style={{ fontSize: 13, color: '#666', lineHeight: 1.9, marginBottom: 16 }}>
              Generella AI-verktyg formulerar svar som låter övertygande — men du kan inte se vad de bygger på. I skatte- och redovisningsfrågor är det ett problem.
            </p>
            <p className="mono" style={{ fontSize: 13, color: '#666', lineHeight: 1.9 }}>
              Normiq visar källan innan det visar svaret.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              'Formulerar ett svar som låter rätt — utan källhänvisning.',
              'Du kan inte se om svaret bygger på lagtext eller träningsdata.',
              'Ingen riskbedömning — alla svar presenteras med samma säkerhet.',
            ].map((text, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, padding: '18px 22px', background: 'white', border: '1px solid #E0DDD6', borderRadius: 8 }}>
                <span style={{ color: '#C0321A', flexShrink: 0, fontFamily: 'DM Mono, monospace', fontSize: 14, marginTop: 1 }}>✕</span>
                <span className="mono" style={{ fontSize: 13, color: '#444', lineHeight: 1.7 }}>{text}</span>
              </div>
            ))}
            <div style={{ height: 8 }} />
            {[
              'Normiq visar vilket lagrum svaret bygger på.',
              'Riskklassning görs mot källorna — innan AI:n svarar.',
              'Du kan klicka direkt till originaltexten och verifiera själv.',
            ].map((text, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, padding: '18px 22px', background: '#F0F7F3', border: '1px solid #D4EBE0', borderRadius: 8 }}>
                <span style={{ color: '#3A7A52', flexShrink: 0, fontFamily: 'DM Mono, monospace', fontSize: 14, marginTop: 1 }}>✓</span>
                <span className="mono" style={{ fontSize: 13, color: '#333', lineHeight: 1.7 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="funktioner" style={{ background: 'white', borderTop: '1px solid #E0DDD6', borderBottom: '1px solid #E0DDD6', padding: '88px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#C0321A', marginBottom: 16 }}>Funktioner</div>
          <h2 className="cg" style={{ fontSize: 'clamp(32px, 3.5vw, 48px)', color: '#0A0A0C', marginBottom: 12, letterSpacing: '-.02em' }}>
            Det du behöver för att arbeta snabbare och säkrare
          </h2>
          <p className="mono" style={{ fontSize: 13, color: '#888', marginBottom: 52, maxWidth: 480, lineHeight: 1.8 }}>
            Varje funktion är byggd för professionella team som arbetar med kvalitet varje dag.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { icon: '§', title: 'Källbaserade svar', desc: 'Varje svar hänvisar till det lagrum det bygger på. Du ser alltid var svaret kommer ifrån.' },
              { icon: '◈', title: 'Riskklassning före svar', desc: 'Frågan bedöms mot källorna innan AI:n svarar. LÅG, MEDEL eller HÖG — med motivering.' },
              { icon: '▦', title: 'Auditlogg', desc: 'Frågor, svar och källor sparas automatiskt för spårbarhet och intern dokumentation.' },
              { icon: '↗', title: 'Klickbara lagrum', desc: 'Gå direkt till originaltexten när du vill verifiera. Varje lagrum är länkat.' },
              { icon: '⟳', title: 'Levande regelindex', desc: 'Strukturerat index över IL, ML, BFL, SFL, ABL och SKV-material. Uppdateras löpande.' },
              { icon: '⊞', title: 'Byggt för team', desc: 'Konsekvent kvalitet och spårbarhet oavsett vem i teamet som ställer frågan.' },
            ].map((f, i) => (
              <div key={i} className="feature-card">
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 22, color: '#C0321A', marginBottom: 14 }}>{f.icon}</div>
                <div className="cg" style={{ fontSize: 20, fontWeight: 600, color: '#0A0A0C', marginBottom: 8 }}>{f.title}</div>
                <div className="mono" style={{ fontSize: 13, color: '#666', lineHeight: 1.8 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FÖR VEM */}
      <section style={{ padding: '88px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#C0321A', marginBottom: 16 }}>För vem</div>
        <h2 className="cg" style={{ fontSize: 'clamp(32px, 3.5vw, 48px)', color: '#0A0A0C', marginBottom: 52, letterSpacing: '-.02em' }}>
          Byggt för team som arbetar där fel kostar
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {[
            { role: 'Redovisningskonsulter', desc: 'Kortare researchtid och bättre underlag i kunddialogen. Hitta rätt lagrum snabbare och dokumentera det.' },
            { role: 'Skattejurister', desc: 'Snabbare första genomgång med tydligt källstöd. Fokusera på bedömningen — inte på att leta i lagtext.' },
            { role: 'CFO:er och ekonomichefer', desc: 'Spårbarhet i interna bedömningar och beslutsunderlag. Vet vilket lagrum svaret bygger på.' },
            { role: 'Redovisningsbyråer', desc: 'Konsekvent arbetssätt över hela teamet. Samma källkvalitet oavsett vem som svarar.' },
          ].map((a, i) => (
            <div key={i} className="audience-card" style={{
              borderBottom: i < 2 ? '1px solid #E8E5DF' : 'none',
              borderRight: i % 2 === 0 ? '1px solid #E8E5DF' : 'none',
            }}>
              <div className="cg" style={{ fontSize: 22, fontWeight: 600, color: '#0A0A0C', marginBottom: 10 }}>{a.role}</div>
              <div className="mono" style={{ fontSize: 13, color: '#666', lineHeight: 1.85 }}>{a.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRISER */}
      <section id="priser" style={{ background: 'white', borderTop: '1px solid #E0DDD6', borderBottom: '1px solid #E0DDD6', padding: '88px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#C0321A', marginBottom: 16 }}>Priser</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 48, flexWrap: 'wrap', gap: 20 }}>
            <h2 className="cg" style={{ fontSize: 'clamp(32px, 3.5vw, 48px)', color: '#0A0A0C', letterSpacing: '-.02em' }}>
              Enkel prissättning för byråer och ekonomiteam
            </h2>
            <div className="toggle-pill">
              <button className={`toggle-opt ${!billingAnnual ? 'active' : ''}`} onClick={() => setBillingAnnual(false)}>Månadsvis</button>
              <button className={`toggle-opt ${billingAnnual ? 'active' : ''}`} onClick={() => setBillingAnnual(true)}>
                Årsvis <span style={{ color: '#3A7A52', marginLeft: 4 }}>−20%</span>
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              {
                name: 'Starter',
                price: billingAnnual ? '392' : '490',
                desc: 'För dig som vill testa Normiq i praktiken.',
                features: ['1 användare', 'Källbaserade svar', 'Riskklassning', 'Auditlogg', 'Klickbara lagrum'],
                cta: 'Kom igång gratis',
                href: '/register',
                featured: false,
              },
              {
                name: 'Pro',
                price: billingAnnual ? '1 592' : '1 990',
                desc: 'För mindre byråer och team som vill använda Normiq i vardagen.',
                features: ['Upp till 10 användare', 'Allt i Starter', 'Teamhistorik', 'Prioriterad support', 'Exportera svar som PDF'],
                cta: 'Starta Pro',
                href: '/register?plan=pro',
                featured: true,
              },
              {
                name: 'Enterprise',
                price: 'Offert',
                desc: 'För större organisationer med högre krav på integration, säkerhet och styrning.',
                features: ['Obegränsade användare', 'Allt i Pro', 'SSO / SAML', 'Dataisolering', 'SLA och dedikerad support'],
                cta: 'Kontakta oss',
                href: 'mailto:hej@normiq.se',
                featured: false,
              },
            ].map((plan, i) => (
              <div key={i} className={`price-card ${plan.featured ? 'featured' : ''}`}>
                {plan.featured && (
                  <div className="mono" style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', background: '#0A0A0C', color: 'white', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: '0 0 6px 6px' }}>
                    Mest populär
                  </div>
                )}
                <div className="mono" style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#888', marginBottom: 8 }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                  <span className="cg" style={{ fontSize: 44, fontWeight: 300, color: '#0A0A0C', letterSpacing: '-.02em' }}>{plan.price}</span>
                  {plan.price !== 'Offert' && <span className="mono" style={{ fontSize: 13, color: '#888' }}>kr/mån</span>}
                </div>
                <div className="mono" style={{ fontSize: 12, color: '#888', lineHeight: 1.7, marginBottom: 28, minHeight: 48 }}>{plan.desc}</div>
                <div style={{ borderTop: '1px solid #F0EDE6', paddingTop: 24, marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {plan.features.map((f, fi) => (
                    <div key={fi} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ color: '#3A7A52', flexShrink: 0, fontFamily: 'DM Mono, monospace', fontSize: 12, marginTop: 1 }}>✓</span>
                      <span className="mono" style={{ fontSize: 12, color: '#444', lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                </div>
                <a href={plan.href} className={plan.featured ? 'btn-primary' : 'btn-secondary'} style={{ width: '100%', justifyContent: 'center', fontSize: 11 }}>
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: '88px 48px', maxWidth: 760, margin: '0 auto' }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#C0321A', marginBottom: 16 }}>Vanliga frågor</div>
        <h2 className="cg" style={{ fontSize: 'clamp(32px, 3.5vw, 48px)', color: '#0A0A0C', marginBottom: 48, letterSpacing: '-.02em' }}>FAQ</h2>
        <div style={{ borderTop: '1px solid #E0DDD6' }}>
          {faqs.map((faq, i) => (
            <div key={i} className="faq-item">
              <button className="faq-btn" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <span className="cg faq-q" style={{ fontSize: 20, color: '#0A0A0C', transition: 'color .2s', paddingRight: 24 }}>{faq.q}</span>
                <span style={{ color: '#C0321A', flexShrink: 0, fontFamily: 'DM Mono, monospace', fontSize: 18, transition: 'transform .2s', display: 'inline-block', transform: openFaq === i ? 'rotate(45deg)' : 'none' }}>+</span>
              </button>
              {openFaq === i && (
                <div className="mono" style={{ fontSize: 13, color: '#555', lineHeight: 1.9, paddingBottom: 24 }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: '#0A0A0C', padding: '88px 48px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#C0321A', marginBottom: 20 }}>Kom igång idag</div>
          <h2 className="cg" style={{ fontSize: 'clamp(36px, 4vw, 60px)', color: 'white', marginBottom: 20, letterSpacing: '-.02em', lineHeight: 1.05 }}>
            Redo att arbeta med källhänvisning i varje svar?
          </h2>
          <p className="mono" style={{ fontSize: 13, color: '#888', lineHeight: 1.85, marginBottom: 40 }}>
            Testa Normiq utan kostnad. Ingen betalningsinformation krävs.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/register" className="btn-primary">Testa gratis</a>
            <a href="mailto:hej@normiq.se" className="cta-demo-btn">Boka demo</a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid #E0DDD6', padding: '32px 48px', background: '#F5F3EE' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <span className="cg" style={{ fontSize: 22, fontWeight: 600, color: '#0A0A0C' }}>
            Normi<span style={{ color: '#C0321A' }}>q</span>
          </span>
          <div className="mono" style={{ fontSize: 11, color: '#CCC', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <a href="/login" style={{ color: '#CCC', textDecoration: 'none' }}>Logga in</a>
            <a href="mailto:hej@normiq.se" style={{ color: '#CCC', textDecoration: 'none' }}>Kontakt</a>
            <span>© 2025 Normiq</span>
          </div>
          <div className="mono" style={{ fontSize: 10, color: '#DDD', letterSpacing: '.04em' }}>
            Konsultera alltid en skatteexpert.
          </div>
        </div>
      </footer>
    </div>
  )
}