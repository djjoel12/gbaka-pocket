// src/utils/routeUtils.ts
import { supabase } from '@/lib/supabase';

// ============================================
// GÉOCODAGE AVEC NOMINATIM (OpenStreetMap)
// ============================================
export const geocodeWithOSM = async (query: string) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=3&countrycodes=ci&accept-language=fr`
    );
    const data = await response.json();
    
    if (data && data.length > 0) {
      return data.map((item: any) => ({
        name: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        type: item.type,
        importance: item.importance
      }));
    }
    return [];
  } catch (error) {
    console.error('❌ Erreur géocodage:', error);
    return [];
  }
};

// ============================================
// TROUVER LES LIGNES PROCHES D'UN POINT
// ============================================
export const findNearbyLines = async (lat: number, lng: number, radius: number = 200) => {
  try {
    const { data, error } = await supabase
      .rpc('find_nearby_lines', {
        lat: lat,
        lng: lng,
        radius_meters: radius
      });

    if (error) {
      console.error('❌ Erreur findNearbyLines:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Erreur:', error);
    return [];
  }
};

// ============================================
// TROUVER LES ARRÊTS D'UNE LIGNE
// ============================================
export const findLineStops = async (lineId: string, radius: number = 50) => {
  try {
    const { data, error } = await supabase
      .rpc('find_line_stops', {
        line_id: lineId,
        radius_meters: radius
      });

    if (error) {
      console.error('❌ Erreur findLineStops:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Erreur:', error);
    return [];
  }
};

// ============================================
// TROUVER LES INTERSECTIONS DE 2 LIGNES
// ============================================
export const findLineIntersections = async (line1Id: string, line2Id: string, radius: number = 50) => {
  try {
    const { data, error } = await supabase
      .rpc('find_line_intersections', {
        line1_id: line1Id,
        line2_id: line2Id,
        radius_meters: radius
      });

    if (error) {
      console.error('❌ Erreur findLineIntersections:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Erreur:', error);
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
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(deltaPhi/2)**2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda/2)**2;
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * R;
}

function estimateDuration(dist1: number, dist2: number): number {
  const avgDist = (dist1 + dist2) / 2;
  return Math.max(10, Math.round(avgDist / 1000 * 5));
}

// ============================================
// TROUVER UN ITINÉRAIRE COMPLET (CORRIGÉ)
// ============================================
export const findRoute = async (startLat: number, startLng: number, endLat: number, endLng: number): Promise<RouteResult> => {
  try {
    // 1. Trouver les lignes proches du départ
    const startLines = await findNearbyLines(startLat, startLng, 200);
    // 2. Trouver les lignes proches de l'arrivée
    const endLines = await findNearbyLines(endLat, endLng, 200);

    if (startLines.length === 0 || endLines.length === 0) {
      return {
        steps: [],
        totalDuration: 0,
        totalPrice: 0,
        type: 'none',
        message: 'Aucune ligne trouvée près de votre position'
      };
    }

    // 3. Vérifier les intersections entre les lignes de départ et d'arrivée
    for (const startLine of startLines) {
      for (const endLine of endLines) {
        if (startLine.line_id === endLine.line_id) {
          // ✅ LIGNE DIRECTE
          const stops = await findLineStops(startLine.line_id, 50);
          
          // ✅ CORRECTION : Typage explicite des paramètres
          const startStop = stops.find((s: any) => 
            calculateDistance(startLat, startLng, s.latitude, s.longitude) < 100
          );
          const endStop = stops.find((s: any) => 
            calculateDistance(endLat, endLng, s.latitude, s.longitude) < 100
          );

          return {
            steps: [
              {
                type: 'bus',
                lineId: startLine.line_id,
                lineName: startLine.line_name,
                fromStop: startStop?.stop_name || 'Arrêt départ',
                toStop: endStop?.stop_name || 'Arrêt arrivée',
                duration: estimateDuration(startLine.distance, endLine.distance),
                price: 300
              }
            ],
            totalDuration: estimateDuration(startLine.distance, endLine.distance),
            totalPrice: 300,
            type: 'direct'
          };
        }

        // 🔄 VÉRIFIER LES INTERSECTIONS
        const intersections = await findLineIntersections(startLine.line_id, endLine.line_id, 50);
        if (intersections.length > 0) {
          const stop = intersections[0];
          const stops1 = await findLineStops(startLine.line_id, 50);
          const stops2 = await findLineStops(endLine.line_id, 50);
          
          // ✅ CORRECTION : Typage explicite des paramètres
          const startStop = stops1.find((s: any) => 
            calculateDistance(startLat, startLng, s.latitude, s.longitude) < 100
          );
          const endStop = stops2.find((s: any) => 
            calculateDistance(endLat, endLng, s.latitude, s.longitude) < 100
          );

          return {
            steps: [
              {
                type: 'bus',
                lineId: startLine.line_id,
                lineName: startLine.line_name,
                fromStop: startStop?.stop_name || 'Arrêt départ',
                toStop: stop.stop_name,
                duration: 20,
                price: 250
              },
              {
                type: 'transfer',
                fromStop: stop.stop_name,
                toStop: stop.stop_name,
                duration: 5,
                distance: 0,
                price: 0
              },
              {
                type: 'bus',
                lineId: endLine.line_id,
                lineName: endLine.line_name,
                fromStop: stop.stop_name,
                toStop: endStop?.stop_name || 'Arrêt arrivée',
                duration: 20,
                price: 250
              }
            ],
            totalDuration: 45,
            totalPrice: 500,
            type: 'one_transfer'
          };
        }
      }
    }

    // ❌ AUCUN ITINÉRAIRE TROUVÉ
    return {
      steps: [
        {
          type: 'walk',
          fromStop: 'Départ',
          toStop: 'Arrivée',
          duration: 30,
          distance: calculateDistance(startLat, startLng, endLat, endLng) / 1000,
          price: 0
        }
      ],
      totalDuration: 30,
      totalPrice: 0,
      type: 'none',
      message: 'Aucune ligne directe ou avec correspondance trouvée'
    };

  } catch (error) {
    console.error('❌ Erreur findRoute:', error);
    return {
      steps: [],
      totalDuration: 0,
      totalPrice: 0,
      type: 'none',
      message: 'Erreur lors de la recherche'
    };
  }
};
