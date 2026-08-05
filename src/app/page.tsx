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
          
          {/* ===== NOUVELLE FENÊTRE DESTINATION AMÉLIORÉE ===== */}
          {showDestinationInput && (
            <div className="mt-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-blue-500/5 to-pink-500/10 p-6 backdrop-blur-xl shadow-2xl shadow-purple-500/20">
                
                {/* Effets de fond animés */}
                <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 blur-3xl animate-pulse" />
                <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                
                <div className="relative z-10">
                  {/* Titre avec emoji animé */}
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 text-2xl animate-bounce">
                      📍
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        Où allez-vous ?
                      </h3>
                      <p className="text-xs text-white/40">
                        Saisissez votre destination pour commencer
                      </p>
                    </div>
                  </div>
                  
                  {/* Champ de recherche amélioré */}
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    
                    <input
                      type="text"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="Ex: Adjamé, Plateau, Cocody, Treichville..."
                      className="w-full rounded-xl border-2 border-white/10 bg-white/5 pl-12 pr-4 py-4 text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-purple-500 focus:bg-white/10 focus:ring-4 focus:ring-purple-500/20 hover:border-white/20"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && destination.trim()) {
                          confirmDestination();
                        }
                      }}
                    />
                    
                    {/* Indicateur de saisie */}
                    {destination.length > 0 && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 text-xs text-green-400">
                          ✓
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Suggestions rapides */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="text-xs text-white/30">Suggestions :</span>
                    {["Adjamé", "Plateau", "Cocody", "Treichville", "Marcory"].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setDestination(suggestion)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 transition-all hover:border-purple-500/50 hover:bg-purple-500/10 hover:text-white"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                  
                  {/* Boutons d'action */}
                  <div className="mt-5 flex gap-3">
                    <button
                      onClick={() => {
                        setShowDestinationInput(false);
                        setDestination("");
                      }}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white/80 active:scale-95"
                    >
                      Annuler
                    </button>
                    
                    <button
                      onClick={confirmDestination}
                      disabled={!destination.trim()}
                      className="group relative flex-1 overflow-hidden rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.02] hover:shadow-purple-600/50 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                    >
                      {/* Effet de brillance */}
                      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                      
                      <div className="relative flex items-center justify-center gap-2">
                        <span>🚀</span>
                        <span>Démarrer</span>
                      </div>
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
            /* ===== BOUTON PLAY ROND ===== */
            <div className="mt-2 space-y-4">
              <div className="flex justify-center">
                <button
                  onClick={handleStartTrip}
                  className="group flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/30 transition hover:scale-110 hover:shadow-green-500/50"
                >
                  <svg 
                    className="ml-1 h-10 w-10 fill-white transition group-hover:scale-110" 
                    viewBox="0 0 24 24"
                  >
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                </button>
              </div>
              
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur-sm">
                <p className="text-sm font-medium text-white/70">
                  Appuyez pour démarrer votre trajet
                </p>
                <p className="mt-1 text-xs text-white/40">
                  Votre position GPS servira de point de départ
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}