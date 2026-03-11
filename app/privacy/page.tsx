'use client'

export default function Privacy() {
  return (
    <div style={{ background: '#F5F3EE', minHeight: '100vh', fontFamily: 'Georgia, serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .cg   { font-family: 'Cormorant Garamond', Georgia, serif; }
        .mono { font-family: 'DM Mono', monospace; }
        h2 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 28px; font-weight: 600; color: #0A0A0C; margin: 48px 0 14px; letter-spacing: -.01em; line-height: 1.1; }
        h3 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20px; font-weight: 600; color: #0A0A0C; margin: 28px 0 10px; }
        p  { font-size: 15px; color: #444; line-height: 1.9; margin-bottom: 14px; }
        ul { padding-left: 0; margin-bottom: 14px; display: flex; flex-direction: column; gap: 7px; }
        li { font-size: 15px; color: #444; line-height: 1.8; display: flex; gap: 10px; align-items: flex-start; }
        li::before { content: '→'; color: #C0321A; font-family: 'DM Mono', monospace; font-size: 11px; flex-shrink: 0; margin-top: 5px; }
        a  { color: #C0321A; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .divider { height: 1px; background: #E0DDD6; margin: 8px 0; }
      `}</style>

      {/* NAV */}
      <nav style={{ borderBottom: '1px solid #E0DDD6', padding: '0 48px', background: 'rgba(245,243,238,.96)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/landing" style={{ textDecoration: 'none' }}>
            <span className="cg" style={{ fontSize: 26, fontWeight: 600, color: '#0A0A0C', letterSpacing: '-.02em' }}>
              normi<span style={{ color: '#C0321A' }}>q</span>
            </span>
          </a>
          <a href="/landing" className="mono" style={{ fontSize: 11, color: '#888', letterSpacing: '.08em', textTransform: 'uppercase', textDecoration: 'none' }}>← Tillbaka</a>
        </div>
      </nav>

      {/* CONTENT */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '64px 48px 96px' }}>

        <div className="mono" style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#C0321A', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'block', width: 24, height: 1, background: '#C0321A' }} />
          Juridisk information
        </div>

        <h1 className="cg" style={{ fontSize: 'clamp(40px, 5vw, 62px)', fontWeight: 600, color: '#0A0A0C', letterSpacing: '-.025em', lineHeight: .95, marginBottom: 20 }}>
          Integritetspolicy
        </h1>

        <p className="mono" style={{ fontSize: 11, color: '#AAA', letterSpacing: '.05em', marginBottom: 48 }}>
          Senast uppdaterad: mars 2026
        </p>

        <div className="divider" />

        <h2>1. Personuppgiftsansvarig</h2>
        <p>
          Normiq är personuppgiftsansvarig för behandlingen av dina personuppgifter. Vid frågor om hur vi hanterar dina uppgifter, kontakta oss på <a href="mailto:hej@normiq.se">hej@normiq.se</a>.
        </p>

        <h2>2. Vilka uppgifter vi samlar in</h2>
        <h3>Kontouppgifter</h3>
        <ul>
          <li>E-postadress (vid registrering)</li>
          <li>Betalningsinformation hanteras av Stripe — vi lagrar aldrig kortnummer eller fullständiga betalningsuppgifter</li>
        </ul>
        <h3>Användningsdata</h3>
        <ul>
          <li>Frågor du ställer i tjänsten</li>
          <li>Svar och källhänvisningar som genererats</li>
          <li>Feedback (tumme upp/ned) på svar</li>
          <li>Session-ID för att koppla frågor till din session</li>
        </ul>
        <p>
          <strong>Observera:</strong> Undvik att inkludera känsliga personuppgifter (personnummer, specifika personnamn, hälsouppgifter) i dina frågor. Frågor lagras för att förbättra tjänsten och för din historik.
        </p>

        <h2>3. Varför vi behandlar uppgifterna</h2>
        <ul>
          <li><strong>Tillhandahålla tjänsten</strong> — för att svara på dina frågor och spara din historik (rättslig grund: avtal)</li>
          <li><strong>Fakturering</strong> — för att hantera din prenumeration via Stripe (rättslig grund: avtal)</li>
          <li><strong>Förbättra tjänsten</strong> — analysera vilka frågor som ger dåliga svar och förbättra dem (rättslig grund: berättigat intresse)</li>
          <li><strong>Juridisk skyldighet</strong> — vi kan behöva spara vissa uppgifter för bokföringsändamål</li>
        </ul>

        <h2>4. Hur länge sparar vi uppgifterna</h2>
        <ul>
          <li>Frågor och svar: 24 månader från senaste aktivitet</li>
          <li>Kontouppgifter: till dess du avslutar ditt konto, plus 30 dagar</li>
          <li>Betalningshistorik: 7 år (bokföringsskyldighet)</li>
        </ul>

        <h2>5. Tredjeparter vi delar data med</h2>
        <ul>
          <li><strong>Anthropic</strong> — dina frågor skickas till Anthropics API för att generera svar. Anthropic behandlar data enligt sitt DPA och använder inte dina frågor för att träna modeller (Enterprise API-avtal). <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer">Anthropics integritetspolicy →</a></li>
          <li><strong>Supabase</strong> — databas och autentisering. Servrar inom EU. <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabases integritetspolicy →</a></li>
          <li><strong>Stripe</strong> — betalningshantering. <a href="https://stripe.com/en-se/privacy" target="_blank" rel="noopener noreferrer">Stripes integritetspolicy →</a></li>
          <li><strong>Vercel</strong> — hosting. <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercels integritetspolicy →</a></li>
        </ul>
        <p>Vi säljer aldrig dina uppgifter till tredje part.</p>

        <h2>6. Dina rättigheter</h2>
        <p>Enligt GDPR har du rätt att:</p>
        <ul>
          <li><strong>Begära tillgång</strong> till de uppgifter vi har om dig</li>
          <li><strong>Rätta</strong> felaktiga uppgifter</li>
          <li><strong>Radera</strong> dina uppgifter ("rätten att bli glömd")</li>
          <li><strong>Invända</strong> mot behandling baserad på berättigat intresse</li>
          <li><strong>Dataportabilitet</strong> — få ut dina uppgifter i maskinläsbart format</li>
        </ul>
        <p>
          Skicka din begäran till <a href="mailto:hej@normiq.se">hej@normiq.se</a>. Vi svarar inom 30 dagar.
        </p>
        <p>
          Du har även rätt att lämna klagomål till <a href="https://www.imy.se" target="_blank" rel="noopener noreferrer">Integritetsskyddsmyndigheten (IMY)</a>.
        </p>

        <h2>7. Cookies</h2>
        <p>
          Normiq använder enbart nödvändiga cookies för autentisering (session-cookie från Supabase). Vi använder inga tracking- eller marknadsföringscookies. Ingen cookiebanner krävs för nödvändiga cookies.
        </p>

        <h2>8. Säkerhet</h2>
        <p>
          Alla uppgifter lagras krypterat. Kommunikation sker via HTTPS. Tillgång till databasen begränsas till behörig personal. Vi använder row-level security (RLS) i Supabase för att säkerställa att användare endast kan se sina egna uppgifter.
        </p>

        <h2>9. Ändringar i policyn</h2>
        <p>
          Vid väsentliga ändringar meddelar vi dig via e-post minst 30 dagar innan ändringen träder i kraft. Datum för senaste uppdatering visas alltid överst på denna sida.
        </p>

        <div className="divider" style={{ marginTop: 48 }} />

        <p className="mono" style={{ fontSize: 11, color: '#AAA', marginTop: 24, letterSpacing: '.04em' }}>
          Frågor? Kontakta oss på <a href="mailto:hej@normiq.se">hej@normiq.se</a>
        </p>
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid #E0DDD6', padding: '24px 48px', background: 'white' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="mono" style={{ fontSize: 11, color: '#CCC' }}>© 2026 Normiq</span>
          <a href="/landing" className="mono" style={{ fontSize: 11, color: '#AAA', textDecoration: 'none', letterSpacing: '.06em', textTransform: 'uppercase' }}>Tillbaka till startsidan</a>
        </div>
      </footer>
    </div>
  )
}