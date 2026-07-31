"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
import GpsRecorder from "@/components/gps/GpsRecorder";

const TransportMap = dynamic(
  () => import("@/components/map/TransportMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[400px] items-center justify-center rounded-2xl bg-gray-200">
        <p className="text-sm text-gray-500">Chargement de la carte…</p>
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

// Type pour les résultats de recherche
type SearchResult = {
  display_name: string;
  lat: string;
  lon: string;
  class: string;
  type: string;
  importance: number;
};

export default function Home() {
  const [route, setRoute] = useState("");
  const [points, setPoints] = useState<GPSPoint[]>([]);
  const [status, setStatus] = useState<"idle" | "recording" | "paused">("idle");

  // États pour la recherche
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<GPSPoint | null>(null);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fonction de recherche
  const searchPlaces = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
      );
      
      if (!response.ok) throw new Error("Erreur de recherche");
      
      const data = await response.json();
      setSearchResults(data);
      setShowResults(true);
    } catch (error) {
      console.error("Erreur de recherche:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounce pour la recherche (attendre que l'utilisateur arrête de taper)
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setShowResults(false);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchPlaces(query);
    }, 500);
  };

  // Sélectionner un lieu
  const selectPlace = (result: SearchResult) => {
    const location: GPSPoint = {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      accuracy: 10,
      speed: null,
      timestamp: Date.now(),
    };
    
    setSelectedLocation(location);
    setSearchQuery(result.display_name);
    setShowResults(false);
    
    // Ajouter le point à la carte
    setPoints((prev) => [...prev, location]);
    
    console.log("📍 Lieu sélectionné:", result.display_name);
  };

  // Nettoyage
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-6">
      <div className="mx-auto max-w-md">
        {/* En-tête */}
        <header className="mb-8">
          <p className="text-sm font-medium text-blue-600">TRANSPORTTICKET.CI</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Collecte de trajet</h1>
          <p className="mt-2 text-sm text-gray-500">
            Enregistrez le parcours réel d&apos;une ligne de transport.
          </p>
        </header>

        {/* Sélection de la ligne */}
        <section className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
          <label htmlFor="route" className="mb-2 block text-sm font-semibold text-gray-700">
            Sélectionner une ligne
          </label>
          <select
            id="route"
            value={route}
            onChange={(e) => setRoute(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-500"
          >
            <option value="">Choisir une ligne</option>
            <option value="yopougon-adjame">Yopougon Maroc → Adjamé</option>
            <option value="abobo-adjame">Abobo → Adjamé</option>
            <option value="cocody-plateau">Cocody → Plateau</option>
          </select>
        </section>

        {/* 🔍 BARRE DE RECHERCHE */}
        <section className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
          <div className="relative">
            <div className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 focus-within:border-blue-500">
              <span className="text-gray-400">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Rechercher un lieu (Yopougon, Adjamé...)"
                className="w-full bg-transparent py-2 text-gray-900 outline-none"
                onFocus={() => searchQuery.trim() && setShowResults(true)}
              />
              {isSearching && (
                <span className="text-sm text-gray-400 animate-pulse">⏳</span>
              )}
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setShowResults(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Résultats de recherche */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-xl bg-white shadow-lg border border-gray-200">
                {searchResults.map((result, index) => (
                  <button
                    key={index}
                    onClick={() => selectPlace(result)}
                    className="flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <span className="mt-0.5 text-gray-400">
                      {result.class === "highway" ? "🛣️" :
                       result.class === "place" ? "📍" :
                       result.class === "amenity" ? "🏪" :
                       result.class === "shop" ? "🛍️" :
                       "📍"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {result.display_name.split(',')[0]}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {result.display_name.split(',').slice(1).join(',').trim()}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {result.type}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Message si aucun résultat */}
            {showResults && searchQuery && searchResults.length === 0 && !isSearching && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl bg-white p-4 text-center shadow-lg border border-gray-200">
                <p className="text-sm text-gray-500">
                  Aucun lieu trouvé pour "{searchQuery}"
                </p>
              </div>
            )}
          </div>

          {/* Lieu sélectionné */}
          {selectedLocation && (
            <div className="mt-3 rounded-lg bg-blue-50 p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900">📍 Lieu sélectionné</p>
                <p className="text-xs text-blue-700">
                  {searchQuery || `${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedLocation(null);
                  setSearchQuery("");
                }}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                ✕ Effacer
              </button>
            </div>
          )}
        </section>

        {/* Carte */}
        <section className="mb-4">
          <TransportMap points={points} />
        </section>

        {/* GPS */}
        {route ? (
          <GpsRecorder
            status={status}
            setStatus={setStatus}
            onPointsChange={setPoints}
          />
        ) : (
          <div className="rounded-2xl bg-white p-5 text-center text-sm text-gray-500 shadow-sm">
            Sélectionnez une ligne pour commencer l&apos;enregistrement.
          </div>
        )}
      </div>
    </main>
  );
                        }
