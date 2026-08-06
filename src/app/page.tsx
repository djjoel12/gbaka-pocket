"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
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

  // Référence pour la carte
  const mapRef = useRef<any>(null);

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
  // GÉNÉRATION DU NOM DE LA LIGNE
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

  // ============================================
  // RECENTRER LA CARTE (compas)
  // ============================================
  const handleRecenter = () => {
    // Cette fonction est passée à TransportMap via une prop
    // On utilise une ref pour appeler la méthode de recentrage
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
    color: "#ffffff",
    estimatedPrice: price ? parseInt(price) : 0,
  } : null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      
      {/* ===== CARTE ===== */}
      <div className="absolute inset-0 z-0">
        <TransportMap
          points={points}
          livePosition={livePosition}
          isRecording={status === "recording"}
          onMapReady={(map) => { mapRef.current = map; }}
          onRecenter={handleRecenter}
        />
      </div>

      {/* ===== BOUTON COMPAS ===== */}
      {status === "recording" && livePosition && (
        <button
          onClick={handleRecenter}
          className="absolute bottom-[52%] right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-black/70 border-2 border-white/30 text-2xl shadow-xl hover:scale-110 transition active:scale-95"
          title="Recentrer sur ma position"
        >
          🧭
        </button>
      )}

      {/* ===== FENÊTRE 50% PROPRE ===== */}
      <div className="absolute bottom-0 left-0 right-0 z-10 h-[50vh] min-h-[340px] bg-[#0a0a0f] shadow-2xl border-t border-white/10">
        
        <div className="flex h-full w-full flex-col px-6 py-4">
          
          {/* ===== LIGNE 1 : Logo + Statut ===== */}
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-2xl">🚌</div>
              <div>
                <h1 className="text-xl font-bold text-white">PASS GBAKA</h1>
                <p className="text-xs text-white/40">Collecte de trajets GPS</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {status === "recording" && (
                <>
                  <span className="h-3 w-3 animate-pulse rounded-full bg-green-500" />
                  <span className="text-sm font-bold text-green-500 uppercase">Enregistrement</span>
                </>
              )}
              {status === "idle" && <span className="text-sm text-white/40">● Prêt</span>}
              {status === "paused" && (
                <div className="flex items-center gap-2">
                  <span className="text-lg">✅</span>
                  <span className="text-sm text-white/60">Terminé</span>
                </div>
              )}
            </div>
          </div>

          {/* ===== LIGNE 2 : Contenu principal ===== */}
          <div className="flex-1 flex items-center py-3">
            
            {/* ÉTAT IDLE */}
            {!showDestinationInput && status === "idle" && (
              <div className="flex w-full items-center justify-between gap-6">
                <div>
                  <p className="text-sm text-white/40">📍 Prêt à enregistrer un trajet</p>
                  <p className="text-base text-white">Appuyez sur Démarrer pour commencer</p>
                </div>
                <button
                  onClick={handleStartTrip}
                  className="flex items-center gap-3 rounded-lg bg-white px-8 py-4 text-base font-bold text-black hover:scale-105 active:scale-95 transition"
                >
                  <svg className="h-6 w-6 fill-black" viewBox="0 0 24 24">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                  <span>Démarrer</span>
                </button>
              </div>
            )}

            {/* FORMULAIRE DE SAISIE */}
            {showDestinationInput && (
              <div className="flex w-full flex-wrap items-end gap-4">
                
                {/* Départ */}
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-1">🟢 Départ</label>
                  <input
                    type="text"
                    value={startPointName}
                    onChange={(e) => setStartPointName(e.target.value)}
                    placeholder="Détection automatique..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/30"
                    disabled={isAutoDetecting}
                  />
                  {isAutoDetecting && (
                    <p className="text-xs text-white/30 mt-1">⏳ Recherche du signal GPS...</p>
                  )}
                </div>

                {/* Destination */}
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-1">🎯 Destination</label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Ex: Plateau, Cocody..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/30"
                    autoFocus
                  />
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {["Adjamé", "Plateau", "Cocody", "Treichville", "Marcory"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setDestination(s)}
                        className="text-xs text-white/30 hover:text-white/70 transition px-2 py-0.5 rounded border border-white/5 hover:border-white/20"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prix */}
                <div className="w-[160px]">
                  <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-1">💰 Prix</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="250"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/30"
                  />
                </div>

                {/* Ligne générée */}
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-1">🚌 Ligne</label>
                  <div className={`w-full rounded-lg px-4 py-3 text-sm border ${lineName ? 'border-white/20 bg-white/5 text-white' : 'border-white/5 text-white/30'}`}>
                    {lineName || "En attente du départ..."}
                  </div>
                </div>

                {/* Boutons */}
                <div className="flex gap-3">
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
                    className="rounded-lg border border-white/10 px-5 py-3 text-sm text-white/50 hover:bg-white/5 transition"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirmDestination}
                    disabled={!destination.trim() || !gpsReady}
                    className="rounded-lg bg-white px-6 py-3 text-sm font-bold text-black hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 transition"
                  >
                    {gpsReady ? "🚀 Démarrer" : "⏳ GPS..."}
                  </button>
                </div>
              </div>
            )}

            {/* ENREGISTREMENT EN COURS */}
            {status === "recording" && (
              <div className="flex w-full flex-col gap-3">
                {/* Ligne info trajet */}
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 animate-pulse rounded-full bg-green-500" />
                    <span className="text-sm font-bold text-green-500 uppercase">REC</span>
                  </div>
                  {startPointName && (
                    <span className="text-sm text-white/70">🟢 {startPointName}</span>
                  )}
                  <span className="text-sm font-bold text-white">→ {destination}</span>
                  {price && <span className="text-sm text-white/60">💰 {price} FCFA</span>}
                  {lineName && (
                    <span className="text-xs text-white/40">🚌 {lineName}</span>
                  )}
                </div>

                {/* Stats en grille propre */}
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

            {/* TRAJET TERMINÉ */}
            {status === "paused" && (
              <div className="flex w-full items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">✅</span>
                  <div>
                    <p className="text-lg font-bold text-white">Trajet terminé</p>
                    <p className="text-sm text-white/40">{points.length} points enregistrés</p>
                    {lineName && <p className="text-sm text-white/40">🚌 {lineName}</p>}
                    {price && <p className="text-sm text-white/40">💰 {price} FCFA</p>}
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
                  className="rounded-lg border border-white/20 px-8 py-3 text-base font-bold text-white hover:bg-white/5 transition"
                >
                  🔄 Nouveau trajet
                </button>
              </div>
            )}
          </div>

          {/* ===== LIGNE 3 : Légende ===== */}
          <div className="flex items-center justify-between border-t border-white/10 pt-3">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-white/60" />
                <span className="text-sm font-medium text-white/50">GPS</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-green-400" />
                <span className="text-sm font-medium text-white/50">Départ</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="text-sm font-medium text-white/50">Arrivée</span>
              </div>
              {status === "recording" && (
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-pulse rounded-full bg-green-500" />
                  <span className="text-xs font-bold text-green-500 uppercase">REC</span>
                </div>
              )}
            </div>
            {status === "recording" && (
              <div className="text-sm text-white/30">📊 {points.length} pts</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
        }
