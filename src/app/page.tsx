"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import GpsRecorder from "@/components/gps/GpsRecorder";

const TransportMap = dynamic(
  () => import("@/components/map/TransportMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[280px] items-center justify-center rounded-2xl bg-gray-100">
        <p className="text-sm text-gray-400">Chargement de la carte...</p>
      </div>
    ),
  }
);

export type GPSPoint = {
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
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-lg">
        
        {/* ===== BARRE D'ÉTAT ===== */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-blue-600">TransportTicket.ci</span>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">Agent</span>
            <span className="font-medium text-gray-900">KOFI</span>
            <span className="text-gray-500">Abidjan</span>
          </div>
          <span className="text-sm text-gray-400">10:30</span>
        </div>

        {/* ===== TITRE TRAJET ===== */}
        <div className="px-5 py-4 border-b border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900">Trajet</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-medium text-blue-600">Ligne 32 :</span>
            <span className="text-sm text-gray-600">Adjame → Yopougon</span>
          </div>
        </div>

        {/* ===== ONGLETS ===== */}
        <div className="flex gap-6 px-5 border-b border-gray-100">
          <button className="py-3 text-sm font-medium border-b-2 border-blue-600 text-blue-600">
            Trajet
          </button>
          <button className="py-3 text-sm font-medium border-b-2 border-transparent text-gray-400 hover:text-gray-600">
            Officiel
          </button>
        </div>

        {/* ===== CONTENU ===== */}
        <div className="p-4 space-y-4">
          
          {/* CARTE */}
          <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <TransportMap points={points} />
          </div>

          {/* BOUTONS PRINCIPAUX */}
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => {
                if (route) {
                  // Démarrer le trajet via GpsRecorder
                  setStatus("recording");
                }
              }}
              className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition active:scale-95"
            >
              <span className="text-lg">🚍</span>
              Commencer Trajet
            </button>
            <button className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-95">
              <span className="text-lg">📍</span>
              Ajouter Arrêt
            </button>
          </div>

          {/* BOUTONS SECONDAIRES */}
          <div className="grid grid-cols-2 gap-3">
            <button className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-95">
              <span className="text-lg">🟢</span>
              Marquer Arrêt
            </button>
            <button className="flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-4 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50 active:scale-95">
              <span className="text-lg">⚠️</span>
              Signaler Incident
            </button>
          </div>

          {/* GPS RECORDER (existant) */}
          <GpsRecorder
            status={status}
            setStatus={setStatus}
            onPointsChange={setPoints}
          />
        </div>
      </div>
    </div>
  );
}
