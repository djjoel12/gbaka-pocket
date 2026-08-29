// src/utils/routeUtils.ts
import { supabase } from '@/lib/supabase';

// ========================================================
// TYPES
// ========================================================
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

// ========================================================
// GEOCODAGE (Nominatim avec signature User-Agent)
// ========================================================
export const geocodeWithOSM = async (query: string) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        query
      )}&format=json&limit=5&countrycodes=ci&accept-language=fr`,
      {
        headers: {
          'User-Agent': 'GbakaPocketApp/1.0 (contact: support@gbakapocket.ci)'
        }
      }
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
    console.error('❌ Erreur géocodage :', error);
    return [];
  }
};

// ========================================================
// REQUÊTES SUPABASE (Appels à la base de données)
// ========================================================
export const findNearbyLines = async (
  lat: number,
  lng: number,
  radius: number = 400
) => {
  try {
    const { data, error } = await supabase.rpc('find_nearby_lines', {
      lat,
      lng,
      radius_meters: radius,
    });
    if (error) {
      console.error('❌ Erreur findNearbyLines :', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('❌ Erreur findNearbyLines :', error);
    return [];
  }
};

// VERSION ULTRA-RAPIDE : Lit directement la table line_stops_order
export const findLineStops = async (lineId: string) => {
  try {
    const { data, error } = await supabase
      .from('line_stops_order')
      .select(`
        stop_id,
        stop_sequence,
        osm_stops (
          id,
          name,
          latitude,
          longitude
        )
      `)
      .eq('line_id', lineId)
      .order('stop_sequence', { ascending: true });

    if (error) {
      console.error('❌ Erreur findLineStops :', error);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.stop_id,
      name: item.osm_stops?.name,
      latitude: item.osm_stops?.latitude,
      longitude: item.osm_stops?.longitude,
      sequence: item.stop_sequence
    }));
  } catch (error) {
    console.error('❌ Erreur findLineStops :', error);
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
      console.error('❌ Erreur findLineIntersections :', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('❌ Erreur findLineIntersections :', error);
    return [];
  }
};

// ========================================================
// RÉCUPÉRATION SECONDAIRE DES DONNÉES
// ========================================================
export const fetchOSMStops = async (limit?: number) => {
  try {
    let query = supabase.from('osm_stops').select('*');
    if (limit) {
      query = query.limit(limit);
    }
    const { data, error } = await query;
    if (error) {
      console.error('❌ Erreur osm_stops :', error);
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('❌ Erreur fetchOSMStops :', error);
    return [];
  }
};

export const fetchTransportLines = async () => {
  try {
    const { data, error } = await supabase
      .from('transport_lines')
      .select('*')
      .limit(1);
    if (error) {
      console.error('❌ Erreur transport_lines :', error);
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('❌ Erreur fetchTransportLines :', error);
    return [];
  }
};

// ========================================================
// UTILITAIRES DE CALCUL
// ========================================================
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

// ========================================================
// MOTEUR D'ITINÉRAIRE PRINCIPAL
// ========================================================
export const findRoute = async (
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<RouteResult> => {
  try {
    const startLines = await findNearbyLines(startLat, startLng, 400);
    const endLines = await findNearbyLines(endLat, endLng, 400);

    console.log('📍 Lignes départ :', startLines.length);
    console.log('📍 Lignes arrivée :', endLines.length);

    if (startLines.length === 0 || endLines.length === 0) {
      return {
        steps: [],
        totalDuration: 0,
        totalPrice: 0,
        type: 'none',
        message: 'Aucune ligne trouvée près de votre position',
      };
    }

    // ==========================================
    // TRAJET DIRECT
    // ==========================================
    for (const sLine of startLines) {
      for (const eLine of endLines) {
        if (sLine.line_id === eLine.line_id) {
          const stops = await findLineStops(sLine.line_id);
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
                fromStop: fromStop?.name || 'Arrêt le plus proche',
                toStop: toStop?.name || 'Arrêt le plus proche',
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

    // ==========================================
    // 1 CORRESPONDANCE
    // ==========================================
    let bestTransfer: RouteResult | null = null;

    const startLinesStopsCache: Record<string, any[]> = {};
    const endLinesStopsCache: Record<string, any[]> = {};

    // Pré-chargement des arrêts en parallèle
    await Promise.all([
      ...startLines.map(async (l: any) => {
        startLinesStopsCache[l.line_id] = await findLineStops(l.line_id);
      }),
      ...endLines.map(async (l: any) => {
        endLinesStopsCache[l.line_id] = await findLineStops(l.line_id);
      }),
    ]);

    for (const sLine of startLines) {
      for (const eLine of endLines) {
        if (sLine.line_id === eLine.line_id) continue;

        const intersections = await findLineIntersections(
          sLine.line_id,
          eLine.line_id,
          250
        );
        if (intersections.length === 0) continue;

        // Extraction propre du premier arrêt de correspondance trouvé
        const transferStop = intersections[0];
        if (!transferStop || !transferStop.stop_name) continue;

        const stopsA = startLinesStopsCache[sLine.line_id] || [];
        const stopsB = endLinesStopsCache[eLine.line_id] || [];

        const fromStop = getClosestStop(stopsA, startLat, startLng, 350);
        const toStop = getClosestStop(stopsB, endLat, endLng, 350);

        // Calcul dynamique et intelligent des temps
        const duration1 = estimateDuration(sLine.distance || 1500);
        const duration2 = estimateDuration(eLine.distance || 1500);
        const totalDuration = duration1 + duration2 + 5;

        const result: RouteResult = {
          steps: [
            {
              type: 'bus',
              lineId: sLine.line_id,
              lineName: sLine.line_name,
              fromStop: fromStop?.name || 'Arrêt départ',
              toStop: transferStop.stop_name,
              duration: duration1,
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
              toStop: toStop?.name || 'Arrêt arrivée',
              duration: duration2,
              price: 250,
            },
          ],
          totalDuration: totalDuration,
          totalPrice: 500,
          type: 'one_transfer',
        };

        if (!bestTransfer) {
          bestTransfer = result;
        }
      }
    }

    if (bestTransfer) {
      return bestTransfer;
    }

    return {
      steps: [],
      totalDuration: 0,
      totalPrice: 0,
      type: 'none',
      message: 'Aucune ligne directe ou avec correspondance trouvée',
    };
  } catch (error) {
    console.error('❌ Erreur findRoute :', error);
    return {
      steps: [],
      totalDuration: 0,
      totalPrice: 0,
      type: 'none',
      message: 'Erreur lors de la recherche',
    };
  }
};
