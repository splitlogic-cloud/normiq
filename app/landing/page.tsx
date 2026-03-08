'use client'

import { useEffect, useState } from 'react'

export default function Landing() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div style={{ background: '#F5F3EE', fontFamily: 'Georgia, serif', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .cg { font-family: 'Cormorant Garamond', Georgia, serif; }
        .mono { font-family: 'DM Mono', monospace; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(40px); } to { opacity:1; transform:none; } }
        @keyframes ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .fu0{animation:fadeUp 1s both}
        .fu1{animation:fadeUp 1s .2s both}
        .fu2{animation:fadeUp 1s .4s both}
        .fu3{animation:fadeUp 1s .6s both}
        .btn-p {
          display:inline-block; font-family:'DM Mono',monospace; font-size:14px;
          font-weight:500; letter-spacing:.12em; text-transform:uppercase;
          color:#F5F3EE; background:#0A0A0C; padding:22px 48px;
          text-decoration:none; cursor:pointer;
          transition:background .2s,transform .15s,box-shadow .2s;
        }
        .btn-p:hover { background:#C0321A; transform:translateY(-2px); box-shadow:0 12px 40px rgba(192,50,26,.3); }
        .btn-g {
          display:inline-block; font-family:'DM Mono',monospace; font-size:14px;
          letter-spacing:.08em; text-transform:uppercase; color:#666;
          text-decoration:none; border-bottom:2px solid #CCC;
          padding-bottom:3px; transition:color .2s,border-color .2s;
        }
        .btn-g:hover { color:#0A0A0C; border-color:#0A0A0C; }
        .nav-a {
          font-family:'DM Mono',monospace; font-size:11px; letter-spacing:.1em;
          text-transform:uppercase; color:#888; text-decoration:none; transition:color .2s;
        }
        .nav-a:hover { color:#0A0A0C; }
        .fc {
          padding:64px; border:1px solid #E0DDD6; background:white;
          transition:border-color .3s,box-shadow .3s,transform .3s;
        }
        .fc:hover { border-color:#C0321A; box-shadow:0 12px 60px rgba(192,50,26,.1); transform:translateY(-3px); }
        .pc { padding:64px 56px; border:1px solid #E0DDD6; background:white; transition:all .3s; }
        .pc:hover { border-color:#0A0A0C; box-shadow:0 20px 80px rgba(0,0,0,.1); }
        .faq { border-bottom:1px solid #E0DDD6; padding:40px 0; cursor:pointer; }
        .faq:first-child { border-top:1px solid #E0DDD6; }
        .ticker-wrap { animation:ticker 32s linear infinite; display:flex; gap:100px; white-space:nowrap; }
        .ticker-wrap:hover { animation-play-state:paused; }
        @media(max-width:900px){
          .feat-grid{grid-template-columns:1fr !important;}
          .who-grid{grid-template-columns:1fr 1fr !important;}
          .price-grid{grid-template-columns:1fr !important;}
          nav .nav-links{display:none !important;}
          .hero-inner{padding:100px 32px 80px !important;}
          .section-pad{padding:100px 32px !important;}
          .feat-wrap{grid-template-columns:1fr !important; gap:64px !important;}
        }
      `}</style>

      {/* NAV */}
      <nav style={{
        position:'fixed', top:0, left:0, right:0, zIndex:100,
        display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'22px 80px',
        background: scrolled ? 'rgba(245,243,238,0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid #E0DDD6' : '1px solid transparent',
        transition:'all .3s'
      }}>
        <div className="cg" style={{fontSize:30,fontWeight:600,color:'#0A0A0C',letterSpacing:'-.02em'}}>
          Normi<span style={{color:'#C0321A'}}>q</span>
        </div>
        <div className="nav-links" style={{display:'flex',gap:44,alignItems:'center'}}>
          <a href="#funktioner" className="nav-a">Funktioner</a>
          <a href="#priser" className="nav-a">Priser</a>
          <a href="#faq" className="nav-a">FAQ</a>
          <a href="/login" className="nav-a">Logga in</a>
          <a href="/register" className="btn-p" style={{padding:'12px 28px',fontSize:12}}>Kom igång gratis</a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{minHeight:'100vh',display:'flex',alignItems:'center',borderBottom:'1px solid #E0DDD6',paddingTop:80,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:0,right:0,width:'40%',height:'100%',background:'linear-gradient(135deg,transparent 0%,rgba(192,50,26,.03) 100%)',pointerEvents:'none'}}/>
        <div className="hero-inner" style={{padding:'120px 140px 120px',maxWidth:1300,width:'100%'}}>

          <div className="mono fu0" style={{fontSize:13,letterSpacing:'.16em',textTransform:'uppercase',color:'#C0321A',marginBottom:48,display:'flex',alignItems:'center',gap:14}}>
            <span style={{display:'block',width:40,height:1.5,background:'#C0321A'}}/>
            Sveriges första citation-first AI för skatt & redovisning
          </div>

          <h1 className="cg fu1" style={{fontSize:'clamp(96px,12vw,160px)',lineHeight:.88,letterSpacing:'-.04em',color:'#0A0A0C'}}>
            Sluta gissa.
          </h1>
          <h1 className="cg fu1" style={{fontSize:'clamp(96px,12vw,160px)',lineHeight:.88,letterSpacing:'-.04em',color:'#0A0A0C',fontStyle:'italic'}}>
            Börja bevisa.
          </h1>
          <h1 className="cg fu2" style={{fontSize:'clamp(96px,12vw,160px)',lineHeight:.88,letterSpacing:'-.04em',fontStyle:'italic',marginBottom:0}}>
            <span style={{color:'#C0321A'}}>Med källan.</span>
          </h1>

          <p className="mono fu2" style={{fontSize:20,color:'#666',marginTop:64,maxWidth:700,lineHeight:2.1}}>
            Normiq ger dig exakta svar på svenska skattefrågor — med lagrum,
            paragrafnummer och riskklassning i varje svar. Inte AI-gissningar.
            Verifierbar juridik.
          </p>

          <div className="fu3" style={{marginTop:72,display:'flex',alignItems:'center',gap:40,flexWrap:'wrap'}}>
            <a href="/register" className="btn-p" style={{fontSize:15,padding:'24px 56px'}}>Testa gratis i 14 dagar →</a>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <a href="#funktioner" className="btn-g" style={{fontSize:15}}>Se hur det fungerar</a>
              <span className="mono" style={{fontSize:12,color:'#AAA',letterSpacing:'.06em'}}>Inget kreditkort krävs</span>
            </div>
          </div>

          <div className="fu3" style={{marginTop:64,display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
            <span className="mono" style={{fontSize:12,color:'#AAA',letterSpacing:'.06em',marginRight:4}}>Täcker:</span>
            {['IL','ML','SFL','BFL','ABL','BFN','SKV'].map(t=>(
              <span key={t} style={{fontSize:13,letterSpacing:'.1em',color:'#777',background:'#EDEAE3',padding:'7px 16px',borderRadius:4,fontFamily:'DM Mono,monospace'}}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div style={{background:'#0A0A0C',padding:'20px 0',overflow:'hidden',borderBottom:'1px solid #1a1a1e'}}>
        <div className="ticker-wrap">
          {[...Array(2)].map((_,ri)=>
            ['Inkomstskattelagen','Mervärdesskattelagen','Skatteförfarandelagen','Bokföringslagen','Aktiebolagslagen','BFN-normer','SKV Ställningstaganden','Rättsfall & Prejudikat'].map((t,i)=>(
              <span key={`${ri}-${i}`} className="mono" style={{fontSize:13,letterSpacing:'.12em',textTransform:'uppercase',color:i%4===0?'#C0321A':'#3a3a3e'}}>{t}</span>
            ))
          )}
        </div>
      </div>

      {/* PROBLEM */}
      <section className="section-pad" style={{padding:'180px 140px',background:'#0A0A0C',borderBottom:'1px solid #1a1a1e'}}>
        <div style={{maxWidth:1200,margin:'0 auto'}}>
          <div className="mono" style={{fontSize:13,letterSpacing:'.14em',textTransform:'uppercase',color:'#C0321A',marginBottom:40,textAlign:'center'}}>Problemet</div>
          <h2 className="cg" style={{fontSize:'clamp(56px,7vw,104px)',lineHeight:1.0,color:'white',textAlign:'center',letterSpacing:'-.03em',marginBottom:96}}>
            "AI sa att det var okej."<br/>
            <em style={{color:'#C0321A'}}>Skatteverket höll inte med.</em>
          </h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:1,background:'#1a1a1e'}}>
            {[
              {n:'74%',text:'av revisorer uppger att de inte litar på AI-svar utan källhänvisning.'},
              {n:'2–3h',text:'spenderar en genomsnittlig konsult per vecka på att leta upp och verifiera regelinformation.'},
              {n:'0 kr',text:'är värdet av ett AI-svar du inte kan bevisa inför Skatteverket eller din klient.'},
            ].map((s,i)=>(
              <div key={i} style={{padding:'72px 56px',background:'#0A0A0C'}}>
                <div className="cg" style={{fontSize:'clamp(64px,7vw,96px)',color:'#C0321A',lineHeight:1,letterSpacing:'-.03em',marginBottom:28}}>{s.n}</div>
                <div className="mono" style={{fontSize:18,color:'#555',lineHeight:1.9}}>{s.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section className="section-pad" style={{padding:'180px 140px',borderBottom:'1px solid #E0DDD6',background:'#FAFAF8'}}>
        <div style={{maxWidth:1100,margin:'0 auto',textAlign:'center'}}>
          <div className="mono" style={{fontSize:13,letterSpacing:'.14em',textTransform:'uppercase',color:'#C0321A',marginBottom:40}}>Lösningen</div>
          <h2 className="cg" style={{fontSize:'clamp(56px,7vw,100px)',lineHeight:1.0,color:'#0A0A0C',letterSpacing:'-.03em',marginBottom:56}}>
            Varje svar har en adress.<br/><em>Varje källa går att klicka.</em>
          </h2>
          <p className="mono" style={{fontSize:20,color:'#666',lineHeight:2.1,maxWidth:780,margin:'0 auto 80px'}}>
            Normiq är inte ett chatverktyg med skattekunskap. Det är ett compliance-verktyg
            byggt kring ett levande regelindex — som aldrig lämnar ett svar utan att visa
            varifrån det kom.
          </p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:56,textAlign:'left'}}>
            {[
              {icon:'[IL 16 kap. 2 §]',title:'Exakt lagrum',desc:'Alltid paragrafnummer och kapitel. Klicka för att komma direkt till riksdagen.se.'},
              {icon:'● LÅG RISK',title:'Riskklassning',desc:'Automatisk bedömning om frågan är enkel, komplex eller kräver juridisk expertis.'},
              {icon:'AUDIT LOG',title:'Auditlogg',desc:'Varje fråga och svar sparas. Visa klienten, styrelsen eller Skatteverket.'},
            ].map(c=>(
              <div key={c.title} style={{borderTop:'3px solid #C0321A',paddingTop:36}}>
                <div className="mono" style={{fontSize:13,color:'#C0321A',marginBottom:24,letterSpacing:'.06em'}}>{c.icon}</div>
                <div className="cg" style={{fontSize:36,color:'#0A0A0C',marginBottom:20,lineHeight:1.15}}>{c.title}</div>
                <div className="mono" style={{fontSize:17,color:'#888',lineHeight:1.9}}>{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="funktioner" className="section-pad" style={{padding:'180px 140px',borderBottom:'1px solid #E0DDD6'}}>
        <div style={{maxWidth:1400,margin:'0 auto'}}>
          <div className="feat-wrap" style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:120,alignItems:'start'}}>
            <div style={{position:'sticky',top:120}}>
              <div className="mono" style={{fontSize:13,letterSpacing:'.12em',textTransform:'uppercase',color:'#C0321A',marginBottom:32}}>Funktioner</div>
              <h2 className="cg" style={{fontSize:'clamp(52px,5vw,80px)',lineHeight:1.05,letterSpacing:'-.02em',color:'#0A0A0C',marginBottom:36}}>
                Allt du<br/>behöver.<br/><em>Inget du<br/>inte behöver.</em>
              </h2>
              <p className="mono" style={{fontSize:17,color:'#888',lineHeight:1.9}}>
                Normiq är byggt specifikt för svensk skatt och redovisning. Inte ett generellt AI-verktyg. Ett professionellt arbetsverktyg.
              </p>
            </div>
            <div className="feat-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:1,background:'#E0DDD6'}}>
              {[
                {n:'01',t:'Citation-first svar',d:'Varje svar innehåller exakta lagrum och paragrafnummer. Om källan inte finns — ges inget svar.'},
                {n:'02',t:'Tre svarsnivåer',d:'Juridiskt exakt för juristen. Förenklat för konsulten. Räkneexempel för klienten. Alltid alla tre.'},
                {n:'03',t:'Automatisk riskklassning',d:'LÅG, MEDEL eller HÖG — baserat på rättspraxis och regelkomplexitet. Aldrig en gissning.'},
                {n:'04',t:'Komplett auditlogg',d:'Alla frågor loggas med timestamp, källa och riskbedömning. Perfekt dokumentation.'},
                {n:'05',t:'Levande regelindex',d:'IL, ML, SFL, BFL, ABL, BFN och SKV. Automatiskt uppdaterat. Alltid aktuellt.'},
                {n:'06',t:'Klickbara källhänvisningar',d:'Varje paragraf är en aktiv länk till riksdagen.se eller skatteverket.se. Verifiera direkt.'},
              ].map(f=>(
                <div key={f.n} className="fc">
                  <div className="mono" style={{fontSize:13,color:'#C0321A',marginBottom:28,letterSpacing:'.08em'}}>{f.n}</div>
                  <div className="cg" style={{fontSize:40,marginBottom:24,color:'#0A0A0C',lineHeight:1.1}}>{f.t}</div>
                  <div className="mono" style={{fontSize:18,color:'#888',lineHeight:1.9}}>{f.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FOR WHO */}
      <section className="section-pad" style={{padding:'180px 140px',background:'#0A0A0C',borderBottom:'1px solid #1a1a1e'}}>
        <div style={{maxWidth:1400,margin:'0 auto'}}>
          <div className="mono" style={{fontSize:13,letterSpacing:'.12em',textTransform:'uppercase',color:'#C0321A',marginBottom:28,textAlign:'center'}}>För vem</div>
          <h2 className="cg" style={{fontSize:'clamp(56px,7vw,100px)',lineHeight:.95,color:'white',textAlign:'center',marginBottom:16,letterSpacing:'-.03em'}}>
            Byggt för dem som
          </h2>
          <h2 className="cg" style={{fontSize:'clamp(56px,7vw,100px)',lineHeight:.95,textAlign:'center',marginBottom:100,letterSpacing:'-.03em',fontStyle:'italic'}}>
            <em style={{color:'#C0321A'}}>inte har råd att ha fel.</em>
          </h2>
          <div className="who-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:1,background:'#1a1a1e'}}>
            {[
              {icon:'⚖',t:'Redovisnings-konsulter',d:'Halvera din researchtid. Dokumentera rättsstödet. Fakturera fler timmar med bättre marginaler.'},
              {icon:'§',t:'Skattejurister',d:'Snabb och verifierbar förstaanalys. Låt Normiq göra grundjobbet — du gör bedömningen.'},
              {icon:'📊',t:'CFO:er & ekonomichefer',d:'Bygg intern compliance-kultur med automatisk dokumentation och auditspår för styrelsen.'},
              {icon:'🏢',t:'Redovisnings-byråer',d:'Ge hela teamet samma kvalitet. Konsekvent, spårbart och skalbart från dag ett.'},
            ].map(a=>(
              <div key={a.t} style={{padding:'72px 48px',background:'#0A0A0C',transition:'background .2s',cursor:'default'}}
                onMouseEnter={e=>(e.currentTarget.style.background='#0f0f13')}
                onMouseLeave={e=>(e.currentTarget.style.background='#0A0A0C')}>
                <div style={{fontSize:44,marginBottom:32}}>{a.icon}</div>
                <div className="cg" style={{fontSize:34,color:'white',marginBottom:24,lineHeight:1.1}}>{a.t}</div>
                <div className="mono" style={{fontSize:18,color:'#4a4a4e',lineHeight:1.9}}>{a.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="priser" className="section-pad" style={{padding:'180px 140px',borderBottom:'1px solid #E0DDD6'}}>
        <div style={{maxWidth:1300,margin:'0 auto'}}>
          <div className="mono" style={{fontSize:13,letterSpacing:'.12em',textTransform:'uppercase',color:'#C0321A',marginBottom:28,textAlign:'center'}}>Priser</div>
          <h2 className="cg" style={{fontSize:'clamp(56px,7vw,100px)',lineHeight:1.0,color:'#0A0A0C',textAlign:'center',marginBottom:24,letterSpacing:'-.03em'}}>
            Transparent prissättning
          </h2>
          <p className="mono" style={{fontSize:20,color:'#888',textAlign:'center',marginBottom:100,lineHeight:1.8}}>
            Karnov kostar 40 000 kr/år. Normiq kostar en timmes fakturerbar tid.
          </p>
          <div className="price-grid" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:1,background:'#E0DDD6'}}>
            {[
              {name:'Starter',price:'490',unit:'kr/mån',desc:'För enskilda konsulter som vill testa',features:['50 frågor per månad','Grundläggande regelindex','Källhänvisningar & riskklassning','Auditlogg','E-postsupport'],featured:false},
              {name:'Pro',price:'1 990',unit:'kr/mån',desc:'För byråer upp till 10 användare',features:['Obegränsat antal frågor','Fullständigt regelindex — IL, ML, SFL, BFL, ABL','Komplett auditlogg & PDF-export','API-access','Prioritetssupport inom 4h'],featured:true},
              {name:'Enterprise',price:'Offert',unit:'',desc:'För stora byråer och bolag',features:['Anpassat regelindex','SSO & on-prem option','SLA 99.9% med garanti','Dedikerad kundansvarig','White-label möjlighet'],featured:false},
            ].map(p=>(
              <div key={p.name} className="pc" style={{background:p.featured?'#0A0A0C':'white'}}>
                {p.featured&&(
                  <div className="mono" style={{fontSize:12,letterSpacing:'.1em',textTransform:'uppercase',color:'#C0321A',marginBottom:32}}>● Mest populär</div>
                )}
                <div className="cg" style={{fontSize:44,color:p.featured?'white':'#0A0A0C',marginBottom:16}}>{p.name}</div>
                <div style={{marginBottom:16,lineHeight:1}}>
                  <span className="cg" style={{fontSize:80,color:p.featured?'white':'#0A0A0C',lineHeight:1,letterSpacing:'-.04em'}}>{p.price}</span>
                  {p.unit&&<span className="mono" style={{fontSize:17,color:p.featured?'#444':'#999',marginLeft:12}}>{p.unit}</span>}
                </div>
                <div className="mono" style={{fontSize:17,color:p.featured?'#444':'#999',marginBottom:44,lineHeight:1.7}}>{p.desc}</div>
                <div style={{display:'flex',flexDirection:'column',gap:20,marginBottom:60}}>
                  {p.features.map(f=>(
                    <div key={f} style={{display:'flex',gap:16,alignItems:'flex-start'}}>
                      <span style={{color:'#C0321A',flexShrink:0,fontSize:20,lineHeight:1.4}}>→</span>
                      <span className="mono" style={{fontSize:16,color:p.featured?'#777':'#444',lineHeight:1.6}}>{f}</span>
                    </div>
                  ))}
                </div>
                <a href="/register" style={{
                  display:'block', textAlign:'center',
                  fontFamily:'DM Mono,monospace', fontSize:15, fontWeight:500,
                  letterSpacing:'.1em', textTransform:'uppercase',
                  padding:22, textDecoration:'none',
                  background:p.featured?'#C0321A':'transparent',
                  color:p.featured?'white':'#0A0A0C',
                  border:p.featured?'none':'2px solid #0A0A0C',
                  transition:'all .2s'
                }}
                  onMouseEnter={e=>{if(!p.featured){(e.currentTarget as HTMLElement).style.background='#0A0A0C';(e.currentTarget as HTMLElement).style.color='white'}}}
                  onMouseLeave={e=>{if(!p.featured){(e.currentTarget as HTMLElement).style.background='transparent';(e.currentTarget as HTMLElement).style.color='#0A0A0C'}}}>
                  {p.price==='Offert'?'Kontakta oss →':'Kom igång gratis →'}
                </a>
                {p.featured&&<div className="mono" style={{fontSize:13,color:'#333',textAlign:'center',marginTop:20,letterSpacing:'.06em'}}>14 dagar gratis · Inget kreditkort</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="section-pad" style={{padding:'180px 140px',borderBottom:'1px solid #E0DDD6',background:'#FAFAF8'}}>
        <div style={{maxWidth:1000,margin:'0 auto'}}>
          <div className="mono" style={{fontSize:13,letterSpacing:'.12em',textTransform:'uppercase',color:'#C0321A',marginBottom:28,textAlign:'center'}}>FAQ</div>
          <h2 className="cg" style={{fontSize:'clamp(56px,6vw,88px)',lineHeight:1.05,color:'#0A0A0C',textAlign:'center',marginBottom:88,letterSpacing:'-.02em'}}>
            Vanliga frågor
          </h2>
          {[
            {q:'Ersätter Normiq en skattejurist?',a:'Nej — och det är ett medvetet designbeslut. Normiq är ett research- och dokumentationsverktyg. Det ger dig rätt lagtext och källhänvisning snabbt, men bedömning av komplexa ärenden kräver alltid en jurist. Normiq talar tydligt om när risken är hög och du bör söka experthjälp.'},
            {q:'Hur aktuell är lagdatabasen?',a:'Vi hämtar automatiskt uppdaterad lagtext från riksdagen.se och skatteverket.se. När en lag ändras uppdateras regelindexet inom 24 timmar. Alla svar inkluderar datum för den lagversion som användes.'},
            {q:'Vad händer med mina frågor och svar?',a:'Dina frågor och svar lagras i din privata auditlogg och är bara tillgängliga för dig. Vi använder aldrig dina frågor för att träna AI-modeller. All data lagras i Sverige och omfattas av GDPR.'},
            {q:'Varför är det dyrare än ChatGPT?',a:'ChatGPT är ett generellt verktyg utan källhänvisningar, utan regelindex och utan auditlogg. Du betalar inte för AI — du betalar för ett kurerat regelindex, verifierbara svar och infrastrukturen som gör dig ansvarsfri inför klient och myndighet. Karnov kostar 40 000 kr/år. Vi kostar en bråkdel.'},
            {q:'Kan jag prova innan jag betalar?',a:'Ja. Du får 14 dagar gratis på alla planer — inget kreditkort behövs. Om du inte är nöjd kostar det dig ingenting och vi förklarar gärna varför.'},
          ].map((item,i)=><FaqItem key={i} q={item.q} a={item.a}/>)}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="section-pad" style={{padding:'200px 140px',background:'#0A0A0C',textAlign:'center',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'800px',height:'800px',borderRadius:'50%',background:'radial-gradient(circle,rgba(192,50,26,.07) 0%,transparent 70%)',pointerEvents:'none'}}/>
        <div className="mono" style={{fontSize:13,letterSpacing:'.16em',textTransform:'uppercase',color:'#C0321A',marginBottom:36}}>
          Kom igång idag
        </div>
        <h2 className="cg" style={{fontSize:'clamp(72px,10vw,140px)',lineHeight:.88,color:'white',marginBottom:36,letterSpacing:'-.04em'}}>
          Dina svar.<br/><em style={{color:'#C0321A'}}>Med bevis.</em>
        </h2>
        <p className="mono" style={{fontSize:20,color:'#555',maxWidth:600,margin:'0 auto 80px',lineHeight:2.1}}>
          Gå med i de redovisningskonsulter och skattejurister som redan arbetar med källhänvisningar i varje svar.
        </p>
        <div style={{display:'flex',gap:32,justifyContent:'center',alignItems:'center',flexWrap:'wrap'}}>
          <a href="/register" className="btn-p" style={{fontSize:16,padding:'26px 64px'}}>Skapa konto gratis →</a>
          <a href="/login" className="btn-g" style={{fontSize:16}}>Redan kund? Logga in</a>
        </div>
        <div className="mono" style={{fontSize:14,color:'#2a2a2e',marginTop:36,letterSpacing:'.06em'}}>
          14 dagar gratis · Inget kreditkort · Avsluta när du vill
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{borderTop:'1px solid #1a1a1e',background:'#0A0A0C',padding:'60px 140px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:24}}>
        <div className="cg" style={{fontSize:32,color:'white',fontWeight:600,letterSpacing:'-.02em'}}>
          Normi<span style={{color:'#C0321A'}}>q</span>
        </div>
        <div className="mono" style={{fontSize:13,color:'#2a2a2e',letterSpacing:'.04em'}}>© 2025 Normiq AB. Compliance intelligence.</div>
        <div style={{display:'flex',gap:40}}>
          {['Integritet','Villkor','Kontakt'].map(l=>(
            <a key={l} href="#" className="mono" style={{fontSize:13,color:'#2a2a2e',textDecoration:'none',letterSpacing:'.06em',transition:'color .2s'}}
              onMouseEnter={e=>((e.currentTarget as HTMLElement).style.color='#666')}
              onMouseLeave={e=>((e.currentTarget as HTMLElement).style.color='#2a2a2e')}>{l}</a>
          ))}
        </div>
      </footer>
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="faq" onClick={() => setOpen(v => !v)}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontFamily:'Cormorant Garamond,Georgia,serif',fontSize:36,color:'#0A0A0C',lineHeight:1.2,paddingRight:48,fontWeight:400}}>{q}</div>
        <div style={{fontFamily:'DM Mono,monospace',fontSize:28,color:'#C0321A',flexShrink:0,transition:'transform .25s',transform:open?'rotate(45deg)':'none'}}>+</div>
      </div>
      {open&&(
        <div style={{fontFamily:'DM Mono,monospace',fontSize:18,color:'#777',lineHeight:2,marginTop:28,maxWidth:860,paddingRight:80}}>{a}</div>
      )}
    </div>
  )
}