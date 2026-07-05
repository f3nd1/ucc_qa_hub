import { useState } from "react";
import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { Db } from "@/lib/qmr-engine";
import { records } from "@/lib/qmr-engine";
import { recordStatus, STATUS_COLOR, STATUS_LABEL } from "./status";

const boardLabel: React.CSSProperties = {
  pointerEvents: "none",
  color: "#42506a",
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: "nowrap",
  fontFamily: '-apple-system, "Segoe UI", Arial, sans-serif',
};
const tileLabel: React.CSSProperties = {
  pointerEvents: "none",
  color: "#fff",
  fontSize: 10.5,
  fontWeight: 600,
  textAlign: "center",
  whiteSpace: "nowrap",
  textShadow: "0 1px 2px rgba(0,0,0,.35)",
  fontFamily: '-apple-system, "Segoe UI", Arial, sans-serif',
};

function Tile({
  name,
  color,
  status,
  position,
  onSelect,
}: {
  name: string;
  color: string;
  status: string;
  position: [number, number, number];
  onSelect: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <group position={position}>
      <mesh
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "auto";
        }}
      >
        <boxGeometry args={[1.95, 0.62, 0.1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hover ? 0.55 : 0.16} />
      </mesh>
      <Html position={[0, 0, 0.09]} center distanceFactor={7}>
        <div style={tileLabel}>
          {name}
          <br />
          {status}
        </div>
      </Html>
    </group>
  );
}

/** A board on the back wall with a tile per record, coloured by status.
    Clicking a tile selects that record (same as picking it in the flat list). */
export function RecordsShelf({
  db,
  order,
  onSelect,
}: {
  db: Db;
  order: string[];
  onSelect: (name: string) => void;
}) {
  const perRow = 3;
  const gapX = 2.2;
  const gapY = 0.85;

  return (
    <group position={[0, 2.6, -6.75]}>
      {/* board */}
      <mesh>
        <boxGeometry args={[7.4, 2.6, 0.12]} />
        <meshStandardMaterial color="#e2e7f0" />
      </mesh>
      <Html position={[0, 1.55, 0.1]} center distanceFactor={10}>
        <div style={boardLabel}>Records — current cycle</div>
      </Html>
      {order.map((name, i) => {
        const rec = records(db)[name];
        const st = recordStatus(db, rec);
        const col = i % perRow;
        const row = Math.floor(i / perRow);
        const x = (col - (perRow - 1) / 2) * gapX;
        const y = 0.55 - row * gapY;
        return (
          <Tile
            key={name}
            name={name}
            color={STATUS_COLOR[st]}
            status={STATUS_LABEL[st]}
            position={[x, y, 0.11]}
            onSelect={() => onSelect(name)}
          />
        );
      })}
    </group>
  );
}
