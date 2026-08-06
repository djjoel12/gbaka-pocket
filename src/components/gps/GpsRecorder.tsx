"use client";

import {
  Dispatch,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";

import type { GPSPoint, TripData, LineInfo, StopPoint } from "@/types/trip";
import {
  calculateDistance,
  detectStops,
  calculateQuality,
  calculateAverageSpeed,
  calculateMaxSpeed,
  calculateMovingTime,
  saveTrip,
  reverseGeocode,
} from "@/utils/tripUtils";

type GpsRecorderProps = {
  status: "idle" | "recording" | "paused";
  setStatus: Dispatch<SetStateAction<"idle" | "recording" | "paused">>;
  onPointsChange: (points: GPSPoint[]) => void;
  onLivePositionChange: (point: GPSPoint | null) => void;
  destination?: string;
  lineInfo?: LineInfo | null;
  startPointName?: string;
  endPointName?: string;
  price?: string;
  minDistance?: number;
  maxAccuracy?: number;
};

function detectSpike(prev: GPSPoint | null, curr: GPSPoint, maxJump = 100): boolean {
  if (!prev) return false;
  const R = 6371000;
  const dLat = (curr.latitude - prev.latitude) * Math.PI / 180;
  const dLon = (curr.longitude - prev.longitude) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(prev.latitude * Math.PI/180) * Math.cos(curr.latitude * Math.PI/180) * Math.sin(dLon/2)**2;
  const dist = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * R;
  if (dist > maxJump) { console.log(`GPS ignoré : saut de ${dist.toFixed(1)}m`); return true; }
  return false;
}

export default function GpsRecorder({
  status,
  setStatus,
  onPointsChange,
  onLivePositionChange,
  destination,
  lineInfo = null,
  startPointName = "",
  endPointName = "",
  price = "",
  minDistance = 5,
  maxAccuracy = 50,
}: GpsRecorderProps) {
  const [points, setPoints] = useState<GPSPoint[]>([]);
  const [gpsStatus, setGpsStatus] = useState("En attente");
  const [error, setError] = useState("");
  const [totalDistance, setTotalDistance] = useState(0);
  const [tripStartTime, setTripStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState<number | null>(null);
  const [tripSaved, setTripSaved] = useState(false);
  const [stops, setStops] = useState<StopPoint[]>([]);
  const [showPriceInput, setShowPriceInput] = useState(false);
  const [finalPrice, setFinalPrice] = useState(price || "");

  const watchIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<GPSPoint | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (status === "recording") {
      setTripStartTime(Date.now());
      timerRef.current = setInterval(() => {
        if (tripStartTime) setElapsedTime(Math.floor((Date.now() - tripStartTime) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [status, tripStartTime]);

  const stopGPS = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  };

  const formatSpeed = (s: number | null) => {
    if (s === null || s < 0) return "--";
    return `${(s * 3.6).toFixed(0)} km/h`;
  };

  useEffect(() => {
    if (status === "recording" && destination) startRecording();
  }, [status, destination]);

  const startRecording = () => {
    if (!navigator.geolocation) { setError("Géolocalisation indisponible."); return; }
    stopGPS();
    setError("");
    setPoints([]);
    onPointsChange([]);
    setTotalDistance(0);
    setCurrentSpeed(null);
    setTripSaved(false);
    setStops([]);
    setShowPriceInput(false);
    lastPointRef.current = null;
    onLivePositionChange(null);
    setGpsStatus("Recherche GPS...");
    setTripStartTime(Date.now());

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newPoint: GPSPoint = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        };
        setCurrentSpeed(pos.coords.speed);
        onLivePositionChange(newPoint);

        if (newPoint.accuracy > maxAccuracy) {
          setGpsStatus(`Précision ${Math.round(newPoint.accuracy)}m`);
          return;
        }

        if (lastPointRef.current === null) {
          setPoints([newPoint]);
          onPointsChange([newPoint]);
          lastPointRef.current = newPoint;
          setGpsStatus("Enregistrement");
          return;
        }

        if (detectSpike(lastPointRef.current, newPoint)) return;

        const R = 6371000;
        const dLat = (newPoint.latitude - lastPointRef.current.latitude) * Math.PI / 180;
        const dLon = (newPoint.longitude - lastPointRef.current.longitude) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lastPointRef.current.latitude * Math.PI/180) * Math.cos(newPoint.latitude * Math.PI/180) * Math.sin(dLon/2)**2;
        const dist = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * R;

        if (dist < minDistance) return;

        setPoints((prev) => {
          const updated = [...prev, newPoint];
          onPointsChange(updated);
          if (updated.length % 10 === 0) setStops(detectStops(updated));
          return updated;
        });

        setTotalDistance(d => d + dist);
        lastPointRef.current = newPoint;
        setGpsStatus("Enregistrement");
      },
      (err) => {
        console.error("GPS Error:", err);
        setError("Erreur GPS.");
        setGpsStatus("Erreur");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
    watchIdRef.current = watchId;
  };

  const saveTripWithPrice = async (tripPrice: number) => {
    if (points.length === 0) { setError("Aucun point GPS enregistré"); return; }
    try {
      const detectedStops = await detectStops(points);
      let endName = endPointName;
      if (!endName && detectedStops.length > 0) {
        const last = detectedStops[detectedStops.length - 1];
        endName = await reverseGeocode(last.coordinates[0], last.coordinates[1]);
      }
      const avgSpeed = points.filter(p => p.speed !== null).map(p => p.speed!).reduce((a,b) => a+b, 0) / points.filter(p => p.speed !== null).length * 3.6 || 0;
      const maxSpeed = Math.max(...points.filter(p => p.speed !== null).map(p => p.speed!)) * 3.6 || 0;
      let movingTime = 0;
      for (let i = 1; i < points.length; i++) {
        if ((points[i].speed || 0) > 0.5) movingTime += (points[i].timestamp - points[i-1].timestamp) / 1000;
      }
      const quality = calculateQuality(points);
      const distanceKm = totalDistance / 1000;
      const pricePerKm = distanceKm > 0 ? tripPrice / distanceKm : 0;

      const tripData: TripData = {
        id: Date.now().toString(),
        line: lineInfo || null,
        destination: destination || "Trajet",
        startPointName: startPointName || "Départ inconnu",
        endPointName: endName || "Arrivée inconnue",
        points: points,
        startPoint: detectedStops.length > 0 ? detectedStops[0] : null,
        endPoint: detectedStops.length > 1 ? detectedStops[detectedStops.length - 1] : null,
        stops: detectedStops,
        totalDistance: totalDistance,
        duration: elapsedTime,
        averageSpeed: avgSpeed,
        maxSpeed: maxSpeed,
        movingTime: movingTime,
        stoppedTime: elapsedTime - movingTime,
        date: new Date().toISOString(),
        quality: quality,
        isComplete: true,
        price: tripPrice,
        pricePerKm: pricePerKm,
        notes: "",
      };

      saveTrip(tripData);
      setTripSaved(true);
      setShowPriceInput(false);
      setStatus("paused");
      setGpsStatus("Terminé");
      setCurrentSpeed(null);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    } catch (e) {
      console.error("Sauvegarde:", e);
      setError("Erreur sauvegarde");
    }
  };

  const stopRecording = () => {
    stopGPS();
    if (points.length === 0) { setError("Aucun point GPS."); setStatus("idle"); return; }
    const p = price && parseInt(price) > 0 ? parseInt(price) : 0;
    p > 0 ? saveTripWithPrice(p) : setShowPriceInput(true);
  };

  const handlePriceSubmit = () => {
    const p = parseInt(finalPrice);
    p > 0 ? saveTripWithPrice(p) : setError("Prix valide");
  };

  useEffect(() => {
    if (status === "idle") {
      stopGPS();
      setPoints([]);
      setTotalDistance(0);
      setError("");
      setGpsStatus("En attente");
      setCurrentSpeed(null);
      setTripSaved(false);
      setStops([]);
      setShowPriceInput(false);
      setFinalPrice("");
      lastPointRef.current = null;
      onPointsChange([]);
      onLivePositionChange(null);
      setTripStartTime(null);
      setElapsedTime(0);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
  }, [status]);

  useEffect(() => {
    return () => { stopGPS(); if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, []);

  const isRecording = status === "recording";

  return (
    <>
      {isRecording && !showPriceInput && (
        <div className="w-full">
          <div className="grid grid-cols-3 gap-2 w-full">
            <div className="bg-white/5 border border-white/10 rounded-lg p-2 text-center">
              <p className="text-[10px] text-white/40 font-medium uppercase">Points</p>
              <p className="text-lg font-bold text-white">{points.length}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-2 text-center">
              <p className="text-[10px] text-white/40 font-medium uppercase">Distance</p>
              <p className="text-lg font-bold text-white">{totalDistance > 0 ? `${(totalDistance/1000).toFixed(1)} km` : "--"}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-2 text-center">
              <p className="text-[10px] text-white/40 font-medium uppercase">Vitesse</p>
              <p className="text-lg font-bold text-white">{formatSpeed(currentSpeed)}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-2 text-center">
              <p className="text-[10px] text-white/40 font-medium uppercase">Temps</p>
              <p className="text-lg font-bold text-white">{formatTime(elapsedTime)}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-2 text-center">
              <p className="text-[10px] text-white/40 font-medium uppercase">Arrêts</p>
              <p className="text-lg font-bold text-white">{stops.length}</p>
            </div>
            <div className="bg-white/5 border border-green-500/20 rounded-lg p-2 text-center">
              <p className="text-[10px] text-white/40 font-medium uppercase">Qualité</p>
              <p className="text-lg font-bold text-green-500">{points.length > 10 ? `${calculateQuality(points)}%` : "--"}</p>
            </div>
          </div>
          <div className="flex items-center justify-between w-full mt-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40">🛰️</span>
              <span className="text-[10px] text-white/50">{gpsStatus}</span>
            </div>
            <button
              onClick={stopRecording}
              className="rounded-lg bg-red-600 border-2 border-red-400 px-5 py-2 text-sm font-bold text-white hover:bg-red-700 hover:scale-105 transition"
            >
              ⏹ Terminer
            </button>
            {tripSaved && <span className="text-sm text-green-500 font-bold">✅</span>}
          </div>
        </div>
      )}

      {showPriceInput && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10 w-full">
          <span className="text-sm font-bold text-white">💰 Prix ?</span>
          <input
            type="number"
            value={finalPrice}
            onChange={(e) => setFinalPrice(e.target.value)}
            placeholder="250"
            className="w-24 bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-base text-white text-center outline-none focus:border-white/30"
            autoFocus
          />
          <button
            onClick={handlePriceSubmit}
            disabled={!finalPrice || parseInt(finalPrice) <= 0}
            className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-black hover:scale-105 disabled:opacity-40 transition"
          >
            ✅ Sauvegarder
          </button>
          <button
            onClick={() => { setShowPriceInput(false); setStatus("paused"); setGpsStatus("Terminé"); }}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/40 hover:bg-white/5 transition"
          >
            Passer
          </button>
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>
      )}
    </>
  );
}
