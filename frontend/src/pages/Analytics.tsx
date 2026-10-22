import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FlaskConical, Loader2 } from "lucide-react";
import { api, failureMessage, type ApiFailure } from "../api";
import type { MetricsResponse } from "../types";
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
  | { name: "empty"; message: string }
  | { name: "ready"; metrics: MetricsResponse };

export default function Analytics() {
  const [state, setState] = useState<State>({ name: "loading" });

  useEffect(() => {
    let cancelled = false;
    api
      .metrics()
      .then((m) => {
        if (cancelled) return;
        if (m.available) setState({ name: "ready", metrics: m });
        else setState({ name: "empty", message: m.message ?? "Evaluation not available yet." });
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
        eyebrow="Evaluation"
        title="Model analytics"
        subtitle="Metrics shown here come from a real evaluation run on a held-out test set, served by the backend. Nothing is estimated or invented."
      />

      {state.name === "loading" && (
        <Panel className="flex min-h-[320px] flex-col items-center justify-center" >
          <Loader2 className="h-10 w-10 animate-spin text-cyan-electric" aria-hidden="true" />
          <p className="mt-4 text-sm text-text-dim" role="status">
            Loading evaluation metrics…
          </p>
        </Panel>
      )}

      {state.name === "error" && (
        <Alert kind="error" title="Could not load metrics">
          {failureMessage(state.failure)}
        </Alert>
      )}

      {state.name === "empty" && (
        <Panel className="flex min-h-[320px] flex-col items-center justify-center text-center">
          <FlaskConical className="h-12 w-12 text-line-glow" aria-hidden="true" />
          <p className="font-display mt-4 text-xl font-semibold text-white">
            Evaluation not available yet.
          </p>
          <p className="mt-2 max-w-md text-sm text-text-dim">
            {state.message} No training or evaluation run has produced a report for
            this deployment. Charts will appear here automatically once a real
            evaluation is completed and served by{" "}
            <code className="rounded bg-white/5 px-1 font-mono text-xs text-cyan-electric">
              /api/metrics
            </code>
            .
          </p>
        </Panel>
      )}

      {state.name === "ready" && <MetricsView metrics={state.metrics} />}

      <LimitationNotice className="mt-6" />
    </div>
  );
}

function MetricsView({ metrics }: { metrics: MetricsResponse }) {
  const perClass = (metrics.per_class ?? []).map((c) => ({
    name: c.name,
    "AP": c.ap,
    Precision: c.precision,
    Recall: c.recall,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Precision" value={fmt(metrics.precision)} />
        <Stat label="Recall" value={fmt(metrics.recall)} />
        <Stat label="F1-score" value={fmt(metrics.f1)} />
        <Stat label="mAP@0.50" value={fmt(metrics.map50)} />
        <Stat label="mAP@0.50:0.95" value={fmt(metrics.map5095)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h3 className="font-display text-lg font-semibold text-white">
            Per-class average precision
          </h3>
          <p className="mt-1 text-xs text-text-dim">
            From the backend evaluation report
            {metrics.dataset ? ` · dataset: ${metrics.dataset}` : ""}
            {metrics.evaluated_at ? ` · evaluated ${new Date(metrics.evaluated_at).toLocaleString()}` : ""}
          </p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perClass} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2c52" />
                <XAxis type="number" domain={[0, 1]} tick={{ fill: "#9aa7c7", fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "#f4f7ff", fontSize: 12 }}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0a1026",
                    border: "1px solid #22d3ee55",
                    borderRadius: 12,
                    color: "#f4f7ff",
                  }}
                />
                <Bar dataKey="AP" radius={[0, 6, 6, 0]}>
                  {perClass.map((_, i) => (
                    <Cell key={i} fill={i % 2 ? "#8b5cf6" : "#22d3ee"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <h3 className="font-display text-lg font-semibold text-white">
            Precision vs recall per class
          </h3>
          <p className="mt-1 text-xs text-text-dim">
            Classification-style scores reported by the backend evaluator.
          </p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perClass} margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2c52" />
                <XAxis dataKey="name" tick={{ fill: "#9aa7c7", fontSize: 12 }} />
                <YAxis domain={[0, 1]} tick={{ fill: "#9aa7c7", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0a1026",
                    border: "1px solid #22d3ee55",
                    borderRadius: 12,
                    color: "#f4f7ff",
                  }}
                />
                <Bar dataKey="Precision" fill="#22d3ee" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Recall" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel>
        <h3 className="font-display text-lg font-semibold text-white">Reading these metrics</h3>
        <div className="mt-3 space-y-2 text-sm text-text-dim">
          <p>
            <span className="font-semibold text-white">Precision / recall / F1</span>{" "}
            describe box-level classification: of all predicted boxes, how many were
            correct (precision); of all real objects, how many were found (recall).
          </p>
          <p>
            <span className="font-semibold text-white">mAP@0.50</span> averages
            precision across classes where a predicted box counts as correct if its
            IoU with a ground-truth box is ≥ 0.50.{" "}
            <span className="font-semibold text-white">mAP@0.50:0.95</span> is
            stricter, averaging over IoU thresholds 0.50–0.95 — the standard COCO
            object-detection metric.
          </p>
          {metrics.inference_latency_ms != null && (
            <p>
              <span className="font-semibold text-white">Mean inference latency:</span>{" "}
              {metrics.inference_latency_ms.toFixed(1)} ms per image (reported by the
              backend, not this interface).
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}

function fmt(v: number | undefined): string {
  return v == null ? "—" : v.toFixed(3);
}
