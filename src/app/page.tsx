"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import GpsRecorder from "@/components/gps/GpsRecorder";

const TransportMap = dynamic(
  () => import("@/components/map/TransportMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] items-center justify-center rounded-2xl bg-gray-200 animate-pulse">
        <p className="text-sm text-gray-500">Chargement de la carte...</p>
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

export default function Home() {
  const [route, setRoute] = useState("");
  const [points, setPoints] = useState<GPSPoint[]>([]);
  const [status, setStatus] = useState<"idle" | "recording" | "paused">("idle");

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-6">
      <div className="mx-auto max-w-lg">
        {/* En-tête amélioré */}
        <header className="mb-6 text-center">
          <div className="inline-block rounded-full bg-blue-100 px-4 py-1.5 text-xs font-semibold text-blue-700 tracking-wider">
            🚍 TRANSPORTTICKET.CI
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-gray-900">
            Collecte de trajet
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Enregistrez le parcours réel d&apos;une ligne de transport
          </p>
        </header>

        {/* Sélection de ligne améliorée */}
        <section className="mb-4 rounded-2xl bg-white p-5 shadow-md border border-gray-100">
          <label htmlFor="route" className="mb-2 block text-sm font-semibold text-gray-700">
            Sélectionner une ligne
          </label>
          <select
            id="route"
            value={route}
            onChange={(e) => setRoute(e.target.value)}
            className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-blue-400"
          >
            <option value="">Choisir une ligne</option>
            <option value="yopougon-adjame">Yopougon Maroc → Adjamé</option>
            <option value="abobo-adjame">Abobo → Adjamé</option>
            <option value="cocody-plateau">Cocody → Plateau</option>
          </select>
        </section>

        {/* Carte agrandie */}
        <section className="mb-4">
          <TransportMap points={points} />
        </section>

        {/* GPS */}
        {route ? (
          <div className="rounded-2xl bg-white/90 backdrop-blur-sm shadow-md border border-gray-100 p-4">
            <GpsRecorder status={status} setStatus={setStatus} onPointsChange={setPoints} />
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-6 text-center text-sm text-gray-500 shadow-md border border-gray-100">
            <span className="text-4xl block mb-2">📍</span>
            Sélectionnez une ligne pour commencer l&apos;enregistrement.
          </div>
        )}
      </div>
    </main>
  );
      }
