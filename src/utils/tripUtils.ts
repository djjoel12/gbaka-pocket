// src/utils/tripUtils.ts
import { GPSPoint, StopPoint, TripData } from "@/types/trip";

// ============================================
// CALCUL DE DISTANCE
// ============================================
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ============================================
// GÉOCODAGE INVERSE
// ============================================
export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&accept-language=fr`
    );
    const data = await response.json();
    
    if (data && data.display_name) {
      const parts = data.display_name.split(',');
      return parts.slice(0, 3).join(',').trim();
    }
    return "Lieu inconnu";
  } catch (error) {
    console.error("Erreur de géocodage:", error);
    return "Lieu inconnu";
  }
};

// ============================================
// DÉTECTION DES ARRÊTS
// ============================================
export const detectStops = (points: GPSPoint[]): StopPoint[] => {
  if (points.length < 10) return [];

  const stops: StopPoint[] = [];
  let currentStop: GPSPoint[] = [];
  const STOP_THRESHOLD = 0.5;
  const MIN_STOP_DURATION = 5;

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const speed = point.speed || 0;

    if (speed < STOP_THRESHOLD) {
      currentStop.push(point);
    } else if (currentStop.length > 0) {
      const duration =
        (currentStop[currentStop.length - 1].timestamp -
          currentStop[0].timestamp) /
        1000;

      if (duration >= MIN_STOP_DURATION) {
        const centerLat =
          currentStop.reduce((sum, p) => sum + p.latitude, 0) /
          currentStop.length;
        const centerLng =
          currentStop.reduce((sum, p) => sum + p.longitude, 0) /
          currentStop.length;

        stops.push({
          id: `stop-${Date.now()}-${stops.length}`,
          name: `Arrêt ${stops.length + 1}`,
          coordinates: [centerLat, centerLng],
          timestamp: currentStop[0].timestamp,
          duration: duration,
          isStart: stops.length === 0,
          isEnd: false,
        });
      }

      currentStop = [];
    }
  }

  if (currentStop.length > 0) {
    const duration =
      (currentStop[currentStop.length - 1].timestamp -
        currentStop[0].timestamp) /
      1000;
    if (duration >= MIN_STOP_DURATION) {
      const centerLat =
        currentStop.reduce((sum, p) => sum + p.latitude, 0) /
        currentStop.length;
      const centerLng =
        currentStop.reduce((sum, p) => sum + p.longitude, 0) /
        currentStop.length;

      stops.push({
        id: `stop-${Date.now()}-${stops.length}`,
        name: `Arrêt ${stops.length + 1}`,
        coordinates: [centerLat, centerLng],
        timestamp: currentStop[0].timestamp,
        duration: duration,
        isStart: stops.length === 0,
        isEnd: true,
      });
    }
  }

  if (stops.length > 0) {
    stops[0].isStart = true;
    stops[stops.length - 1].isEnd = true;
  }

  return stops;
};

// ============================================
// CALCUL DE LA QUALITÉ
// ============================================
export const calculateQuality = (points: GPSPoint[]): number => {
  if (points.length === 0) return 0;

  let score = 100;

  const avgAccuracy =
    points.reduce((sum, p) => sum + p.accuracy, 0) / points.length;
  if (avgAccuracy > 50) score -= 25;
  else if (avgAccuracy > 30) score -= 15;
  else if (avgAccuracy > 20) score -= 5;

  let spikes = 0;
  for (let i = 1; i < points.length; i++) {
    const dist = calculateDistance(
      points[i - 1].latitude,
      points[i - 1].longitude,
      points[i].latitude,
      points[i].longitude
    );
    if (dist > 50) spikes++;
  }
  if (spikes > points.length * 0.1) score -= 20;

  if (points.length < 50) score -= 20;

  const duration = points[points.length - 1].timestamp - points[0].timestamp;
  if (duration < 60 * 1000) score -= 20;

  return Math.max(0, Math.min(100, score));
};

// ============================================
// CALCUL DE LA VITESSE MOYENNE
// ============================================
export const calculateAverageSpeed = (points: GPSPoint[]): number => {
  const speeds = points.filter((p) => p.speed !== null).map((p) => p.speed!);
  if (speeds.length === 0) return 0;
  const avg = speeds.reduce((sum, s) => sum + s, 0) / speeds.length;
  return avg * 3.6;
};

// ============================================
// CALCUL DE LA VITESSE MAX
// ============================================
export const calculateMaxSpeed = (points: GPSPoint[]): number => {
  const speeds = points.filter((p) => p.speed !== null).map((p) => p.speed!);
  if (speeds.length === 0) return 0;
  return Math.max(...speeds) * 3.6;
};

// ============================================
// CALCUL DU TEMPS EN MOUVEMENT
// ============================================
export const calculateMovingTime = (points: GPSPoint[]): number => {
  if (points.length < 2) return 0;
  let movingTime = 0;
  for (let i = 1; i < points.length; i++) {
    const speed = points[i].speed || 0;
    if (speed > 0.5) {
      movingTime += (points[i].timestamp - points[i - 1].timestamp) / 1000;
    }
  }
  return movingTime;
};

// ============================================
// SAUVEGARDE DES TRAJETS
// ============================================
export const saveTrip = (trip: TripData): void => {
  const savedTrips = JSON.parse(localStorage.getItem("trips") || "[]");
  savedTrips.push(trip);
  localStorage.setItem("trips", JSON.stringify(savedTrips));
};

export const getTrips = (): TripData[] => {
  return JSON.parse(localStorage.getItem("trips") || "[]");
};

export const getTrip = (id: string): TripData | null => {
  const trips = getTrips();
  return trips.find((t) => t.id === id) || null;
};

export const deleteTrip = (id: string): void => {
  const trips = getTrips().filter((t) => t.id !== id);
  localStorage.setItem("trips", JSON.stringify(trips));
};

export const clearAllTrips = (): void => {
  localStorage.removeItem("trips");
};