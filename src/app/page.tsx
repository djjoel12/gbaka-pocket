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
      const generatedName = `Gbaka ${startMain} → ${endMain}`;
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

  // ============================================
  // CONSTRUCTION DES INFOS DE LIGNE
  // ============================================
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
      
      {/* ===== CARTE - 100% DE L'ÉCRAN ===== */}
      <div className="absolute inset-0 z-0">
        <TransportMap
          points={points}
          livePosition={livePosition}
          isRecording={status === "recording"}
        />
      </div>

      {/* ===== INTERFACE À GAUCHE - NOUVEAU DESIGN ===== */}
      <div className="relative z-10 flex h-screen w-[280px] flex-shrink-0 flex-col overflow-y-auto bg-gradient-to-b from-sky-400 via-sky-500 to-blue-600 shadow-2xl">
        
        <div className="flex flex-1 flex-col p-4">
          {/* ===== EN-TÊTE ===== */}
          <div className="mb-4 flex items-center gap-2 border-b border-white/20 pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-xl">
              🚌
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">PASS GBAKA</h1>
              <p className="text-[10px] text-sky-100/70 font-medium">Collecte de trajets</p>
            </div>
          </div>

          {/* ===== CONTENU ===== */}
          <div className="flex-1 space-y-3">
            
            {/* Info trajet en cours */}
            {destination && status === "recording" && (
              <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 p-3">
                <p className="text-[10px] font-semibold text-sky-100 uppercase tracking-wider">Trajet en cours</p>
                <p className="font-bold text-white text-sm">{destination}</p>
                {startPointName && (
                  <p className="text-xs text-white/80">🟢 {startPointName.split(',')[0]}</p>
                )}
                {lineName && (
                  <p className="text-xs text-sky-100">🚌 {lineName}</p>
                )}
                {price && (
                  <p className="text-xs text-yellow-200">💰 {price} FCFA</p>
                )}
              </div>
            )}

            {/* ===== BOUTON PLAY ===== */}
            {!showDestinationInput && status === "idle" && (
              <div className="space-y-3">
                <button
                  onClick={handleStartTrip}
                  className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 px-4 py-4 font-bold text-white shadow-lg shadow-sky-500/30 transition hover:scale-[1.02] hover:shadow-sky-500/50 active:scale-95 flex items-center justify-center gap-3"
                >
                  <svg className="h-6 w-6 fill-white" viewBox="0 0 24 24">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                  <span>Démarrer</span>
                </button>
                <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-3 text-center">
                  <p className="text-xs text-white/80">📍 Le GPS détectera votre position</p>
                </div>
              </div>
            )}

            {/* ===== FORMULAIRE ===== */}
            {showDestinationInput && (
              <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-300">
                {/* Point de départ */}
                <div>
                  <label className="text-xs font-medium text-sky-100 flex items-center gap-1">
                    🟢 Départ
                    {isAutoDetecting ? (
                      <span className="flex items-center gap-1 text-white">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                        Détection...
                      </span>
                    ) : gpsReady ? (
                      <span className="text-white">✅</span>
                    ) : null}
                  </label>
                  <input
                    type="text"
                    value={startPointName}
                    onChange={(e) => setStartPointName(e.target.value)}
                    placeholder="Détection auto..."
                    className="w-full rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-2 text-sm text-white placeholder:text-white/50 outline-none focus:border-white/50 focus:bg-white/15"
                    disabled={isAutoDetecting}
                  />
                </div>

                {/* Destination */}
                <div>
                  <label className="text-xs font-medium text-sky-100">🎯 Destination *</label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Ex: Plateau, Cocody..."
                    className="w-full rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-2 text-sm text-white placeholder:text-white/50 outline-none focus:border-white/50 focus:bg-white/15"
                    autoFocus
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {["Adjamé", "Plateau", "Cocody", "Treichville", "Marcory"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setDestination(s)}
                        className="rounded-full bg-white/10 backdrop-blur-sm border border-white/15 px-2.5 py-0.5 text-xs text-white/70 hover:bg-white/20 hover:text-white"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prix */}
                <div>
                  <label className="text-xs font-medium text-sky-100 flex items-center gap-1">
                    💰 Prix <span className="text-white/40">(optionnel)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="Ex: 250"
                      className="w-full rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-2 text-sm text-white placeholder:text-white/50 outline-none focus:border-white/50 focus:bg-white/15"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">FCFA</span>
                  </div>
                </div>

                {/* Ligne générée */}
                {lineName && (
                  <div className="rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 p-2.5">
                    <p className="text-xs text-sky-200">🚌 Ligne générée</p>
                    <p className="font-medium text-white text-sm">{lineName}</p>
                  </div>
                )}

                {/* Mode auto */}
                <div className="rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 p-2.5">
                  <p className="text-xs text-sky-200">🤖 Mode automatique</p>
                  <p className="text-xs text-white/60">Départ • Ligne • Arrivée • Arrêts</p>
                </div>

                {/* Boutons */}
                <div className="flex gap-2 pt-2">
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
                    className="flex-1 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-2.5 text-sm text-white/80 hover:bg-white/20"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirmDestination}
                    disabled={!destination.trim() || !gpsReady}
                    className="flex-1 rounded-lg bg-gradient-to-r from-sky-400 to-blue-500 px-3 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-400/30 hover:scale-[1.02] disabled:opacity-40"
                  >
                    {gpsReady ? "🚀 Démarrer" : "⏳ GPS..."}
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
              <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 p-4 text-center">
                <div className="text-2xl mb-1">✅</div>
                <p className="font-medium text-white">Trajet terminé</p>
                <p className="text-xs text-white/60">{points.length} points</p>
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
                  className="mt-3 w-full rounded-lg bg-gradient-to-r from-sky-400 to-blue-500 px-3 py-2 text-sm font-bold text-white shadow-lg shadow-sky-400/30 hover:scale-[1.02]"
                >
                  🔄 Nouveau trajet
                </button>
              </div>
            )}
          </div>

          {/* ===== LÉGENDE ===== */}
          <div className="mt-4 border-t border-white/20 pt-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-400 shadow-lg shadow-blue-400/50" />
                <span className="text-white/80 font-medium">GPS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-green-400 shadow-lg shadow-green-400/50" />
                <span className="text-white/80 font-medium">Départ</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400 shadow-lg shadow-rose-400/50" />
                <span className="text-white/80 font-medium">Arrivée</span>
              </div>
              {status === "recording" && (
                <div className="flex items-center gap-1.5 ml-1">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
                  <span className="font-semibold text-emerald-200 text-[10px] uppercase tracking-wider">REC</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  }
