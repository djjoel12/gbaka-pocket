// src/utils/supabaseUtils.ts
import { supabase } from '@/lib/supabase'
import { TripData } from '@/types/trip'

export const saveTripToSupabase = async (tripData: TripData) => {
  console.log('📤 Envoi vers Supabase...')
  console.log('📤 Format Gbaka Pocket v2')
  
  try {
    // Vérifier les données
    if (!tripData.points || tripData.points.length === 0) {
      console.warn('⚠️ Pas de points GPS')
      return { success: false, error: 'Pas de points' }
    }

    // Construire la géométrie LINESTRING pour le tracé
    const routeString = tripData.points
      .map(p => `${p.longitude} ${p.latitude}`)
      .join(',')

    // Construire la géométrie MULTIPOINT pour les arrêts
    const stopsString = tripData.stops.length > 0
      ? tripData.stops.map(s => `${s.coordinates[1]} ${s.coordinates[0]}`).join(',')
      : null

    // Préparer les données au format Gbaka Pocket
    const tripToInsert = {
      // Identifiants
      line_id: tripData.lineId,
      
      // Ligne
      type: tripData.type,
      direction: tripData.direction,
      
      // Départ
      start_name: tripData.start.name,
      start_point: `POINT(${tripData.start.longitude} ${tripData.start.latitude})`,
      
      // Arrivée
      end_name: tripData.end.name,
      end_point: `POINT(${tripData.end.longitude} ${tripData.end.latitude})`,
      
      // Tarif
      fare: tripData.fare,
      
      // Statistiques (en km, km/h, secondes)
      distance_km: tripData.distance,
      duration_sec: tripData.duration,
      avg_speed_kmh: tripData.averageSpeed,
      max_speed_kmh: tripData.maxSpeed,
      
      // Données brutes
      route: `LINESTRING(${routeString})`,
      stops_geom: stopsString ? `MULTIPOINT(${stopsString})` : null,
      points_json: tripData.points,
      stops_json: tripData.stops,
      
      // Temps
      started_at: tripData.startedAt,
      ended_at: tripData.endedAt,
      
      // Qualité
      quality: tripData.quality,
    }

    const { data, error } = await supabase
      .from('trips_v2')
      .insert([tripToInsert])

    if (error) {
      console.error('❌ Erreur Supabase:', error)
      return { success: false, error }
    }

    console.log('✅ Trajet envoyé !')
    console.log(`📊 ${tripData.points.length} points`)
    console.log(`📏 ${tripData.distance} km`)
    console.log(`💰 ${tripData.fare} FCFA`)
    return { success: true, data }
  } catch (error) {
    console.error('❌ Erreur:', error)
    return { success: false, error }
  }
      }
