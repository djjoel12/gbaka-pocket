"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchOSMStops } from "@/utils/supabaseUtils";
import { geocodeWithOSM, findRoute, RouteResult } from "@/utils/routeUtils";
import { fetchTransportLines } from "@/utils/supabaseUtils";
import { supabase } from "@/lib/supabase";

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
  const [points] = useState<GPSPoint[]>([]);
  const [livePosition] = useState<GPSPoint | null>(null);
  const [osmStops, setOsmStops] = useState<any[]>([]);
  const [transportLines, setTransportLines] = useState<any[]>([]);  // ✅ AJOUT
  const [searchedLine, setSearchedLine] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);
  
  // États pour la recherche
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [result, setResult] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);

  const mapRef = useRef<any>(null);



  // ============================================
  // CHARGEMENT DES ARRÊTS OSM UNIQUEMENT
  // ============================================
  useEffect(() => {
    const loadOSMStops = async () => {
      try {
        const stops = await fetchOSMStops();
        console.log(`🚏 ${stops.length} arrêts OSM chargés`);
        setOsmStops(stops);
      } catch (error) {
        console.error('❌ Erreur arrêts OSM:', error);
      }
    };
    loadOSMStops();
  }, []);

  
  // ============================================
  // CHARGEMENT DES LIGNES DE TRANSPORT
  // ============================================
  useEffect(() => {
    const loadTransportLines = async () => {
      try {
        const lines = await fetchTransportLines();
        console.log(`🚌 ${lines.length} lignes chargées`);
        setTransportLines(lines);
      } catch (error) {
        console.error('❌ Erreur lignes transport:', error);
      }
    };
    loadTransportLines();
  }, []);

  // ============================================
  // RECHERCHE DE TRAJET
  // ============================================

  const handleSearch = async () => {
    if (!start.trim() || !end.trim()) {
      setSearchError("Veuillez saisir un départ et une arrivée");
      return;
    }

    setLoading(true);
    setSearchError("");
    setResult(null);
    setSearchedLine(null);
    setShowResult(false);

    try {
      const startResults = await geocodeWithOSM(start);
      const endResults = await geocodeWithOSM(end);

      if (startResults.length === 0) {
        setSearchError(`Lieu de départ "${start}" non trouvé`);
        setLoading(false);
        return;
      }

      if (endResults.length === 0) {
        setSearchError(`Lieu d'arrivée "${end}" non trouvé`);
        setLoading(false);
        return;
      }

      const startPlace = startResults[0];
      const endPlace = endResults[0];

      console.log("📍 Départ:", startPlace);
      console.log("📍 Arrivée:", endPlace);

      const route = await findRoute(
        startPlace.latitude,
        startPlace.longitude,
        endPlace.latitude,
        endPlace.longitude
      );

      setResult(route);

      if (route.type !== 'none' && route.steps.length > 0) {
        const busStep = route.steps.find((s: any) => s.type === 'bus');
        if (busStep && busStep.lineId) {
          const { data } = await supabase
            .from('transport_lines')
            .select('*')
            .eq('id', busStep.lineId)
            .single();
          setSearchedLine(data);
          setShowResult(true);
        }
      }

      setIsSheetExpanded(true);

    } catch (error) {
      console.error("❌ Erreur:", error);
      setSearchError("Une erreur est survenue");
    }

    setLoading(false);
  };

  const toggleSheet = () => {
    setIsSheetExpanded(!isSheetExpanded);
  };

  const getTypeLabel = (type: string) => {
    switch(type) {
      case 'direct': return '🚀 Trajet direct';
      case 'one_transfer': return '🔄 1 correspondance';
      case 'two_transfers': return '🔄🔄 2 correspondances';
      default: return '❌ Aucun itinéraire';
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      
      {/* ===== CARTE ===== */}
      <div className="absolute inset-0 z-0">
        <TransportMap
          points={points}
          livePosition={livePosition}
          isRecording={false}
          onMapReady={(map) => { mapRef.current = map; }}
          osmStops={osmStops}
          searchedLine={searchedLine}
          showResult={showResult}
          transportLines={transportLines}  // ✅ AJOUTE CETTE LIGNE
        />
      </div>

      {/* ===== CONTROLES CARTE ===== */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <button className="h-10 w-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white flex items-center justify-center text-sm hover:bg-black/80 transition">
          🗺️
        </button>
        <button className="h-10 w-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white flex items-center justify-center text-sm hover:bg-black/80 transition">
          ⚙️
        </button>
      </div>

      {/* ===== BOTTOM SHEET ===== */}
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
        {/* ===== HANDLE ===== */}
        <div className="flex justify-center pt-3 pb-2" onClick={toggleSheet}>
          <div className="w-12 h-1.5 rounded-full bg-white/20 hover:bg-white/40 transition cursor-pointer" />
        </div>

        <div className="px-5 pb-6 overflow-y-auto max-h-[90vh]">
          
          {/* ===== EN-TÊTE ===== */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-xl flex-shrink-0">
              🚌
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">PASS GBAKA</h1>
              <p className="text-[10px] text-white/40 font-medium tracking-wider">Recherche de trajets</p>
            </div>
            <button 
              onClick={toggleSheet}
              className="ml-auto text-white/40 hover:text-white/70 text-xs transition"
            >
              {isSheetExpanded ? "Réduire ▲" : "Déplier ▼"}
            </button>
          </div>

          {/* ===== RECHERCHE ===== */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-white/60 block mb-1">📍 Départ</label>
              <input
                type="text"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                placeholder="Ex: Gesco, Yopougon"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 outline-none focus:border-blue-500/50"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-white/60 block mb-1">🎯 Arrivée</label>
              <input
                type="text"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                placeholder="Ex: Adjamé, Plateau"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 outline-none focus:border-blue-500/50"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>

            {searchError && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">
                ⚠️ {searchError}
              </div>
            )}

            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl py-3 font-bold text-white shadow-lg shadow-blue-600/30 hover:scale-[1.02] transition disabled:opacity-40"
            >
              {loading ? "⏳ Recherche..." : "🔍 Trouver mon trajet"}
            </button>
          </div>

          {/* ===== RÉSULTAT ===== */}
          {result && (
            <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-green-400">{getTypeLabel(result.type)}</h3>
                {result.type !== 'none' && (
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{result.totalDuration} min</p>
                    <p className="text-xs text-white/40">{result.totalPrice} FCFA</p>
                  </div>
                )}
              </div>

              {result.type === 'none' ? (
                <p className="text-sm text-yellow-400">{result.message || "Aucun itinéraire trouvé"}</p>
              ) : (
                <div className="space-y-3 mt-3">
                  {result.steps.map((step, index) => (
                    <div key={index} className="relative pl-6 border-l-2 border-white/10 pb-3 last:pb-0">
                      {step.type === 'bus' && (
                        <div className="flex items-start gap-3">
                          <span className="text-lg">🚌</span>
                          <div>
                            <p className="font-medium text-white">{step.lineName || "Ligne de transport"}</p>
                            <span className="text-xs text-white/60">{step.fromStop} ➔ {step.toStop}</span>
                            
                            <p className="text-xs text-white/40">{step.duration} min • {step.price} FCFA</p>
                          </div>
                        </div>
                      )}
                      {step.type === 'transfer' && (
                        <div className="flex items-start gap-3">
                          <span className="text-lg">🔄</span>
                          <div>
                            <p className="font-medium text-yellow-400">Correspondance</p>
                            <p className="text-xs text-white/60">📌 Descendre à {step.fromStop}</p>
                            <p className="text-xs text-white/40">{step.duration} min</p>
                          </div>
                        </div>
                      )}
                      {step.type === 'walk' && (
                        <div className="flex items-start gap-3">
                          <span className="text-lg">🚶</span>
                          <div>
                            <p className="font-medium text-white">Marche</p>
                            <p className="text-xs text-white/40">{step.duration} min • {step.distance?.toFixed(1)} km</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== FOOTER ===== */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/30">Arrêts disponibles</span>
              <span className="text-[10px] text-white/40">{osmStops.length}</span>
            </div>
            <span className="text-[10px] text-white/20">PASS GBAKA</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
      }
