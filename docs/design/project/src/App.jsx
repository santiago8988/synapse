function App() {
  const [screen, setScreen] = React.useState(() => localStorage.getItem("synapse.screen") || "dashboard");
  const [tweaksOpen, setTweaksOpen] = React.useState(false);
  const [theme, setThemeState] = React.useState(window.__TWEAKS.theme || "light");
  const [density, setDensityState] = React.useState(window.__TWEAKS.density || "normal");

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-density", density);
    document.body.style.background = "var(--bg-0)";
  }, [theme, density]);

  React.useEffect(() => {
    localStorage.setItem("synapse.screen", screen);
  }, [screen]);

  // Edit mode protocol
  React.useEffect(() => {
    const handler = (e) => {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "__activate_edit_mode") setTweaksOpen(true);
      if (e.data.type === "__deactivate_edit_mode") setTweaksOpen(false);
    };
    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);

  const persist = (edits) => {
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits }, "*");
  };
  const setTheme = (t) => { setThemeState(t); persist({ theme: t }); };
  const setDensity = (d) => { setDensityState(d); persist({ density: d }); };

  const labels = {
    dashboard: "Dashboard",
    records: "Registros",
    docs: "Documentos",
    recipes: "Recetas",
    matrices: "Matrices",
    methods: "Métodos",
    templates: "Plantillas calib.",
    batches: "Lotes",
    samples: "Muestras",
    instruments: "Instrumental",
    calibrations: "Calibraciones",
    stock: "Stock",
    nc: "No conformidades",
    approvals: "Aprobaciones",
    audit: "Auditoría",
    settings: "Ajustes",
    builder: "Registros",
    detail: "Registros",
    mobile: "Registros",
  };

  const crumbs = React.useMemo(() => {
    if (screen === "dashboard") return ["Synapse"];
    if (screen === "builder") return ["Synapse","Registros","Nuevo registro"];
    if (screen === "detail") return ["Synapse","Registros","Verif. balanza BAL‑003"];
    if (screen === "mobile") return ["Synapse","Registros","Verif. balanza BAL‑003","Vista móvil"];
    return ["Synapse", labels[screen] || screen];
  }, [screen]);

  const nav = (id) => setScreen(id);

  let content;
  if (screen === "dashboard") {
    content = <Dashboard
      onOpenRecord={() => setScreen("detail")}
      onOpenBuilder={() => setScreen("builder")}
      onOpenMobile={() => setScreen("mobile")}
    />;
  } else if (screen === "builder") {
    content = <RecordBuilder onBack={() => setScreen("dashboard")} onOpenDetail={() => setScreen("detail")}/>;
  } else if (screen === "detail") {
    content = <RecordDetail onBack={() => setScreen("dashboard")} onOpenMobile={() => setScreen("mobile")}/>;
  } else if (screen === "mobile") {
    content = <MobileForm onBack={() => setScreen("detail")}/>;
  } else {
    // Generic placeholder for side-nav items
    content = (
      <div className="fade-in">
        <div className="ph">
          <div>
            <div style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:"0.2em",textTransform:"uppercase",color:"var(--ink-3)",marginBottom:10}}>
              · {labels[screen]}
            </div>
            <h1>Sección <span className="italic">{(labels[screen]||"").toLowerCase()}.</span></h1>
            <p className="sub">
              Este prototipo enfoca las 5 pantallas clave del flujo de registros.
              El resto del producto comparte el mismo sistema visual: tablas con entries, builder lateral, cascadas declarativas y vista móvil.
            </p>
          </div>
          <button className="btn btn-ghost" onClick={() => setScreen("dashboard")}>← Volver al dashboard</button>
        </div>
        <div className="card">
          <div className="empty-brain">
            <BrainMark size={100} animated={true}/>
            <div className="label">· Pantalla no incluida en este prototipo</div>
            <div style={{fontSize:13,color:"var(--ink-2)",maxWidth:420,textAlign:"center"}}>
              Los ítems de <b style={{color:"var(--ink-0)"}}>Registros</b>, <b style={{color:"var(--ink-0)"}}>Builder</b>, <b style={{color:"var(--ink-0)"}}>Detalle</b> y <b style={{color:"var(--ink-0)"}}>Vista móvil</b> están activos desde el dashboard.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const edgeToEdge = screen === "builder";
  const screenLabel = "Synapse · " + (labels[screen] || screen);

  return (
    <div className="shell" data-screen-label={screenLabel}>
      <Sidebar screen={screen} onNavigate={nav}/>
      <div className="main-col">
        <Topbar crumbs={crumbs} onBack={() => setScreen("dashboard")} onTweaksToggle={() => setTweaksOpen(o => !o)}/>
        <main className={"content" + (edgeToEdge ? " edge-to-edge" : "")}>
          {content}
        </main>
      </div>
      <Tweaks open={tweaksOpen} onClose={() => setTweaksOpen(false)}
              theme={theme} setTheme={setTheme}
              density={density} setDensity={setDensity}/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
