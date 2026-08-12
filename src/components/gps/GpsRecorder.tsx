"use client";

import {
  Dispatch,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";

import type { GPSPoint, TripData, StopPoint } from "@/types/trip";
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
import { saveTripToSupabase } from "@/utils/supabaseUtils";
import { convertToGbakaFormat } from "@/utils/tripConverter";
import StopManager from "@/components/stops/StopManager";

type GpsRecorderProps = {
  status: "idle" | "recording" | "paused";
  setStatus: Dispatch<SetStateAction<"idle" | "recording" | "paused">>;
  onPointsChange: (points: GPSPoint[]) => void;
  onLivePositionChange: (point: GPSPoint | null) => void;
  destination?: string;
  lineInfo?: {
    id: string;
    name: string;
    number: string;
    type: "gbaka" | "woro-woro" | "bus" | "taxi";
    color: string;
    estimatedPrice: number;
  } | null;
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
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState("");

  // ===== GESTION DES ARRÊTS =====
  const [pendingStop, setPendingStop] = useState<StopPoint | null>(null);
  const [userStops, setUserStops] = useState<StopPoint[]>([]);
  const [showStopConfirmation, setShowStopConfirmation] = useState(false);

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
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatSpeed = (speed: number | null) => {
    if (speed === null || speed < 0) return "--";
    const kmh = speed * 3.6;
    return `${kmh.toFixed(0)} km/h`;
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
      setError("La géolocalisation n'est pas disponible.");
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
    setUserStops([]);
    setPendingStop(null);
    setShowStopConfirmation(false);
    setShowPriceInput(false);
    setSyncStatus("idle");
    setSyncMessage("");
    lastPointRef.current = null;
    onLivePositionChange(null);
    setGpsStatus("Recherche GPS...");
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

        setCurrentSpeed(position.coords.speed);
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
          return;
        }

        setPoints((previousPoints) => {
          const updatedPoints = [...previousPoints, newPoint];
          onPointsChange(updatedPoints);
          
          // ===== DÉTECTION DES ARRÊTS =====
          if (updatedPoints.length % 10 === 0) {
            const detectedStops = detectStops(updatedPoints);
            
            // Nouvel arrêt détecté ?
            const newStop = detectedStops[detectedStops.length - 1];
            if (newStop && !newStop.isStart && !newStop.isEnd) {
              // Vérifier si cet arrêt a déjà été proposé
              const existingStop = userStops.find(s => 
                Math.abs(s.coordinates[0] - newStop.coordinates[0]) < 0.0001 &&
                Math.abs(s.coordinates[1] - newStop.coordinates[1]) < 0.0001
              );
              
              if (!existingStop && !pendingStop) {
                setPendingStop(newStop);
                setShowStopConfirmation(true);
              }
            }
            
            setStops(detectedStops);
          }
          
          return updatedPoints;
        });

        setTotalDistance((previousDistance) => previousDistance + distance);
        lastPointRef.current = newPoint;
        setGpsStatus("Enregistrement");
      },

      (gpsError) => {
        console.error("Erreur GPS :", gpsError);
        if (gpsError.code === 1) {
          setError("Autorisez la localisation.");
        } else {
          setError("Erreur GPS.");
        }
        setGpsStatus("Erreur");
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
  // GESTION DES ARRÊTS
  // ============================================

  const handleConfirmStop = (name: string) => {
    if (pendingStop) {
      const confirmedStop: StopPoint = {
        ...pendingStop,
        name: name,
        isConfirmed: true,
        isManual: false,
      };
      setUserStops(prev => [...prev, confirmedStop]);
      setPendingStop(null);
      setShowStopConfirmation(false);
      setStops(prev => prev.map(s => 
        s.id === pendingStop.id ? confirmedStop : s
      ));
      console.log(`🛑 Arrêt confirmé: ${name}`);
    }
  };

  const handleIgnoreStop = () => {
    setPendingStop(null);
    setShowStopConfirmation(false);
    console.log('🛑 Arrêt ignoré');
  };

  const handleManualStopAdded = (stop: StopPoint) => {
    setUserStops(prev => [...prev, stop]);
    setStops(prev => [...prev, stop]);
    console.log(`📌 Arrêt manuel ajouté: ${stop.name}`);
  };

  // ============================================
  // SAUVEGARDE AVEC PRIX
  // ============================================
  const saveTripWithPrice = async (tripPrice: number) => {
    if (points.length === 0) {
      setError("Aucun point GPS enregistré");
      return;
    }

    try {
      // ===== RÉCUPÉRER TOUS LES ARRÊTS =====
      const allStops = [...stops.filter(s => !s.isManual && !s.isStart && !s.isEnd), ...userStops];
      
      // Détection des arrêts
      const detectedStops = await detectStops(points);
      
      // Fusionner les arrêts détectés et les arrêts manuels
      const finalStops = [...detectedStops, ...userStops];
      
      // Géocodage du point d'arrivée
      let endName = endPointName;
      if (!endName && detectedStops.length > 0) {
        const lastStop = detectedStops[detectedStops.length - 1];
        endName = await reverseGeocode(
          lastStop.coordinates[0],
          lastStop.coordinates[1]
        );
      }

      const averageSpeed = calculateAverageSpeed(points);
      const maxSpeed = calculateMaxSpeed(points);
      const quality = calculateQuality(points);

      // Conversion au format Gbaka Pocket
      const tripData = convertToGbakaFormat(
        points,
        finalStops,
        destination || "Trajet",
        startPointName || "Départ inconnu",
        endName || "Arrivée inconnue",
        tripPrice,
        totalDistance,
        elapsedTime,
        averageSpeed,
        maxSpeed,
        quality,
        lineInfo?.name || `${startPointName} → ${destination}`,
        lineInfo?.type || "gbaka"
      );

      console.log(`🛑 ${finalStops.length} arrêts enregistrés`);

      // ===== SAUVEGARDE LOCALE =====
      const oldTripData: any = {
        id: tripData.id,
        line: {
          name: tripData.direction,
          type: tripData.type,
          color: "#2563EB",
        },
        destination: tripData.end.name,
        startPointName: tripData.start.name,
        endPointName: tripData.end.name,
        points: tripData.points,
        startPoint: null,
        endPoint: null,
        stops: tripData.stops,
        totalDistance: tripData.distance * 1000,
        duration: tripData.duration,
        averageSpeed: tripData.averageSpeed,
        maxSpeed: tripData.maxSpeed,
        movingTime: 0,
        stoppedTime: 0,
        date: tripData.startedAt,
        quality: tripData.quality,
        isComplete: true,
        price: tripData.fare,
        pricePerKm: tripData.distance > 0 ? tripData.fare / tripData.distance : 0,
        notes: "",
      };
      
      saveTrip(oldTripData);
      setTripSaved(true);
      setShowPriceInput(false);

      // ===== ENVOI VERS SUPABASE =====
      try {
        const result = await saveTripToSupabase(tripData);
        if (result.success) {
          setSyncStatus("success");
          setSyncMessage("✅ Trajet synchronisé !");
          console.log('✅ Trajet synchronisé avec Supabase');
        } else {
          setSyncStatus("error");
          const errorMessage = typeof result.error === 'object' && result.error !== null && 'message' in result.error
            ? result.error.message
            : result.error?.toString() || "Erreur inconnue";
          setSyncMessage(`❌ ${errorMessage}`);
          console.warn('⚠️ Échec synchronisation Supabase:', result.error);
        }
      } catch (error: any) {
        setSyncStatus("error");
        setSyncMessage(`❌ ${error.message || "Erreur inconnue"}`);
        console.warn('⚠️ Erreur lors de l\'envoi à Supabase:', error);
      }

      setStatus("paused");
      setGpsStatus("Terminé");
      setCurrentSpeed(null);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      setError("Erreur lors de la sauvegarde");
    }
  };

  // ============================================
  // TERMINER LE TRAJET
  // ============================================
  const stopRecording = () => {
    stopGPS();

    if (points.length === 0) {
      setError("Aucun point GPS enregistré.");
      setStatus("idle");
      return;
    }

    const priceValue = price && parseInt(price) > 0 ? parseInt(price) : 0;

    if (priceValue > 0) {
      saveTripWithPrice(priceValue);
    } else {
      setShowPriceInput(true);
    }
  };

  // ============================================
  // VALIDATION PRIX
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
      setUserStops([]);
      setPendingStop(null);
      setShowStopConfirmation(false);
      setShowPriceInput(false);
      setFinalPrice("");
      setSyncStatus("idle");
      setSyncMessage("");
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

  const isRecording = status === "recording";
  const allStops = [...stops, ...userStops];

  return (
    <>
      {isRecording && !showPriceInput && (
        <div className="w-full space-y-2">
          {/* STATS */}
          <div className="grid grid-cols-3 gap-2 w-full">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
              <p className="text-[10px] text-gray-400 font-medium uppercase">Points</p>
              <p className="text-lg font-bold text-gray-800">{points.length}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
              <p className="text-[10px] text-gray-400 font-medium uppercase">Distance</p>
              <p className="text-lg font-bold text-gray-800">{totalDistance > 0 ? `${(totalDistance/1000).toFixed(1)} km` : "--"}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
              <p className="text-[10px] text-gray-400 font-medium uppercase">Vitesse</p>
              <p className="text-lg font-bold text-gray-800">{formatSpeed(currentSpeed)}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
              <p className="text-[10px] text-gray-400 font-medium uppercase">Temps</p>
              <p className="text-lg font-bold text-gray-800">{formatTime(elapsedTime)}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
              <p className="text-[10px] text-gray-400 font-medium uppercase">Arrêts</p>
              <p className="text-lg font-bold text-gray-800">{allStops.length}</p>
            </div>
            <div className="bg-gray-50 border border-green-200 rounded-lg p-2 text-center">
              <p className="text-[10px] text-gray-400 font-medium uppercase">Qualité</p>
              <p className="text-lg font-bold text-green-600">{points.length > 10 ? `${calculateQuality(points)}%` : "--"}</p>
            </div>
          </div>

          {/* ===== STOP MANAGER ===== */}
          <StopManager
            isRecording={isRecording}
            currentPosition={livePosition}
            onStopAdded={handleManualStopAdded}
            detectedStop={pendingStop}
            onConfirmStop={handleConfirmStop}
            onIgnoreStop={handleIgnoreStop}
          />

          {/* BOUTON TERMINER */}
          <div className="flex items-center justify-between w-full mt-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400">🛰️</span>
              <span className="text-[10px] text-gray-500">{gpsStatus}</span>
            </div>
            <div className="flex items-center gap-3">
              {syncStatus === "success" && (
                <span className="text-[10px] text-green-600 font-medium">✅ {syncMessage}</span>
              )}
              {syncStatus === "error" && (
                <span className="text-[10px] text-red-500 font-medium">❌ {syncMessage}</span>
              )}
              <button
                onClick={stopRecording}
                className="rounded-lg bg-red-600 border-2 border-red-400 px-5 py-2 text-sm font-bold text-white hover:bg-red-700 transition"
              >
                ⏹ Terminer
              </button>
              {tripSaved && <span className="text-sm text-green-600 font-bold">✅</span>}
            </div>
          </div>
        </div>
      )}

      {showPriceInput && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 w-full">
          <span className="text-sm font-bold text-gray-800">💰 Prix ?</span>
          <input
            type="number"
            value={finalPrice}
            onChange={(e) => setFinalPrice(e.target.value)}
            placeholder="250"
            className="w-24 bg-white border border-gray-300 rounded-lg px-3 py-2 text-base text-gray-700 text-center outline-none focus:border-blue-400"
            autoFocus
          />
          <button
            onClick={handlePriceSubmit}
            disabled={!finalPrice || parseInt(finalPrice) <= 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40 transition"
          >
            ✅ Sauvegarder
          </button>
          <button
            onClick={() => { setShowPriceInput(false); setStatus("paused"); setGpsStatus("Terminé"); }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 transition"
          >
            Passer
          </button>
          {error && <span className="text-sm text-red-500">{error}</span>}
        </div>
      )}
    </>
  );
      }
