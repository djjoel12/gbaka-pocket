"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import GpsRecorder from "@/components/gps/GpsRecorder";

const TransportMap = dynamic(
  () => import("@/components/map/TransportMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen w-full bg-gray-200 animate-pulse flex items-center justify-center">
        <p className="text-sm text-gray-500">Chargement de la carte...</p>
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
    <main className="relative h-screen w-full overflow-hidden">
      {/* Carte en plein écran */}
      <TransportMap points={points} status={status} />

      {/* Overlay des contrôles - positionné par-dessus */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="pointer-events-auto mx-auto max-w-md px-4 py-6 h-full flex flex-col justify-between">
          {/* En-tête compact */}
          <div className="text-center">
            <div className="inline-block rounded-full bg-black/40 backdrop-blur-md px-3 py-1 text-xs font-semibold text-white/90 tracking-wider border border-white/10">
              🚍 TRANSPORTTICKET.CI
            </div>
          </div>

          {/* Zone du milieu (sélecteur + carte déjà en fond) */}
          <div className="flex-1" />

          {/* Panneau inférieur */}
          <div className="space-y-3">
            {/* Sélection de ligne */}
            <div className="rounded-2xl bg-black/40 backdrop-blur-md p-4 border border-white/10 shadow-2xl">
              <label htmlFor="route" className="mb-1.5 block text-xs font-semibold text-white/80">
                Ligne
              </label>
              <select
                id="route"
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 text-white text-sm outline-none focus:border-blue-400 transition"
              >
                <option value="" className="text-gray-900">Choisir une ligne</option>
                <option value="yopougon-adjame" className="text-gray-900">Yopougon Maroc → Adjamé</option>
                <option value="abobo-adjame" className="text-gray-900">Abobo → Adjamé</option>
                <option value="cocody-plateau" className="text-gray-900">Cocody → Plateau</option>
              </select>
            </div>

            {/* GPS Recorder */}
            {route ? (
              <div className="rounded-2xl bg-black/40 backdrop-blur-md p-4 border border-white/10 shadow-2xl">
                <GpsRecorder status={status} setStatus={setStatus} onPointsChange={setPoints} />
              </div>
            ) : (
              <div className="rounded-2xl bg-black/40 backdrop-blur-md p-5 text-center text-sm text-white/70 border border-white/10 shadow-2xl">
                <span className="text-3xl block mb-1">📍</span>
                Sélectionnez une ligne
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}