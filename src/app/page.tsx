"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import GpsRecorder from "@/components/gps/GpsRecorder";

const TransportMap = dynamic(
  () => import("@/components/map/TransportMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen w-full bg-gradient-to-br from-gray-900 to-gray-800 animate-pulse flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm font-medium">Chargement de la carte...</p>
        </div>
      </div>
    ),
  }
);

type GPSPoint = {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  timestamp: number;
};

export default function Home() {
  const [route, setRoute] = useState("");
  const [points, setPoints] = useState<GPSPoint[]>([]);
  const [status, setStatus] = useState<"idle" | "recording" | "paused">("idle");

  return (
    <main className="relative h-screen w-full overflow-hidden bg-black">
      {/* Carte en plein écran */}
      <TransportMap points={points} status={status} />

      {/* Overlay des contrôles - design "glassmorphism" */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="pointer-events-auto mx-auto max-w-md px-4 py-5 h-full flex flex-col justify-between">
          
          {/* En-tête premium */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-xl px-4 py-2 border border-white/10 shadow-2xl">
              <span className="text-lg">🚍</span>
              <span className="text-xs font-bold text-white/90 tracking-widest">TRANSPORTTICKET.CI</span>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-white drop-shadow-lg">
              Collecte de trajet
            </h1>
            <p className="mt-1 text-sm text-white/60 font-light">
              Enregistrez le parcours réel d'une ligne de transport
            </p>
          </div>

          {/* Zone centrale (espace) */}
          <div className="flex-1" />

          {/* Panneau inférieur élégant */}
          <div className="space-y-3">
            {/* Sélection de ligne - version luxe */}
            <div className="rounded-2xl bg-white/10 backdrop-blur-2xl p-4 border border-white/10 shadow-2xl">
              <label htmlFor="route" className="mb-1.5 block text-xs font-semibold text-white/70 uppercase tracking-wider">
                Ligne
              </label>
              <select
                id="route"
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/20 px-4 py-3 text-white text-sm outline-none focus:border-blue-400 transition-all duration-200 hover:bg-white/10 appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                  backgroundPosition: 'right 12px center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '20px',
                }}
              >
                <option value="" className="text-gray-900 bg-white">Choisir une ligne</option>
                <option value="yopougon-adjame" className="text-gray-900 bg-white">Yopougon Maroc → Adjamé</option>
                <option value="abobo-adjame" className="text-gray-900 bg-white">Abobo → Adjamé</option>
                <option value="cocody-plateau" className="text-gray-900 bg-white">Cocody → Plateau</option>
              </select>
            </div>

            {/* GPS Recorder - version premium */}
            {route ? (
              <div className="rounded-2xl bg-white/10 backdrop-blur-2xl p-4 border border-white/10 shadow-2xl">
                <GpsRecorder status={status} setStatus={setStatus} onPointsChange={setPoints} />
              </div>
            ) : (
              <div className="rounded-2xl bg-white/10 backdrop-blur-2xl p-6 text-center border border-white/10 shadow-2xl">
                <div className="text-4xl mb-2 opacity-50">📍</div>
                <p className="text-sm text-white/50 font-light">
                  Sélectionnez une ligne pour commencer
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
                }
