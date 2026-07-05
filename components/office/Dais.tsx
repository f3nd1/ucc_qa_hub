import { useState } from "react";
import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";

const labelStyle: React.CSSProperties = {
  pointerEvents: "none",
  background: "rgba(26,59,110,.92)",
  color: "#fff",
  borderRadius: 6,
  padding: "3px 9px",
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: "nowrap",
  fontFamily: '-apple-system, "Segoe UI", Arial, sans-serif',
};

/** The orchestrator dais in the centre of the room. Click to open its panel. */
export function Dais({ onOpen }: { onOpen: () => void }) {
  const [hover, setHover] = useState(false);

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHover(true);
    document.body.style.cursor = "pointer";
  };
  const out = () => {
    setHover(false);
    document.body.style.cursor = "auto";
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onOpen();
  };

  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.15, 0]} onClick={click} onPointerOver={over} onPointerOut={out}>
        <cylinderGeometry args={[1.5, 1.7, 0.3, 40]} />
        <meshStandardMaterial color={hover ? "#2d5aa0" : "#1a3b6e"} emissive="#24508f" emissiveIntensity={hover ? 0.5 : 0.25} />
      </mesh>
      <mesh position={[0, 0.75, 0]} onClick={click} onPointerOver={over} onPointerOut={out}>
        <cylinderGeometry args={[0.5, 0.55, 0.9, 28]} />
        <meshStandardMaterial color="#24508f" emissive="#3a6fbf" emissiveIntensity={hover ? 1.1 : 0.5} />
      </mesh>
      <pointLight position={[0, 2.1, 0]} color="#3a6fbf" intensity={hover ? 10 : 6} distance={9} />
      <Html position={[0, 1.7, 0]} center distanceFactor={11}>
        <div style={labelStyle}>Orchestrator</div>
      </Html>
    </group>
  );
}
