import { lazy, Suspense } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BrainCircuit,
  Cpu,
  ImagePlus,
  LayoutDashboard,
  Server,
  Upload,
  Workflow,
} from "lucide-react";
const HeroScene = lazy(() => import("../components/HeroScene"));
import { Alert, GhostButton, LimitationNotice, Panel, PrimaryButton, SectionHeading } from "../components/ui";
import type { HealthState } from "../App";

const workflow = [
  {
    icon: Upload,
    title: "Upload",
    text: "Provide an image through the detection workspace. The file is validated in the browser and again on the server.",
  },
  {
    icon: BrainCircuit,
    title: "Inference",
    text: "A real YOLO detector runs on the backend (CPU, or GPU when available) and returns boxes, classes and confidence.",
  },
  {
    icon: LayoutDashboard,
    title: "Inspect",
    text: "Annotated results render in the browser with a detection table, inference time and a downloadable output.",
  },
];

const stack = [
  { group: "Frontend", items: "React · Vite · TypeScript · Tailwind CSS · Framer Motion · React Three Fiber" },
  { group: "Backend", items: "FastAPI · Uvicorn · Pydantic · Pillow" },
  { group: "Vision", items: "PyTorch · Ultralytics YOLO · OpenCV" },
  { group: "Testing", items: "Pytest · FastAPI TestClient" },
];

function HealthBanner({ health }: { health: HealthState }) {
  if (health.status === "loading") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line-glow bg-midnight/60 px-4 py-3">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-electric" />
        <p className="text-sm text-text-dim">Checking backend health…</p>
      </div>
    );
  }
  if (health.status === "offline") {
    return (
      <Alert kind="error" title="Backend offline">
        The detection API is not reachable. Start the backend server (see README), or
        browse the interface — all pages handle the offline state gracefully.
      </Alert>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-400/25 bg-emerald-500/5 px-4 py-3">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
      </span>
      <p className="text-sm text-emerald-100">
        <span className="font-semibold">Backend online.</span> Model status:{" "}
        <span className="font-mono">{health.modelStatus}</span>
        {health.device ? (
          <>
            {" · "}device: <span className="font-mono">{health.device}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}

export default function Home({ health }: { health: HealthState }) {
  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-cyan-electric">
              Computer-Vision Research Lab
            </p>
            <h1 className="font-display glow-text mt-4 text-4xl font-bold leading-tight text-white sm:text-6xl">
              AI-Based Object
              <br />
              Detection, <span className="text-cyan-electric">Visualised.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-text-dim">
              Upload an image and watch a real YOLO detector locate everyday
              objects — bounding boxes, class labels and confidence scores,
              rendered live. Built as a university computer-vision project.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <PrimaryButton to="/detect">
                <ImagePlus className="h-4 w-4" aria-hidden="true" /> Start Detection{" "}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </PrimaryButton>
              <GhostButton to="/model">
                <Server className="h-4 w-4" aria-hidden="true" /> View Model Information
              </GhostButton>
            </div>
            <div className="mt-8 max-w-xl">
              <HealthBanner health={health} />
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative h-[380px] sm:h-[460px]"
          >
            <div className="absolute inset-0 rounded-3xl border border-cyan-electric/15 bg-midnight/40">
              <Suspense
                fallback={
                  <div className="grid-bg h-full w-full" aria-label="Loading 3D illustration" />
                }
              >
                <HeroScene />
              </Suspense>
            </div>
            <div
              className="pointer-events-none absolute -left-3 top-6 rounded-lg border border-cyan-electric/30 bg-abyss/80 px-3 py-2 font-mono text-xs text-cyan-electric backdrop-blur"
              aria-hidden="true"
            >
              person · 0.94
            </div>
            <div
              className="pointer-events-none absolute -right-2 bottom-10 rounded-lg border border-violet-restraint/40 bg-abyss/80 px-3 py-2 font-mono text-xs text-violet-restraint backdrop-blur"
              aria-hidden="true"
            >
              inference · 38 ms
            </div>
          </motion.div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeading
          eyebrow="Pipeline"
          title="How a detection flows"
          subtitle="Three stages, no shortcuts: every bounding box on screen is produced by the backend model, never invented by the interface."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {workflow.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
            >
              <Panel className="h-full">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-electric/30 bg-cyan-electric/10">
                    <s.icon className="h-5 w-5 text-cyan-electric" aria-hidden="true" />
                  </span>
                  <p className="font-mono text-xs text-text-dim">0{i + 1}</p>
                </div>
                <h3 className="font-display mt-4 text-xl font-semibold text-white">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-dim">{s.text}</p>
              </Panel>
            </motion.div>
          ))}
        </div>
      </section>

      {/* TECH STACK */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <SectionHeading eyebrow="Under the hood" title="Technology stack" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stack.map((g, i) => (
            <motion.div
              key={g.group}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <Panel className="h-full">
                <p className="font-display text-sm font-semibold uppercase tracking-widest text-cyan-electric">
                  {g.group}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-text-dim">{g.items}</p>
              </Panel>
            </motion.div>
          ))}
        </div>
        <div className="mt-8 flex items-start gap-3">
          <Cpu className="mt-1 h-5 w-5 shrink-0 text-violet-restraint" aria-hidden="true" />
          <p className="text-sm text-text-dim">
            <span className="font-semibold text-white">Trained detector:</span>{" "}
            YOLOv8n fine-tuned by the team on a public weapon dataset — 8 classes
            including{" "}
            <span className="text-cyan-electric">pistol</span>,{" "}
            <span className="text-cyan-electric">Rifle</span> and{" "}
            <span className="text-cyan-electric">knife</span>. The UI reports only
            what the loaded checkpoint actually supports, fetched live from{" "}
            <code className="rounded bg-white/5 px-1 font-mono text-xs text-cyan-electric">
              /api/model-info
            </code>
            .
          </p>
        </div>
      </section>

      {/* DISCLAIMER */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-cyan-electric" aria-hidden="true" />
          <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-cyan-electric">
            A note on accuracy
          </p>
        </div>
        <LimitationNotice className="mt-4" />
      </section>
    </div>
  );
}
