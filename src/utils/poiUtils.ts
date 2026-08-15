// src/utils/poiUtils.ts
import { supabase } from '@/lib/supabase'

export type POI = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: string;
  line_ids: string[];
  confirmed_by: string;
  confirmed_at: string;
  is_verified: boolean;
  created_at: string;
};

export const fetchAllPOIs = async (): Promise<POI[]> => {
  try {
    const { data, error } = await supabase
      .from('pois')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ Erreur récupération POI:', error);
      return [];
    }

    console.log(`📍 ${data?.length || 0} POI récupérés`);
    return data || [];
  } catch (error) {
    console.error('❌ Erreur:', error);
    return [];
  }
};

export const savePOI = async (poi: Omit<POI, 'id' | 'created_at'>): Promise<POI | null> => {
  try {
    const { data, error } = await supabase
      .from('pois')
      .insert([{
        name: poi.name,
        latitude: poi.latitude,
        longitude: poi.longitude,
        type: poi.type || 'gbaka_stop',
        line_ids: poi.line_ids || [],
        confirmed_by: poi.confirmed_by || '',
        is_verified: poi.is_verified || false,
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur sauvegarde POI:', error);
      return null;
    }

    console.log(`✅ POI sauvegardé: ${data.name}`);
    return data;
  } catch (error) {
    console.error('❌ Erreur:', error);
    return null;
  }
};
