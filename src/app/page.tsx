"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import GpsRecorder from "@/components/gps/GpsRecorder";

const TransportMap = dynamic(
  () => import("@/components/map/TransportMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[400px] items-center justify-center rounded-2xl bg-gray-200">
        <p className="text-sm text-gray-500">
          Chargement de la carte...
        </p>
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

  // Tous les points réellement enregistrés
  const [points, setPoints] = useState<GPSPoint[]>([]);

  // Position GPS actuelle
  const [livePosition, setLivePosition] =
    useState<GPSPoint | null>(null);

  // État de l'enregistrement
  const [status, setStatus] = useState<
    "idle" | "recording" | "paused"
  >("idle");

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-6">
      <div className="mx-auto max-w-md space-y-5">

        {/* EN-TÊTE */}
        <header>
          <p className="text-sm font-medium text-blue-600">
            TRANSPORTTICKET.CI
          </p>

          <h1 className="mt-2 text-3xl font-bold text-gray-900">
            Collecte de trajet
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Enregistrez le parcours réel d&apos;une ligne
            de transport.
          </p>
        </header>

        {/* SÉLECTION DE LA LIGNE */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <label
            htmlFor="route"
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            Sélectionner une ligne
          </label>

          <select
            id="route"
            value={route}
            onChange={(e) => {
              setRoute(e.target.value);

              // On efface l'ancien trajet
              setPoints([]);

              // On efface la position actuelle
              setLivePosition(null);

              // On remet l'état à zéro
              setStatus("idle");
            }}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-500"
          >
            <option value="">
              Choisir une ligne
            </option>

            <option value="yopougon-adjame">
              Yopougon Maroc → Adjamé
            </option>

            <option value="abobo-adjame">
              Abobo → Adjamé
            </option>

            <option value="cocody-plateau">
              Cocody → Plateau
            </option>
          </select>
        </section>

        {/* CARTE */}
        <section>
          <TransportMap
            points={points}
            livePosition={livePosition}
            isRecording={status === "recording"}
          />
        </section>

        {/* GPS */}
        {route ? (
          <GpsRecorder
            status={status}
            setStatus={setStatus}
            route={route}
            onPointsChange={setPoints}
            onLivePositionChange={setLivePosition}
            minDistance={5}
            maxAccuracy={50}
          />
        ) : (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-medium text-gray-700">
              Sélectionnez une ligne
            </p>

            <p className="mt-1 text-xs text-gray-500">
              pour commencer l&apos;enregistrement.
            </p>
          </div>
        )}

      </div>
    </main>
  );
      }
