import React, { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Abstract computer-vision hero: a glowing wireframe core, a scanning grid,
 * and floating "image plane" cards carrying bounding-box overlays.
 * No weapon imagery — pure detection/geometry aesthetic.
 */

function useReducedMotion(): boolean {
  const [reduced] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : true,
  );
  return reduced;
}

/** Procedural texture: an abstract "captured frame" with detection boxes. */
function makeFrameTexture(seed: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 160;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 256, 160);
  grad.addColorStop(0, "#0d1530");
  grad.addColorStop(1, "#1a2450");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 160);
  // abstract blobs
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < 6; i++) {
    g.fillStyle = `rgba(34,211,238,${0.05 + rnd() * 0.08})`;
    g.beginPath();
    g.arc(rnd() * 256, rnd() * 160, 18 + rnd() * 40, 0, Math.PI * 2);
    g.fill();
  }
  // bounding boxes
  const boxes = [
    { x: 30 + rnd() * 40, y: 24 + rnd() * 30, w: 46 + rnd() * 30, h: 60 + rnd() * 30, l: "0.93" },
    { x: 140 + rnd() * 40, y: 60 + rnd() * 30, w: 40 + rnd() * 24, h: 50 + rnd() * 26, l: "0.81" },
  ];
  for (const b of boxes) {
    g.strokeStyle = "#22d3ee";
    g.lineWidth = 3;
    g.strokeRect(b.x, b.y, b.w, b.h);
    g.fillStyle = "#22d3ee";
    g.fillRect(b.x, b.y - 18, 62, 18);
    g.fillStyle = "#060a18";
    g.font = "bold 12px monospace";
    g.fillText(`obj ${b.l}`, b.x + 5, b.y - 5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function WireCore({ reduced }: { reduced: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);
  useFrame((state, dt) => {
    if (reduced || !ref.current || !inner.current) return;
    ref.current.rotation.y += dt * 0.25;
    ref.current.rotation.x += dt * 0.08;
    inner.current.rotation.y -= dt * 0.5;
    inner.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.12;
  });
  return (
    <group position={[0, 0.4, 0]}>
      <mesh ref={ref}>
        <icosahedronGeometry args={[1.35, 1]} />
        <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.55} />
      </mesh>
      <mesh ref={inner}>
        <octahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial
          color="#0a1026"
          emissive="#8b5cf6"
          emissiveIntensity={1.6}
          wireframe
        />
      </mesh>
      <pointLight color="#22d3ee" intensity={18} distance={12} />
    </group>
  );
}

function FramePlane({
  position,
  rotation,
  seed,
  reduced,
  phase,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  seed: number;
  reduced: boolean;
  phase: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => makeFrameTexture(seed), [seed]);
  useFrame((state) => {
    if (reduced || !ref.current) return;
    ref.current.position.y =
      position[1] + Math.sin(state.clock.elapsedTime * 0.6 + phase) * 0.18;
    ref.current.rotation.y = rotation[1] + Math.sin(state.clock.elapsedTime * 0.3 + phase) * 0.06;
  });
  return (
    <mesh ref={ref} position={position} rotation={rotation}>
      <planeGeometry args={[1.9, 1.2]} />
      <meshBasicMaterial map={tex} transparent opacity={0.92} side={THREE.DoubleSide} />
    </mesh>
  );
}

function ScanLine({ reduced }: { reduced: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (reduced || !ref.current) return;
    const t = (state.clock.elapsedTime * 0.35) % 1;
    ref.current.position.z = -3 + t * 6;
  });
  return (
    <mesh ref={ref} position={[0, 0.4, -3]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[9, 0.35]} />
      <meshBasicMaterial color="#22d3ee" transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

function Scene() {
  const reduced = useReducedMotion();
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[6, 6, 6]} color="#8b5cf6" intensity={10} distance={20} />
      <gridHelper args={[14, 28, "#22d3ee", "#1e2c52"]} position={[0, -1.4, 0]} />
      <WireCore reduced={reduced} />
      <ScanLine reduced={reduced} />
      <FramePlane position={[-3.4, 1.5, -1.2]} rotation={[0, 0.5, 0]} seed={11} reduced={reduced} phase={0} />
      <FramePlane position={[3.5, 1.1, -1.8]} rotation={[0, -0.45, 0]} seed={42} reduced={reduced} phase={2.1} />
      <FramePlane position={[-2.9, -0.6, 1.4]} rotation={[0, 0.35, 0]} seed={77} reduced={reduced} phase={4.2} />
      <FramePlane position={[3, -0.9, 1.2]} rotation={[0, -0.35, 0]} seed={99} reduced={reduced} phase={1.3} />
      <fog attach="fog" args={["#060a18", 8, 18]} />
    </>
  );
}

class SceneErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { failed: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** CSS fallback shown when WebGL is unavailable or disabled. */
function CssFallback() {
  return (
    <div
      className="grid-bg flex h-full w-full items-center justify-center"
      aria-label="Stylised computer-vision grid illustration"
      role="img"
    >
      <div className="relative">
        <div className="h-44 w-44 rotate-45 border-2 border-cyan-electric/60 shadow-[0_0_60px_rgba(34,211,238,0.35)]" />
        <div className="absolute inset-6 rotate-45 border border-violet-restraint/60" />
        <div className="absolute inset-12 rotate-45 bg-cyan-electric/20 blur-xl" />
      </div>
    </div>
  );
}

export default function HeroScene() {
  return (
    <div className="h-full w-full" aria-hidden="true">
      <SceneErrorBoundary fallback={<CssFallback />}>
        <Suspense fallback={<CssFallback />}>
          <Canvas
            dpr={[1, 1.75]}
            camera={{ position: [0, 1.2, 8.5], fov: 42 }}
            gl={{ antialias: true, alpha: true }}
            onCreated={({ gl }) => {
              if (!gl.getContext()) throw new Error("WebGL unavailable");
            }}
          >
            <Scene />
          </Canvas>
        </Suspense>
      </SceneErrorBoundary>
    </div>
  );
}
