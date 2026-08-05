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
  
  const [destination, setDestination] = useState("");
  const [price, setPrice] = useState("");
  const [lineName, setLineName] = useState("");
  const [startPointName, setStartPointName] = useState("");
  const [endPointName, setEndPointName] = useState("");
  
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [gpsReady, setGpsReady] = useState(false);
  const [showDestinationInput, setShowDestinationInput] = useState(false);

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
          setGpsReady(true);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [showDestinationInput, startPointName]);

  // ============================================
  // GÉNÉRATION AUTOMATIQUE DU NOM DE LA LIGNE
  // ============================================
  useEffect(() => {
    if (startPointName && destination) {
      const startMain = startPointName.split(',')[0].trim();
      const endMain = destination.split(',')[0].trim();
      const generatedName = `${startMain} → ${endMain}`;
      setLineName(generatedName);
      console.log("🚌 Nom de ligne généré :", generatedName);
    }
  }, [startPointName, destination]);

  // ============================================
  // DÉMARRER LE TRAJET
  // ============================================
  const handleStartTrip = () => {
    setShowDestinationInput(true);
  };

  const confirmDestination = () => {
    if (destination.trim() && gpsReady) {
      setShowDestinationInput(false);
      setStatus("recording");
    }
  };

  const lineInfo: LineInfo | null = lineName ? {
    id: Date.now().toString(),
    name: lineName,
    number: lineName.match(/\d+/)?.[0] || "",
    type: "gbaka",
    color: "#38bdf8",
    estimatedPrice: price ? parseInt(price) : 0,
  } : null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      
      {/* ===== CARTE ===== */}
      <div className="absolute inset-0 z-0">
        <TransportMap
          points={points}
          livePosition={livePosition}
          isRecording={status === "recording"}
        />
      </div>

      {/* ===== INTERFACE ULTRA COMPACTE ===== */}
      <div className="relative z-10 flex h-screen w-[200px] flex-shrink-0 flex-col overflow-y-auto bg-gradient-to-b from-sky-400 via-sky-500 to-blue-600 shadow-2xl">
        
        <div className="flex flex-1 flex-col p-2">
          {/* ===== EN-TÊTE ===== */}
          <div className="mb-2 flex items-center gap-1.5 border-b border-white/15 pb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-sm">
              🚌
            </div>
            <div>
              <h1 className="text-xs font-bold text-white leading-tight">PASS GBAKA</h1>
              <p className="text-[8px] text-sky-100/60 font-medium">Collecte</p>
            </div>
          </div>

          {/* ===== CONTENU ===== */}
          <div className="flex-1 space-y-2 text-xs">
            
            {/* Info trajet */}
            {destination && status === "recording" && (
              <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/15 p-2">
                <p className="text-[8px] font-semibold text-sky-100 uppercase">En cours</p>
                <p className="font-bold text-white text-xs truncate">{destination}</p>
                {startPointName && (
                  <p className="text-[10px] text-white/70 truncate">🟢 {startPointName.split(',')[0]}</p>
                )}
              </div>
            )}

            {/* ===== BOUTON PLAY ===== */}
            {!showDestinationInput && status === "idle" && (
              <div className="space-y-2">
                <button
                  onClick={handleStartTrip}
                  className="w-full rounded-lg bg-gradient-to-r from-sky-500 to-blue-500 px-2 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-500/30 transition hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                >
                  <svg className="h-4 w-4 fill-white" viewBox="0 0 24 24">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                  <span>Démarrer</span>
                </button>
                <div className="rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 p-1.5 text-center">
                  <p className="text-[9px] text-white/70">📍 GPS détecte position</p>
                </div>
              </div>
            )}

            {/* ===== FORMULAIRE ===== */}
            {showDestinationInput && (
              <div className="space-y-2 animate-in fade-in slide-in-from-left-4 duration-300">
                {/* Départ */}
                <div>
                  <label className="text-[9px] font-medium text-sky-100 flex items-center gap-1">
                    🟢 Départ
                    {isAutoDetecting && (
                      <span className="text-[8px] text-white flex items-center gap-0.5">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                        ...
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={startPointName}
                    onChange={(e) => setStartPointName(e.target.value)}
                    placeholder="Auto..."
                    className="w-full rounded-lg bg-white/10 backdrop-blur-sm border border-white/15 px-2 py-1.5 text-xs text-white placeholder:text-white/40 outline-none focus:border-white/30"
                    disabled={isAutoDetecting}
                  />
                </div>

                {/* Destination */}
                <div>
                  <label className="text-[9px] font-medium text-sky-100">🎯 Destination</label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Plateau, Cocody..."
                    className="w-full rounded-lg bg-white/10 backdrop-blur-sm border border-white/15 px-2 py-1.5 text-xs text-white placeholder:text-white/40 outline-none focus:border-white/30"
                    autoFocus
                  />
                  <div className="mt-1 flex flex-wrap gap-1">
                    {["Adjamé", "Plateau", "Cocody", "Treichville"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setDestination(s)}
                        className="rounded-full bg-white/10 border border-white/10 px-1.5 py-0.5 text-[8px] text-white/60 hover:bg-white/20"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prix */}
                <div>
                  <label className="text-[9px] font-medium text-sky-100">💰 Prix</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="250"
                      className="w-full rounded-lg bg-white/10 backdrop-blur-sm border border-white/15 px-2 py-1.5 text-xs text-white placeholder:text-white/40 outline-none focus:border-white/30"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-white/30">FCFA</span>
                  </div>
                </div>

                {/* Ligne */}
                {lineName && (
                  <div className="rounded-lg bg-white/5 border border-white/10 p-1.5">
                    <p className="text-[8px] text-sky-200">🚌 {lineName}</p>
                  </div>
                )}

                {/* Boutons */}
                <div className="flex gap-1.5 pt-1">
                  <button
                    onClick={() => {
                      setShowDestinationInput(false);
                      setDestination("");
                      setPrice("");
                      setLineName("");
                      setStartPointName("");
                      setEndPointName("");
                      setGpsReady(false);
                    }}
                    className="flex-1 rounded-lg bg-white/10 border border-white/15 px-2 py-1.5 text-[10px] text-white/70 hover:bg-white/20"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirmDestination}
                    disabled={!destination.trim() || !gpsReady}
                    className="flex-1 rounded-lg bg-gradient-to-r from-sky-400 to-blue-500 px-2 py-1.5 text-[10px] font-bold text-white shadow-lg shadow-sky-400/20 hover:scale-[1.02] disabled:opacity-40"
                  >
                    {gpsReady ? "🚀 Go" : "⏳..."}
                  </button>
                </div>
              </div>
            )}

            {/* ===== GPS RECORDER ===== */}
            {status === "recording" && (
              <GpsRecorder
                status={status}
                setStatus={setStatus}
                destination={destination}
                lineInfo={lineInfo}
                startPointName={startPointName}
                endPointName={endPointName}
                price={price}
                onPointsChange={setPoints}
                onLivePositionChange={setLivePosition}
                minDistance={5}
                maxAccuracy={50}
              />
            )}

            {/* ===== TRAJET TERMINÉ ===== */}
            {status === "paused" && (
              <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/15 p-2.5 text-center">
                <div className="text-lg mb-0.5">✅</div>
                <p className="font-medium text-white text-xs">Terminé</p>
                <p className="text-[8px] text-white/50">{points.length} pts</p>
                <button
                  onClick={() => {
                    setPoints([]);
                    setLivePosition(null);
                    setStatus("idle");
                    setDestination("");
                    setPrice("");
                    setLineName("");
                    setStartPointName("");
                    setEndPointName("");
                    setGpsReady(false);
                  }}
                  className="mt-1.5 w-full rounded-lg bg-gradient-to-r from-sky-400 to-blue-500 px-2 py-1 text-[10px] font-bold text-white shadow-lg shadow-sky-400/20 hover:scale-[1.02]"
                >
                  🔄 Nouveau
                </button>
              </div>
            )}
          </div>

          {/* ===== LÉGENDE ===== */}
          <div className="mt-2 border-t border-white/15 pt-2">
            <div className="flex flex-wrap items-center gap-2 text-[8px]">
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />
                <span className="text-white/70">GPS</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-300" />
                <span className="text-white/70">Départ</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
                <span className="text-white/70">Arrivée</span>
              </div>
              {status === "recording" && (
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                  <span className="font-semibold text-emerald-200 text-[7px]">REC</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
            }
