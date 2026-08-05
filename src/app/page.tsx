"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import GpsRecorder from "@/components/gps/GpsRecorder";

const TransportMap = dynamic(
  () => import("@/components/map/TransportMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[400px] items-center justify-center rounded-2xl bg-gray-800">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-sm text-gray-400">Chargement de la carte...</p>
        </div>
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
  const [points, setPoints] = useState<GPSPoint[]>([]);
  const [livePosition, setLivePosition] = useState<GPSPoint | null>(null);
  const [status, setStatus] = useState<"idle" | "recording" | "paused">("idle");
  const [destination, setDestination] = useState("");
  const [showDestinationInput, setShowDestinationInput] = useState(false);

  const handleStartTrip = () => {
    setShowDestinationInput(true);
  };

  const confirmDestination = () => {
    if (destination.trim()) {
      setShowDestinationInput(false);
      setStatus("recording");
    }
  };

  return (
    <div className="flex h-screen flex-col bg-[#0a0a0f]">
      
      <div className="relative h-[70vh] w-full flex-shrink-0 overflow-hidden">
        
        {destination && status === "recording" && (
          <div className="absolute left-0 right-0 top-4 z-10 px-4">
            <div className="mx-auto max-w-md rounded-2xl bg-blue-600/90 px-4 py-2.5 text-center backdrop-blur-sm">
              <p className="text-sm font-medium text-white">
                🚗 Trajet vers : <span className="font-bold">{destination}</span>
              </p>
            </div>
          </div>
        )}

        <TransportMap
          points={points}
          livePosition={livePosition}
          isRecording={status === "recording"}
        />
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto bg-[#0a0a0f] px-4 pb-4 pt-2">
        <div className="mx-auto w-full max-w-md flex-1">
          
          {/* NOUVELLE FENÊTRE DESTINATION - JAUNE/ORANGE */}
          {showDestinationInput && (
            <div className="mt-2">
              <div className="relative overflow-hidden rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 p-6 backdrop-blur-sm shadow-xl shadow-yellow-500/20">
                
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-yellow-500/20 blur-2xl" />
                <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-orange-500/20 blur-2xl" />
                
                <div className="relative z-10">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-2xl">📍</span>
                    <label className="block text-base font-semibold text-white">
                      Où allez-vous ?
                    </label>
                  </div>
                  
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Ex: Adjamé, Plateau, Cocody..."
                    className="w-full rounded-xl border border-yellow-500/30 bg-white/10 px-4 py-3.5 text-white placeholder:text-white/30 outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && destination.trim()) {
                        confirmDestination();
                      }
                    }}
                  />
                  
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => {
                        setShowDestinationInput(false);
                        setDestination("");
                      }}
                      className="flex-1 rounded-xl bg-white/10 px-4 py-3.5 text-sm font-medium text-white/60 transition hover:bg-white/20"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={confirmDestination}
                      disabled={!destination.trim()}
                      className="flex-1 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-yellow-500/30 transition hover:scale-[1.02] hover:shadow-yellow-500/50 disabled:opacity-40 disabled:hover:scale-100"
                    >
                      ✅ Valider
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {status === "recording" ? (
            <GpsRecorder
              status={status}
              setStatus={setStatus}
              destination={destination}
              onPointsChange={setPoints}
              onLivePositionChange={setLivePosition}
              minDistance={5}
              maxAccuracy={50}
            />
          ) : status === "paused" ? (
            <div className="mt-2 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm text-center">
                <div className="text-3xl mb-2">✅</div>
                <p className="font-medium text-white/80">Trajet terminé</p>
                <p className="mt-1 text-sm text-white/40">
                  {points.length} points enregistrés
                </p>
                <button
                  onClick={() => {
                    setPoints([]);
                    setLivePosition(null);
                    setStatus("idle");
                    setDestination("");
                  }}
                  className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                >
                  🔄 Nouveau trajet
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 space-y-3">
              <button
                onClick={handleStartTrip}
                className="w-full rounded-2xl bg-blue-600 px-5 py-4 font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700"
              >
                📍 Démarrer le trajet
              </button>
              
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur-sm">
                <p className="text-sm text-white/60">
                  Votre position GPS sera utilisée comme point de départ
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
