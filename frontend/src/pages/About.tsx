import { motion } from "framer-motion";
import { AlertTriangle, GitBranch, Target, Users } from "lucide-react";
import { LimitationNotice, Panel, SectionHeading } from "../components/ui";

const members = [
  {
    name: "Anjali Singh",
    roll: "S24CSEU0359",
    role: "Backend, API integration, and model connection.",
  },
  {
    name: "Satyam Kumar",
    roll: "S24CSEU0480",
    role: "Frontend, user interaction, upload interface, and detection-result display.",
  },
  {
    name: "Krishnanand Yadav",
    roll: "S24CSEU0657",
    role: "Backend, AI-model integration, and detection pipeline.",
  },
];

const sections = [
  {
    title: "Problem statement",
    text: "Manual surveillance review is slow, tiring, and error-prone. The project explores whether a modern object detector can assist a human reviewer by flagging visible objects of interest in images and short video clips — as a research demonstration, not as an autonomous security decision-maker.",
  },
  {
    title: "Objectives",
    text: "Build an end-to-end pipeline: image upload → server-side YOLO inference → annotated results with bounding boxes, class names and confidence scores; expose model metadata and evaluation reports; and present it all through a clear, accessible web interface.",
  },
  {
    title: "Methodology",
    text: "A YOLOv8 detector behind a FastAPI backend runs inference. The served checkpoint is the team's own fine-tuned YOLOv8n, trained on a public weapon dataset (Roboflow, CC BY 4.0) across 8 weapon-related classes; a general COCO-pretrained YOLOv8n remains available as a fallback configuration. Images are validated, preprocessed, and passed through the model; predictions above a configurable confidence threshold are returned with pixel-space boxes and rendered on an annotated copy. Dataset validation, training and evaluation scripts are included in the repository.",
  },
  {
    title: "System architecture",
    text: "React + Vite frontend (this app) communicates over HTTP with a FastAPI backend. Inference logic lives in a dedicated detection module, separate from the HTTP routes; the model loads once at startup and serves all requests. Uploaded files are size-limited, validated, and cleaned up after processing.",
  },
  {
    title: "Algorithms & techniques",
    text: "YOLO (You Only Look Once) single-shot detection: a convolutional backbone predicts boxes and class probabilities in one pass, with non-maximum suppression to remove duplicates. Evaluation uses IoU-based matching with precision, recall, F1, mAP@0.50 and mAP@0.50:0.95.",
  },
];

const limitations = [
  "The trained model is only as good as its dataset: the submachine-gun class has very few examples (~46 annotations) and scores poorly, and the Gunmen class can occasionally fire on people without a clearly visible weapon.",
  "Detections can be wrong: missed objects, wrong labels, misplaced boxes, and sensitivity to lighting, angle and occlusion.",
  "Video analysis processes uploaded clips after the fact; it is not real-time CCTV monitoring.",
  "Evaluation metrics are only shown when a real evaluation report exists — otherwise the dashboard states it plainly.",
  "This is a computer-vision demonstration, never a threat-assessment or safety-critical system.",
];

export default function About() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <SectionHeading
        eyebrow="Documentation"
        title="About the project"
        subtitle="WeaponDetect Lab — an AI-based object detection web application built as a university computer-vision project."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {sections.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, delay: (i % 2) * 0.08 }}
          >
            <Panel className="h-full">
              <h3 className="font-display text-lg font-semibold text-cyan-electric">
                {s.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-text-dim">{s.text}</p>
            </Panel>
          </motion.div>
        ))}

        <Panel>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-cyan-electric" aria-hidden="true" />
            <h3 className="font-display text-lg font-semibold text-white">Limitations</h3>
          </div>
          <ul className="mt-3 space-y-2.5">
            {limitations.map((l) => (
              <li key={l} className="flex gap-2.5 text-sm leading-relaxed text-text-dim">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
                  aria-hidden="true"
                />
                {l}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-cyan-electric" aria-hidden="true" />
            <h3 className="font-display text-lg font-semibold text-white">
              Development workflow
            </h3>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-text-dim">
            Built in parallel agent phases: repository audit, API contract,
            backend inference, frontend interface, dataset and training pipeline,
            evaluation, integration QA, and documentation — with end-to-end
            verification of the upload → inference → annotated-result loop.
          </p>
        </Panel>
      </div>

      <div className="mt-10">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-cyan-electric" aria-hidden="true" />
          <h3 className="font-display text-xl font-semibold text-white">Team</h3>
        </div>
        <div className="mt-4 grid gap-6 md:grid-cols-3">
          {members.map((m, i) => (
            <motion.div
              key={m.roll}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <Panel className="h-full">
                <p className="font-display text-lg font-bold text-white">{m.name}</p>
                <p className="mt-1 font-mono text-xs text-cyan-electric">{m.roll}</p>
                <p className="mt-3 text-sm leading-relaxed text-text-dim">{m.role}</p>
              </Panel>
            </motion.div>
          ))}
        </div>
        <p className="mt-4 text-sm text-text-dim">
          All members: system integration, testing, and final project review.
        </p>
      </div>

      <LimitationNotice className="mt-10" />
    </div>
  );
}
