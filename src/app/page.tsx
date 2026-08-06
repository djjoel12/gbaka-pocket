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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
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
    color: "#ffffff",
    estimatedPrice: price ? parseInt(price) : 0,
  } : null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      
      {/* ===== CARTE - 100% ===== */}
      <div className="absolute inset-0 z-0">
        <TransportMap
          points={points}
          livePosition={livePosition}
          isRecording={status === "recording"}
        />
      </div>

      {/* ===== INTERFACE EN BAS - 50% NOIR & BLANC ===== */}
      <div className="absolute bottom-0 left-0 right-0 z-10 h-[50vh] min-h-[300px] bg-[#0a0a0f] shadow-2xl border-t border-white/10">
        
        <div className="flex h-full w-full flex-col px-4 py-3">
          
          {/* ===== LIGNE 1 : Logo + Titre + Statut ===== */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl">
                🚌
              </div>
              <div>
                <h1 className="text-base font-bold text-white leading-tight">PASS GBAKA</h1>
                <p className="text-[10px] text-white/40">Collecte de trajets</p>
              </div>
            </div>

            {/* Statut */}
            <div className="flex items-center gap-2">
              {status === "recording" && (
                <>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  <span className="text-xs font-semibold text-green-500 uppercase">Enregistrement</span>
                </>
              )}
              {status === "idle" && (
                <span className="text-xs text-white/40">Prêt</span>
              )}
              {status === "paused" && (
                <span className="text-xs text-green-500">✅ Terminé</span>
              )}
            </div>
          </div>

          {/* ===== LIGNE 2 : Contenu principal ===== */}
          <div className="flex-1 flex items-center">
            
            {/* État IDLE */}
            {!showDestinationInput && status === "idle" && (
              <div className="flex w-full items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] text-white/40">📍 Prêt à enregistrer</p>
                  <p className="text-sm text-white">Appuyez sur Démarrer pour commencer</p>
                </div>
                <button
                  onClick={handleStartTrip}
                  className="flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-bold text-black transition hover:scale-[1.02] active:scale-95"
                >
                  <svg className="h-5 w-5 fill-black" viewBox="0 0 24 24">
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
                <div className="flex-1 min-w-[140px]">
                  <p className="text-[8px] text-white/40 uppercase tracking-wider">🟢 Départ</p>
                  <input
                    type="text"
                    value={startPointName}
                    onChange={(e) => setStartPointName(e.target.value)}
                    placeholder="Détection auto..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/30"
                    disabled={isAutoDetecting}
                  />
                </div>

                {/* Destination */}
                <div className="flex-1 min-w-[140px]">
                  <p className="text-[8px] text-white/40 uppercase tracking-wider">🎯 Destination</p>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Plateau, Cocody..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/30"
                    autoFocus
                  />
                  <div className="mt-1 flex gap-2">
                    {["Adjamé", "Plateau", "Cocody", "Treichville"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setDestination(s)}
                        className="text-[8px] text-white/30 hover:text-white/70"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prix */}
                <div className="w-[150px]">
                  <p className="text-[8px] text-white/40 uppercase tracking-wider">💰 Prix</p>
                  <div className="relative">
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="250"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/30"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/20">FCFA</span>
                  </div>
                </div>

                {/* Ligne générée */}
                {lineName && (
                  <div className="flex-1 min-w-[120px]">
                    <p className="text-[8px] text-white/40 uppercase tracking-wider">🚌 Ligne</p>
                    <p className="text-sm text-white/70 font-medium truncate">{lineName}</p>
                  </div>
                )}

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
                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/50 hover:bg-white/10"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirmDestination}
                    disabled={!destination.trim() || !gpsReady}
                    className="rounded-lg bg-white px-6 py-2.5 text-sm font-bold text-black hover:scale-[1.02] disabled:opacity-40"
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
                    <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                    <span className="text-xs font-bold text-green-500 uppercase">REC</span>
                  </div>
                  {startPointName && (
                    <p className="text-sm text-white/60 truncate">
                      🟢 {startPointName.split(',')[0]}
                    </p>
                  )}
                  <p className="text-sm font-bold text-white truncate">→ {destination}</p>
                  {price && (
                    <p className="text-sm text-white/60">💰 {price} FCFA</p>
                  )}
                  {lineName && (
                    <p className="text-xs text-white/40 truncate">🚌 {lineName}</p>
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
                    <p className="text-xs text-white/40">{points.length} points enregistrés</p>
                    {lineName && (
                      <p className="text-xs text-white/40">🚌 {lineName}</p>
                    )}
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
                  className="rounded-lg border border-white/10 px-6 py-2.5 text-sm font-bold text-white hover:bg-white/10"
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
                <span className="h-2.5 w-2.5 rounded-full bg-white/60" />
                <span className="text-[10px] text-white/50">GPS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                <span className="text-[10px] text-white/50">Départ</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="text-[10px] text-white/50">Arrivée</span>
              </div>
              {status === "recording" && (
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  <span className="text-[9px] font-bold text-green-500 uppercase">REC</span>
                </div>
              )}
            </div>

            {/* Infos */}
            {status === "recording" && (
              <div className="flex items-center gap-4 text-xs text-white/30">
                <span>📊 {points.length} pts</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
