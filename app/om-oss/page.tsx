'use client'

export default function OmOss() {
  return (
    <div style={{ background: '#F5F3EE', minHeight: '100vh', fontFamily: 'Georgia, serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .cg   { font-family: 'Cormorant Garamond', Georgia, serif; }
        .mono { font-family: 'DM Mono', monospace; }
        a { color: #C0321A; text-decoration: none; }
        a:hover { text-decoration: underline; }
      `}</style>

      {/* NAV */}
      <nav style={{ borderBottom: '1px solid #E0DDD6', padding: '0 48px', background: 'rgba(245,243,238,.96)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/landing" style={{ textDecoration: 'none' }}>
            <span className="cg" style={{ fontSize: 26, fontWeight: 600, color: '#0A0A0C', letterSpacing: '-.02em' }}>
              normi<span style={{ color: '#C0321A' }}>q</span>
            </span>
          </a>
          <a href="/landing" className="mono" style={{ fontSize: 11, color: '#888', letterSpacing: '.08em', textTransform: 'uppercase', textDecoration: 'none' }}>← Tillbaka</a>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '72px 48px 0' }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#C0321A', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'block', width: 24, height: 1, background: '#C0321A' }} />
          Om oss
        </div>
        <h1 className="cg" style={{ fontSize: 'clamp(42px, 5.5vw, 70px)', fontWeight: 600, color: '#0A0A0C', letterSpacing: '-.025em', lineHeight: .95, marginBottom: 28, maxWidth: 700 }}>
          Byggt av personer som arbetat med frågorna varje dag
        </h1>
        <p style={{ fontSize: 16, color: '#555', lineHeight: 1.9, maxWidth: 580, marginBottom: 72 }}>
          Normiq är inte ett generellt AI-verktyg som anpassats till redovisning. Det är ett verktyg som byggts inifrån branschen — med förståelse för hur frågorna faktiskt ser ut i praktiken.
        </p>
      </div>

      {/* DIVIDER */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 48px' }}>
        <div style={{ height: 1, background: '#E0DDD6' }} />
      </div>

      {/* MAIN CONTENT */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '64px 48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start' }}>

          {/* LEFT */}
          <div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#999', marginBottom: 20 }}>Bakgrund</div>
            <h2 className="cg" style={{ fontSize: 38, fontWeight: 600, color: '#0A0A0C', letterSpacing: '-.015em', lineHeight: 1.05, marginBottom: 22 }}>
              Framtaget i samarbete med JoJo Business Management
            </h2>
            <p style={{ fontSize: 15, color: '#444', lineHeight: 1.9, marginBottom: 16 }}>
              JoJo Business Management AB har sedan 2010 arbetat med redovisning, skattefrågor och företagsrådgivning. Under de åren har tusentals frågor om skatt, moms och bokföring hanterats — många av dem återkommande, komplexa och tidskrävande att utreda.
            </p>
            <p style={{ fontSize: 15, color: '#444', lineHeight: 1.9, marginBottom: 16 }}>
              Det var den erfarenheten som lade grunden till Normiq. Inte som ett experiment med AI, utan som ett svar på ett konkret problem: hur hittar man rätt lagrum snabbt, och hur förklarar man det på ett sätt som går att stå för?
            </p>
            <p style={{ fontSize: 15, color: '#444', lineHeight: 1.9 }}>
              Normiq är resultatet av den frågan — ett verktyg där AI:n inte gissar, utan förklarar vad källorna faktiskt säger.
            </p>
          </div>

          {/* RIGHT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#999', marginBottom: 4 }}>Det vi vet efter 15 år</div>
            {[
              {
                num: '01',
                title: 'Rätt svar räcker inte',
                desc: 'Det måste också gå att försvara. Klienter och revisorer vill se källan — inte bara slutsatsen.',
              },
              {
                num: '02',
                title: 'Frågorna återkommer',
                desc: 'Representation, 3:12, bilförmån, moms på tjänster — samma frågor ställs om och om igen. De ska besvaras konsekvent varje gång.',
              },
              {
                num: '03',
                title: 'Regelverket förändras',
                desc: 'Belopp, procentsatser och undantag ändras varje år. Det tar tid att hålla sig uppdaterad — tid som Normiq kan spara.',
              },
              {
                num: '04',
                title: 'Dokumentation är allt',
                desc: 'Vid en granskning är det inte vad du visste som räknas, utan vad du kan visa. Normiq är byggt för spårbarhet.',
              },
            ].map((item, i) => (
              <div key={i} style={{ background: 'white', border: '1px solid #E0DDD6', borderRadius: 6, padding: '22px 24px' }}>
                <div className="mono" style={{ fontSize: 10, color: '#C0321A', letterSpacing: '.1em', marginBottom: 8 }}>{item.num}</div>
                <div className="cg" style={{ fontSize: 20, fontWeight: 600, color: '#0A0A0C', marginBottom: 8, lineHeight: 1.2 }}>{item.title}</div>
                <div style={{ fontSize: 14, color: '#666', lineHeight: 1.8 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DARK SECTION */}
      <div style={{ background: '#0A0A0C', padding: '72px 48px', marginTop: 16 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#C0321A', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'block', width: 24, height: 1, background: '#C0321A' }} />
              Vår approach
            </div>
            <h2 className="cg" style={{ fontSize: 'clamp(30px, 3.5vw, 46px)', fontWeight: 600, color: 'white', letterSpacing: '-.02em', lineHeight: 1.05, marginBottom: 22 }}>
              Vi ersätter inte expertisen. Vi gör den snabbare.
            </h2>
            <p style={{ fontSize: 15, color: '#666', lineHeight: 1.9 }}>
              Normiq är ett beslutsstöd, inte ett beslut. Varje svar är en utgångspunkt för din bedömning — inte ett substitut för den. Det är en distinktion vi tar på allvar, och som genomsyrar hur verktyget är byggt.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[
              ['Källorna hittas', 'innan AI:n svarar'],
              ['Riskklassning görs', 'mot regelverket'],
              ['Svaret förklarar', 'vad lagen säger'],
              ['Du fattar', 'det slutliga beslutet'],
            ].map(([a, b], i, arr) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 0', borderBottom: i < arr.length - 1 ? '1px solid #1a1a1c' : 'none' }}>
                <span className="mono" style={{ fontSize: 11, color: '#C0321A', flexShrink: 0, width: 24 }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#888' }}>
                  <span style={{ color: 'white' }}>{a}</span> {b}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '72px 48px', textAlign: 'center' }}>
        <h2 className="cg" style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 600, color: '#0A0A0C', letterSpacing: '-.02em', marginBottom: 16, lineHeight: 1.05 }}>
          Redo att testa?
        </h2>
        <p style={{ fontSize: 15, color: '#888', lineHeight: 1.85, marginBottom: 36 }}>
          14 dagars gratis testperiod. Inget kreditkort krävs.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#0A0A0C', color: 'white', padding: '14px 28px', borderRadius: 3, fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '.09em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Testa gratis
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </a>
          <a href="mailto:hej@normiq.se" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', color: '#555', padding: '14px 28px', borderRadius: 3, fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '.09em', textTransform: 'uppercase', textDecoration: 'none', border: '1px solid #C8C4BC' }}>
            Kontakta oss
          </a>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid #1a1a1c', padding: '28px 48px', background: '#0A0A0C' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <span className="cg" style={{ fontSize: 22, fontWeight: 600, color: 'white' }}>normi<span style={{ color: '#C0321A' }}>q</span></span>
          <div className="mono" style={{ fontSize: 11, color: '#444', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <a href="/landing" style={{ color: '#444', textDecoration: 'none' }}>Startsidan</a>
            <a href="/privacy" style={{ color: '#444', textDecoration: 'none' }}>Integritetspolicy</a>
            <a href="mailto:hej@normiq.se" style={{ color: '#444', textDecoration: 'none' }}>Kontakt</a>
            <span>© 2026 Normiq</span>
          </div>
        </div>
      </footer>
    </div>
  )
}