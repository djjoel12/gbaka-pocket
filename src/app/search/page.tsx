"use client";

import { useState } from "react";
import Link from "next/link";

export default function SearchPage() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!start.trim() || !end.trim()) {
      alert("Veuillez saisir un départ et une arrivée");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Ici on appellera la fonction de recherche
      // const response = await findRoute(start, end);
      // setResult(response);
      
      // Pour l'instant, simulation
      setTimeout(() => {
        setResult({
          line: "Gbaka 22 - Adjamé ↔ Plateau",
          startStop: "Arrêt Gesco",
          endStop: "Plateau - Place République",
          duration: "25 minutes",
          price: "300 FCFA",
        });
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error("Erreur:", error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-4">
      <div className="max-w-md mx-auto">
        {/* Retour */}
        <Link href="/" className="text-white/40 text-sm hover:text-white/70 transition mb-4 inline-block">
          ← Retour
        </Link>

        <h1 className="text-2xl font-bold mb-2">🚌 Planifier un trajet</h1>
        <p className="text-white/40 text-sm mb-6">Trouvez le meilleur itinéraire en Gbaka</p>

        {/* Formulaire */}
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
            <h3 className="text-lg font-bold text-green-400 mb-2">✅ Itinéraire trouvé !</h3>
            <div className="space-y-2 text-sm">
              <p><span className="text-white/40">🚌 Ligne :</span> {result.line}</p>
              <p><span className="text-white/40">📍 Montez à :</span> {result.startStop}</p>
              <p><span className="text-white/40">📍 Descendez à :</span> {result.endStop}</p>
              <p><span className="text-white/40">⏱️ Durée :</span> {result.duration}</p>
              <p><span className="text-white/40">💰 Prix :</span> {result.price}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
        }
