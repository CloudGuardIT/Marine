interface Segment {
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: Segment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string | number;
}

export default function DonutChart({ segments, size = 160, thickness = 24, centerLabel, centerValue }: Props) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-sm text-gray-400">אין נתונים</span>
      </div>
    );
  }

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {segments.filter(s => s.value > 0).map((seg, i) => {
            const pct = seg.value / total;
            const dashLength = circumference * pct;
            const dashGap = circumference - dashLength;
            const offset = circumference * cumulativeOffset;
            cumulativeOffset += pct;

            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={`${dashLength} ${dashGap}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                className="transition-all duration-500"
              />
            );
          })}
        </svg>
        {(centerLabel || centerValue !== undefined) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue !== undefined && <div className="text-2xl font-bold text-gray-800">{centerValue}</div>}
            {centerLabel && <div className="text-xs text-gray-500">{centerLabel}</div>}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center">
        {segments.filter(s => s.value > 0).map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            {seg.label}: {seg.value}
          </div>
        ))}
      </div>
    </div>
  );
}
