"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import GpsRecorder from "@/components/gps/GpsRecorder";

const TransportMap = dynamic(
  () => import("@/components/map/TransportMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-gray-200">
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
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-white relative">
      {/* Carte */}
      <div className="flex-1 min-h-0">
        <TransportMap points={points} status={status} />
      </div>

      {/* Panneau coulissant avec hauteur minimale = 10% */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm rounded-t-3xl shadow-2xl border-t border-gray-200/80 transition-all duration-500 ease-in-out ${
          isPanelOpen ? 'h-[80vh]' : 'h-[10vh]'
        }`}
      >
        {/* Poignée */}
        <div
          className="flex justify-center items-center h-10 cursor-pointer select-none"
          onClick={() => setIsPanelOpen(!isPanelOpen)}
        >
          <div className="w-12 h-1.5 bg-gray-400 rounded-full hover:bg-gray-500 transition" />
        </div>

        {/* Contenu (visible seulement quand ouvert) */}
        <div className={`px-4 pb-6 overflow-y-auto ${isPanelOpen ? 'h-[calc(100%-40px)]' : 'h-0 opacity-0'} transition-opacity duration-300`}>
          <div className="max-w-lg mx-auto space-y-4">
            {/* En-tête */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🚍</span>
                <span className="font-bold text-gray-800">TransportTicket.ci</span>
              </div>
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">Collecte</span>
            </div>

            {/* Sélection de ligne */}
            <div>
              <label htmlFor="route" className="block text-sm font-medium text-gray-700 mb-1">
                Ligne
              </label>
              <select
                id="route"
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-800 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Choisir une ligne</option>
                <option value="yopougon-adjame">Yopougon Maroc → Adjamé</option>
                <option value="abobo-adjame">Abobo → Adjamé</option>
                <option value="cocody-plateau">Cocody → Plateau</option>
              </select>
            </div>

            {/* GPS Recorder */}
            {route ? (
              <GpsRecorder status={status} setStatus={setStatus} onPointsChange={setPoints} />
            ) : (
              <div className="rounded-2xl bg-gray-50 p-5 text-center text-sm text-gray-500 border border-dashed border-gray-300">
                <span className="text-3xl block mb-2">📍</span>
                Sélectionnez une ligne pour commencer
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
