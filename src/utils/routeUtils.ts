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
      `https://openstreetmap.org{encodeURIComponent(
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
// REQUÊTES COMPLÉMENTAIRES (Si besoin pour ton interface)
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
// MOTEUR D'ITINÉRAIRE PRINCIPAL (100% BASE DE DONNÉES)
// ========================================================
export const findRoute = async (
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<RouteResult> => {
  try {
    // On appelle directement l'unique fonction intelligente dans Supabase
    const { data, error } = await supabase.rpc('calculer_trajet_intelligent', {
      start_lat: startLat,
      start_lng: startLng,
      end_lat: endLat,
      end_lng: endLng
    });

    if (error || !data || data.length === 0) {
      console.error('❌ Aucun trajet trouvé ou erreur :', error);
      return {
        steps: [],
        totalDuration: 0,
        totalPrice: 0,
        type: 'none',
        message: 'Aucun itinéraire trouvé pour ce trajet.',
      };
    }

    // Supabase renvoie une liste, on prend le premier élément (le meilleur)
    const bestRoute = data[0];

    // ------------------------------------------
    // CAS DU TRAJET DIRECT
    // ------------------------------------------
    if (bestRoute.type_trajet === 'direct') {
      const duration = Math.max(10, Math.round((bestRoute.total_distance / 1000) * 4));
      
      return {
        steps: [
          {
            type: 'bus',
            lineId: bestRoute.line1_id,
            lineName: bestRoute.line1_name,
            fromStop: bestRoute.start_stop_name,
            toStop: bestRoute.end_stop_name,
            duration: duration,
            price: 300,
          },
        ],
        totalDuration: duration,
        totalPrice: 300,
        type: 'direct',
      };
    }

    // ------------------------------------------
    // CAS DU TRAJET AVEC CORRESPONDANCE (1 CHANGEMENT)
    // ------------------------------------------
    const duration1 = Math.max(10, Math.round((bestRoute.dist_bus1 / 1000) * 4));
    const duration2 = Math.max(10, Math.round((bestRoute.dist_bus2 / 1000) * 4));
    const totalDuration = duration1 + duration2 + 5; // +5 minutes de marche transfert

    return {
      steps: [
        {
          type: 'bus',
          lineId: bestRoute.line1_id,
          lineName: bestRoute.line1_name,
          fromStop: bestRoute.start_stop_name,
          toStop: bestRoute.transfer_stop_name,
          duration: duration1,
          price: 250,
        },
        {
          type: 'transfer',
          fromStop: bestRoute.transfer_stop_name,
          toStop: bestRoute.transfer_stop_name,
          duration: 5,
          price: 0,
        },
        {
          type: 'bus',
          lineId: bestRoute.line2_id,
          lineName: bestRoute.line2_name,
          fromStop: bestRoute.transfer_stop_name,
          toStop: bestRoute.end_stop_name,
          duration: duration2,
          price: 250,
        },
      ],
      totalDuration: totalDuration,
      totalPrice: 500,
      type: 'one_transfer',
    };

  } catch (error) {
    console.error('❌ Erreur findRoute :', error);
    return {
      steps: [],
      totalDuration: 0,
      totalPrice: 0,
      type: 'none',
      message: 'Erreur lors de la recherche du trajet.',
    };
  }
};
