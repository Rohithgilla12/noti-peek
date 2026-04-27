interface Props {
  values: number[];
  width?: number;
  height?: number;
  strokeColor?: string;
  fillColor?: string;
}

export function MiniSpark({
  values,
  width = 80,
  height = 18,
  strokeColor = 'currentColor',
  fillColor,
}: Props) {
  if (values.length === 0) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }
  const max = Math.max(1, ...values);
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - (v / max) * (height - 2) - 1;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const pathLine = `M ${points.join(' L ')}`;
  const fillPath = `${pathLine} L ${width.toFixed(2)},${height} L 0,${height} Z`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pulse-mini-spark"
    >
      {fillColor ? <path d={fillPath} fill={fillColor} /> : null}
      <path d={pathLine} fill="none" stroke={strokeColor} strokeWidth={1.2} />
    </svg>
  );
}
