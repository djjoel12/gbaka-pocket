import { supabase } from '@/lib/supabase'
import { TripData, StopPoint } from '@/types/trip'

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

        // Données JSON
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
// RÉCUPÉRER LES ARRÊTS ENREGISTRÉS DANS stops_json
// ======================================================

export const fetchHistoricalStops = async (): Promise<StopPoint[]> => {
  try {
    const { data, error } = await supabase
      .from('trips')
      .select('stops_json')
      .not('stops_json', 'is', null)
      .order('date', { ascending: false })
      .limit(100)

    // ✅ NOUVEAU CODE (à mettre) :
  if (error) {
    console.error('❌ ERREUR SUPABASE STOPS:', error)
    throw new Error(
      `Impossible de récupérer les arrêts : ${
        error.message || 'Erreur Supabase'
      }`
    )
  }

    if (!data || data.length === 0) {
      console.warn(
        '⚠️ Aucun trajet contenant stops_json'
      )

      return []
    }

    const allStops: StopPoint[] = []

    for (const trip of data) {

      let stops: unknown = trip.stops_json

      // ------------------------------------------
      // Si Supabase renvoie une chaîne JSON
      // ------------------------------------------

      if (typeof stops === 'string') {
        try {
          stops = JSON.parse(stops)
        } catch (error) {
          console.warn(
            '⚠️ stops_json impossible à parser:',
            stops
          )

          continue
        }
      }

      // ------------------------------------------
      // On veut obligatoirement un tableau
      // ------------------------------------------

      if (!Array.isArray(stops)) {
        continue
      }

      // ------------------------------------------
      // Vérifier chaque arrêt
      // ------------------------------------------

      for (const stop of stops) {

        if (!stop || typeof stop !== 'object') {
          continue
        }

        const s = stop as Partial<StopPoint>

        if (
          typeof s.id !== 'string' ||
          typeof s.name !== 'string' ||
          !Array.isArray(s.coordinates) ||
          s.coordinates.length < 2
        ) {
          continue
        }

        const latitude = Number(s.coordinates[0])
        const longitude = Number(s.coordinates[1])

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          continue
        }

        // ------------------------------------------
        // Créer un StopPoint propre
        // ------------------------------------------

        allStops.push({
          id: s.id,
          name: s.name,

          // IMPORTANT :
          // [latitude, longitude]
          coordinates: [
            latitude,
            longitude,
          ],

          timestamp:
            typeof s.timestamp === 'number'
              ? s.timestamp
              : Date.now(),

          duration:
            typeof s.duration === 'number'
              ? s.duration
              : 0,

          isStart:
            typeof s.isStart === 'boolean'
              ? s.isStart
              : false,

          isEnd:
            typeof s.isEnd === 'boolean'
              ? s.isEnd
              : false,

          isManual:
            typeof s.isManual === 'boolean'
              ? s.isManual
              : false,

          isConfirmed:
            typeof s.isConfirmed === 'boolean'
              ? s.isConfirmed
              : false,
        })
      }
    }

    // ==================================================
    // SUPPRIMER LES DOUBLONS
    // ==================================================

    const uniqueStops: StopPoint[] = []

    for (const stop of allStops) {

      const alreadyExists = uniqueStops.some(
        existing =>
          existing.coordinates[0] ===
            stop.coordinates[0] &&
          existing.coordinates[1] ===
            stop.coordinates[1]
      )

      if (!alreadyExists) {
        uniqueStops.push(stop)
      }
    }

    console.log(
      `🚏 ${uniqueStops.length} arrêts historiques récupérés`
    )

    return uniqueStops

  } catch (error) {

    console.error(
      '❌ Erreur fetchHistoricalStops:',
      error
    )

    return []
  }
      }
