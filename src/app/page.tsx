"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
import GpsRecorder from "@/components/gps/GpsRecorder";
import type { LineInfo } from "@/types/trip";
import { reverseGeocode } from "@/utils/tripUtils";
import type { StopPoint } from "@/types/trip";
import { motion, AnimatePresence } from "framer-motion";
import { fetchAllPOIs, POI } from "@/utils/poiUtils";
import { fetchHistoricalStops } from "@/utils/supabaseUtils";

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

const SUGGESTED_DESTINATIONS = ["Adjame", "Cocody", "Trech.", "Plateau", "Yopou."];

export default function Home() {
  const [points, setPoints] = useState<GPSPoint[]>([]);
  const [livePosition, setLivePosition] = useState<GPSPoint | null>(null);
  const [status, setStatus] = useState<"idle" | "recording" | "paused">("idle");
  
  const [destination, setDestination] = useState("");
  const [price, setPrice] = useState("");
  const [lineName, setLineName] = useState("");
  const [startPointName, setStartPointName] = useState("");
  const [endPointName, setEndPointName] = useState("");
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [historicalStops, setHistoricalStops] = useState<StopPoint[]>([])
  const [elapsedTime, setElapsedTime] = useState(0);
  const [stopsCount, setStopsCount] = useState(0);
  const [pois, setPois] = useState<POI[]>([]);
  const [stops, setStops] = useState<StopPoint[]>([]);
  
  // ✅ État pour les arrêts historiques
  
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [gpsReady, setGpsReady] = useState(false);
  const [showDestinationInput, setShowDestinationInput] = useState(false);

  const mapRef = useRef<any>(null);

  useEffect(() => {
    const loadPOIs = async () => {
      const data = await fetchAllPOIs();
      setPois(data);
    };
    loadPOIs();
  }, []);

  // ✅ Charger les arrêts historiques
  // État pour les arrêts historiques


// Charger les arrêts enregistrés dans Supabase
// ✅ NOUVEAU CODE (à mettre) :
useEffect(() => {
  const loadHistoricalStops = async () => {
    try {
      const stopsData = await fetchHistoricalStops()
      
      console.log(`🚏 ${stopsData.length} arrêts chargés`)
      
      setHistoricalStops(stopsData)
      
    } catch (error) {
      console.error('❌ Impossible de charger les arrêts:', error)
      
      alert(
        error instanceof Error
          ? error.message
          : 'Impossible de charger les arrêts'
      )
      
      setHistoricalStops([])
    }
  }
  
  loadHistoricalStops()
}, []);
  

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

  useEffect(() => {
    if (startPointName && destination) {
      const startMain = startPointName.split(',')[0].trim();
      const endMain = destination.split(',')[0].trim();
      setLineName(`${startMain} → ${endMain}`);
    }
  }, [startPointName, destination]);

  useEffect(() => {
    if (status === "recording") {
      const interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
    if (status === "idle" || status === "paused") {
      setElapsedTime(0);
    }
  }, [status]);

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

  const toggleSheet = () => {
    setIsSheetExpanded(!isSheetExpanded);
  };

  const lineInfo: LineInfo | null = lineName ? {
    id: Date.now().toString(),
    name: lineName,
    number: lineName.match(/\d+/)?.[0] || "",
    type: "gbaka",
    color: "#ffffff",
    estimatedPrice: price ? parseInt(price) : 0,
  } : null;

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const calculateTotalDistance = (pts: GPSPoint[]): number => {
    if (pts.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const dist = calculateDistance(
        pts[i-1].latitude, pts[i-1].longitude,
        pts[i].latitude, pts[i].longitude
      );
      total += dist;
    }
    return total / 1000;
  };

  const calculateAverageSpeed = (pts: GPSPoint[]): number => {
    const speeds = pts.filter(p => p.speed !== null).map(p => p.speed!);
    if (speeds.length === 0) return 0;
    const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    return avg * 3.6;
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(deltaPhi/2)**2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda/2)**2;
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * R;
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      
      <div className="absolute inset-0 z-0">
        <TransportMap
          points={points}
          livePosition={livePosition}
          isRecording={status === "recording"}
          onMapReady={(map) => { mapRef.current = map; }}
          stops={stops}
          pois={pois}
          historicalStops={historicalStops} // ✅ Envoi des arrêts historiques
        />
      </div>

      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <button className="h-10 w-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white flex items-center justify-center text-sm hover:bg-black/80 transition">
          🗺️
        </button>
        <button className="h-10 w-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white flex items-center justify-center text-sm hover:bg-black/80 transition">
          ⚙️
        </button>
        {status === "recording" && livePosition && (
          <button
            onClick={handleRecenter}
            className="h-10 w-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white flex items-center justify-center text-lg hover:bg-black/80 transition"
          >
            🧭
          </button>
        )}
      </div>

      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.1}
        dragMomentum={false}
        initial={{ y: "55%" }}
        animate={{ y: isSheetExpanded ? "5%" : "55%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="absolute bottom-0 left-0 right-0 z-10 bg-[#12121a] rounded-t-3xl shadow-2xl border-t border-white/5 max-h-[95vh] overflow-hidden"
      >
        <div className="flex justify-center pt-3 pb-2" onClick={toggleSheet}>
          <div className="w-12 h-1.5 rounded-full bg-white/20 hover:bg-white/40 transition cursor-pointer" />
        </div>

        <div className="px-5 pb-6 overflow-y-auto max-h-[90vh]">
          
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-xl flex-shrink-0">
              🚌
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">PASS GBAKA</h1>
              <p className="text-[10px] text-white/40 font-medium tracking-wider">Collecte de trajets GPS professionnelle</p>
            </div>
            <button 
              onClick={toggleSheet}
              className="ml-auto text-white/40 hover:text-white/70 text-xs transition"
            >
              {isSheetExpanded ? "Réduire ▲" : "Déplier ▼"}
            </button>
          </div>

          {!showDestinationInput && status === "idle" && (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/30 mb-4 w-fit">
                <span className="text-xs">🚀</span>
                <span className="text-xs font-medium text-yellow-400">Prêt</span>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center mb-4">
                <p className="text-white/60 text-sm">📍 Prêt à enregistrer un trajet</p>
                <p className="text-white/30 text-xs mt-1">Appuyez sur Démarrer pour commencer</p>
              </div>

              <button
                onClick={handleStartTrip}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl py-4 text-base font-bold text-white shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition flex items-center justify-center gap-2"
              >
                <svg className="h-5 w-5 fill-white" viewBox="0 0 24 24">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                Démarrer le trajet
              </button>
            </>
          )}

          {showDestinationInput && (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/30 mb-4 w-fit">
                <span className="text-xs">🚀</span>
                <span className="text-xs font-medium text-yellow-400">Préparation du Trajet</span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block mb-1">🟢 Départ</label>
                  <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                    <p className="text-sm text-white font-medium truncate">
                      {startPointName || "Détection..."}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block mb-1">🎯 Destination</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="Adjamé"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-blue-500/50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">🔍</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {SUGGESTED_DESTINATIONS.map((city) => (
                  <button
                    key={city}
                    onClick={() => setDestination(city)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
                      destination === city
                        ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                        : "bg-white/5 border-white/10 text-white/40 hover:border-white/30 hover:text-white/70"
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block mb-1">💰 Prix</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="250"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block mb-1">🚌 Ligne</label>
                  <div className={`w-full bg-white/5 border rounded-xl px-3 py-2.5 text-sm ${lineName ? 'border-white/20 text-white' : 'border-white/10 text-white/30'}`}>
                    {lineName || "En attente..."}
                  </div>
                </div>
              </div>

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
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl py-3 text-sm font-medium text-white/40 hover:bg-white/10 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmDestination}
                  disabled={!destination.trim() || !gpsReady}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:scale-[1.02] disabled:opacity-40 transition"
                >
                  {gpsReady ? "🚀 Démarrer" : "⏳ GPS..."}
                </button>
              </div>
            </>
          )}

          {status === "recording" && (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 border border-green-500/30 mb-4 w-fit">
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-medium text-green-400">Suivi GPS Actif</span>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-green-500 uppercase">REC</span>
                {startPointName && (
                  <span className="text-xs text-white/60">🟢 {startPointName}</span>
                )}
                <span className="text-xs font-medium text-white">→ {destination}</span>
                {price && <span className="text-xs text-white/40">💰 {price}</span>}
                {lineName && <span className="text-[10px] text-white/30">🚌 {lineName}</span>}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">Tableau de bord</h3>
                  <button 
                    onClick={() => setIsSheetExpanded(!isSheetExpanded)}
                    className="text-[10px] text-blue-400/60 hover:text-blue-400 transition"
                  >
                    {isSheetExpanded ? "Réduire" : "Voir tous les détails"}
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-white/30 font-medium uppercase tracking-wider">Vitesse Moy.</p>
                    <p className="text-2xl font-bold text-white mt-0.5">
                      {points.length > 1 
                        ? `${calculateAverageSpeed(points).toFixed(1)}`
                        : "---"} 
                      <span className="text-sm font-normal text-white/30"> km/h</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 font-medium uppercase tracking-wider">Distance Est.</p>
                    <p className="text-2xl font-bold text-white mt-0.5">
                      {points.length > 0
                        ? `${calculateTotalDistance(points).toFixed(1)}`
                        : "---"} 
                      <span className="text-sm font-normal text-white/30"> km</span>
                    </p>
                  </div>
                </div>

                <AnimatePresence>
                  {isSheetExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/5">
                        <div className="text-center">
                          <p className="text-[8px] text-white/30 uppercase">Points</p>
                          <p className="text-sm font-bold text-white">{points.length}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[8px] text-white/30 uppercase">Temps</p>
                          <p className="text-sm font-bold text-white">
                            {formatTime(elapsedTime)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[8px] text-white/30 uppercase">Arrêts</p>
                          <p className="text-sm font-bold text-white">{stopsCount}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <GpsRecorder
                status={status}
                setStatus={setStatus}
                destination={destination}
                lineInfo={lineInfo}
                startPointName={startPointName}
                endPointName={endPointName}
                price={price}
                livePosition={livePosition}
                onPointsChange={setPoints}
                onLivePositionChange={setLivePosition}
                onStopsCountChange={setStopsCount}
                onStopsChange={setStops}
                minDistance={2}
                maxAccuracy={150}
              />
            </>
          )}

          {status === "paused" && (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 border border-green-500/30 mb-4 w-fit">
                <span className="text-xs">✅</span>
                <span className="text-xs font-medium text-green-400">Trajet terminé</span>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✅</span>
                  <div>
                    <p className="text-sm font-bold text-white">Trajet terminé</p>
                    <p className="text-xs text-white/40">{points.length} points enregistrés</p>
                    {lineName && <p className="text-xs text-white/40">🚌 {lineName}</p>}
                    {price && <p className="text-xs text-white/40">💰 {price} FCFA</p>}
                    {stopsCount > 0 && <p className="text-xs text-white/40">🛑 {stopsCount} arrêts</p>}
                  </div>
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
                className="w-full bg-white/10 border border-white/20 rounded-xl py-4 text-base font-bold text-white hover:bg-white/20 transition"
              >
                🔄 Nouveau trajet
              </button>
            </>
          )}

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/30">Supabase</span>
              <span className="text-[10px] text-green-400">✅</span>
            </div>
            <span className="text-[10px] text-white/20">Conditions d'Utilisation</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
