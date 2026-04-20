function Sidebar({ screen, onNavigate }) {
  const groups = [
    {
      label: "Definición",
      items: [
        { id: "dashboard", name: "Dashboard", icon: Ico.Dashboard },
        { id: "records", name: "Registros", icon: Ico.Records },
        { id: "docs", name: "Documentos", icon: Ico.Docs },
        { id: "recipes", name: "Recetas", icon: Ico.Recipes },
        { id: "matrices", name: "Matrices", icon: Ico.Matrix },
        { id: "methods", name: "Métodos", icon: Ico.Methods },
        { id: "templates", name: "Plantillas calib.", icon: Ico.Template },
      ]
    },
    {
      label: "Seguimiento",
      items: [
        { id: "batches", name: "Lotes", icon: Ico.Batch },
        { id: "samples", name: "Muestras", icon: Ico.Sample },
        { id: "instruments", name: "Instrumental", icon: Ico.Instrument },
        { id: "calibrations", name: "Calibraciones", icon: Ico.Calib },
        { id: "stock", name: "Stock", icon: Ico.Stock },
      ]
    },
    {
      label: "Calidad",
      items: [
        { id: "nc", name: "No conformidades", icon: Ico.NC, badge: "4" },
        { id: "approvals", name: "Aprobaciones", icon: Ico.Approval, badge: "5", warn: true },
        { id: "audit", name: "Auditoría", icon: Ico.Audit },
      ]
    },
    {
      label: "Configuración",
      items: [
        { id: "settings", name: "Ajustes", icon: Ico.Settings },
      ]
    },
  ];

  // Map meta-screens to active sidebar item
  const activeMap = { builder: "records", detail: "records", mobile: "records" };
  const activeId = activeMap[screen] || screen;

  return (
    <aside className="sidebar">
      <div className="sb-brand" onClick={() => onNavigate("dashboard")} style={{cursor:"pointer"}}>
        <div className="sb-mark"><BrainMark size={36} animated={true}/></div>
        <div className="sb-wordmark">
          <span className="s-name">Synap<em>se</em></span>
          <span className="s-parent">by · NosisHub</span>
        </div>
      </div>

      <div className="sb-org">
        <div className="sb-org-av">L</div>
        <div className="sb-org-info">
          <div className="sb-org-name">Laboratorio Alfa</div>
          <div className="sb-org-sub">Multitenant · V4.2</div>
        </div>
        <Ico.Chev className="chev" width="12" height="12"/>
      </div>

      <nav className="sb-nav">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="sb-group-label">{g.label}</div>
            {g.items.map((it) => {
              const IconComp = it.icon;
              const isActive = activeId === it.id;
              return (
                <div key={it.id}
                     className={"sb-item" + (isActive ? " active" : "")}
                     onClick={() => onNavigate(it.id)}>
                  <IconComp/>
                  <span>{it.name}</span>
                  {it.badge && <span className={"sb-badge" + (it.warn ? " warn" : "")}>{it.badge}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sb-user">
        <div className="sb-user-av">SD</div>
        <div className="sb-user-info">
          <div className="sb-user-name">Sofía Domínguez</div>
          <div className="sb-user-role">Quality Manager</div>
        </div>
        <Ico.Chev className="chev" width="12" height="12" style={{color:"#6A7797"}}/>
      </div>
    </aside>
  );
}
window.Sidebar = Sidebar;
