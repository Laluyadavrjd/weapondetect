import { useEffect, useState } from "react";
import { Cpu, Loader2, Tag } from "lucide-react";
import { api, failureMessage, type ApiFailure } from "../api";
import type { ModelInfoResponse } from "../types";
import {
  Alert,
  LimitationNotice,
  Panel,
  SectionHeading,
  Stat,
} from "../components/ui";

type State =
  | { name: "loading" }
  | { name: "error"; failure: ApiFailure }
  | { name: "ready"; info: ModelInfoResponse };

export default function ModelInfo() {
  const [state, setState] = useState<State>({ name: "loading" });

  useEffect(() => {
    let cancelled = false;
    api
      .modelInfo()
      .then((info) => {
        if (!cancelled) setState({ name: "ready", info });
      })
      .catch((err: ApiFailure) => {
        if (!cancelled) setState({ name: "error", failure: err });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <SectionHeading
        eyebrow="Under the hood"
        title="Model information"
        subtitle="Everything below is read live from the backend — class names, checkpoint status and configuration are never hardcoded here."
      />

      {state.name === "loading" && (
        <Panel className="flex min-h-[320px] flex-col items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-cyan-electric" aria-hidden="true" />
          <p className="mt-4 text-sm text-text-dim" role="status">
            Contacting the backend…
          </p>
        </Panel>
      )}

      {state.name === "error" && (
        <Alert kind="error" title="Backend unreachable — showing offline state">
          {failureMessage(state.failure)} Start the backend and refresh; this page
          cannot display model facts without it.
        </Alert>
      )}

      {state.name === "ready" && <InfoView info={state.info} />}

      <LimitationNotice className="mt-6" />
    </div>
  );
}

function InfoView({ info }: { info: ModelInfoResponse }) {
  const lastCheck = info.last_health_check
    ? new Date(info.last_health_check).toLocaleString()
    : "—";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Model family" value={info.model_family} />
        <Stat label="Checkpoint" value={info.checkpoint} sub={`status: ${info.checkpoint_status}`} />
        <Stat label="Device" value={info.device} />
        <Stat label="Input size" value={`${info.input_size}×${info.input_size}`} sub="pixels" />
        <Stat label="Default confidence" value={info.default_confidence.toFixed(2)} />
        <Stat
          label="Load status"
          value={info.loaded ? "loaded" : "not loaded"}
          sub={info.loaded ? "ready for inference" : "inference disabled"}
        />
        <Stat label="Last health check" value={lastCheck} />
        <Stat label="Supported classes" value={String(info.classes.length)} />
      </div>

      <Panel>
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-cyan-electric" aria-hidden="true" />
          <h3 className="font-display text-lg font-semibold text-white">
            Supported classes (from the loaded checkpoint)
          </h3>
        </div>
        {info.classes.length === 0 ? (
          <p className="mt-3 text-sm text-text-dim">
            The backend reported no class list — the model may not have loaded.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {info.classes.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-lg border border-line-glow bg-midnight/60 px-3 py-2"
              >
                <span className="rounded bg-cyan-electric/10 px-1.5 py-0.5 font-mono text-[11px] text-cyan-electric">
                  {c.id}
                </span>
                <span className="truncate text-sm text-white">{c.name}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-violet-restraint/25 bg-violet-500/5 p-4">
          <Cpu className="mt-0.5 h-5 w-5 shrink-0 text-violet-restraint" aria-hidden="true" />
          <p className="text-sm text-text-dim">
            <span className="font-semibold text-white">Model honesty:</span> this
            page reflects the checkpoint the backend actually loaded, fetched
            live. The default setup serves the team's purpose-trained weapon
            detector; a general-purpose COCO checkpoint can be configured
            instead, and this page will then show those classes. Either way, the
            interface only claims what the loaded checkpoint supports.
          </p>
        </div>
      </Panel>
    </div>
  );
}
