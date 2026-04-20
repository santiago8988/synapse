function MobileForm({ onBack }) {
  const [patron, setPatron] = React.useState("100.000");
  const [lectura, setLectura] = React.useState("100.612");
  const desv = React.useMemo(() => {
    const p = parseFloat(patron), l = parseFloat(lectura);
    if (isNaN(p) || isNaN(l)) return "—";
    return ((l - p) * 1000).toFixed(3);
  }, [patron, lectura]);
  const numDesv = parseFloat(desv);
  const fail = !isNaN(numDesv) && Math.abs(numDesv) > 0.5;

  return (
    <div className="fade-in" style={{padding:"0 32px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",padding:"24px 0 8px"}}>
        <div>
          <div style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:"0.2em",textTransform:"uppercase",color:"var(--ink-3)",marginBottom:6}}>
            · Vista móvil
          </div>
          <h1 style={{fontFamily:"var(--serif)",fontSize:36,fontWeight:400,margin:0,letterSpacing:"-0.02em",lineHeight:1.1}}>
            Entry como <span style={{fontStyle:"italic",color:"var(--primary)"}}>en el piso.</span>
          </h1>
          <p style={{color:"var(--ink-2)",fontSize:14,maxWidth:520,marginTop:8}}>
            El mismo registro renderizado como formulario dinámico. Fórmula y comparación se evalúan en vivo — sin sincronización manual.
          </p>
        </div>
        <button className="btn btn-ghost" onClick={onBack}>← Volver</button>
      </div>

      <div className="phone-stage">
        <div className="phone">
          <div className="phone-screen">
            <div className="ph-status">
              <span>9:41</span>
              <span className="icons">
                <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor"><rect x="0" y="6" width="3" height="4" rx="0.5"/><rect x="4" y="4" width="3" height="6" rx="0.5"/><rect x="8" y="2" width="3" height="8" rx="0.5"/><rect x="12" y="0" width="3" height="10" rx="0.5"/></svg>
                <svg width="16" height="10" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M1 6 C4 2, 12 2, 15 6 M3 8 C5 5, 11 5, 13 8 M6 10 L8 11.5 L10 10"/></svg>
                <svg width="22" height="10" viewBox="0 0 22 10" fill="none" stroke="currentColor" strokeWidth="1"><rect x="1" y="1" width="18" height="8" rx="2"/><rect x="2.5" y="2.5" width="13" height="5" rx="0.8" fill="currentColor"/><rect x="20" y="3.5" width="1.5" height="3" rx="0.5" fill="currentColor"/></svg>
              </span>
            </div>

            <div className="ph-header">
              <div className="ph-back"><Ico.Chev width="14" height="14" style={{transform:"rotate(90deg)"}}/></div>
              <div className="ph-title">
                <div className="t">Verif. balanza BAL‑003</div>
                <div className="s">· VBAL‑20260420‑02 · BORRADOR</div>
              </div>
              <div className="ph-back"><Ico.Close width="14" height="14"/></div>
            </div>

            <div className="ph-body">
              <div className="ph-section-label">· Identificación</div>
              <div className="ph-field">
                <div className="ph-field-label">CÓDIGO <Ico.Lock width="11" height="11" style={{color:"var(--ink-3)"}}/></div>
                <input className="input" value="VBAL‑20260420‑02" readOnly style={{background:"var(--bg-3)",color:"var(--ink-2)",fontFamily:"var(--mono)",fontSize:14}}/>
              </div>

              <div className="ph-section-label" style={{marginTop:20}}>· Medición</div>
              <div className="ph-field">
                <div className="ph-field-label">Patrón <span style={{color:"var(--danger)"}}>*</span></div>
                <div className="unit-input"><input value={patron} onChange={e=>setPatron(e.target.value)} inputMode="decimal"/><span className="unit">g</span></div>
              </div>
              <div className="ph-field">
                <div className="ph-field-label">Lectura balanza <span style={{color:"var(--danger)"}}>*</span></div>
                <div className="unit-input"><input value={lectura} onChange={e=>setLectura(e.target.value)} inputMode="decimal"/><span className="unit">g</span></div>
              </div>
              <div className="ph-field">
                <div className="ph-field-label">Desviación <span style={{color:"var(--ink-3)",fontFamily:"var(--mono)",fontSize:10,letterSpacing:"0.08em"}}>CALCULADO</span></div>
                <div className="ph-calc-box">
                  <span>{desv}</span><span className="unit">mg</span>
                </div>
              </div>

              <div className="ph-section-label" style={{marginTop:20}}>· Tolerancia ± 0.5 mg</div>
              {fail ? (
                <div className="ph-result-fail">
                  <span className="x"><Ico.X width="14" height="14"/></span>
                  <span className="txt">Fuera de tolerancia — al guardar se genera NC automática y BAL‑003 pasa a <code style={{fontFamily:"var(--mono)",fontSize:11}}>IN_CALIBRATION</code></span>
                </div>
              ) : (
                <div style={{padding:"14px 16px",background:"var(--ok-soft)",border:"1.5px solid var(--ok)",borderRadius:12,display:"flex",alignItems:"center",gap:12}}>
                  <span style={{width:28,height:28,background:"var(--ok)",color:"#fff",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}><Ico.Check width="14" height="14"/></span>
                  <span style={{fontSize:13.5,color:"var(--ok)",fontWeight:500}}>Dentro de tolerancia</span>
                </div>
              )}

              <div className="ph-section-label" style={{marginTop:20}}>· Evidencia</div>
              <div className="ph-attach-row">
                <div className="ph-attach"><Ico.Camera width="16" height="16"/> Foto</div>
                <div className="ph-attach"><Ico.Paperclip width="16" height="16"/> Archivo</div>
              </div>

              <div className="ph-section-label" style={{marginTop:20}}>· Observaciones</div>
              <textarea className="textarea" placeholder="Opcional — comentario del técnico" style={{fontSize:15,minHeight:70}}></textarea>
            </div>

            <div className="ph-bottom">
              <button className="btn btn-ghost">Borrador</button>
              <button className={"btn " + (fail ? "btn-danger" : "btn-primary")} style={{flex:1.4}}>
                {fail ? "Guardar + NC" : "Guardar"} <Ico.ArrowR width="12" height="12"/>
              </button>
            </div>
          </div>
        </div>

        {/* Side annotations */}
        <div style={{maxWidth:280,marginLeft:30,display:"flex",flexDirection:"column",gap:20,paddingTop:40,color:"var(--ink-2)",fontSize:12.5,lineHeight:1.55}}>
          <div>
            <div style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:"0.2em",color:"var(--primary)",textTransform:"uppercase",marginBottom:6}}>· 01</div>
            <b style={{color:"var(--ink-0)",fontSize:13}}>Hit targets ≥ 48 px.</b>
            <div style={{marginTop:4}}>Los campos respetan guías de accesibilidad móvil sin sacrificar densidad en desktop.</div>
          </div>
          <div>
            <div style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:"0.2em",color:"var(--primary)",textTransform:"uppercase",marginBottom:6}}>· 02</div>
            <b style={{color:"var(--ink-0)",fontSize:13}}>Fórmula en vivo.</b>
            <div style={{marginTop:4}}>La desviación se calcula mientras el técnico tipea — mismo motor que en desktop.</div>
          </div>
          <div>
            <div style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:"0.2em",color:"var(--warn)",textTransform:"uppercase",marginBottom:6}}>· 03</div>
            <b style={{color:"var(--ink-0)",fontSize:13}}>El fallo se dice antes de guardar.</b>
            <div style={{marginTop:4}}>La cascada de NC se anuncia explícitamente — no es una sorpresa post‑submit.</div>
          </div>
          <div>
            <div style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:"0.2em",color:"var(--accent)",textTransform:"uppercase",marginBottom:6}}>· 04</div>
            <b style={{color:"var(--ink-0)",fontSize:13}}>Tipo numérico → teclado numérico.</b>
            <div style={{marginTop:4}}><code style={{fontFamily:"var(--mono)",fontSize:11}}>inputMode="decimal"</code> para que el teclado del dispositivo se adapte al tipo del campo.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
window.MobileForm = MobileForm;
