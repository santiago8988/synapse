// Brain mark — lateral view, minimalistic, scalable
function BrainMark({ size = 36, variant = "filled", animated = false }) {
  const stroke = variant === "outline" ? "#1E3A8A" : "rgba(94,234,254,0.65)";
  const fill = variant === "outline" ? "none" : "url(#hemiDark)";
  return (
    <svg width={size} height={size} viewBox="-260 -260 520 520">
      <path d="M -200 -40 C -210 -90, -180 -150, -130 -180 C -70 -210, 10 -218, 80 -200 C 145 -184, 195 -148, 215 -90 C 230 -40, 232 10, 215 60 C 205 95, 180 115, 145 120 C 175 130, 195 155, 195 175 L 100 175 C 90 165, 70 158, 45 158 C 25 158, 5 168, -5 175 L -60 175 C -75 168, -90 152, -100 130 C -115 95, -135 80, -160 70 C -190 55, -210 25, -212 -5 Z"
            fill={fill} stroke={stroke} strokeWidth="8"/>
      <path d="M -160 50 C -100 35, -20 30, 60 40 C 110 48, 150 60, 180 70" stroke={stroke} strokeWidth="5" fill="none" opacity="0.8"/>
      <path d="M 0 -180 C -10 -130, -10 -70, 0 -10" stroke={stroke} strokeWidth="5" fill="none" opacity="0.8"/>
      {/* synapse nodes */}
      <circle cx="-90" cy="-50" r="14" fill="#5EEAFE" filter={animated ? "url(#sbGlow)" : null}>
        {animated && <animate attributeName="r" values="10;18;10" dur="2.4s" repeatCount="indefinite"/>}
      </circle>
      <circle cx="60" cy="-60" r="14" fill="#5EEAFE" filter={animated ? "url(#sbGlow)" : null}>
        {animated && <animate attributeName="r" values="10;18;10" dur="2.8s" begin="0.6s" repeatCount="indefinite"/>}
      </circle>
      <circle cx="130" cy="-30" r="12" fill="#5EEAFE" filter={animated ? "url(#sbGlow)" : null}>
        {animated && <animate attributeName="r" values="8;16;8" dur="2.2s" begin="1.2s" repeatCount="indefinite"/>}
      </circle>
    </svg>
  );
}
window.BrainMark = BrainMark;
