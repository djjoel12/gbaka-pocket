"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
import GpsRecorder from "@/components/gps/GpsRecorder";

const TransportMap = dynamic(
  () => import("@/components/map/TransportMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[400px] items-center justify-center rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200/50 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-2">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-sm text-gray-500">Chargement de la carte…</p>
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<GPSPoint | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Recherche
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

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setShowResults(false);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchPlaces(query), 400);
  };

  const selectPlace = (result: SearchResult) => {
    const location: GPSPoint = {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      accuracy: 10,
      speed: null,
      timestamp: Date.now(),
    };
    setSelectedLocation(location);
    setSearchQuery(result.display_name.split(',')[0]);
    setShowResults(false);
    setPoints((prev) => {
      const updated = [...prev, location];
      updated.sort((a, b) => a.timestamp - b.timestamp);
      return updated;
    });
  };

  // Fermer les résultats en cliquant ailleurs
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  // ✅ Fonction pour gérer les points depuis GpsRecorder
  const handlePointsChange = (newPoints: GPSPoint[]) => {
    console.log('📊 Points reçus du GPS:', newPoints.length);
    setPoints(newPoints);
  };

  // Icône selon le type de lieu
  const getPlaceIcon = (result: SearchResult) => {
    if (result.class === "highway") return "🛣️";
    if (result.class === "place") return "📍";
    if (result.class === "amenity") return "🏪";
    if (result.class === "shop") return "🛍️";
    if (result.class === "leisure") return "🎯";
    if (result.class === "tourism") return "🏛️";
    if (result.class === "building") return "🏢";
    return "📍";
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 px-4 py-6">
      <div className="mx-auto max-w-md space-y-5">
        {/* ===== EN-TÊTE ===== */}
        <header className="relative">
          <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-purple-500/10 blur-3xl" />
          
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 px-3 py-1 text-xs font-semibold text-blue-700 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
              TRANSPORTTICKET.CI
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
              Collecte de trajet
            </h1>
            <p className="mt-1.5 text-sm text-gray-500">
              Enregistrez le parcours réel d&apos;une ligne de transport.
            </p>
          </div>
        </header>

        {/* ===== SÉLECTION DE LA LIGNE ===== */}
        <section className="group rounded-2xl bg-white/70 p-5 shadow-lg shadow-slate-200/50 backdrop-blur-xl border border-white/80 transition-all hover:shadow-xl hover:shadow-slate-200/70">
          <label htmlFor="route" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
            Sélectionner une ligne
          </label>
          <div className="relative">
            <select
              id="route"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              className="w-full rounded-xl border-0 bg-slate-100/80 px-4 py-3.5 text-gray-900 outline-none ring-1 ring-slate-200/50 transition-all focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
            >
              <option value="">Choisir une ligne</option>
              <option value="yopougon-adjame">🚍 Yopougon Maroc → Adjamé</option>
              <option value="abobo-adjame">🚍 Abobo → Adjamé</option>
              <option value="cocody-plateau">🚍 Cocody → Plateau</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </section>

        {/* ===== BARRE DE RECHERCHE ===== */}
        <section className="rounded-2xl bg-white/70 p-5 shadow-lg shadow-slate-200/50 backdrop-blur-xl border border-white/80">
          <div ref={searchRef} className="relative">
            <div
              className={`flex items-center gap-3 rounded-xl bg-slate-100/80 px-4 py-1.5 transition-all ${
                isSearchFocused ? "ring-2 ring-blue-500 bg-white" : "ring-1 ring-slate-200/50"
              }`}
            >
              <span className="text-gray-400 text-lg">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => {
                  setIsSearchFocused(true);
                  if (searchQuery.trim() && searchResults.length > 0) setShowResults(true);
                }}
                onBlur={() => setIsSearchFocused(false)}
                placeholder="Rechercher un lieu…"
                className="w-full bg-transparent py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400"
              />
              {isSearching && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              )}
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setShowResults(false);
                  }}
                  className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Résultats */}
            {showResults && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-xl bg-white/95 shadow-2xl shadow-slate-300/50 backdrop-blur-xl border border-white/50 animate-in slide-in-from-top-2 duration-200">
                {searchResults.length > 0 ? (
                  <div className="py-1.5">
                    {searchResults.map((result, index) => (
                      <button
                        key={index}
                        onClick={() => selectPlace(result)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50/70 transition-colors border-b border-slate-100/50 last:border-b-0 group"
                      >
                        <span className="text-xl">{getPlaceIcon(result)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {result.display_name.split(',')[0]}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {result.display_name.split(',').slice(1, 4).join(',').trim()}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 capitalize">
                          {result.type}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-sm text-gray-400">Aucun lieu trouvé pour « {searchQuery} »</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Lieu sélectionné */}
          {selectedLocation && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50/50 px-4 py-3 border border-blue-100/50 animate-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📍</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">Lieu sélectionné</p>
                  <p className="text-xs text-gray-600">{searchQuery}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedLocation(null);
                  setSearchQuery("");
                }}
                className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-200/80 hover:text-gray-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </section>

        {/* ===== CARTE ===== */}
        <section className="relative">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 blur-xl opacity-50" />
          <div className="relative">
            <TransportMap points={points} />
          </div>
        </section>

        {/* ===== GPS ===== */}
        {route ? (
          <GpsRecorder
            status={status}
            setStatus={setStatus}
            onPointsChange={handlePointsChange}
            route={route}
          />
        ) : (
          <div className="rounded-2xl bg-white/70 p-8 text-center shadow-lg shadow-slate-200/50 backdrop-blur-xl border border-white/80">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-full bg-slate-100 p-3 text-3xl">🗺️</div>
              <p className="text-sm font-medium text-gray-700">Sélectionnez une ligne</p>
              <p className="text-xs text-gray-400">pour commencer l&apos;enregistrement</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
