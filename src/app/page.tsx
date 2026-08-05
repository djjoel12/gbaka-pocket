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
    color: "#2563EB",
    estimatedPrice: price ? parseInt(price) : 0,
  } : null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0a0e17]">
      
      {/* ===== CARTE - 100% ===== */}
      <div className="absolute inset-0 z-0">
        <TransportMap
          points={points}
          livePosition={livePosition}
          isRecording={status === "recording"}
        />
      </div>

      {/* ===== INTERFACE EN BAS - 25% ===== */}
      <div className="absolute bottom-0 left-0 right-0 z-10 h-[25vh] min-h-[180px] bg-[#1E3A8A] shadow-2xl border-t-2 border-[#0284C7]/30">
        
        <div className="flex h-full w-full flex-col px-4 py-2">
          
          {/* ===== LIGNE 1 : Logo + Titre + Statut ===== */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0284C7]/20 text-xl">
                🚌
              </div>
              <div>
                <h1 className="text-sm font-bold text-white leading-tight">PASS GBAKA</h1>
                <p className="text-[10px] text-[#E2E8F0]/60">Collecte de trajets</p>
              </div>
            </div>

            {/* Statut */}
            <div className="flex items-center gap-2">
              {status === "recording" && (
                <>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#EA580C]" />
                  <span className="text-xs font-semibold text-[#EA580C] uppercase">Enregistrement</span>
                </>
              )}
              {status === "idle" && (
                <span className="text-xs text-[#E2E8F0]/60">Prêt</span>
              )}
              {status === "paused" && (
                <span className="text-xs text-[#22C55E]">✅ Terminé</span>
              )}
            </div>
          </div>

          {/* ===== LIGNE 2 : Contenu principal ===== */}
          <div className="flex-1 flex items-center">
            
            {/* État IDLE */}
            {!showDestinationInput && status === "idle" && (
              <div className="flex w-full items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] text-[#E2E8F0]/50">📍 Prêt à enregistrer</p>
                  <p className="text-sm text-white">Appuyez sur Démarrer pour commencer</p>
                </div>
                <button
                  onClick={handleStartTrip}
                  className="flex items-center gap-2 rounded-lg bg-[#0284C7] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#0284C7]/30 transition hover:scale-[1.02] hover:shadow-[#0284C7]/50 active:scale-95"
                >
                  <svg className="h-5 w-5 fill-white" viewBox="0 0 24 24">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                  <span>Démarrer</span>
                </button>
              </div>
            )}

            {/* FORMULAIRE */}
            {showDestinationInput && (
              <div className="flex w-full items-center gap-4 flex-wrap">
                {/* Départ */}
                <div className="flex-1 min-w-[120px]">
                  <p className="text-[8px] text-[#E2E8F0]/50 uppercase tracking-wider">🟢 Départ</p>
                  <input
                    type="text"
                    value={startPointName}
                    onChange={(e) => setStartPointName(e.target.value)}
                    placeholder="Détection auto..."
                    className="w-full bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#0284C7]"
                    disabled={isAutoDetecting}
                  />
                </div>

                {/* Destination */}
                <div className="flex-1 min-w-[120px]">
                  <p className="text-[8px] text-[#E2E8F0]/50 uppercase tracking-wider">🎯 Destination</p>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Plateau, Cocody..."
                    className="w-full bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#0284C7]"
                    autoFocus
                  />
                </div>

                {/* Prix */}
                <div className="w-[140px]">
                  <p className="text-[8px] text-[#E2E8F0]/50 uppercase tracking-wider">💰 Prix</p>
                  <div className="relative">
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="250"
                      className="w-full bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#0284C7]"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30">FCFA</span>
                  </div>
                </div>

                {/* Boutons */}
                <div className="flex gap-2">
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
                    className="rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white/70 hover:bg-white/10"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirmDestination}
                    disabled={!destination.trim() || !gpsReady}
                    className="rounded-lg bg-[#0284C7] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#0284C7]/30 hover:scale-[1.02] disabled:opacity-40"
                  >
                    {gpsReady ? "🚀 Démarrer" : "⏳ GPS..."}
                  </button>
                </div>
              </div>
            )}

            {/* ENREGISTREMENT */}
            {status === "recording" && (
              <div className="flex w-full items-center gap-4 flex-wrap">
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#EA580C]" />
                    <span className="text-xs font-bold text-[#EA580C] uppercase">REC</span>
                  </div>
                  {startPointName && (
                    <p className="text-sm text-white/80 truncate">
                      🟢 {startPointName.split(',')[0]}
                    </p>
                  )}
                  <p className="text-sm font-bold text-white truncate">→ {destination}</p>
                  {price && (
                    <p className="text-sm text-[#FCD34D]">💰 {price} FCFA</p>
                  )}
                </div>
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
              </div>
            )}

            {/* PAUSED */}
            {status === "paused" && (
              <div className="flex w-full items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✅</span>
                  <div>
                    <p className="text-sm font-bold text-white">Trajet terminé</p>
                    <p className="text-xs text-[#E2E8F0]/50">{points.length} points enregistrés</p>
                  </div>
                </div>
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
                  className="rounded-lg bg-[#0284C7] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#0284C7]/30 hover:scale-[1.02]"
                >
                  🔄 Nouveau trajet
                </button>
              </div>
            )}
          </div>

          {/* ===== LIGNE 3 : Légende ===== */}
          <div className="flex items-center justify-between border-t border-white/10 pt-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />
                <span className="text-[10px] text-[#E2E8F0]/70">GPS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#22C55E]" />
                <span className="text-[10px] text-[#E2E8F0]/70">Départ</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" />
                <span className="text-[10px] text-[#E2E8F0]/70">Arrivée</span>
              </div>
              {status === "recording" && (
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#EA580C]" />
                  <span className="text-[9px] font-bold text-[#EA580C] uppercase">REC</span>
                </div>
              )}
            </div>

            {/* Infos supplémentaires */}
            {status === "recording" && (
              <div className="flex items-center gap-4 text-xs text-[#E2E8F0]/60">
                <span>📊 {points.length} pts</span>
                <span>📏 {totalDistance > 0 ? `${(totalDistance / 1000).toFixed(1)} km` : "--"}</span>
                <span>🏎️ {currentSpeed !== null ? `${(currentSpeed * 3.6).toFixed(0)} km/h` : "--"}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
    }
