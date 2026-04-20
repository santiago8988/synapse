function RecordBuilder({ onBack, onOpenDetail }) {
  const [recordName, setRecordName] = React.useState("Verificación diaria balanza");
  const [recordType, setRecordType] = React.useState("PERIODIC");
  const [periodicity, setPeriodicity] = React.useState("1");
  const [notify, setNotify] = React.useState("1");
  const [previewDevice, setPreviewDevice] = React.useState("desktop");
  const [selectedField, setSelectedField] = React.useState("tolerancia");

  const types = [
    ["PERIODIC","Periódico"],["NOT_PERIODIC","Eventual"],
    ["BATCH","Lote"],["SAMPLE","Muestra"],
    ["CALIBRATION","Calibración"],["INSTRUMENTAL","Instrumental"]
  ];

  const fields = [
    { id:"code", name:"CÓDIGO", type:"default", unit:null, locked:true, required:true },
    { id:"patron", name:"Patrón", type:"NUMBER", unit:"g", required:true },
    { id:"lectura", name:"Lectura balanza", type:"NUMBER", unit:"g", required:true },
    { id:"desviacion", name:"Desviación", type:"FORMULA", unit:"mg", expr:"({lectura}-{patrón})*1000" },
    { id:"tolerancia", name:"¿Dentro de tolerancia?", type:"COMPARISON", operator:"BETWEEN", min:-0.5, max:0.5, unit:"mg", required:true },
  ];

  const RenderField = (f) => {
    const selected = f.id === selectedField;
    const typeClass = f.type === "FORMULA" ? "formula" : f.type === "COMPARISON" ? "compare" : "";
    return (
      <div key={f.id} className={"field-card" + (selected ? " selected" : "")} onClick={() => setSelectedField(f.id)}>
        <div className="field-card-head">
          <span className="fc-drag"><Ico.Drag width="12" height="12"/></span>
          <div className="fc-label">
            <span className="fc-name">{f.name}</span>
            <span className={"fc-type " + typeClass}>{f.type}{f.unit ? " · " + f.unit : ""}</span>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",fontSize:11,color:"var(--ink-3)"}}>
            {f.required && <span style={{fontFamily:"var(--mono)",letterSpacing:"0.05em"}}>REQ</span>}
            {f.locked && <Ico.Lock width="12" height="12" className="fc-locked"/>}
          </div>
          <button className="btn-subtle" style={{padding:"4px 6px",color:"var(--ink-3)"}}>
            <Ico.Chev width="12" height="12" style={{transform: selected ? "rotate(180deg)" : null, transition:"transform .2s"}}/>
          </button>
        </div>
        {selected && (
          <div className="fc-expand">
            {f.type === "COMPARISON" && (
              <>
                <div className="field">
                  <span className="field-label">Operador</span>
                  <select className="select" defaultValue="BETWEEN">
                    <option>BETWEEN</option><option>GREATER_THAN</option><option>LESS_THAN</option><option>EQUAL</option>
                  </select>
                </div>
                <div className="field">
                  <span className="field-label">Comparar contra</span>
                  <div className="radio-group">
                    <span className="radio-opt on"><span className="dot"></span>Constante</span>
                    <span className="radio-opt"><span className="dot"></span>Campo</span>
                  </div>
                </div>
                <div className="field">
                  <span className="field-label">Mínimo</span>
                  <div className="unit-input"><input type="text" defaultValue="-0.5"/><span className="unit">mg</span></div>
                </div>
                <div className="field">
                  <span className="field-label">Máximo</span>
                  <div className="unit-input"><input type="text" defaultValue="0.5"/><span className="unit">mg</span></div>
                </div>
                <div className="field full">
                  <span className="field-label">Mensaje en fallo</span>
                  <input className="input" defaultValue="Desviación fuera de tolerancia — generar NC"/>
                </div>
                <div className="full" style={{display:"flex",gap:14,paddingTop:6}}>
                  <label className="checkbox on"><span className="box"><Ico.Check/></span>Requerido</label>
                  <label className="checkbox"><span className="box"><Ico.Check/></span>Identificador</label>
                </div>
              </>
            )}
            {f.type === "FORMULA" && (
              <div className="field full">
                <span className="field-label">Expresión <span className="hint">JS · refs entre {"{}"}</span></span>
                <input className="input" style={{fontFamily:"var(--mono)",fontSize:13}} defaultValue="({lectura} - {patrón}) * 1000"/>
              </div>
            )}
            {f.type === "NUMBER" && (
              <>
                <div className="field"><span className="field-label">Unidad</span><input className="input" defaultValue={f.unit}/></div>
                <div className="field"><span className="field-label">Decimales</span><input className="input" defaultValue="3"/></div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div className="builder">
        {/* LEFT — Configuration */}
        <div className="builder-col">
          <div style={{marginBottom:22}}>
            <div style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:"0.2em",textTransform:"uppercase",color:"var(--ink-3)",marginBottom:8}}>· Record Builder</div>
            <h1 style={{fontFamily:"var(--serif)",fontSize:36,fontWeight:400,margin:0,letterSpacing:"-0.02em",lineHeight:1.1}}>
              Diseña un <span style={{fontStyle:"italic",color:"var(--primary)"}}>registro.</span>
            </h1>
          </div>

          <div className="builder-section">
            <div className="bs-head">
              <span className="bs-num">1</span>
              <span className="bs-title">Datos del registro</span>
            </div>
            <div style={{display:"grid",gap:14}}>
              <div className="field">
                <span className="field-label">Nombre <span className="req">*</span></span>
                <input className="input" value={recordName} onChange={(e) => setRecordName(e.target.value)}/>
              </div>
              <div className="field">
                <span className="field-label">Tipo de registro</span>
                <div className="radio-group">
                  {types.map(([k,v]) => (
                    <span key={k} className={"radio-opt" + (recordType === k ? " on" : "")} onClick={() => setRecordType(k)}>
                      <span className="dot"></span>{v}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                <div className="field">
                  <span className="field-label">Periodicidad</span>
                  <div className="unit-input"><input type="text" value={periodicity} onChange={(e) => setPeriodicity(e.target.value)}/><span className="unit">días</span></div>
                </div>
                <div className="field">
                  <span className="field-label">Notificar</span>
                  <div className="unit-input"><input type="text" value={notify} onChange={(e) => setNotify(e.target.value)}/><span className="unit">día antes</span></div>
                </div>
                <div className="field">
                  <span className="field-label">Área</span>
                  <select className="select"><option>Microbiología</option><option>Fisicoquímica</option><option>Volumetría</option></select>
                </div>
              </div>
              <div className="field">
                <span className="field-label">Documento base <span className="hint">SOP / PROC</span></span>
                <select className="select"><option>SOP‑LAB‑003 · Verificación diaria balanza (v3)</option></select>
              </div>
            </div>
          </div>

          <div className="builder-section">
            <div className="bs-head">
              <span className="bs-num">2</span>
              <span className="bs-title">Campos</span>
              <span className="bs-sub">{fields.length} campos · arrastrá para reordenar</span>
            </div>
            <div className="fields-list">
              {fields.map(RenderField)}
              <button className="add-field-btn"><Ico.Plus width="12" height="12"/> Agregar campo</button>
            </div>
          </div>

          <div className="builder-section">
            <div className="bs-head">
              <span className="bs-num">3</span>
              <span className="bs-title">Acciones en cascada</span>
            </div>
            <div className="cascade-card">
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <span className="chip chip-active"><span className="pulse"></span>TRIGGER</span>
                <span style={{color:"var(--ink-2)",fontSize:12}}>Cuando <b style={{color:"var(--ink-0)"}}>tolerancia = fallo</b></span>
              </div>
              <div style={{color:"var(--ink-1)",lineHeight:1.7}}>
                <span className="cascade-arrow">→</span> Crear Entry en <code>NCs automáticas</code>
                <br/>
                <span style={{marginLeft:16,color:"var(--ink-2)",fontSize:12}}>mapeo: <code>CÓDIGO</code> → <code>REF_ENTRY</code>, <code>desviación</code> → <code>magnitud</code></span>
              </div>
              <button className="btn btn-subtle" style={{marginTop:12,padding:"4px 0",fontSize:12}}><Ico.Plus width="10" height="10"/> Agregar acción</button>
            </div>
          </div>

          <div className="builder-section">
            <div className="bs-head">
              <span className="bs-num">4</span>
              <span className="bs-title">Publicación</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <span className="chip chip-draft">DRAFT</span>
              <button className="btn btn-ghost">Enviar a revisión <Ico.ArrowR width="12" height="12"/></button>
            </div>
          </div>
        </div>

        {/* RIGHT — Preview */}
        <div className="builder-col right">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
            <div>
              <div style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:"0.2em",textTransform:"uppercase",color:"var(--ink-3)",marginBottom:8}}>· Preview en vivo</div>
              <div style={{fontFamily:"var(--serif)",fontSize:22,letterSpacing:"-0.01em"}}>Como lo <span style={{fontStyle:"italic",color:"var(--primary)"}}>ven los técnicos.</span></div>
            </div>
            <div className="preview-tabs">
              <span className={"preview-tab" + (previewDevice==="desktop"?" active":"")} onClick={() => setPreviewDevice("desktop")}>🖥 DESKTOP</span>
              <span className={"preview-tab" + (previewDevice==="mobile"?" active":"")} onClick={() => setPreviewDevice("mobile")}>📱 MOBILE</span>
            </div>
          </div>

          <div className={"preview-frame " + previewDevice} style={{marginTop:18}}>
            <div style={{padding: previewDevice === "mobile" ? "18px 16px" : "24px 28px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div>
                  <div style={{fontFamily:"var(--serif)",fontSize: previewDevice==="mobile" ? 18 : 22,lineHeight:1.15}}>{recordName}</div>
                  <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--ink-3)",letterSpacing:"0.1em",marginTop:4,textTransform:"uppercase"}}>
                    DRAFT · Vence — · Creado por S.D.
                  </div>
                </div>
                {previewDevice==="desktop" && <span className="chip chip-draft">DRAFT</span>}
              </div>

              <div style={{display:"grid",gap:14}}>
                <div className="field">
                  <span className="field-label">CÓDIGO <span className="req">*</span></span>
                  <input className="input" placeholder="VBAL-20260420-01"/>
                </div>
                <div className="field">
                  <span className="field-label">Patrón <span className="req">*</span></span>
                  <div className="unit-input"><input type="text" placeholder="100.000"/><span className="unit">g</span></div>
                </div>
                <div className="field">
                  <span className="field-label">Lectura balanza <span className="req">*</span></span>
                  <div className="unit-input"><input type="text" placeholder="100.003"/><span className="unit">g</span></div>
                </div>
                <div className="field">
                  <span className="field-label">Desviación <span className="hint">Calculado</span></span>
                  <div className="unit-input">
                    <input className="calc" value="3.000" readOnly style={{fontFamily:"var(--mono)"}}/>
                    <span className="unit">mg</span>
                  </div>
                </div>
                <div className="field">
                  <span className="field-label">¿Dentro de tolerancia?</span>
                  <div style={{padding:"12px 14px",background:"var(--danger-soft)",border:"1.5px solid var(--danger)",borderRadius:10,display:"flex",alignItems:"center",gap:10,fontSize:13,color:"var(--danger)",fontWeight:500}}>
                    <span style={{width:22,height:22,background:"var(--danger)",color:"#fff",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}><Ico.X width="12" height="12"/></span>
                    Fuera de ±0.5 mg — generar NC
                  </div>
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:18}}>
                <button className="btn btn-ghost" style={{justifyContent:"center"}}><Ico.Camera width="14" height="14"/> Foto</button>
                <button className="btn btn-ghost" style={{justifyContent:"center"}}><Ico.Paperclip width="14" height="14"/> Archivo</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="builder-foot">
        <div className="st">
          <span className="chip chip-draft">DRAFT · no publicado</span>
          <span>Última edición: hace 2 min · Sofía Domínguez</span>
        </div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={onBack}>Cancelar</button>
          <button className="btn btn-ghost" onClick={() => onOpenDetail()}>Ver como registro</button>
          <button className="btn btn-primary">Publicar <Ico.ArrowR width="12" height="12"/></button>
        </div>
      </div>
    </div>
  );
}
window.RecordBuilder = RecordBuilder;
