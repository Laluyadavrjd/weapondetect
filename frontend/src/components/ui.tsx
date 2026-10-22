import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`glass-panel p-6 ${className}`}>{children}</div>;
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5 }}
      className="mb-8"
    >
      <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-cyan-electric">
        {eyebrow}
      </p>
      <h2 className="font-display mt-2 text-3xl font-bold text-white sm:text-4xl">
        {title}
      </h2>
      {subtitle && <p className="mt-3 max-w-2xl text-text-dim">{subtitle}</p>}
    </motion.div>
  );
}

export function PrimaryButton({
  to,
  children,
  onClick,
  type,
  disabled,
  className = "",
}: {
  to?: string;
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-6 py-3 font-display text-sm font-semibold uppercase tracking-wider text-[#060a18] shadow-[0_0_28px_rgba(34,211,238,0.35)] transition hover:shadow-[0_0_40px_rgba(34,211,238,0.55)] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none ${className}`;
  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

export function GhostButton({
  to,
  children,
  onClick,
  disabled,
  className = "",
}: {
  to?: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-electric/30 bg-cyan-electric/5 px-6 py-3 font-display text-sm font-semibold uppercase tracking-wider text-cyan-electric transition hover:border-cyan-electric/60 hover:bg-cyan-electric/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-50 ${className}`;
  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

type AlertKind = "error" | "warning" | "info" | "success";

const alertStyles: Record<AlertKind, { icon: typeof Info; cls: string }> = {
  error: { icon: XCircle, cls: "border-red-400/30 bg-red-500/10 text-red-200" },
  warning: {
    icon: AlertTriangle,
    cls: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  },
  info: { icon: Info, cls: "border-cyan-400/30 bg-cyan-500/10 text-cyan-100" },
  success: {
    icon: CheckCircle2,
    cls: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  },
};

export function Alert({
  kind,
  title,
  children,
}: {
  kind: AlertKind;
  title: string;
  children: ReactNode;
}) {
  const { icon: Icon, cls } = alertStyles[kind];
  return (
    <div
      role="alert"
      className={`flex gap-3 rounded-xl border p-4 ${cls}`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-display text-sm font-semibold">{title}</p>
        <div className="mt-1 text-sm opacity-90">{children}</div>
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-line-glow bg-midnight/60 px-4 py-3">
      <p className="text-xs uppercase tracking-widest text-text-dim">{label}</p>
      <p className="font-display mt-1 text-xl font-bold text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-text-dim">{sub}</p>}
    </div>
  );
}

/** Repeated disclaimer: detections can be wrong; this is a demo. */
export function LimitationNotice({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-violet-restraint/25 bg-violet-500/5 p-4 text-sm text-text-dim ${className}`}
    >
      <p className="font-display font-semibold text-white">
        Demonstration only — not a threat-assessment system.
      </p>
      <p className="mt-1">
        Detections can be wrong: objects may be missed, mislabelled, or reported
        with misplaced boxes. Rare classes in the training data (such as{" "}
        <span className="text-cyan-electric">submachine-gun</span>) are detected
        unreliably, and people can occasionally be mislabelled. Never rely on
        this output for safety decisions.
      </p>
    </div>
  );
}
