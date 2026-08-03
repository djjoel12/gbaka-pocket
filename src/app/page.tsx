"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import GpsRecorder from "@/components/gps/GpsRecorder";

const TransportMap = dynamic(
  () => import("@/components/map/TransportMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[400px] items-center justify-center rounded-2xl bg-gray-800">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-sm text-gray-400">Chargement de la carte...</p>
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
  const [livePosition, setLivePosition] = useState<GPSPoint | null>(null);
  const [status, setStatus] = useState<"idle" | "recording" | "paused">("idle");

  return (
    <div className="flex h-screen flex-col bg-[#0a0a0f]">
      
      {/* ========== ZONE CARTE ========== */}
      {/* 70% de l'écran */}
      <div className="relative h-[70vh] w-full flex-shrink-0 overflow-hidden">
        
        {/* Sélecteur de ligne - overlay en haut */}
        <div className="absolute left-0 right-0 top-4 z-10 px-4">
          <div className="mx-auto max-w-md">
            <select
              value={route}
              onChange={(e) => {
                setRoute(e.target.value);
                setPoints([]);
                setLivePosition(null);
                setStatus("idle");
              }}
              className="w-full rounded-2xl border-0 bg-white/95 px-5 py-3.5 text-sm font-medium text-gray-900 shadow-2xl shadow-black/30 outline-none backdrop-blur-sm transition-all focus:ring-2 focus:ring-blue-500"
            >
              <option value="">🚌 Choisir une ligne</option>
              <option value="yopougon-adjame">Yopougon Maroc → Adjamé</option>
              <option value="abobo-adjame">Abobo → Adjamé</option>
              <option value="cocody-plateau">Cocody → Plateau</option>
            </select>
          </div>
        </div>

        {/* La carte */}
        <TransportMap
          points={points}
          livePosition={livePosition}
          isRecording={status === "recording"}
        />
      </div>

      {/* ========== ZONE CONTROLES ========== */}
      {/* 30% restant */}
      <div className="flex flex-1 flex-col overflow-y-auto bg-[#0a0a0f] px-4 pb-4 pt-2">
        <div className="mx-auto w-full max-w-md flex-1">
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
            <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-5 text-center backdrop-blur-sm">
              <div className="text-3xl mb-2">📍</div>
              <p className="font-medium text-white/80">
                Sélectionnez une ligne
              </p>
              <p className="mt-1 text-sm text-white/40">
                pour commencer l&apos;enregistrement
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
      }
