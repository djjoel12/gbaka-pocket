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

function detectSpike(
  previousPoint: GPSPoint | null,
  newPoint: GPSPoint,
  maxJump = 100
): boolean {
  if (!previousPoint) return false;

  const distance = calculateDistance(
    previousPoint.latitude,
    previousPoint.longitude,
    newPoint.latitude,
    newPoint.longitude
  );

  if (distance > maxJump) {
    console.log(`GPS ignoré : saut de ${distance.toFixed(1)} mètres`);
    return true;
  }

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

  // ============================================
  // CHRONOMÈTRE
  // ============================================

  useEffect(() => {
    if (status === "recording") {
      setTripStartTime(Date.now());
      timerRef.current = setInterval(() => {
        if (tripStartTime) {
          setElapsedTime(Math.floor((Date.now() - tripStartTime) / 1000));
        }
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status, tripStartTime]);

  // ============================================
  // NETTOYAGE GPS
  // ============================================

  const stopGPS = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      console.log("GPS arrêté correctement");
    }
  };

  // ============================================
  // FORMATAGE
  // ============================================

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatSpeed = (speed: number | null) => {
    if (speed === null || speed < 0) return "--";
    const kmh = speed * 3.6;
    return `${kmh.toFixed(1)} km/h`;
  };

  // ============================================
  // DÉMARRER ENREGISTREMENT
  // ============================================

  useEffect(() => {
    if (status === "recording" && destination) {
      startRecording();
    }
  }, [status, destination]);

  const startRecording = () => {
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }

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
    setGpsStatus("Recherche de votre position...");
    setTripStartTime(Date.now());

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newPoint: GPSPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          timestamp: position.timestamp,
        };

        console.log("Position GPS reçue :", newPoint);

        setCurrentSpeed(position.coords.speed);
        onLivePositionChange(newPoint);

        if (newPoint.accuracy > maxAccuracy) {
          console.log(
            `Position ignorée : précision ${newPoint.accuracy.toFixed(1)}m`
          );
          setGpsStatus(`GPS imprécis (${Math.round(newPoint.accuracy)}m)`);
          return;
        }

        if (lastPointRef.current === null) {
          setPoints([newPoint]);
          onPointsChange([newPoint]);
          lastPointRef.current = newPoint;
          setGpsStatus("Enregistrement en cours");
          console.log("Premier point enregistré");
          return;
        }

        if (detectSpike(lastPointRef.current, newPoint)) {
          return;
        }

        const distance = calculateDistance(
          lastPointRef.current.latitude,
          lastPointRef.current.longitude,
          newPoint.latitude,
          newPoint.longitude
        );

        if (distance < minDistance) {
          console.log(`Déplacement trop faible : ${distance.toFixed(1)}m`);
          return;
        }

        setPoints((previousPoints) => {
          const updatedPoints = [...previousPoints, newPoint];
          onPointsChange(updatedPoints);
          
          if (updatedPoints.length % 10 === 0) {
            const detectedStops = detectStops(updatedPoints);
            setStops(detectedStops);
          }
          
          return updatedPoints;
        });

        setTotalDistance((previousDistance) => previousDistance + distance);
        lastPointRef.current = newPoint;
        setGpsStatus("Enregistrement en cours");

        console.log(`Point enregistré : ${distance.toFixed(1)}m`);
      },

      (gpsError) => {
        console.error("Erreur GPS :", gpsError);
        if (gpsError.code === 1) {
          setError("Autorisez la localisation dans votre navigateur.");
        } else if (gpsError.code === 2) {
          setError("Impossible de déterminer votre position.");
        } else if (gpsError.code === 3) {
          setError("Le GPS met trop de temps à répondre.");
        } else {
          setError("Une erreur GPS est survenue.");
        }
        setGpsStatus("Erreur GPS");
      },

      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );

    watchIdRef.current = watchId;
  };

  // ============================================
  // SAUVEGARDE AVEC PRIX
  // ============================================
  const saveTripWithPrice = async (tripPrice: number) => {
    if (points.length === 0) {
      console.log("⚠️ Aucun point enregistré, trajet ignoré");
      return;
    }

    const detectedStops = await detectStops(points);
    
    let endName = endPointName;
    if (!endName && detectedStops.length > 0) {
      const lastStop = detectedStops[detectedStops.length - 1];
      endName = await reverseGeocode(
        lastStop.coordinates[0],
        lastStop.coordinates[1]
      );
    }

    const startPoint = detectedStops.length > 0 ? detectedStops[0] : null;
    const endPoint = detectedStops.length > 1 ? detectedStops[detectedStops.length - 1] : null;
    const averageSpeed = calculateAverageSpeed(points);
    const maxSpeed = calculateMaxSpeed(points);
    const movingTime = calculateMovingTime(points);
    const stoppedTime = elapsedTime - movingTime;
    const quality = calculateQuality(points);
    
    const distanceKm = totalDistance / 1000;
    const pricePerKm = distanceKm > 0 ? tripPrice / distanceKm : 0;

    const tripData: TripData = {
      id: Date.now().toString(),
      line: lineInfo || null,
      destination: destination || "Trajet sans destination",
      startPointName: startPointName || "Départ inconnu",
      endPointName: endName || "Arrivée inconnue",
      points: points,
      startPoint: startPoint,
      endPoint: endPoint,
      stops: detectedStops,
      totalDistance: totalDistance,
      duration: elapsedTime,
      averageSpeed: averageSpeed,
      maxSpeed: maxSpeed,
      movingTime: movingTime,
      stoppedTime: stoppedTime > 0 ? stoppedTime : 0,
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

    console.log("✅ Trajet enregistré :", tripData);
    console.log(`💰 Prix : ${tripPrice} FCFA (${pricePerKm.toFixed(1)} FCFA/km)`);

    setStatus("paused");
    setGpsStatus("Trajet terminé");
    setCurrentSpeed(null);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // ============================================
  // TERMINER LE TRAJET
  // ============================================

  const stopRecording = async () => {
    stopGPS();

    if (price && parseInt(price) > 0) {
      await saveTripWithPrice(parseInt(price));
    } else {
      setShowPriceInput(true);
    }
  };

  // ============================================
  // VALIDATION DU PRIX
  // ============================================

  const handlePriceSubmit = () => {
    const priceValue = parseInt(finalPrice);
    if (priceValue > 0) {
      saveTripWithPrice(priceValue);
    } else {
      setError("Veuillez saisir un prix valide");
    }
  };

  // ============================================
  // RESET
  // ============================================

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
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [status]);

  // ============================================
  // NETTOYAGE
  // ============================================

  useEffect(() => {
    return () => {
      stopGPS();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const latestPoint = points.length > 0 ? points[points.length - 1] : null;
  const isRecording = status === "recording";

  return (
    <div className="space-y-3">
      {/* STATUT GPS */}
      <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                isRecording ? "animate-pulse bg-emerald-300" : "bg-white/30"
              }`}
            />
            <span className="text-sm font-medium text-white">GPS</span>
          </div>
          <span className="text-xs font-medium text-white/70">
            {gpsStatus}
          </span>
        </div>

        {isRecording && (
          <div className="mt-1.5 flex justify-between text-xs text-white/60">
            <span>{points.length} points</span>
            {elapsedTime > 0 && <span>⏱ {formatTime(elapsedTime)}</span>}
            {stops.length > 0 && <span>🛑 {stops.length} arrêts</span>}
          </div>
        )}

        {tripSaved && (
          <div className="mt-2 rounded-lg bg-emerald-500/20 p-1.5 text-center text-xs text-emerald-200">
            ✅ Trajet sauvegardé !
          </div>
        )}
      </div>

      {/* DEMANDE DE PRIX */}
      {showPriceInput && (
        <div className="rounded-xl bg-yellow-500/20 backdrop-blur-sm border border-yellow-500/30 p-4 text-center">
          <div className="text-2xl mb-1">💰</div>
          <h3 className="font-bold text-white">Combien as-tu payé ?</h3>
          <p className="text-xs text-white/60">Saisis le prix en FCFA</p>
          
          <div className="mt-3">
            <div className="relative">
              <input
                type="number"
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value)}
                placeholder="Ex: 250"
                className="w-full rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-2 text-center text-lg text-white placeholder:text-white/40 outline-none focus:border-white/50"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handlePriceSubmit();
                  }}
                }
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">FCFA</span>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                setShowPriceInput(false);
                setStatus("paused");
                setGpsStatus("Trajet terminé");
              }}
              className="flex-1 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-2 text-xs text-white/70 hover:bg-white/20"
            >
              Passer
            </button>
            <button
              onClick={handlePriceSubmit}
              disabled={!finalPrice || parseInt(finalPrice) <= 0}
              className="flex-1 rounded-lg bg-gradient-to-r from-yellow-400 to-orange-400 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-yellow-400/30 hover:scale-[1.02] disabled:opacity-40"
            >
              ✅ Sauvegarder
            </button>
          </div>

          {error && (
            <p className="mt-2 text-xs text-rose-300">{error}</p>
          )}
        </div>
      )}

      {/* INFOS TRAJET */}
      {destination && (
        <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-2.5 text-center">
          <p className="text-xs text-white">
            🎯 <span className="font-bold">{destination}</span>
          </p>
          {lineInfo && (
            <p className="mt-0.5 text-xs text-sky-200">🚌 {lineInfo.name}</p>
          )}
          {startPointName && (
            <p className="mt-0.5 text-xs text-white/70">🟢 {startPointName.split(',')[0]}</p>
          )}
          {price && parseInt(price) > 0 && (
            <p className="mt-0.5 text-xs text-yellow-200">💰 {price} FCFA</p>
          )}
        </div>
      )}

      {/* ERREUR */}
      {error && !showPriceInput && (
        <div className="rounded-xl bg-rose-500/20 backdrop-blur-sm border border-rose-500/30 p-2.5 text-xs text-rose-200">
          ⚠️ {error}
        </div>
      )}

      {/* BOUTON TERMINER */}
      {isRecording && !showPriceInput && (
        <button
          onClick={stopRecording}
          className="w-full rounded-xl bg-rose-500 px-3 py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/30 transition hover:bg-rose-600"
        >
          ⏹ Terminer le trajet
        </button>
      )}

      {/* STATS */}
      {isRecording && !showPriceInput && (
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-2 text-center">
            <p className="text-[10px] text-white/40">POINTS</p>
            <p className="font-bold text-white">{points.length}</p>
          </div>
          <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-2 text-center">
            <p className="text-[10px] text-white/40">DISTANCE</p>
            <p className="font-bold text-white">
              {totalDistance > 0 ? `${(totalDistance / 1000).toFixed(2)} km` : "--"}
            </p>
          </div>
          <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-2 text-center">
            <p className="text-[10px] text-white/40">VITESSE</p>
            <p className="font-bold text-sky-200">{formatSpeed(currentSpeed)}</p>
          </div>
          <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-2 text-center">
            <p className="text-[10px] text-white/40">ARRÊTS</p>
            <p className="font-bold text-white">{stops.length}</p>
          </div>
          <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-2 text-center">
            <p className="text-[10px] text-white/40">QUALITÉ</p>
            <p className="font-bold text-emerald-200">
              {points.length > 0 ? `${calculateQuality(points)}%` : "--"}
            </p>
          </div>
          <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-2 text-center">
            <p className="text-[10px] text-white/40">TEMPS</p>
            <p className="font-bold text-white">{formatTime(elapsedTime)}</p>
          </div>
        </div>
      )}

      {/* DERNIER POINT */}
      {latestPoint && isRecording && !showPriceInput && (
        <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-2.5">
          <p className="mb-1 text-[10px] text-white/40">🛰️ Dernier point</p>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <div>
              <span className="text-white/40">Lat </span>
              <span className="font-mono text-white/80">{latestPoint.latitude.toFixed(6)}</span>
            </div>
            <div>
              <span className="text-white/40">Lng </span>
              <span className="font-mono text-white/80">{latestPoint.longitude.toFixed(6)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
    }
