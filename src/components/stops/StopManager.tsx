"use client";

import { useState } from "react";
import { StopPoint, GPSPoint } from "@/types/trip";

type StopManagerProps = {
  isRecording: boolean;
  currentPosition: GPSPoint | null;
  onStopAdded: (stop: StopPoint) => void;
  detectedStop: StopPoint | null;
  onConfirmStop: (name: string) => void;
  onIgnoreStop: () => void;
};

export default function StopManager({
  isRecording,
  currentPosition,
  onStopAdded,
  detectedStop,
  onConfirmStop,
  onIgnoreStop,
}: StopManagerProps) {
  const [stopName, setStopName] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualStopName, setManualStopName] = useState("");

  if (!isRecording) return null;

  // ============================================
  // FENÊTRE 4 : CONFIRMATION D'ARRÊT
  // ============================================
  if (detectedStop) {
    return (
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-4 mb-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🛑</span>
          <p className="text-sm font-medium text-white">Arrêt détecté !</p>
        </div>
        <p className="text-xs text-white/40 mb-3">
          📍 {detectedStop.coordinates[0].toFixed(4)}, {detectedStop.coordinates[1].toFixed(4)}
        </p>
        <input
          type="text"
          value={stopName}
          onChange={(e) => setStopName(e.target.value)}
          placeholder="Nom de l'arrêt (ex: Gare Nord)"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-blue-500/50 mb-3"
          autoFocus
        />
        <div className="flex gap-3">
          <button
            onClick={() => {
              if (stopName.trim()) {
                onConfirmStop(stopName.trim());
                setStopName("");
              }
            }}
            className="flex-1 bg-gradient-to-r from-green-500 to-green-600 rounded-xl py-2.5 text-sm font-bold text-white hover:scale-[1.02] transition"
          >
            ✅ Confirmer
          </button>
          <button
            onClick={() => {
              onIgnoreStop();
              setStopName("");
            }}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2.5 text-sm font-medium text-white/40 hover:bg-white/10 transition"
          >
            ❌ Ignorer
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // FENÊTRE 5 : AJOUT MANUEL D'ARRÊT
  // ============================================
  return (
    <div className="mb-3">
      {!showManualInput ? (
        <button
          onClick={() => setShowManualInput(true)}
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 text-sm font-medium text-white/60 hover:bg-white/10 transition flex items-center justify-center gap-2"
        >
          <span className="text-lg">➕</span> Ajouter un arrêt manuellement
        </button>
      ) : (
        <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📌</span>
            <p className="text-sm font-medium text-white">Ajout manuel</p>
          </div>
          <p className="text-xs text-white/40 mb-3">📍 Position actuelle</p>
          <input
            type="text"
            value={manualStopName}
            onChange={(e) => setManualStopName(e.target.value)}
            placeholder="Nom de l'arrêt"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-blue-500/50 mb-3"
            autoFocus
          />
          <div className="flex gap-3">
            <button
              onClick={() => {
                if (manualStopName.trim() && currentPosition) {
                  const newStop: StopPoint = {
                    id: `manual-${Date.now()}`,
                    name: manualStopName.trim(),
                    coordinates: [currentPosition.latitude, currentPosition.longitude],
                    timestamp: currentPosition.timestamp,
                    duration: 0,
                    isStart: false,
                    isEnd: false,
                    isManual: true,
                    isConfirmed: true,
                  };
                  onStopAdded(newStop);
                  setShowManualInput(false);
                  setManualStopName("");
                }
              }}
              disabled={!manualStopName.trim()}
              className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl py-2.5 text-sm font-bold text-white hover:scale-[1.02] disabled:opacity-40 transition"
            >
              ✅ Ajouter
            </button>
            <button
              onClick={() => {
                setShowManualInput(false);
                setManualStopName("");
              }}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2.5 text-sm font-medium text-white/40 hover:bg-white/10 transition"
            >
              ❌ Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
  }
