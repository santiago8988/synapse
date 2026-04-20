function Dashboard({ onOpenRecord, onOpenBuilder, onOpenMobile }) {
  const Spark = ({ points, color = "var(--primary)" }) => {
    const w = 120, h = 28;
    const max = Math.max(...points), min = Math.min(...points);
    const step = w / (points.length - 1);
    const norm = points.map((p, i) => [i * step, h - ((p - min) / (max - min || 1)) * h]);
    const d = norm.map((pt, i) => (i === 0 ? "M" : "L") + pt[0].toFixed(1) + " " + pt[1].toFixed(1)).join(" ");
    return (
      <svg className="kpi-spark" viewBox={`0 0 ${w} ${h}`} width="100%" preserveAspectRatio="none">
        <path d={d} stroke={color} strokeWidth="1.5" fill="none"/>
        <circle cx={norm[norm.length-1][0]} cy={norm[norm.length-1][1]} r="2.5" fill={color}/>
      </svg>
    );
  };

  return (
    <div className="fade-in">
      <div className="ph">
        <div>
          <div style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:"0.2em",textTransform:"uppercase",color:"var(--ink-3)",marginBottom:10}}>
            · Martes 20 Abril · Laboratorio Alfa
          </div>
          <h1>Buen día, <span className="italic">Sofía.</span></h1>
          <p className="sub">Tu semana tiene 7 verificaciones pendientes y 3 muestras en ingreso. Calibración trimestral de balanza BAL‑003 la próxima semana.</p>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost" onClick={onOpenMobile}>
            Vista móvil
          </button>
          <button className="btn btn-primary" onClick={onOpenBuilder}>
            <Ico.Plus width="12" height="12"/> Nuevo registro
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi accent">
          <div className="klabel">Vencen en 7 días</div>
          <div className="kval">12</div>
          <Spark points={[5,7,6,9,8,10,12]} color="var(--accent-live)"/>
          <div className="kfoot"><span>vs semana ant.</span><span className="delta-up">▲ +3</span></div>
        </div>
        <div className="kpi">
          <div className="klabel">Instrumentos calibrando</div>
          <div className="kval"><span className="italic">2</span></div>
          <div style={{display:"flex",gap:6,marginTop:14}}>
            <span className="chip chip-active"><span className="pulse"></span>BAL‑003</span>
            <span className="chip chip-active"><span className="pulse"></span>TERM‑07</span>
          </div>
          <div className="kfoot"><span>De 34 activos</span><span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--ink-3)"}}>5,9%</span></div>
        </div>
        <div className="kpi">
          <div className="klabel">NCs abiertas</div>
          <div className="kval">4</div>
          <Spark points={[3,5,4,6,4,3,4]} color="var(--warn)"/>
          <div className="kfoot"><span>2 en progreso · 2 por asignar</span><span className="delta-dn">▼ -1</span></div>
        </div>
        <div className="kpi">
          <div className="klabel">Docs a revisar</div>
          <div className="kval">1</div>
          <div style={{marginTop:12,fontSize:12,color:"var(--ink-2)"}}>SOP‑LAB‑003 v3 → v4</div>
          <div className="kfoot"><span>Vence en 4 días</span><span className="chip chip-warn">REVISIÓN</span></div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">· 01 Mis tareas</div>
              <h3 style={{marginTop:6}}>Para hoy y esta semana</h3>
            </div>
            <button className="btn btn-subtle">Ver todas <Ico.ArrowR width="12" height="12"/></button>
          </div>
          <div className="task-list">
            <div className="task-group-label">📅 Hoy</div>
            <div className="task-item fail" onClick={onOpenRecord}>
              <div className="task-check"><Ico.X/></div>
              <div>
                <div className="task-name">Verif. temperatura heladera muestras</div>
                <div className="task-meta">VHEL‑20260420‑02 · fuera de tolerancia</div>
              </div>
              <span className="chip chip-fail">FALLIDA</span>
              <span className="task-meta">09:14</span>
            </div>
            <div className="task-item" onClick={onOpenMobile}>
              <div className="task-check"><Ico.Check/></div>
              <div>
                <div className="task-name">Ingreso muestra agua potable — CoopX</div>
                <div className="task-meta">M‑00231 · Microbiología</div>
              </div>
              <span className="chip chip-active"><span className="pulse"></span>AHORA</span>
              <span className="task-meta">—</span>
            </div>
            <div className="task-item">
              <div className="task-check"><Ico.Check/></div>
              <div>
                <div className="task-name">Verificación diaria balanza BAL‑003</div>
                <div className="task-meta">VBAL‑20260420‑01</div>
              </div>
              <span className="chip chip-draft">PENDIENTE</span>
              <span className="task-meta">17:00</span>
            </div>

            <div className="task-group-label">📅 Esta semana</div>
            <div className="task-item">
              <div className="task-check"><Ico.Check/></div>
              <div>
                <div className="task-name">Calibración interna pipeta P‑1000</div>
                <div className="task-meta">PIP‑1000‑A · Volumetría</div>
              </div>
              <span className="chip chip-draft">JUE 22</span>
              <span className="task-meta">—</span>
            </div>
            <div className="task-item">
              <div className="task-check"><Ico.Check/></div>
              <div>
                <div className="task-name">Revisión stock mínimo — medios de cultivo</div>
                <div className="task-meta">12 insumos bajo umbral</div>
              </div>
              <span className="chip chip-warn">STOCK</span>
              <span className="task-meta">VIE 23</span>
            </div>
            <div className="task-item">
              <div className="task-check"><Ico.Check/></div>
              <div>
                <div className="task-name">Verificación interna termómetro TERM‑07</div>
                <div className="task-meta">14 días desde última</div>
              </div>
              <span className="chip chip-draft">VIE 23</span>
              <span className="task-meta">—</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">· 02 Actividad</div>
              <h3 style={{marginTop:6}}>En el hub</h3>
            </div>
          </div>
          <div>
            <div className="feed-item">
              <div className="feed-av">JP</div>
              <div>
                <div className="feed-text"><b>J. Parodi</b> completó Entry <code style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--primary)"}}>VBAL‑…231</code></div>
                <div className="feed-time">hace 8 min</div>
              </div>
            </div>
            <div className="feed-item">
              <div className="feed-av" style={{background:"linear-gradient(135deg,#7AB8FF,#0891B2)"}}>LR</div>
              <div>
                <div className="feed-text"><b>L. Ruíz</b> cambió estado de <b>BAL‑003</b> a <span className="chip chip-active" style={{fontSize:9}}><span className="pulse"></span>IN_CALIBRATION</span></div>
                <div className="feed-time">hace 32 min</div>
              </div>
            </div>
            <div className="feed-item">
              <div className="feed-av" style={{background:"linear-gradient(135deg,#B45309,#FFB86B)"}}>!</div>
              <div>
                <div className="feed-text">NC <b>#45</b> generada automáticamente y asignada a <b>S. Domínguez</b></div>
                <div className="feed-time">hace 1 h</div>
              </div>
            </div>
            <div className="feed-item">
              <div className="feed-av">MS</div>
              <div>
                <div className="feed-text"><b>M. Sosa</b> publicó v4 del documento <b>SOP‑LAB‑003</b></div>
                <div className="feed-time">hace 3 h</div>
              </div>
            </div>
            <div className="feed-item">
              <div className="feed-av" style={{background:"linear-gradient(135deg,#047857,#10B981)"}}><Ico.Check width="12" height="12"/></div>
              <div>
                <div className="feed-text">Auditoría interna semanal: <b>98% cumplimiento</b> · 4 observaciones menores</div>
                <div className="feed-time">ayer</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{marginTop:20,display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">· 03 Próximas calibraciones</div>
              <h3 style={{marginTop:6}}>14 días</h3>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr><th>Instrumento</th><th>Tipo</th><th>Vence</th><th style={{textAlign:"right"}}>Estado</th></tr>
            </thead>
            <tbody>
              <tr><td className="col-mono">BAL‑003</td><td>Balanza analítica</td><td>22 abr</td><td style={{textAlign:"right"}}><span className="chip chip-warn">3 DÍAS</span></td></tr>
              <tr><td className="col-mono">TERM‑07</td><td>Termómetro digital</td><td>23 abr</td><td style={{textAlign:"right"}}><span className="chip chip-warn">4 DÍAS</span></td></tr>
              <tr><td className="col-mono">PIP‑1000‑A</td><td>Pipeta P‑1000</td><td>28 abr</td><td style={{textAlign:"right"}}><span className="chip chip-draft">9 DÍAS</span></td></tr>
              <tr><td className="col-mono">pH‑METRO‑02</td><td>pH-metro</td><td>03 may</td><td style={{textAlign:"right"}}><span className="chip chip-draft">14 DÍAS</span></td></tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">· 04 Cumplimiento por norma</div>
              <h3 style={{marginTop:6}}>Mes actual</h3>
            </div>
          </div>
          <div style={{padding:"20px 22px 24px"}}>
            {[
              {k:"ISO/IEC 17025", v:98, c:"var(--ok)"},
              {k:"ISO 9001", v:96, c:"var(--ok)"},
              {k:"BPM internas", v:92, c:"var(--primary)"},
              {k:"GLP", v:88, c:"var(--warn)"},
            ].map((r) => (
              <div key={r.k} style={{marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:7,fontSize:13}}>
                  <span style={{color:"var(--ink-0)",fontWeight:500}}>{r.k}</span>
                  <span style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--ink-2)"}}>{r.v}%</span>
                </div>
                <div style={{height:6,background:"var(--bg-3)",borderRadius:3,overflow:"hidden"}}>
                  <div style={{width:r.v+"%",height:"100%",background:r.c,borderRadius:3,transition:"width 1s ease"}}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
window.Dashboard = Dashboard;
