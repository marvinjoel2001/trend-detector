export function SimpleLineChart({ values, emptyLabel }: { values: number[]; emptyLabel: string }) {
  if (!values.length) {
    return <div className="rounded-xl border border-white/10 p-6 text-sm text-slate-400">{emptyLabel}</div>;
  }
  const plottedValues = values.length === 1 ? [values[0], values[0]] : values;
  const width = 480;
  const height = 160;
  const min = Math.min(...plottedValues);
  const max = Math.max(...plottedValues);
  const range = Math.max(max - min, 1);
  const points = plottedValues
    .map((value, i) => {
      const x = (i / Math.max(plottedValues.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="w-full rounded-xl border border-white/10 bg-slate-900/30 p-3" viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" stroke="#9fa7ff" strokeWidth="3" points={points} />
    </svg>
  );
}
