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

      {/* Overlay des contrôles - tout est visible et cliquable */}
      <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none">
        {/* En-tête */}
        <div className="pointer-events-auto text-center">
          <div className="inline-block rounded-full bg-black/60 backdrop-blur-md px-4 py-1.5 text-sm font-bold text-white/90 tracking-wider border border-white/20 shadow-lg">
            🚍 TRANSPORTTICKET.CI
          </div>
        </div>

        {/* Espace central (laisse la carte visible) */}
        <div className="flex-1" />

        {/* Panneau inférieur - bien visible */}
        <div className="pointer-events-auto space-y-3">
          {/* Sélection de ligne */}
          <div className="rounded-2xl bg-black/60 backdrop-blur-md p-4 border border-white/20 shadow-2xl">
            <label htmlFor="route" className="mb-1.5 block text-sm font-semibold text-white/90">
              Ligne
            </label>
            <select
              id="route"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              className="w-full rounded-xl bg-white/20 border border-white/30 px-4 py-3 text-white text-base outline-none focus:border-blue-400 transition"
            >
              <option value="" className="text-gray-900 bg-white">Choisir une ligne</option>
              <option value="yopougon-adjame" className="text-gray-900 bg-white">Yopougon Maroc → Adjamé</option>
              <option value="abobo-adjame" className="text-gray-900 bg-white">Abobo → Adjamé</option>
              <option value="cocody-plateau" className="text-gray-900 bg-white">Cocody → Plateau</option>
            </select>
          </div>

          {/* GPS Recorder */}
          {route ? (
            <div className="rounded-2xl bg-black/60 backdrop-blur-md p-4 border border-white/20 shadow-2xl">
              <GpsRecorder status={status} setStatus={setStatus} onPointsChange={setPoints} />
            </div>
          ) : (
            <div className="rounded-2xl bg-black/60 backdrop-blur-md p-5 text-center text-base text-white/90 border border-white/20 shadow-2xl">
              <span className="text-4xl block mb-2">📍</span>
              Sélectionnez une ligne pour commencer
            </div>
          )}
        </div>
      </div>
    </main>
  );
      }
