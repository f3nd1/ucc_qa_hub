import { useState } from "react";
import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { Agent } from "@/lib/qmr-engine";

const labelStyle = (dim: boolean): React.CSSProperties => ({
  pointerEvents: "none",
  background: "rgba(255,255,255,.94)",
  color: "#24303f",
  border: "1px solid #d8dee9",
  borderRadius: 6,
  padding: "2px 8px",
  fontSize: 11,
  fontWeight: 600,
  whiteSpace: "nowrap",
  opacity: dim ? 0.5 : 1,
  fontFamily: '-apple-system, "Segoe UI", Arial, sans-serif',
});

/** One desk per agent. The desk light shows the agent's colour; a disabled
    agent's desk is dimmed. Click to open the agent's panel. */
export function Desk({ agent, onOpen }: { agent: Agent; onOpen: () => void }) {
  const [hover, setHover] = useState(false);
  const dim = !agent.enabled;
  const [x, , z] = agent.deskPosition;

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

  const glow = dim ? 0.05 : hover ? 1.5 : 0.8;

  return (
    <group position={[x, 0, z]}>
      {/* desk top */}
      <mesh position={[0, 0.52, 0]} onClick={click} onPointerOver={over} onPointerOut={out}>
        <boxGeometry args={[1.7, 0.12, 0.95]} />
        <meshStandardMaterial color={hover ? "#ffffff" : dim ? "#dde3ec" : "#eaeff6"} />
      </mesh>
      {/* pedestal */}
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[1.5, 0.44, 0.8]} />
        <meshStandardMaterial color="#c7d0dc" />
      </mesh>
      {/* desk light in the agent's colour */}
      <mesh position={[0.55, 0.78, -0.25]}>
        <sphereGeometry args={[0.13, 18, 18]} />
        <meshStandardMaterial color={agent.color} emissive={agent.color} emissiveIntensity={glow} />
      </mesh>
      <pointLight position={[0.55, 1.1, -0.25]} color={agent.color} intensity={dim ? 0 : hover ? 7 : 3.5} distance={4} />
      <Html position={[0, 1.15, 0]} center distanceFactor={9}>
        <div style={labelStyle(dim)}>{agent.name}</div>
      </Html>
    </group>
  );
}
