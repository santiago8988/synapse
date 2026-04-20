function RecordDetail({ onBack, onOpenMobile }) {
  const [tab, setTab] = React.useState("entries");

  const entries = [
    { code:"VBAL‑20260420‑02", date:"20 abr · 09:14", user:"J. Parodi", lectura:"100.612 g", desv:"612 mg", status:"fail" },
    { code:"VBAL‑20260419‑01", date:"19 abr · 17:02", user:"S. Domínguez", lectura:"100.001 g", desv:"1 mg", status:"ok" },
    { code:"VBAL‑20260418‑01", date:"18 abr · 17:00", user:"S. Domínguez", lectura:"99.998 g", desv:"‑2 mg", status:"ok" },
    { code:"VBAL‑20260417‑01", date:"17 abr · 16:58", user:"L. Ruíz", lectura:"100.000 g", desv:"0 mg", status:"ok" },
    { code:"VBAL‑20260416‑02", date:"16 abr · 17:21", user:"L. Ruíz", lectura:"100.004 g", desv:"4 mg", status:"ok" },
    { code:"VBAL‑20260415‑01", date:"15 abr · 16:55", user:"S. Domínguez", lectura:"99.999 g", desv:"‑1 mg", status:"ok" },
  ];

  return (
    <div className="fade-in">
      <div className="rec-hero">
        <div>
          <div style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:"0.2em",textTransform:"uppercase",color:"var(--ink-3)",marginBottom:6}}>
            · RECORD · VBAL‑003
          </div>
          <h2>Verificación diaria <span className="italic">balanza.</span></h2>
          <div className="rec-hero-meta">
            <div className="m"><span className="mk">ESTADO</span><span className="mv"><span className="chip chip-active"><span className="pulse"></span>ACTIVO</span></span></div>
            <div className="m"><span className="mk">PERIODICIDAD</span><span className="mv">Diaria</span></div>
            <div className="m"><span className="mk">ÁREA</span><span className="mv">Volumetría</span></div>
            <div className="m"><span className="mk">INSTRUMENTO</span><span className="mv" style={{fontFamily:"var(--mono)"}}>BAL‑003</span></div>
            <div className="m"><span className="mk">PRÓXIMO</span><span className="mv">Hoy · 17:00</span></div>
            <div className="m"><span className="mk">OWNER</span><span className="mv">Sofía Domínguez</span></div>
          </div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
          <button className="btn btn-ghost" onClick={onOpenMobile}>Ver en móvil</button>
          <button className="btn btn-primary"><Ico.Plus width="12" height="12"/> Nueva entry</button>
        </div>
      </div>

      <div className="rec-grid">
        <div style={{display:"flex",flexDirection:"column",gap:20}}>
          <div className="card">
            <div className="card-head"><div><div className="eyebrow">· Campos del registro</div><h3 style={{marginTop:6}}>5 campos</h3></div></div>
            <div style={{padding:"4px 0"}}>
              {[
                {n:"CÓDIGO", t:"DEFAULT · texto", u:"—"},
                {n:"Patrón", t:"NUMBER", u:"g · req"},
                {n:"Lectura balanza", t:"NUMBER", u:"g · req"},
                {n:"Desviación", t:"FORMULA", u:"mg · calc"},
                {n:"¿Dentro de tolerancia?", t:"COMPARISON", u:"± 0.5 mg"},
              ].map((f,i) => (
                <div key={i} style={{padding:"12px 20px",display:"flex",justifyContent:"space-between",borderTop: i ? "1px solid var(--line)" : "none",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:13.5,fontWeight:500,color:"var(--ink-0)"}}>{f.n}</div>
                    <div style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:"0.1em",color:"var(--ink-3)",marginTop:3,textTransform:"uppercase"}}>{f.t}</div>
                  </div>
                  <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--ink-2)"}}>{f.u}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><div><div className="eyebrow">· Acciones cascada</div><h3 style={{marginTop:6}}>Automáticas</h3></div></div>
            <div style={{padding:"16px 20px"}}>
              <div className="cascade-card" style={{background:"var(--bg-1)"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <span className="chip chip-active"><span className="pulse"></span>ON FAIL</span>
                  <span style={{fontSize:12,color:"var(--ink-2)"}}>tolerancia fuera de rango</span>
                </div>
                <div style={{fontSize:13,lineHeight:1.7,color:"var(--ink-1)"}}>
                  <span className="cascade-arrow">→</span> Genera entry en <code>NC‑automáticas</code><br/>
                  <span className="cascade-arrow">→</span> Estado de <b style={{color:"var(--ink-0)"}}>BAL‑003</b> <code>→ IN_CALIBRATION</code><br/>
                  <span className="cascade-arrow">→</span> Notifica a <b style={{color:"var(--ink-0)"}}>S. Domínguez</b>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><div><div className="eyebrow">· Cumplimiento</div><h3 style={{marginTop:6}}>30 días</h3></div></div>
            <div style={{padding:"20px 22px"}}>
              <div style={{fontFamily:"var(--serif)",fontSize:42,lineHeight:1,color:"var(--ink-0)",letterSpacing:"-0.02em"}}>
                96<span style={{fontStyle:"italic",color:"var(--primary)"}}>%</span>
              </div>
              <div style={{fontSize:12,color:"var(--ink-2)",marginTop:8}}>28 de 29 verificaciones dentro de tolerancia</div>
              <div style={{display:"flex",gap:3,marginTop:14}}>
                {Array.from({length:29}).map((_,i) => {
                  const fail = i === 5;
                  return <div key={i} style={{flex:1,height:28,borderRadius:2,background: fail ? "var(--danger)" : "var(--ok)",opacity:fail?1:0.75}}></div>;
                })}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontFamily:"var(--mono)",fontSize:10,color:"var(--ink-3)",letterSpacing:"0.08em"}}>
                <span>22 MAR</span><span>HOY</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div style={{display:"flex",gap:0,borderBottom:"0"}}>
              {[["entries","Entries · 29"],["versions","Versiones · 3"],["audit","Auditoría"]].map(([k,l]) => (
                <button key={k}
                  onClick={() => setTab(k)}
                  style={{
                    padding:"4px 14px 6px",
                    fontSize:13,
                    fontWeight:500,
                    color: tab===k ? "var(--ink-0)" : "var(--ink-2)",
                    borderBottom: tab===k ? "2px solid var(--primary)" : "2px solid transparent",
                    marginBottom:-18,
                  }}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-subtle" style={{padding:"6px 10px"}}><Ico.Filter width="14" height="14"/> Filtrar</button>
              <button className="btn btn-subtle" style={{padding:"6px 10px"}}>Exportar <Ico.Arrow width="12" height="12"/></button>
            </div>
          </div>
          {tab === "entries" && (
            <table className="table">
              <thead><tr><th>Código</th><th>Fecha</th><th>Usuario</th><th>Lectura</th><th>Desv.</th><th style={{textAlign:"right"}}>Resultado</th></tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.code}>
                    <td className="col-mono">{e.code}</td>
                    <td>{e.date}</td>
                    <td>{e.user}</td>
                    <td className="col-mono">{e.lectura}</td>
                    <td className="col-mono" style={{color: e.status==="fail" ? "var(--danger)":"var(--ink-1)"}}>{e.desv}</td>
                    <td style={{textAlign:"right"}}><span className={"chip " + (e.status==="fail" ? "chip-fail" : "chip-ok")}>{e.status==="fail" ? "FALLIDA" : "OK"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "versions" && (
            <div style={{padding:20,fontSize:13,color:"var(--ink-2)"}}>3 versiones publicadas — v1 (ene), v2 (feb), v3 actual (abr). El cambio clave en v3: tolerancia pasó de ±1.0 mg a ±0.5 mg.</div>
          )}
          {tab === "audit" && (
            <div style={{padding:20,fontSize:13,color:"var(--ink-2)"}}>Log inmutable — 142 eventos. Cada entry firmada digitalmente por el usuario, sellado temporal del servidor.</div>
          )}
        </div>
      </div>
    </div>
  );
}
window.RecordDetail = RecordDetail;
