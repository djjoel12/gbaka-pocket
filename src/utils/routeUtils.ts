// src/utils/routeUtils.ts
import { supabase } from '@/lib/supabase';

// ============================================
// GÉOCODAGE (Nominatim)
// ============================================
export const geocodeWithOSM = async (query: string) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        query
      )}&format=json&limit=5&countrycodes=ci&accept-language=fr`
    );
    const data = await response.json();

    if (data && data.length > 0) {
      return data.map((item: any) => ({
        name: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        type: item.type,
        importance: item.importance,
      }));
    }
    return [];
  } catch (error) {
    console.error('❌ Erreur géocodage:', error);
    return [];
  }
};

// ============================================
// RPC SUPABASE
// ============================================
export const findNearbyLines = async (
  lat: number,
  lng: number,
  radius: number = 600
) => {
  try {
    const { data, error } = await supabase.rpc('find_nearby_lines', {
      lat,
      lng,
      radius_meters: radius,
    });
    if (error) {
      console.error('❌ findNearbyLines:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('❌ findNearbyLines:', error);
    return [];
  }
};

export const findLineStops = async (
  lineId: string,
  radius: number = 150
) => {
  try {
    const { data, error } = await supabase.rpc('find_line_stops', {
      line_id: lineId,
      radius_meters: radius,
    });
    if (error) {
      console.error('❌ findLineStops:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('❌ findLineStops:', error);
    return [];
  }
};

export const findLineIntersections = async (
  line1Id: string,
  line2Id: string,
  radius: number = 200
) => {
  try {
    const { data, error } = await supabase.rpc('find_line_intersections', {
      line1_id: line1Id,
      line2_id: line2Id,
      radius_meters: radius,
    });
    if (error) {
      console.error('❌ findLineIntersections:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('❌ findLineIntersections:', error);
    return [];
  }
};

// ============================================
// TYPES
// ============================================
export interface RouteStep {
  type: 'walk' | 'bus' | 'transfer';
  lineId?: string;
  lineName?: string;
  fromStop?: string;
  toStop?: string;
  duration: number;
  distance?: number;
  price?: number;
}

export interface RouteResult {
  steps: RouteStep[];
  totalDuration: number;
  totalPrice: number;
  type: 'direct' | 'one_transfer' | 'two_transfers' | 'none';
  message?: string;
}

// ============================================
// UTILITAIRES
// ============================================
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * R;
}

function estimateDuration(distanceMeters: number): number {
  // \~5 min par km + minimum 10 min
  return Math.max(10, Math.round((distanceMeters / 1000) * 5));
}

function getClosestStop(
  stops: any[],
  lat: number,
  lng: number,
  maxDistance = 300
) {
  if (!stops || stops.length === 0) return null;

  let best = null;
  let bestDist = Infinity;

  for (const s of stops) {
    const d = calculateDistance(lat, lng, s.latitude, s.longitude);
    if (d < bestDist && d <= maxDistance) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

// ============================================
// MOTEUR D'ITINÉRAIRE (basé sur les coordonnées)
// ============================================
export const findRoute = async (
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<RouteResult> => {
  try {
    // 1. Lignes proches du départ et de l'arrivée (coords)
    const startLines = await findNearbyLines(startLat, startLng, 700);
    const endLines = await findNearbyLines(endLat, endLng, 700);

    console.log('📍 Lignes départ:', startLines.length);
    console.log('📍 Lignes arrivée:', endLines.length);

    if (startLines.length === 0 || endLines.length === 0) {
      return {
        steps: [],
        totalDuration: 0,
        totalPrice: 0,
        type: 'none',
        message: 'Aucune ligne trouvée près de votre position',
      };
    }

    // ============================================
    // ÉTAPE A — TRAJET DIRECT
    // Une même ligne passe près du départ ET de l'arrivée
    // ============================================
    for (const sLine of startLines) {
      for (const eLine of endLines) {
        if (sLine.line_id === eLine.line_id) {
          const stops = await findLineStops(sLine.line_id, 200);
          const fromStop = getClosestStop(stops, startLat, startLng, 350);
          const toStop = getClosestStop(stops, endLat, endLng, 350);

          const duration = estimateDuration(
            (sLine.distance || 0) + (eLine.distance || 0) + 2000
          );

          return {
            steps: [
              {
                type: 'bus',
                lineId: sLine.line_id,
                lineName: sLine.line_name,
                fromStop: fromStop?.stop_name || 'Arrêt le plus proche',
                toStop: toStop?.stop_name || 'Arrêt le plus proche',
                duration,
                price: 300,
              },
            ],
            totalDuration: duration,
            totalPrice: 300,
            type: 'direct',
          };
        }
      }
    }

    // ============================================
    // ÉTAPE B — 1 CORRESPONDANCE
    // Ligne A près du départ + Ligne B près de l'arrivée
    // qui se croisent à un arrêt commun
    // ============================================
    let bestTransfer: RouteResult | null = null;

    for (const sLine of startLines) {
      for (const eLine of endLines) {
        if (sLine.line_id === eLine.line_id) continue;

        const intersections = await findLineIntersections(
          sLine.line_id,
          eLine.line_id,
          250
        );

        if (intersections.length === 0) continue;

        // Prendre l'intersection la plus "centrale"
        const transferStop = intersections[0];

        const stopsA = await findLineStops(sLine.line_id, 200);
        const stopsB = await findLineStops(eLine.line_id, 200);

        const fromStop = getClosestStop(stopsA, startLat, startLng, 350);
        const toStop = getClosestStop(stopsB, endLat, endLng, 350);

        const result: RouteResult = {
          steps: [
            {
              type: 'bus',
              lineId: sLine.line_id,
              lineName: sLine.line_name,
              fromStop: fromStop?.stop_name || 'Arrêt départ',
              toStop: transferStop.stop_name,
              duration: 20,
              price: 250,
            },
            {
              type: 'transfer',
              fromStop: transferStop.stop_name,
              toStop: transferStop.stop_name,
              duration: 5,
              price: 0,
            },
            {
              type: 'bus',
              lineId: eLine.line_id,
              lineName: eLine.line_name,
              fromStop: transferStop.stop_name,
              toStop: toStop?.stop_name || 'Arrêt arrivée',
              duration: 20,
              price: 250,
            },
          ],
          totalDuration: 45,
          totalPrice: 500,
          type: 'one_transfer',
        };

        // On garde la première correspondance trouvée
        // (plus tard on pourra classer par distance)
        if (!bestTransfer) {
          bestTransfer = result;
        }
      }
    }

    if (bestTransfer) {
      return bestTransfer;
    }

    // ============================================
    // ÉTAPE C — RIEN TROUVÉ
    // ============================================
    return {
      steps: [],
      totalDuration: 0,
      totalPrice: 0,
      type: 'none',
      message: 'Aucune ligne directe ou avec correspondance trouvée',
    };
  } catch (error) {
    console.error('❌ Erreur findRoute:', error);
    return {
      steps: [],
      totalDuration: 0,
      totalPrice: 0,
      type: 'none',
      message: 'Erreur lors de la recherche',
    };
  }
};
