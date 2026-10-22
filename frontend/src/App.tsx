import { useEffect, useState } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import { api, type ApiFailure, failureMessage } from "./api";
import Home from "./pages/Home";
import Detect from "./pages/Detect";
import Video from "./pages/Video";
import Analytics from "./pages/Analytics";
import ModelInfo from "./pages/ModelInfo";
import About from "./pages/About";

export interface HealthState {
  status: "loading" | "online" | "offline";
  modelStatus?: string;
  device?: string;
}

export default function App() {
  const [health, setHealth] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then((h) => {
        if (!cancelled)
          setHealth({ status: "online", modelStatus: h.model_status, device: h.device });
      })
      .catch(() => {
        if (!cancelled) setHealth({ status: "offline" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <HashRouter>
      <div className="min-h-screen bg-abyss text-white">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Home health={health} />} />
            <Route path="/detect" element={<Detect />} />
            <Route path="/video" element={<Video />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/model" element={<ModelInfo />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<Home health={health} />} />
          </Routes>
        </main>
        <footer className="border-t border-cyan-electric/10 py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <p className="text-center text-sm text-text-dim">
              WeaponDetect Lab — a computer-vision research demonstration. Detections
              can be wrong and must never be used for safety or security decisions.
            </p>
            <p className="mt-2 text-center text-xs text-text-dim/70">
              University project · Team: Anjali Singh · Satyam Kumar · Krishnanand Yadav
            </p>
          </div>
        </footer>
      </div>
    </HashRouter>
  );
}

export function describeApiFailure(f: ApiFailure): string {
  return failureMessage(f);
}
