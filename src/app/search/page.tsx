"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { geocodeWithOSM, findRoute, RouteResult } from "@/utils/routeUtils";
import { supabase } from "@/lib/supabase";
import dynamic from "next/dynamic";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ✅ Carte chargée UNIQUEMENT côté client
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);

const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);

const Polyline = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polyline),
  { ssr: false }
);

const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

// ✅ Icônes créées APRÈS le chargement (côté client)
const getIcons = () => {
  if (typeof window === "undefined") {
    return { startIcon: null, endIcon: null, transferIcon: null };
  }
  
  return {
    startIcon: L.divIcon({
      html: `<div style="background:#22C55E;border-radius:50%;width:16px;height:16px;border:3px solid white;box-shadow:0 0 20px rgba(34,197,94,0.6);"></div>`,
      className: "",
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    }),
    endIcon: L.divIcon({
      html: `<div style="background:#EF4444;border-radius:50%;width:16px;height:16px;border:3px solid white;box-shadow:0 0 20px rgba(239,68,68,0.6);"></div>`,
      className: "",
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    }),
    transferIcon: L.divIcon({
      html: `<div style="background:#F59E0B;border-radius:50%;width:14px;height:14px;border:2px solid white;box-shadow:0 0 15px rgba(245,158,11,0.5);"></div>`,
      className: "",
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    }),
  };
};

export default function SearchPage() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [result, setResult] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [startCoords, setStartCoords] = useState<{lat: number, lng: number, name: string} | null>(null);
  const [endCoords, setEndCoords] = useState<{lat: number, lng: number, name: string} | null>(null);
  const [lineGeometry, setLineGeometry] = useState<any>(null);
  const [transferPoints, setTransferPoints] = useState<any[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([5.36, -4.02]);
  const [isMounted, setIsMounted] = useState(false);

  const mapRef = useRef<any>(null);

  // ✅ Marquer le composant comme monté (côté client)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSearch = async () => {
    if (!start.trim() || !end.trim()) {
      setError("Veuillez saisir un départ et une arrivée");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setLineGeometry(null);
    setTransferPoints([]);

    try {
      const startResults = await geocodeWithOSM(start);
      const endResults = await geocodeWithOSM(end);

      if (startResults.length === 0) {
        setError(`Lieu de départ "${start}" non trouvé`);
        setLoading(false);
        return;
      }

      if (endResults.length === 0) {
        setError(`Lieu d'arrivée "${end}" non trouvé`);
        setLoading(false);
        return;
      }

      const startPlace = startResults[0];
      const endPlace = endResults[0];

      setStartCoords({
        lat: startPlace.latitude,
        lng: startPlace.longitude,
        name: startPlace.name,
      });

      setEndCoords({
        lat: endPlace.latitude,
        lng: endPlace.longitude,
        name: endPlace.name,
      });

      setMapCenter([startPlace.latitude, startPlace.longitude]);

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
          const { data, error } = await supabase
            .from('transport_lines')
            .select('geometry')
            .eq('id', busStep.lineId)
            .single();

          if (data && data.geometry) {
            setLineGeometry(data.geometry);
          }
        }

        const transferSteps = route.steps.filter((s: any) => s.type === 'transfer');
        if (transferSteps.length > 0) {
          const points = [];
          for (const step of transferSteps) {
            if (step.fromStop) {
              const geo = await geocodeWithOSM(step.fromStop);
              if (geo.length > 0) {
                points.push({
                  lat: geo[0].latitude,
                  lng: geo[0].longitude,
                  name: step.fromStop,
                });
              }
            }
          }
          setTransferPoints(points);
        }
      }

    } catch (error) {
      console.error("❌ Erreur:", error);
      setError("Une erreur est survenue");
    }

    setLoading(false);
  };

  const getTypeLabel = (type: string) => {
    switch(type) {
      case 'direct': return '🚀 Trajet direct';
      case 'one_transfer': return '🔄 1 correspondance';
      case 'two_transfers': return '🔄🔄 2 correspondances';
      default: return '❌ Aucun itinéraire';
    }
  };

  // ✅ Récupérer les icônes (uniquement côté client)
  const icons = isMounted ? getIcons() : { startIcon: null, endIcon: null, transferIcon: null };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      {/* Header */}
      <div className="p-4 bg-[#12121a] border-b border-white/5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-white/40 text-sm hover:text-white/70 transition">
            ← Retour
          </Link>
          <h1 className="text-lg font-bold">🚌 Planifier un trajet</h1>
          <div className="w-16"></div>
        </div>
      </div>

      {/* Formulaire */}
      <div className="p-4 bg-[#12121a] border-b border-white/5">
        <div className="max-w-6xl mx-auto flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
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

          <div className="flex-1 min-w-[200px]">
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

          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl px-6 py-2.5 font-bold text-white shadow-lg shadow-blue-600/30 hover:scale-[1.02] transition disabled:opacity-40"
          >
            {loading ? "⏳..." : "🔍 Rechercher"}
          </button>
        </div>

        {error && (
          <div className="mt-3 bg-red-500/20 border border-red-500/30 rounded-xl p-3 text-sm text-red-400 max-w-6xl mx-auto">
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Carte + Résultats */}
      <div className="flex-1 flex flex-col lg:flex-row relative min-h-[500px]">
        {/* Carte - UNIQUEMENT côté client */}
        <div className="flex-1 h-[400px] lg:h-auto bg-[#0a0e17] relative">
          {isMounted && (
            <MapContainer
              center={mapCenter}
              zoom={14}
              className="h-full w-full"
              style={{ background: "#0a0e17" }}
              ref={mapRef}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Point de départ */}
              {startCoords && icons.startIcon && (
                <Marker position={[startCoords.lat, startCoords.lng]} icon={icons.startIcon}>
                  <Popup>
                    <div className="text-sm font-bold text-green-600">🚀 Départ</div>
                    <div className="text-xs text-gray-500">{startCoords.name}</div>
                  </Popup>
                </Marker>
              )}

              {/* Point d'arrivée */}
              {endCoords && icons.endIcon && (
                <Marker position={[endCoords.lat, endCoords.lng]} icon={icons.endIcon}>
                  <Popup>
                    <div className="text-sm font-bold text-red-600">🏁 Arrivée</div>
                    <div className="text-xs text-gray-500">{endCoords.name}</div>
                  </Popup>
                </Marker>
              )}

              {/* Tracé de la ligne */}
              {lineGeometry && (
                <Polyline
                  positions={lineGeometry.coordinates.map((c: any) => [c[1], c[0]])}
                  color="#3B82F6"
                  weight={4}
                  opacity={0.9}
                />
              )}

              {/* Points de correspondance */}
              {transferPoints.map((p, i) => (
                icons.transferIcon && (
                  <Marker key={i} position={[p.lat, p.lng]} icon={icons.transferIcon}>
                    <Popup>
                      <div className="text-sm font-bold text-orange-500">🔄 Correspondance</div>
                      <div className="text-xs text-gray-500">{p.name}</div>
                    </Popup>
                  </Marker>
                )
              ))}
            </MapContainer>
          )}
        </div>

        {/* Résultats */}
        <div className="lg:w-[400px] p-4 bg-[#12121a] border-l border-white/5 overflow-y-auto max-h-[400px] lg:max-h-none">
          {result ? (
            <div className="space-y-4">
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
                <div className="space-y-3">
                  {result.steps.map((step, index) => (
                    <div key={index} className="relative pl-6 border-l-2 border-white/10 pb-3 last:pb-0">
                      {step.type === 'bus' && (
                        <div className="flex items-start gap-3">
                          <span className="text-lg">🚌</span>
                          <div>
                            <p className="font-medium text-white">{step.lineName}</p>
                            <p className="text-xs text-white/60">📌 {step.fromStop} → {step.toStop}</p>
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
          ) : (
            <div className="text-center text-white/40 py-8">
              <p className="text-4xl mb-4">🗺️</p>
              <p>Recherchez un trajet pour voir l'itinéraire</p>
              <p className="text-sm mt-2">Les lignes et arrêts s'afficheront sur la carte</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  }
