"use client";

import { useState } from "react";
import Link from "next/link";
import { geocodeWithOSM, findRoute, RouteResult } from "@/utils/routeUtils";

export default function SearchPage() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [result, setResult] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!start.trim() || !end.trim()) {
      setError("Veuillez saisir un départ et une arrivée");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      // 1. Géocoder le départ
      const startResults = await geocodeWithOSM(start);
      if (startResults.length === 0) {
        setError(`Lieu de départ "${start}" non trouvé`);
        setLoading(false);
        return;
      }

      // 2. Géocoder l'arrivée
      const endResults = await geocodeWithOSM(end);
      if (endResults.length === 0) {
        setError(`Lieu d'arrivée "${end}" non trouvé`);
        setLoading(false);
        return;
      }

      const startPlace = startResults[0];
      const endPlace = endResults[0];

      console.log("📍 Départ:", startPlace);
      console.log("📍 Arrivée:", endPlace);

      // 3. Trouver l'itinéraire
      const route = await findRoute(
        startPlace.latitude,
        startPlace.longitude,
        endPlace.latitude,
        endPlace.longitude
      );

      setResult(route);

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

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-4">
      <div className="max-w-md mx-auto">
        <Link href="/" className="text-white/40 text-sm hover:text-white/70 transition mb-4 inline-block">
          ← Retour
        </Link>

        <h1 className="text-2xl font-bold mb-2">🚌 Planifier un trajet</h1>
        <p className="text-white/40 text-sm mb-6">Trouvez le meilleur itinéraire en Gbaka</p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-white/60 block mb-1">📍 Départ</label>
            <input
              type="text"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              placeholder="Ex: Yopougon Gesco"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-blue-500/50"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-white/60 block mb-1">🎯 Arrivée</label>
            <input
              type="text"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              placeholder="Ex: Plateau"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-blue-500/50"
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={handleSearch}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl py-4 font-bold text-white shadow-lg shadow-blue-600/30 hover:scale-[1.02] transition disabled:opacity-40"
          >
            {loading ? "⏳ Recherche..." : "🔍 Trouver mon trajet"}
          </button>
        </div>

        {/* Résultat */}
        {result && (
          <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
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
                    {step.type === 'walk' && (
                      <div className="flex items-start gap-3">
                        <span className="text-lg">🚶</span>
                        <div>
                          <p className="font-medium text-white">Marche</p>
                          <p className="text-xs text-white/40">{step.duration} min • {step.distance?.toFixed(1)} km</p>
                        </div>
                      </div>
                    )}
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
                    {index < result.steps.length - 1 && (
                      <div className="absolute left-2 top-8 w-0.5 h-4 bg-white/10" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
                                        }
