import { OrbitControls } from "@react-three/drei";
import type { Agent, Db } from "@/lib/qmr-engine";
import { Dais } from "./Dais";
import { Desk } from "./Desk";
import { RecordsShelf } from "./RecordsShelf";

/** The room: floor, walls, lights, the dais, one desk per agent, the shelf.
    A quiet audit office in UCC navy, not an arcade. */
export function Scene({
  db,
  agents,
  order,
  reducedMotion,
  onOpenOrchestrator,
  onOpenAgent,
  onSelectRecord,
}: {
  db: Db;
  agents: Agent[];
  order: string[];
  reducedMotion: boolean;
  onOpenOrchestrator: () => void;
  onOpenAgent: (id: string) => void;
  onSelectRecord: (name: string) => void;
}) {
  const desks = agents.filter((a) => a.id !== "orchestrator");

  return (
    <>
      <color attach="background" args={["#eef1f6"]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[7, 11, 6]} intensity={0.85} />
      <hemisphereLight args={["#ffffff", "#c9d2df", 0.4]} />

      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[26, 22]} />
        <meshStandardMaterial color="#d9dfe8" />
      </mesh>
      {/* back wall */}
      <mesh position={[0, 3, -7.2]}>
        <boxGeometry args={[26, 6, 0.3]} />
        <meshStandardMaterial color="#c9d2df" />
      </mesh>
      {/* side walls */}
      <mesh position={[-13, 3, 0]}>
        <boxGeometry args={[0.3, 6, 22]} />
        <meshStandardMaterial color="#cfd7e2" />
      </mesh>
      <mesh position={[13, 3, 0]}>
        <boxGeometry args={[0.3, 6, 22]} />
        <meshStandardMaterial color="#cfd7e2" />
      </mesh>

      <Dais onOpen={onOpenOrchestrator} />
      {desks.map((a) => (
        <Desk key={a.id} agent={a} onOpen={() => onOpenAgent(a.id)} />
      ))}
      <RecordsShelf db={db} order={order} onSelect={onSelectRecord} />

      <OrbitControls
        makeDefault
        enableDamping={!reducedMotion}
        enablePan
        minDistance={4}
        maxDistance={24}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 1, 0]}
      />
    </>
  );
}
