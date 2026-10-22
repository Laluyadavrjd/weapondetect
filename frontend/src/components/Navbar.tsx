import { NavLink } from "react-router-dom";
import { ScanLine } from "lucide-react";

const links = [
  { to: "/", label: "Home" },
  { to: "/detect", label: "Detection" },
  { to: "/video", label: "Video" },
  { to: "/analytics", label: "Analytics" },
  { to: "/model", label: "Model Info" },
  { to: "/about", label: "About" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-cyan-electric/10 bg-abyss/80 backdrop-blur-xl">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6"
      >
        <NavLink to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-electric/40 bg-cyan-electric/10 shadow-[0_0_18px_rgba(34,211,238,0.35)]">
            <ScanLine className="h-5 w-5 text-cyan-electric" aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-white">
            WeaponDetect <span className="text-cyan-electric">Lab</span>
          </span>
        </NavLink>
        <ul className="flex flex-wrap items-center gap-1 sm:gap-2">
          {links.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-cyan-300 ${
                    isActive
                      ? "bg-cyan-electric/15 text-cyan-electric"
                      : "text-text-dim hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
