"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
import GpsRecorder from "@/components/gps/GpsRecorder";
import SupabaseStatus from "@/components/SupabaseStatus";
import type { LineInfo } from "@/types/trip";
import { reverseGeocode } from "@/utils/tripUtils";

const TransportMap = dynamic(
  () => import("@/components/map/TransportMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[400px] items-center justify-center rounded-2xl bg-gray-200">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm text-gray-600">Chargement de la carte...</p>
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

  const mapRef = useRef<any>(null);

  // ============================================
  // AUTODÉTECTION
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
          const cleanName = name.split(',')[0].trim();
          setStartPointName(cleanName);
          setIsAutoDetecting(false);
          setGpsReady(true);
        },
        () => {
          setIsAutoDetecting(false);
          setStartPointName("Position actuelle");
          setGpsReady(true);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [showDestinationInput]);

  // ============================================
  // GÉNÉRATION LIGNE
  // ============================================
  useEffect(() => {
    if (startPointName && destination) {
      const startMain = startPointName.split(',')[0].trim();
      const endMain = destination.split(',')[0].trim();
      setLineName(`${startMain} → ${endMain}`);
    }
  }, [startPointName, destination]);

  // ============================================
  // ACTIONS
  // ============================================
  const handleStartTrip = () => setShowDestinationInput(true);

  const confirmDestination = () => {
    if (destination.trim() && gpsReady) {
      setShowDestinationInput(false);
      setStatus("recording");
    }
  };

  const handleRecenter = () => {
    if (mapRef.current && livePosition) {
      mapRef.current.setView(
        [livePosition.latitude, livePosition.longitude],
        16,
        { animate: true, duration: 0.5 }
      );
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
    <div className="relative h-screen w-screen overflow-hidden bg-[#f0f2f5]">
      
      {/* ===== CARTE ===== */}
      <div className="absolute inset-0 z-0">
        <TransportMap
          points={points}
          livePosition={livePosition}
          isRecording={status === "recording"}
          onMapReady={(map) => { mapRef.current = map; }}
        />
      </div>

      {/* ===== BOUTON COMPAS ===== */}
      {status === "recording" && livePosition && (
        <button
          onClick={handleRecenter}
          className="absolute bottom-[calc(50vh+80px)] right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-xl border border-gray-200 text-xl hover:scale-110 transition active:scale-95"
          title="Recentrer sur ma position"
        >
          🧭
        </button>
      )}

      {/* ===== FENÊTRE 50% - BLANCHE ===== */}
      <div className="absolute bottom-0 left-0 right-0 z-10 h-[50vh] min-h-[320px] bg-white shadow-2xl border-t border-gray-200">
        
        <div className="flex h-full w-full flex-col px-5 py-3">
          
          {/* ===== LIGNE 1 : Logo + Statut ===== */}
          <div className="flex items-center justify-between pb-2 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-xl">🚌</div>
              <div>
                <h1 className="text-base font-bold text-gray-800">PASS GBAKA</h1>
                <p className="text-[10px] text-gray-500">Collecte de trajets GPS</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {status === "recording" && (
                <>
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500" />
                  <span className="text-xs font-bold text-blue-600 uppercase">Enregistrement</span>
                </>
              )}
              {status === "idle" && <span className="text-xs text-gray-400">● Prêt</span>}
              {status === "paused" && (
                <div className="flex items-center gap-2">
                  <span className="text-base">✅</span>
                  <span className="text-xs text-gray-500">Terminé</span>
                </div>
              )}
            </div>
          </div>

          {/* ===== LIGNE 2 : Contenu ===== */}
          <div className="flex-1 flex items-center py-2">
            
            {/* IDLE */}
            {!showDestinationInput && status === "idle" && (
              <div className="flex w-full items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] text-gray-500">📍 Prêt à enregistrer un trajet</p>
                  <p className="text-sm text-gray-800">Appuyez sur Démarrer pour commencer</p>
                </div>
                <button
                  onClick={handleStartTrip}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 transition shadow-sm"
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
              <div className="flex w-full flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">🟢 Départ</label>
                  <input
                    type="text"
                    value={startPointName}
                    onChange={(e) => setStartPointName(e.target.value)}
                    placeholder="Détection auto..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder:text-gray-300 outline-none focus:border-blue-400"
                    disabled={isAutoDetecting}
                  />
                  {isAutoDetecting && (
                    <p className="text-[10px] text-gray-400 mt-1">⏳ Recherche GPS...</p>
                  )}
                </div>

                <div className="flex-1 min-w-[120px]">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">🎯 Destination</label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Ex: Plateau, Cocody..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder:text-gray-300 outline-none focus:border-blue-400"
                    autoFocus
                  />
                  <div className="flex flex-wrap gap-2 mt-1">
                    {["Adjamé", "Plateau", "Cocody", "Treichville", "Marcory"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setDestination(s)}
                        className="text-[10px] text-gray-400 hover:text-gray-600 transition"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="w-[130px]">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">💰 Prix</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="250"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder:text-gray-300 outline-none focus:border-blue-400"
                  />
                </div>

                <div className="flex-1 min-w-[100px]">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">🚌 Ligne</label>
                  <div className={`w-full rounded-lg px-3 py-2 text-sm border ${lineName ? 'border-blue-200 bg-blue-50 text-gray-700' : 'border-gray-200 text-gray-400'}`}>
                    {lineName || "En attente..."}
                  </div>
                </div>

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
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirmDestination}
                    disabled={!destination.trim() || !gpsReady}
                    className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40 transition"
                  >
                    {gpsReady ? "🚀 Démarrer" : "⏳ GPS..."}
                  </button>
                </div>
              </div>
            )}

            {/* RECORDING */}
            {status === "recording" && (
              <div className="flex w-full flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500" />
                    <span className="text-xs font-bold text-blue-600 uppercase">REC</span>
                  </div>
                  {startPointName && (
                    <span className="text-xs text-gray-600">🟢 {startPointName}</span>
                  )}
                  <span className="text-sm font-bold text-gray-800">→ {destination}</span>
                  {price && <span className="text-xs text-gray-600">💰 {price}</span>}
                  {lineName && <span className="text-[10px] text-gray-400">🚌 {lineName}</span>}
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
                  minDistance={2}
                  maxAccuracy={150}
                />
              </div>
            )}

            {/* PAUSED */}
            {status === "paused" && (
              <div className="flex w-full items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✅</span>
                  <div>
                    <p className="text-base font-bold text-gray-800">Trajet terminé</p>
                    <p className="text-xs text-gray-500">{points.length} points</p>
                    {lineName && <p className="text-xs text-gray-500">🚌 {lineName}</p>}
                    {price && <p className="text-xs text-gray-500">💰 {price}</p>}
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
                  className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition"
                >
                  🔄 Nouveau
                </button>
              </div>
            )}
          </div>

          {/* ===== LIGNE 3 : Légende + SupabaseStatus ===== */}
          <div className="flex items-center justify-between border-t border-gray-200 pt-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span className="text-[11px] font-medium text-gray-500">GPS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-[11px] font-medium text-gray-500">Départ</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="text-[11px] font-medium text-gray-500">Arrivée</span>
              </div>
              {status === "recording" && (
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500" />
                  <span className="text-[10px] font-bold text-blue-600 uppercase">REC</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <SupabaseStatus />
              {status === "recording" && (
                <div className="text-xs text-gray-400">📊 {points.length} pts</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
