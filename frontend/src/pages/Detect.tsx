import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Download,
  ImagePlus,
  Loader2,
  RotateCcw,
  ScanSearch,
  UploadCloud,
  X,
} from "lucide-react";
import { api, failureMessage, type ApiFailure } from "../api";
import type { DetectResponse } from "../types";
import {
  Alert,
  GhostButton,
  LimitationNotice,
  Panel,
  PrimaryButton,
  SectionHeading,
} from "../components/ui";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/bmp"];
const ACCEPTED_LABEL = "JPEG · PNG · WebP · BMP";
const MAX_BYTES = 10 * 1024 * 1024; // client-side guard; backend enforces its own limit

type Phase =
  | { name: "idle" }
  | { name: "inferring" }
  | { name: "done"; result: DetectResponse; objectUrl: string }
  | { name: "error"; failure: ApiFailure }
  | { name: "validation"; message: string };

function validateFile(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) {
    return `Unsupported file type "${file.type || "unknown"}". Accepted types: ${ACCEPTED_LABEL}.`;
  }
  if (file.size > MAX_BYTES) {
    return `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — the client-side limit is 10 MB.`;
  }
  return null;
}

export default function Detect() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0.25);
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Revoke object URLs to avoid leaks.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const pickFile = useCallback(
    (f: File | undefined | null) => {
      if (!f) return;
      const problem = validateFile(f);
      if (problem) {
        setPhase({ name: "validation", message: problem });
        return;
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(f));
      setFile(f);
      setPhase({ name: "idle" });
    },
    [previewUrl],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      pickFile(e.dataTransfer.files?.[0]);
    },
    [pickFile],
  );

  const reset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const done = phase as { name: string; objectUrl?: string };
    if (done.name === "done" && done.objectUrl) URL.revokeObjectURL(done.objectUrl);
    setPreviewUrl(null);
    setFile(null);
    setPhase({ name: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }, [previewUrl, phase]);

  const detect = useCallback(async () => {
    if (!file) {
      setPhase({ name: "validation", message: "Choose an image first." });
      return;
    }
    setPhase({ name: "inferring" });
    try {
      const result = await api.detectImage(file, confidence);
      setPhase({ name: "done", result, objectUrl: "" });
    } catch (err) {
      setPhase({ name: "error", failure: err as ApiFailure });
    }
  }, [file, confidence]);

  const download = () => {
    if (phase.name !== "done" || !phase.result.annotated_image) return;
    const a = document.createElement("a");
    a.href = phase.result.annotated_image;
    a.download = `weapondetect-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const result = phase.name === "done" ? phase.result : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <SectionHeading
        eyebrow="Workspace"
        title="Image detection"
        subtitle="Upload an image and run it through the live YOLO backend. Results are returned by the model — this interface never invents detections."
      />

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        {/* LEFT: upload + controls */}
        <Panel>
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload an image. Activate to browse files, or drag and drop an image here."
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition focus-visible:outline-2 focus-visible:outline-cyan-300 ${
              dragOver
                ? "border-cyan-electric bg-cyan-electric/10"
                : "border-line-glow bg-midnight/50 hover:border-cyan-electric/40"
            }`}
          >
            <UploadCloud className="h-10 w-10 text-cyan-electric" aria-hidden="true" />
            <p className="font-display mt-3 font-semibold text-white">
              Drag & drop an image here
            </p>
            <p className="mt-1 text-sm text-text-dim">or click to browse files</p>
            <p className="mt-3 font-mono text-xs text-text-dim">{ACCEPTED_LABEL}</p>
            <p className="font-mono text-xs text-text-dim">max 10 MB (client-side)</p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(",")}
              className="hidden"
              aria-label="Choose an image file"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </div>

          {previewUrl && (
            <div className="relative mt-4">
              <img
                src={previewUrl}
                alt="Preview of the uploaded image, awaiting detection"
                className="max-h-64 w-full rounded-xl border border-line-glow object-contain bg-abyss"
              />
              <button
                type="button"
                onClick={reset}
                aria-label="Remove uploaded image"
                className="absolute right-2 top-2 rounded-full border border-line-glow bg-abyss/80 p-1.5 text-text-dim hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
              <p className="mt-2 truncate font-mono text-xs text-text-dim">{file?.name}</p>
            </div>
          )}

          <div className="mt-6">
            <label htmlFor="confidence" className="flex items-center justify-between text-sm">
              <span className="font-medium text-white">Confidence threshold</span>
              <span className="rounded-md bg-cyan-electric/10 px-2 py-0.5 font-mono text-xs text-cyan-electric">
                {confidence.toFixed(2)}
              </span>
            </label>
            <input
              id="confidence"
              type="range"
              min={0.05}
              max={0.95}
              step={0.01}
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
              className="mt-3 w-full"
              aria-describedby="conf-help"
            />
            <p id="conf-help" className="mt-1 text-xs text-text-dim">
              Detections below this score are discarded by the backend.
            </p>
          </div>

          <div className="mt-6 flex gap-3">
            <PrimaryButton
              onClick={detect}
              disabled={!file || phase.name === "inferring"}
              className="flex-1"
            >
              {phase.name === "inferring" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Detecting…
                </>
              ) : (
                <>
                  <ScanSearch className="h-4 w-4" aria-hidden="true" /> Detect
                </>
              )}
            </PrimaryButton>
            <GhostButton onClick={reset} disabled={phase.name === "inferring"}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reset
            </GhostButton>
          </div>
        </Panel>

        {/* RIGHT: results */}
        <Panel className="min-h-[480px]">
          {phase.name === "idle" && (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center text-center">
              <ImagePlus className="h-12 w-12 text-line-glow" aria-hidden="true" />
              <p className="font-display mt-4 text-lg font-semibold text-white">
                No detection yet
              </p>
              <p className="mt-2 max-w-sm text-sm text-text-dim">
                Upload an image on the left and press <span className="text-white">Detect</span>.
                The annotated result will appear here.
              </p>
            </div>
          )}

          {phase.name === "validation" && (
            <div className="flex h-full min-h-[420px] items-center justify-center">
              <div className="w-full max-w-md">
                <Alert kind="warning" title="Image rejected before upload">
                  {phase.message}
                </Alert>
              </div>
            </div>
          )}

          {phase.name === "inferring" && (
            <div
              className="flex h-full min-h-[420px] flex-col items-center justify-center text-center"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-12 w-12 animate-spin text-cyan-electric" aria-hidden="true" />
              <p className="font-display mt-4 text-lg font-semibold text-white">
                Running inference…
              </p>
              <p className="mt-2 max-w-sm text-sm text-text-dim">
                The YOLO model is analysing your image on the backend. This usually
                takes a second or two on CPU.
              </p>
            </div>
          )}

          {phase.name === "error" && (
            <div className="flex h-full min-h-[420px] items-center justify-center">
              <div className="w-full max-w-md">
                <Alert kind="error" title="Detection failed">
                  {failureMessage(phase.failure)}
                </Alert>
              </div>
            </div>
          )}

          {result && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-lg font-semibold text-white">
                  Annotated result
                </h3>
                <GhostButton onClick={download} className="!px-4 !py-2 text-xs">
                  <Download className="h-4 w-4" aria-hidden="true" /> Download annotated image
                </GhostButton>
              </div>
              <img
                src={result.annotated_image}
                alt={`Annotated detection result: ${result.detections.length} object(s) detected`}
                className="mt-4 max-h-[480px] w-full rounded-xl border border-cyan-electric/20 object-contain bg-abyss"
              />
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Detections" value={String(result.detections.length)} />
                <Stat label="Inference" value={`${result.inference_ms.toFixed(0)} ms`} />
                <Stat label="Image size" value={`${result.image_width}×${result.image_height}`} />
                <Stat label="Model" value={result.model_status} />
              </div>

              {result.detections.length === 0 ? (
                <div className="mt-6">
                  <Alert kind="info" title="No objects detected">
                    The model found no objects above the confidence threshold of{" "}
                    {confidence.toFixed(2)}. Try lowering the threshold or a different image.
                  </Alert>
                </div>
              ) : (
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="pb-3 text-left font-display text-sm font-semibold text-white">
                      Detection table
                    </caption>
                    <thead>
                      <tr className="border-b border-line-glow text-xs uppercase tracking-wider text-text-dim">
                        <th scope="col" className="px-3 py-2">Class</th>
                        <th scope="col" className="px-3 py-2">Confidence</th>
                        <th scope="col" className="px-3 py-2">x1</th>
                        <th scope="col" className="px-3 py-2">y1</th>
                        <th scope="col" className="px-3 py-2">x2</th>
                        <th scope="col" className="px-3 py-2">y2</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.detections.map((d, i) => (
                        <tr
                          key={`${d.class_id}-${i}`}
                          className="border-b border-line-glow/50 font-mono text-xs text-text-dim hover:bg-white/[0.02]"
                        >
                          <td className="px-3 py-2 font-sans text-sm font-medium text-cyan-electric">
                            {d.class_name}
                          </td>
                          <td className="px-3 py-2">{(d.confidence * 100).toFixed(1)}%</td>
                          <td className="px-3 py-2">{Math.round(d.bbox.x1)}</td>
                          <td className="px-3 py-2">{Math.round(d.bbox.y1)}</td>
                          <td className="px-3 py-2">{Math.round(d.bbox.x2)}</td>
                          <td className="px-3 py-2">{Math.round(d.bbox.y2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </Panel>
      </div>

      <LimitationNotice className="mt-6" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line-glow bg-midnight/60 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-widest text-text-dim">{label}</p>
      <p className="font-display mt-0.5 text-base font-bold text-white">{value}</p>
    </div>
  );
}
