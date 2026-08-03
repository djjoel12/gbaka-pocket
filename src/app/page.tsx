"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import GpsRecorder from "@/components/gps/GpsRecorder";

const TransportMap = dynamic(
  () => import("@/components/map/TransportMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[400px] items-center justify-center rounded-2xl bg-gray-200">
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
    <main className="flex h-screen flex-col bg-gray-100 p-4">
      {/* SÉLECTION DE LA LIGNE - compacte */}
      <div className="mx-auto mb-3 w-full max-w-md flex-shrink-0">
        <select
          id="route"
          value={route}
          onChange={(e) => {
            setRoute(e.target.value);
            setPoints([]);
            setLivePosition(null);
            setStatus("idle");
          }}
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500"
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
      </div>

      {/* CARTE - 70% de l'espace */}
      <div className="flex-1 overflow-hidden">
        <TransportMap
          points={points}
          livePosition={livePosition}
          isRecording={status === "recording"}
        />
      </div>

      {/* GPS - contrôles en bas */}
      <div className="mx-auto mt-3 w-full max-w-md flex-shrink-0">
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
          <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
            <p className="text-sm font-medium text-gray-700">
              Sélectionnez une ligne
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              pour commencer l&apos;enregistrement.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
