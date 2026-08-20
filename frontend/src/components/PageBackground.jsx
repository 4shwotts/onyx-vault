function Diamond({ x, y, size, rotation = 0, opacity = 0.12, color }) {
  return (
    <path
      d={`M ${x} ${y - size} L ${x + size} ${y} L ${x} ${y + size} L ${x - size} ${y} Z`}
      fill="none"
      stroke={color}
      strokeWidth="1.2"
      opacity={opacity}
      transform={`rotate(${rotation} ${x} ${y})`}
    />
  );
}

function Hexagon({ x, y, size, rotation = 0, opacity = 0.1, color }) {
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return `${x + size * Math.cos(angle)},${y + size * Math.sin(angle)}`;
  }).join(' ');
  return (
    <polygon
      points={points}
      fill="none"
      stroke={color}
      strokeWidth="1.2"
      opacity={opacity}
      transform={`rotate(${rotation} ${x} ${y})`}
    />
  );
}

export default function PageBackground() {
  const shapeColor = '#101112';

  return (
    <div className="page-background">
      <div className="page-background__base" />

      <svg
        className="onyx-bg-svg"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        aria-hidden="true"
      >
        <Diamond x={120} y={100} size={22} rotation={12} opacity={0.14} color={shapeColor} />
        <Diamond x={1480} y={140} size={16} rotation={-8} opacity={0.1} color={shapeColor} />
        <Hexagon x={220} y={780} size={20} rotation={20} opacity={0.1} color={shapeColor} />
        <Diamond x={1420} y={760} size={26} rotation={5} opacity={0.13} color={shapeColor} />
        <Hexagon x={1550} y={480} size={14} rotation={-15} opacity={0.09} color={shapeColor} />
        <Diamond x={80} y={480} size={14} rotation={30} opacity={0.09} color={shapeColor} />
        <Hexagon x={800} y={60} size={12} rotation={0} opacity={0.08} color={shapeColor} />
        <Diamond x={780} y={850} size={18} rotation={-20} opacity={0.1} color={shapeColor} />
      </svg>
    </div>
  );
}