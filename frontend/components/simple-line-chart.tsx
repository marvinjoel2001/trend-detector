type SimpleLineChartProps = {
  values: number[];
  emptyLabel: string;
  xLabels?: string[];
  forecastStartIndex?: number;
  valueFormatter?: (value: number) => string;
  ariaLabel?: string;
  baseLabel?: string;
  forecastLabel?: string;
};

function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${Math.round(value)}`;
}

function buildPolyline(points: Array<{ x: number; y: number }>): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

export function SimpleLineChart({
  values,
  emptyLabel,
  xLabels,
  forecastStartIndex,
  valueFormatter = compactNumber,
  ariaLabel = "Line chart",
  baseLabel = "Trend line",
  forecastLabel = "Forecast projection",
}: SimpleLineChartProps) {
  if (!values.length) {
    return <div className="rounded-xl border border-white/10 p-6 text-sm text-slate-400">{emptyLabel}</div>;
  }

  const plottedValues = values.length === 1 ? [values[0], values[0]] : values;
  const width = 640;
  const height = 240;
  const padding = { top: 16, right: 20, bottom: 34, left: 48 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const min = Math.min(...plottedValues);
  const max = Math.max(...plottedValues);
  const range = Math.max(max - min, 1);
  const points = plottedValues.map((value, index) => {
    const x = padding.left + (index / Math.max(plottedValues.length - 1, 1)) * innerWidth;
    const y = padding.top + innerHeight - ((value - min) / range) * innerHeight;
    return { x, y, value, index };
  });

  const forecastIndex =
    typeof forecastStartIndex === "number" && forecastStartIndex >= 0
      ? Math.min(forecastStartIndex, points.length - 1)
      : null;
  const firstForecastIndex = forecastIndex !== null ? Math.min(forecastIndex + 1, points.length - 1) : null;
  const historicalPoints = forecastIndex !== null ? points.slice(0, forecastIndex + 1) : points;
  const forecastPoints = forecastIndex !== null && forecastIndex < points.length - 1 ? points.slice(forecastIndex, points.length) : [];
  const gridValues = Array.from({ length: 5 }, (_, index) => max - (range / 4) * index);
  const xLabelIndices = Array.from(new Set([0, forecastIndex ?? Math.floor(points.length / 2), points.length - 1]));

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
      <svg className="w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
        {firstForecastIndex !== null && points[firstForecastIndex] ? (
          <rect
            x={points[firstForecastIndex].x}
            y={padding.top}
            width={width - padding.right - points[firstForecastIndex].x}
            height={innerHeight}
            fill="rgba(34,211,238,0.07)"
          />
        ) : null}

        {gridValues.map((gridValue, index) => {
          const y = padding.top + (index / 4) * innerHeight;
          return (
            <g key={`${gridValue}-${index}`}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 6" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.55)" fontSize="11">
                {valueFormatter(gridValue)}
              </text>
            </g>
          );
        })}

        <line x1={padding.left} y1={padding.top + innerHeight} x2={width - padding.right} y2={padding.top + innerHeight} stroke="rgba(255,255,255,0.12)" />

        {historicalPoints.length > 1 ? (
          <polyline fill="none" stroke="#9fa7ff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={buildPolyline(historicalPoints)} />
        ) : null}
        {forecastPoints.length > 1 ? (
          <polyline fill="none" stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8 6" points={buildPolyline(forecastPoints)} />
        ) : null}

        {points.map((point) => {
          const isForecastPoint = firstForecastIndex !== null && point.index >= firstForecastIndex;
          const isCurrentPoint = forecastIndex !== null && point.index === forecastIndex;
          return (
            <circle
              key={point.index}
              cx={point.x}
              cy={point.y}
              r={isCurrentPoint ? 4.5 : 3}
              fill={isForecastPoint ? "#22d3ee" : "#9fa7ff"}
              opacity={isCurrentPoint || point.index === points.length - 1 ? 1 : 0.8}
            />
          );
        })}

        {xLabelIndices.map((index) => {
          const point = points[index];
          if (!point) return null;
          return (
            <text key={index} x={point.x} y={height - 8} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="11">
              {xLabels?.[index] || `P${index + 1}`}
            </text>
          );
        })}
      </svg>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-300">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#9fa7ff]" />
          {baseLabel}
        </span>
        {forecastPoints.length ? (
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#22d3ee]" />
            {forecastLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
