"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import GpsRecorder from "@/components/gps/GpsRecorder";
import type { LineInfo } from "@/types/trip";
import { reverseGeocode } from "@/utils/tripUtils";

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
  
  // Champs automatiques
  const [destination, setDestination] = useState("");
  const [lineName, setLineName] = useState("");
  const [startPointName, setStartPointName] = useState("");
  const [endPointName, setEndPointName] = useState("");
  
  // État pour l'autodétection
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [gpsReady, setGpsReady] = useState(false);
  const [showDestinationInput, setShowDestinationInput] = useState(false);
  
  // Suggestions de lignes basées sur les trajets précédents
  const [suggestedLines, setSuggestedLines] = useState<string[]>([]);

  // ============================================
  // AUTODÉTECTION DU POINT DE DÉPART
  // ============================================
  useEffect(() => {
    if (showDestinationInput && !startPointName && navigator.geolocation) {
      setIsAutoDetecting(true);
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const name = await reverseGeocode(
            position.coords.latitude,
            position.coords.longitude
          );
          setStartPointName(name);
          setIsAutoDetecting(false);
          setGpsReady(true);
          console.log("📍 Point de départ automatique :", name);
        },
        (error) => {
          console.error("Erreur GPS pour le départ:", error);
          setIsAutoDetecting(false);
          setStartPointName("Position actuelle");
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [showDestinationInput, startPointName]);

  // ============================================
  // CHARGER LES SUGGESTIONS DE LIGNES
  // ============================================
  useEffect(() => {
    const savedTrips = JSON.parse(localStorage.getItem("trips") || "[]");
    const lines = savedTrips
      .map((t: any) => t.line?.name)
      .filter(Boolean);
    const uniqueLines = [...new Set(lines)];
    setSuggestedLines(uniqueLines.slice(0, 5));
  }, []);

  // ============================================
  // DÉMARRER LE TRAJET
  // ============================================
  const handleStartTrip = () => {
    setShowDestinationInput(true);
  };

  const confirmDestination = () => {
    if (destination.trim()) {
      setShowDestinationInput(false);
      setStatus("recording");
    }
  };

  // ============================================
  // CONSTRUCTION DES INFOS DE LIGNE
  // ============================================
  const lineInfo: LineInfo | null = lineName ? {
    id: Date.now().toString(),
    name: lineName,
    number: lineName.match(/\d+/)?.[0] || "",
    type: lineName.toLowerCase().includes("wor") ? "woro-woro" : "gbaka",
    color: "#8b5cf6",
    estimatedPrice: 0,
  } : null;

  return (
    <div className="flex h-screen flex-col bg-[#0a0a0f]">
      
      <div className="relative h-[70vh] w-full flex-shrink-0 overflow-hidden">
        
        {destination && status === "recording" && (
          <div className="absolute left-0 right-0 top-4 z-10 px-4">
            <div className="mx-auto max-w-md rounded-2xl bg-blue-600/90 px-4 py-2.5 text-center backdrop-blur-sm">
              <p className="text-sm font-medium text-white">
                🚗 Trajet vers : <span className="font-bold">{destination}</span>
                {lineName && (
                  <span className="ml-2 rounded-full bg-purple-500/30 px-2 py-0.5 text-xs">
                    {lineName}
                  </span>
                )}
              </p>
              {startPointName && (
                <p className="mt-1 text-xs text-white/70">
                  🟢 Départ : {startPointName}
                </p>
              )}
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
          
          {/* ===== FORMULAIRE AUTOMATISÉ ===== */}
          {showDestinationInput && (
            <div className="mt-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-blue-500/5 to-pink-500/10 p-6 backdrop-blur-xl shadow-2xl shadow-purple-500/20">
                
                <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 blur-3xl animate-pulse" />
                <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                
                <div className="relative z-10">
                  {/* Titre */}
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 text-2xl animate-bounce">
                      🤖
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        Trajet automatique
                      </h3>
                      <p className="text-xs text-white/40">
                        Le GPS détecte automatiquement votre position
                      </p>
                    </div>
                  </div>

                  {/* Point de départ - AUTOMATIQUE */}
                  <div className="mb-3">
                    <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-white/60">
                      <span>🟢 Point de départ</span>
                      {isAutoDetecting ? (
                        <span className="flex items-center gap-1 text-green-400">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                          Détection...
                        </span>
                      ) : gpsReady ? (
                        <span className="text-green-400">✅ Automatique</span>
                      ) : null}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={startPointName}
                        onChange={(e) => setStartPointName(e.target.value)}
                        placeholder="Détection automatique en cours..."
                        className="w-full rounded-xl border-2 border-green-500/30 bg-green-500/5 px-4 py-3 text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-green-500 focus:bg-green-500/10 focus:ring-4 focus:ring-green-500/20"
                        disabled={isAutoDetecting}
                      />
                      {gpsReady && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <span className="text-green-400">📍</span>
                        </div>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-green-400/60">
                      {gpsReady 
                        ? "✅ Position détectée automatiquement" 
                        : "⏳ En attente du signal GPS..."}
                    </p>
                  </div>

                  {/* Destination - MANUELLE */}
                  <div className="mb-3">
                    <label className="mb-1.5 block text-xs font-medium text-white/60">
                      🎯 Destination *
                    </label>
                    <input
                      type="text"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="Ex: Adjamé, Plateau, Cocody..."
                      className="w-full rounded-xl border-2 border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-purple-500 focus:bg-white/10 focus:ring-4 focus:ring-purple-500/20"
                      autoFocus
                    />
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {["Adjamé", "Plateau", "Cocody", "Treichville", "Marcory"].map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => setDestination(suggestion)}
                          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-white/50 transition hover:border-purple-500/50 hover:bg-purple-500/10 hover:text-white"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Nom de la ligne - SUGGESTIONS AUTOMATIQUES */}
                  <div className="mb-3">
                    <label className="mb-1.5 block text-xs font-medium text-white/60">
                      🚌 Nom de la ligne
                    </label>
                    <input
                      type="text"
                      value={lineName}
                      onChange={(e) => setLineName(e.target.value)}
                      placeholder="Ex: Gbaka 22, Wôrô-wôrô..."
                      className="w-full rounded-xl border-2 border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-purple-500 focus:bg-white/10 focus:ring-4 focus:ring-purple-500/20"
                    />
                    {suggestedLines.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <span className="text-xs text-white/30">Basé sur vos trajets :</span>
                        {suggestedLines.map((line) => (
                          <button
                            key={line}
                            onClick={() => setLineName(line)}
                            className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs text-purple-400 transition hover:bg-purple-500/20"
                          >
                            {line}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Point d'arrivée - AUTO DÉTECTION OPTIONNELLE */}
                  <div className="mb-4">
                    <label className="mb-1.5 block text-xs font-medium text-white/60">
                      🔴 Point d'arrivée
                    </label>
                    <input
                      type="text"
                      value={endPointName}
                      onChange={(e) => setEndPointName(e.target.value)}
                      placeholder="Sera détecté automatiquement à la fin du trajet"
                      className="w-full rounded-xl border-2 border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-purple-500 focus:bg-white/10 focus:ring-4 focus:ring-purple-500/20"
                    />
                    <p className="mt-1 text-xs text-white/30">
                      ⚡ Optionnel - sera automatiquement détecté par GPS
                    </p>
                  </div>

                  {/* Indicateur des données automatiques */}
                  <div className="mb-4 rounded-xl border border-green-500/20 bg-green-500/5 p-3">
                    <div className="flex items-center gap-2 text-xs text-green-400">
                      <span className="text-lg">🤖</span>
                      <div>
                        <p className="font-medium">Mode automatique activé</p>
                        <p className="text-green-400/60">
                          Départ détecté • Arrivée auto • Arrêts automatiques
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Boutons d'action */}
                  <div className="mt-5 flex gap-3">
                    <button
                      onClick={() => {
                        setShowDestinationInput(false);
                        setDestination("");
                        setLineName("");
                        setStartPointName("");
                        setEndPointName("");
                        setGpsReady(false);
                      }}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white/80 active:scale-95"
                    >
                      Annuler
                    </button>

                    <button
                      onClick={confirmDestination}
                      disabled={!destination.trim() || !gpsReady}
                      className="group relative flex-1 overflow-hidden rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-green-600/30 transition-all hover:scale-[1.02] hover:shadow-green-600/50 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                    >
                      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                      <div className="relative flex items-center justify-center gap-2">
                        <span>🚀</span>
                        <span>{gpsReady ? "Démarrer" : "Attente GPS..."}</span>
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
              lineInfo={lineInfo}
              startPointName={startPointName}
              endPointName={endPointName}
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
                    setLineName("");
                    setStartPointName("");
                    setEndPointName("");
                    setGpsReady(false);
                  }}
                  className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                >
                  🔄 Nouveau trajet
                </button>
              </div>
            </div>
          ) : (
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
                  📍 Appuyez pour démarrer
                </p>
                <p className="mt-1 text-xs text-white/40">
                  Le GPS détectera automatiquement votre position de départ
                </p>
                {suggestedLines.length > 0 && (
                  <div className="mt-2 flex justify-center gap-2 text-xs text-white/30">
                    <span>Dernières lignes :</span>
                    {suggestedLines.map((line) => (
                      <span key={line} className="text-purple-400">{line}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}