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
  // AJOUT MANUEL
  // ============================================
  const handleManualAdd = () => {
    if (!currentPosition) return;
    setShowManualInput(true);
  };

  const confirmManualStop = () => {
    if (!currentPosition || !manualStopName.trim()) return;

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
  };

  // ============================================
  // RENDU
  // ============================================
  return (
    <div className="space-y-2 w-full">
      {/* Détection automatique */}
      {detectedStop && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛑</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800">Arrêt détecté !</p>
              <p className="text-xs text-blue-600">
                📍 {detectedStop.coordinates[0].toFixed(4)}, {detectedStop.coordinates[1].toFixed(4)}
              </p>
            </div>
          </div>

          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={stopName}
              onChange={(e) => setStopName(e.target.value)}
              placeholder="Nom de l'arrêt (ex: Gare Nord)"
              className="flex-1 bg-white border border-blue-200 rounded px-2 py-1 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-blue-400"
              autoFocus
            />
          </div>

          <div className="mt-2 flex gap-2">
            <button
              onClick={() => {
                if (stopName.trim()) {
                  onConfirmStop(stopName.trim());
                  setStopName("");
                }
              }}
              className="flex-1 bg-green-600 text-white text-sm font-medium px-3 py-1.5 rounded hover:bg-green-700 transition"
            >
              ✅ Confirmer
            </button>
            <button
              onClick={() => {
                onIgnoreStop();
                setStopName("");
              }}
              className="flex-1 bg-gray-200 text-gray-700 text-sm font-medium px-3 py-1.5 rounded hover:bg-gray-300 transition"
            >
              ❌ Ignorer
            </button>
          </div>
        </div>
      )}

      {/* Ajout manuel */}
      {!showManualInput ? (
        <button
          onClick={handleManualAdd}
          className="w-full bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm font-medium px-3 py-2 rounded-lg transition flex items-center justify-center gap-2"
        >
          <span>➕</span> Ajouter un arrêt manuellement
        </button>
      ) : (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <span className="text-lg">📌</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-purple-800">Ajout manuel</p>
              <p className="text-xs text-purple-600">📍 Position actuelle</p>
            </div>
          </div>

          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={manualStopName}
              onChange={(e) => setManualStopName(e.target.value)}
              placeholder="Nom de l'arrêt"
              className="flex-1 bg-white border border-purple-200 rounded px-2 py-1 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-purple-400"
              autoFocus
            />
          </div>

          <div className="mt-2 flex gap-2">
            <button
              onClick={confirmManualStop}
              disabled={!manualStopName.trim()}
              className="flex-1 bg-purple-600 text-white text-sm font-medium px-3 py-1.5 rounded hover:bg-purple-700 disabled:opacity-40 transition"
            >
              ✅ Ajouter
            </button>
            <button
              onClick={() => {
                setShowManualInput(false);
                setManualStopName("");
              }}
              className="flex-1 bg-gray-200 text-gray-700 text-sm font-medium px-3 py-1.5 rounded hover:bg-gray-300 transition"
            >
              ❌ Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
      }
