/** Lightweight inline-SVG charts for the dashboard (theme-aware via CSS vars). */

export function AreaChart({ values }) {
  const W = 520, H = 150, P = 8;
  const data = values.length ? values : [0];
  const max = Math.max(...data) * 1.15 || 1;
  const step = data.length > 1 ? (W - P * 2) / (data.length - 1) : 0;
  const pts = data.map((v, i) => [P + i * step, H - P - (v / max) * (H - P * 2)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${H - P} L${P} ${H - P} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Queries per day" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity=".28" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#ag)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0].toFixed(1)} cy={p[1].toFixed(1)} r="2.6" fill="var(--accent)" />)}
    </svg>
  );
}

export function DonutChart({ a, b, centerLabel = "OPENAI" }) {
  const R = 52, C = 2 * Math.PI * R;
  const total = a + b || 1;
  const pa = a / total;
  return (
    <svg viewBox="0 0 140 140" role="img" aria-label="Provider usage" style={{ maxWidth: 190, margin: "0 auto", display: "block" }}>
      <circle cx="70" cy="70" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="18" />
      <circle cx="70" cy="70" r={R} fill="none" stroke="var(--accent)" strokeWidth="18" strokeLinecap="round"
        strokeDasharray={`${(pa * C).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 70 70)" />
      <circle cx="70" cy="70" r={R} fill="none" stroke="var(--blue)" strokeWidth="18" strokeLinecap="round"
        strokeDasharray={`${((1 - pa) * C).toFixed(1)} ${C.toFixed(1)}`} strokeDashoffset={`${(-pa * C).toFixed(1)}`} transform="rotate(-90 70 70)" />
      <text x="70" y="66" textAnchor="middle" fontFamily="var(--serif)" fontSize="24" fontWeight="600" fill="var(--text)">{Math.round(pa * 100)}%</text>
      <text x="70" y="86" textAnchor="middle" fontFamily="var(--mono)" fontSize="9" fill="var(--text-3)">{centerLabel}</text>
    </svg>
  );
}

export function BarChart({ items }) {
  const W = 300, BH = 26, GAP = 16, P = 4;
  const max = Math.max(...items.map((x) => x.v)) || 1;
  const H = items.length * (BH + GAP) + P;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Documents by type" style={{ width: "100%", height: "auto", display: "block" }}>
      {items.map((x, i) => {
        const y = P + i * (BH + GAP);
        const w = Math.max(6, (x.v / max) * (W - 120));
        return (
          <g key={x.k}>
            <text x="0" y={y + 17} fontSize="12" fontWeight="600" fill="var(--text-2)" fontFamily="var(--sans)">{x.k.toUpperCase()}</text>
            <rect x="52" y={y} width={w} height={BH} rx="7" fill={x.c} />
            <text x={58 + w} y={y + 17} fontSize="12" fontFamily="var(--mono)" fill="var(--text)">{x.v}</text>
          </g>
        );
      })}
    </svg>
  );
}
