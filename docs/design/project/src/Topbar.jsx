function Topbar({ crumbs, onBack, onTweaksToggle }) {
  return (
    <header className="topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <React.Fragment key={i}>
              {i > 0 && <Ico.ChevR className="sep" width="10" height="10"/>}
              {i === 0 ? (
                <span className="home" onClick={onBack}>
                  <Ico.Dashboard width="14" height="14"/> {c}
                </span>
              ) : (
                <span className={last ? "current" : ""}>{c}</span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="area-pill" title="Área activa">
        <span className="dot"></span>
        <span>Área: <b style={{color:"var(--ink-0)"}}>Microbiología</b></span>
        <Ico.Chev width="10" height="10" style={{color:"var(--ink-3)"}}/>
      </div>

      <div className="top-actions">
        <button className="icon-btn" title="Buscar"><Ico.Search/></button>
        <button className="icon-btn" title="Notificaciones">
          <Ico.Bell/>
          <span className="notif-dot"></span>
        </button>
        <button className="icon-btn" title="Tweaks" onClick={onTweaksToggle}>
          <Ico.Tweaks/>
        </button>
      </div>
    </header>
  );
}
window.Topbar = Topbar;
