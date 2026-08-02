"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
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

export default function Home() {
  const [route, setRoute] = useState("");
  const [points, setPoints] = useState<GPSPoint[]>([]);
  const [status, setStatus] = useState<"idle" | "recording" | "paused">("idle");
  
  // ✅ Position en direct (même sans enregistrement)
  const [livePosition, setLivePosition] = useState<GPSPoint | null>(null);
  const [liveAccuracy, setLiveAccuracy] = useState<number>(0);

  // ✅ Suivi GPS permanent
  useEffect(() => {
    if (!navigator.geolocation) {
      console.log("❌ Géolocalisation non disponible");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const point: GPSPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        };
        setLivePosition(point);
        setLiveAccuracy(position.coords.accuracy);
      },
      (error) => {
        console.error("❌ Erreur GPS:", error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const handlePointsChange = (newPoints: GPSPoint[]) => {
    setPoints(newPoints);
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

        {/* ===== CARTE ===== */}
        <section className="relative">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 blur-xl opacity-50" />
          <div className="relative">
            <TransportMap 
              points={points} 
              livePosition={livePosition}
            />
          </div>
        </section>

        {/* ===== INDICATEUR GPS ===== */}
        <div className="rounded-2xl bg-white/70 p-4 shadow-lg border border-gray-100/50 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${livePosition ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm font-medium text-gray-700">
                {livePosition ? '📍 Position en direct' : '🔴 En attente du GPS...'}
              </span>
            </div>
            {liveAccuracy > 0 && (
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                liveAccuracy < 20 ? 'bg-green-100 text-green-700' :
                liveAccuracy < 30 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                Précision: {Math.round(liveAccuracy)}m
              </span>
            )}
          </div>
          {livePosition && (
            <div className="mt-2 text-xs text-gray-400 flex gap-4">
              <span>Lat: {livePosition.latitude.toFixed(6)}</span>
              <span>Lon: {livePosition.longitude.toFixed(6)}</span>
              {livePosition.speed !== null && (
                <span>{(livePosition.speed * 3.6).toFixed(1)} km/h</span>
              )}
            </div>
          )}
        </div>

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
