"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import GpsRecorder from "@/components/gps/GpsRecorder";

const TransportMap = dynamic(
  () => import("@/components/map/TransportMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[450px] items-center justify-center rounded-2xl bg-gray-200">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-sm text-gray-500">Chargement de la carte...</p>
        </div>
      </div>
    ),
  }
);

type GPSPoint = {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  timestamp: number;
};

type Status = "idle" | "recording" | "paused";

export default function Home() {
  const [route, setRoute] = useState("");
  const [points, setPoints] = useState<GPSPoint[]>([]);
  const [status, setStatus] = useState<Status>("idle");

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 px-4 py-6">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <header className="mb-8 text-center">
          <div className="inline-block rounded-full bg-blue-100 px-4 py-1 text-xs font-semibold text-blue-700">
            🚌 TRANSPORTTICKET.CI
          </div>
          <h1 className="mt-3 text-3xl font-bold text-gray-900">
            Collecte de trajet
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Enregistrez le parcours réel d'une ligne de transport
          </p>
        </header>

        {/* Sélection ligne */}
        <section className="mb-4 rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <label htmlFor="route" className="mb-2 block text-sm font-semibold text-gray-700">
            Sélectionner une ligne
          </label>
          <select
            id="route"
            value={route}
            onChange={(e) => setRoute(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
          >
            <option value="">Choisir une ligne</option>
            <option value="yopougon-adjame">🚌 Yopougon Maroc → Adjamé</option>
            <option value="abobo-adjame">🚌 Abobo → Adjamé</option>
            <option value="cocody-plateau">🚌 Cocody → Plateau</option>
            <option value="anyama-plateau">🚌 Anyama → Plateau</option>
          </select>
        </section>

        {/* Carte */}
        <section className="mb-4">
          <TransportMap points={points} />
        </section>

        {/* Recorder ou message */}
        {route ? (
          <GpsRecorder
            status={status}
            setStatus={setStatus}
            onPointsChange={setPoints}
          />
        ) : (
          <div className="rounded-2xl bg-white p-6 text-center text-sm text-gray-500 shadow-sm border border-gray-100 border-dashed">
            <span className="text-2xl block mb-2">🗺️</span>
            Sélectionnez une ligne pour commencer l'enregistrement
          </div>
        )}

        {/* Footer */}
        <footer className="mt-8 text-center text-xs text-gray-400">
          <p>© 2026 TransportTicket.ci - Collecte de données GPS</p>
        </footer>
      </div>
    </main>
  );
}