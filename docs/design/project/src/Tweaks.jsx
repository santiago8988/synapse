function Tweaks({ open, onClose, theme, setTheme, density, setDensity }) {
  return (
    <div className={"tweaks-panel" + (open ? " open" : "")}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <h4>Twe<em>aks</em></h4>
        <button className="icon-btn" onClick={onClose} style={{width:28,height:28}}><Ico.Close width="12" height="12"/></button>
      </div>
      <div style={{fontSize:11.5,color:"var(--ink-3)",marginBottom:16,fontFamily:"var(--mono)",letterSpacing:"0.05em"}}>
        · Ajustes de visualización
      </div>

      <div className="tw-row">
        <div className="tw-row-head"><span>Tema</span><span className="val">{theme.toUpperCase()}</span></div>
        <div className="tw-segment">
          <button className={theme==="light"?"on":""} onClick={()=>setTheme("light")}>☀ Claro</button>
          <button className={theme==="dark"?"on":""} onClick={()=>setTheme("dark")}>☾ Oscuro</button>
        </div>
      </div>

      <div className="tw-row">
        <div className="tw-row-head"><span>Densidad</span><span className="val">{density.toUpperCase()}</span></div>
        <div className="tw-segment">
          <button className={density==="dense"?"on":""} onClick={()=>setDensity("dense")}>Densa</button>
          <button className={density==="normal"?"on":""} onClick={()=>setDensity("normal")}>Normal</button>
          <button className={density==="cozy"?"on":""} onClick={()=>setDensity("cozy")}>Cómoda</button>
        </div>
      </div>

      <div style={{fontSize:11.5,color:"var(--ink-3)",marginTop:18,paddingTop:14,borderTop:"1px solid var(--line)",lineHeight:1.5}}>
        El tema oscuro usa el cian eléctrico de marca como acento primario. La densidad afecta alturas de fila e inputs.
      </div>
    </div>
  );
}
window.Tweaks = Tweaks;
