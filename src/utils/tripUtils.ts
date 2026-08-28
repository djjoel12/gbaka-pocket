import { supabase } from '@/lib/supabase'
import { TripData, StopPoint, GPSPoint } from '@/types/trip'

// ======================================================
// CALCUL DE LA DISTANCE ENTRE DEUX POINTS (en mètres)
// ======================================================

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

// ======================================================
// CALCUL DE LA VITESSE MOYENNE (en km/h)
// ======================================================

export const calculateAverageSpeed = (points: GPSPoint[]): number => {
  if (points.length < 2) return 0;

  const speeds = points
    .filter((p) => p.speed !== null && p.speed !== undefined)
    .map((p) => p.speed!);

  if (speeds.length === 0) return 0;

  const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  return avg * 3.6;
};

// ======================================================
// CALCUL DE LA VITESSE MAXIMALE (en km/h)
// ======================================================

export const calculateMaxSpeed = (points: GPSPoint[]): number => {
  if (points.length === 0) return 0;

  const speeds = points
    .filter((p) => p.speed !== null && p.speed !== undefined)
    .map((p) => p.speed!);

  if (speeds.length === 0) return 0;

  const max = Math.max(...speeds);
  return max * 3.6;
};

// ======================================================
// CALCUL DE LA DISTANCE TOTALE (en km)
// ======================================================

export const calculateTotalDistance = (points: GPSPoint[]): number => {
  if (points.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += calculateDistance(
      points[i - 1].latitude,
      points[i - 1].longitude,
      points[i].latitude,
      points[i].longitude
    );
  }
  return total / 1000;
};

// ======================================================
// CALCUL DU TEMPS DE DÉPLACEMENT (en secondes)
// ======================================================

export const calculateMovingTime = (points: GPSPoint[]): number => {
  if (points.length < 2) return 0;

  const first = points[0];
  const last = points[points.length - 1];

  return (last.timestamp - first.timestamp) / 1000;
};

// ======================================================
// DÉTECTION DES ARRÊTS
// ======================================================

export const detectStops = (
  points: GPSPoint[],
  options?: { minDuration?: number; maxDistance?: number }
): StopPoint[] => {
  const minDuration = options?.minDuration || 30;
  const maxDistance = options?.maxDistance || 10;

  if (points.length < 2) return [];

  const stops: StopPoint[] = [];
  let stopStart = 0;

  for (let i = 1; i < points.length; i++) {
    const dist = calculateDistance(
      points[i - 1].latitude,
      points[i - 1].longitude,
      points[i].latitude,
      points[i].longitude
    );

    if (dist < maxDistance) {
      if (stopStart === 0) {
        stopStart = i - 1;
      }
    } else {
      if (stopStart > 0) {
        const duration =
          (points[i - 1].timestamp - points[stopStart].timestamp) / 1000;
        if (duration >= minDuration) {
          const avgLat =
            points.slice(stopStart, i).reduce((sum, p) => sum + p.latitude, 0) /
            (i - stopStart);
          const avgLon =
            points.slice(stopStart, i).reduce((sum, p) => sum + p.longitude, 0) /
            (i - stopStart);

          stops.push({
            id: `stop-${stops.length}`,
            name: `Arrêt ${stops.length + 1}`,
            coordinates: [avgLat, avgLon],
            timestamp: points[stopStart].timestamp,
            duration: duration,
            isStart: false,
            isEnd: false,
            isManual: false,
            isConfirmed: false,
          });
        }
        stopStart = 0;
      }
    }
  }

  return stops;
};

// ======================================================
// CALCUL DE LA QUALITÉ DU TRAJET (score sur 100)
// ======================================================

export const calculateQuality = (points: GPSPoint[]): number => {
  if (points.length < 10) return 0;

  let score = 100;

  if (points.length < 50) score -= 20;

  const avgAccuracy =
    points.reduce((sum, p) => sum + p.accuracy, 0) / points.length;
  if (avgAccuracy > 50) score -= 20;
  if (avgAccuracy > 100) score -= 20;

  const avgSpeed = calculateAverageSpeed(points);
  if (avgSpeed > 80) score -= 10;
  if (avgSpeed < 5 && points.length > 100) score -= 10;

  return Math.max(0, Math.min(100, score));
};

// ======================================================
// GÉOCODAGE INVERSE
// ======================================================

export const reverseGeocode = async (
  lat: number,
  lon: number
): Promise<string> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data && data.display_name) {
      return data.display_name;
    }

    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  } catch (error) {
    console.error("❌ reverseGeocode error:", error);
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }
};

// ======================================================
// SAUVEGARDE LOCALE
// ======================================================

export const saveTrip = (tripData: any): void => {
  try {
    const trips = JSON.parse(localStorage.getItem("trips") || "[]");
    trips.push({
      ...tripData,
      savedAt: new Date().toISOString(),
    });
    localStorage.setItem("trips", JSON.stringify(trips));
    console.log("✅ Trajet sauvegardé localement");
  } catch (error) {
    console.error("❌ Erreur saveTrip:", error);
  }
};

// ======================================================
// SAUVEGARDE VERS SUPABASE
// ======================================================

export const saveTripToSupabase = async (tripData: TripData) => {
  console.log('📤 Envoi vers Supabase...')

  try {
    if (!tripData.points || tripData.points.length === 0) {
      console.warn('⚠️ Pas de points GPS')
      return { success: false, error: 'Pas de points' }
    }

    const routeString = tripData.points
      .map(p => `${p.longitude} ${p.latitude}`)
      .join(',')

    const stopsString =
      tripData.stops.length > 0
        ? tripData.stops
            .map(s => `${s.coordinates[1]} ${s.coordinates[0]}`)
            .join(',')
        : null

    const { data, error } = await supabase
      .from('trips')
      .insert([{
        line_name: tripData.direction,
        destination: tripData.end.name,
        start_point_name: tripData.start.name,
        end_point_name: tripData.end.name,

        route: `LINESTRING(${routeString})`,

        stops: stopsString
          ? `MULTIPOINT(${stopsString})`
          : null,

        total_distance: tripData.distance * 1000,
        duration: tripData.duration,
        average_speed: tripData.averageSpeed,
        max_speed: tripData.maxSpeed,
        price: tripData.fare,
        price_per_km:
          tripData.distance > 0
            ? tripData.fare / tripData.distance
            : 0,

        quality: tripData.quality,

        points_json: tripData.points,
        stops_json: tripData.stops,

        date: tripData.startedAt,
        is_verified: false,

        line_id: tripData.lineId,
        type: tripData.type,
        direction: tripData.direction,
        fare: tripData.fare,
        distance_km: tripData.distance,
        duration_sec: tripData.duration,
        avg_speed_kmh: tripData.averageSpeed,
        max_speed_kmh: tripData.maxSpeed,
        started_at: tripData.startedAt,
        ended_at: tripData.endedAt,
      }])

    if (error) {
      console.error('❌ Erreur Supabase:', error)

      return {
        success: false,
        error,
      }
    }

    console.log('✅ Trajet envoyé à Supabase !')

    return {
      success: true,
      data,
    }

  } catch (error) {
    console.error('❌ Erreur:', error)

    return {
      success: false,
      error,
    }
  }
}

// ======================================================
// RÉCUPÉRER LES ARRÊTS ENREGISTRÉS
// ======================================================

export const fetchHistoricalStops = async (): Promise<StopPoint[]> => {
  try {
    const { data, error } = await supabase
      .from('trips')
      .select('stops_json')
      .not('stops_json', 'is', null)
      .order('date', { ascending: false })
      .limit(100)

    if (error) {
      console.error('❌ ERREUR SUPABASE STOPS:', error)
      throw new Error(
        `Impossible de récupérer les arrêts : ${
          error.message || 'Erreur Supabase'
        }`
      )
    }

    if (!data || data.length === 0) {
      console.log('ℹ️ Aucun trajet trouvé')
      return []
    }

    const historicalStops: StopPoint[] = []

    for (const trip of data) {
      let stops: any = trip.stops_json

      if (typeof stops === 'string') {
        try {
          stops = JSON.parse(stops)
        } catch (e) {
          console.error(
            '❌ Impossible de lire stops_json:',
            stops
          )
          continue
        }
      }

      if (!Array.isArray(stops)) {
        console.warn(
          '⚠️ stops_json n’est pas un tableau:',
          stops
        )
        continue
      }

      for (let i = 0; i < stops.length; i++) {
        const stop = stops[i]

        if (!stop) continue

        let coordinates = stop.coordinates

        if (!Array.isArray(coordinates)) {
          console.warn(
            '⚠️ Arrêt sans coordinates:',
            stop
          )
          continue
        }

        if (coordinates.length < 2) {
          console.warn(
            '⚠️ Coordonnées incomplètes:',
            coordinates
          )
          continue
        }

        const latitude = Number(coordinates[0])
        const longitude = Number(coordinates[1])

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          console.warn(
            '⚠️ Coordonnées invalides:',
            coordinates
          )
          continue
        }

        const historicalStop: StopPoint = {
          id:
            typeof stop.id === 'string'
              ? stop.id
              : `historical-stop-${Date.now()}-${i}`,

          name:
            typeof stop.name === 'string'
              ? stop.name
              : 'Arrêt enregistré',

          coordinates: [
            latitude,
            longitude,
          ],

          timestamp:
            typeof stop.timestamp === 'number'
              ? stop.timestamp
              : Date.now(),

          duration:
            typeof stop.duration === 'number'
              ? stop.duration
              : 0,

          isStart:
            typeof stop.isStart === 'boolean'
              ? stop.isStart
              : false,

          isEnd:
            typeof stop.isEnd === 'boolean'
              ? stop.isEnd
              : false,

          isManual:
            typeof stop.isManual === 'boolean'
              ? stop.isManual
              : false,

          isConfirmed:
            typeof stop.isConfirmed === 'boolean'
              ? stop.isConfirmed
              : false,
        }

        historicalStops.push(historicalStop)
      }
    }

    const uniqueStops = historicalStops.filter(
      (stop, index, array) => {
        return (
          index ===
          array.findIndex(
            other =>
              other.coordinates[0] ===
                stop.coordinates[0] &&
              other.coordinates[1] ===
                stop.coordinates[1]
          )
        )
      }
    )

    console.log(
      `🚏 ${uniqueStops.length} arrêts récupérés depuis Supabase`
    )

    return uniqueStops

  } catch (error) {
    console.error(
      '❌ fetchHistoricalStops:',
      error
    )

    throw error
  }
}

// ======================================================
// RÉCUPÉRER LES LIGNES DE TRANSPORT
// ======================================================

export const fetchTransportLines = async () => {
  try {
    const { data, error } = await supabase
      .from("transport_lines")
      .select("*")
      .limit(1);

    if (error) {
      console.error("❌ Erreur transport_lines:", error);
      throw error;
    }

    console.log(`🚌 ${data?.length || 0} ligne(s) récupérée(s)`);
    return data || [];
  } catch (error) {
    console.error("❌ fetchTransportLines:", error);
    return [];
  }
};

// ======================================================
// RÉCUPÉRER LES ARRÊTS OSM
// ======================================================

export const fetchOsmStops = async () => {
  try {
    const { data, error } = await supabase
      .from("osm_stops")
      .select("*")
      .limit(100);

    if (error) {
      console.error("❌ Erreur osm_stops:", error);
      throw error;
    }

    console.log(`🚏 ${data?.length || 0} arrêts récupérés`);
    return data || [];
  } catch (error) {
    console.error("❌ fetchOsmStops:", error);
    return [];
  }
};
