import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Clapperboard, Download, Loader2, RotateCcw, UploadCloud, X } from "lucide-react";
import { API_BASE, api, failureMessage, type ApiFailure } from "../api";
import type { VideoDetectResponse } from "../types";
import {
  Alert,
  GhostButton,
  LimitationNotice,
  Panel,
  PrimaryButton,
  SectionHeading,
} from "../components/ui";

const ACCEPTED = ["video/mp4", "video/x-msvideo", "video/avi", "video/quicktime"];
const ACCEPTED_LABEL = "MP4 · AVI · MOV";
const MAX_BYTES = 50 * 1024 * 1024;

type Phase =
  | { name: "idle" }
  | { name: "processing" }
  | { name: "done"; result: VideoDetectResponse }
  | { name: "error"; failure: ApiFailure }
  | { name: "validation"; message: string };

function validateFile(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) {
    return `Unsupported video type "${file.type || "unknown"}". Accepted: ${ACCEPTED_LABEL}.`;
  }
  if (file.size > MAX_BYTES) {
    return `Video is ${(file.size / 1024 / 1024).toFixed(1)} MB — the client-side limit is 50 MB.`;
  }
  return null;
}

export default function Video() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFile = useCallback((f: File | undefined | null) => {
    if (!f) return;
    const problem = validateFile(f);
    if (problem) {
      setPhase({ name: "validation", message: problem });
      return;
    }
    setFile(f);
    setPhase({ name: "idle" });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      pickFile(e.dataTransfer.files?.[0]);
    },
    [pickFile],
  );

  const reset = () => {
    setFile(null);
    setPhase({ name: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  };

  const process = async () => {
    if (!file) {
      setPhase({ name: "validation", message: "Choose a video first." });
      return;
    }
    setPhase({ name: "processing" });
    try {
      const result = await api.detectVideo(file);
      setPhase({ name: "done", result });
    } catch (err) {
      setPhase({ name: "error", failure: err as ApiFailure });
    }
  };

  const download = () => {
    if (phase.name !== "done") return;
    const a = document.createElement("a");
    a.href = `${API_BASE}${phase.result.annotated_video_url}`;
    a.download = `weapondetect-video-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const result = phase.name === "done" ? phase.result : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <SectionHeading
        eyebrow="Workspace"
        title="Video analysis"
        subtitle="Upload a short video clip. The backend processes selected frames with OpenCV and returns an annotated video. Requires the backend to implement POST /api/detect-video."
      />

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <Panel>
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload a video. Activate to browse files, or drag and drop a video here."
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
            className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition focus-visible:outline-2 focus-visible:outline-cyan-300 ${
              dragOver
                ? "border-cyan-electric bg-cyan-electric/10"
                : "border-line-glow bg-midnight/50 hover:border-cyan-electric/40"
            }`}
          >
            <Clapperboard className="h-10 w-10 text-violet-restraint" aria-hidden="true" />
            <p className="font-display mt-3 font-semibold text-white">
              Drag & drop a video here
            </p>
            <p className="mt-1 text-sm text-text-dim">or click to browse files</p>
            <p className="mt-3 font-mono text-xs text-text-dim">{ACCEPTED_LABEL}</p>
            <p className="font-mono text-xs text-text-dim">
              max 50 MB · keep clips short (≤ 30 s recommended)
            </p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(",")}
              className="hidden"
              aria-label="Choose a video file"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </div>

          {file && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-line-glow bg-midnight/60 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{file.name}</p>
                <p className="font-mono text-xs text-text-dim">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                aria-label="Remove uploaded video"
                className="rounded-full border border-line-glow bg-abyss/80 p-1.5 text-text-dim hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <PrimaryButton
              onClick={process}
              disabled={!file || phase.name === "processing"}
              className="flex-1"
            >
              {phase.name === "processing" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Processing…
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" aria-hidden="true" /> Analyse video
                </>
              )}
            </PrimaryButton>
            <GhostButton onClick={reset} disabled={phase.name === "processing"}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reset
            </GhostButton>
          </div>

          <Alert kind="warning" title="Not CCTV monitoring" >
            Uploaded-video analysis processes a clip after the fact. It is not
            equivalent to guaranteed real-time CCTV monitoring.
          </Alert>
        </Panel>

        <Panel className="min-h-[420px]">
          {phase.name === "idle" && (
            <div className="flex h-full min-h-[380px] flex-col items-center justify-center text-center">
              <Clapperboard className="h-12 w-12 text-line-glow" aria-hidden="true" />
              <p className="font-display mt-4 text-lg font-semibold text-white">
                No video analysed yet
              </p>
              <p className="mt-2 max-w-sm text-sm text-text-dim">
                Upload a clip on the left and press{" "}
                <span className="text-white">Analyse video</span>. The annotated
                result will play here.
              </p>
            </div>
          )}

          {phase.name === "validation" && (
            <div className="flex h-full min-h-[380px] items-center justify-center">
              <div className="w-full max-w-md">
                <Alert kind="warning" title="Video rejected before upload">
                  {phase.message}
                </Alert>
              </div>
            </div>
          )}

          {phase.name === "processing" && (
            <div
              className="flex h-full min-h-[380px] flex-col items-center justify-center text-center"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-12 w-12 animate-spin text-violet-restraint" aria-hidden="true" />
              <p className="font-display mt-4 text-lg font-semibold text-white">
                Processing video…
              </p>
              <p className="mt-2 max-w-sm text-sm text-text-dim">
                Frames are being extracted and analysed on the backend. This can
                take a while for longer clips — please keep this tab open.
              </p>
            </div>
          )}

          {phase.name === "error" && (
            <div className="flex h-full min-h-[380px] items-center justify-center">
              <div className="w-full max-w-md">
                <Alert kind="error" title="Video analysis failed">
                  {failureMessage(phase.failure)}
                </Alert>
              </div>
            </div>
          )}

          {result && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-lg font-semibold text-white">
                  Annotated video
                </h3>
                <GhostButton onClick={download} className="!px-4 !py-2 text-xs">
                  <Download className="h-4 w-4" aria-hidden="true" /> Download annotated video
                </GhostButton>
              </div>
              <video
                src={`${API_BASE}${result.annotated_video_url}`}
                controls
                className="mt-4 max-h-[420px] w-full rounded-xl border border-violet-restraint/25 bg-abyss"
                aria-label={`Annotated video result: ${result.detections_total} total detections across ${result.frames_processed} frames`}
              />
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Frames processed" value={String(result.frames_processed)} />
                <Stat label="Total detections" value={String(result.detections_total)} />
                <Stat label="Inference" value={`${result.inference_ms.toFixed(0)} ms`} />
                <Stat label="Status" value={result.success ? "complete" : "partial"} />
              </div>
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
