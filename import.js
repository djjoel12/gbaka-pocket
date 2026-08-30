import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Variables d'environnement Supabase manquantes dans GitHub Secrets");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const dataDir = path.join(process.cwd(), "data");

if (!fs.existsSync(dataDir)) {
  console.log("📂 Le dossier /data n'existe pas. Créez-le et placez vos fichiers dedans.");
  process.exit(0);
}

// On cherche tous les fichiers qui finissent par .json
const files = fs.readdirSync(dataDir).filter(file => file.endsWith(".json"));

if (files.length === 0) {
  console.log("📂 Aucun fichier .json trouvé dans le dossier /data.");
  process.exit(0);
}

async function startImport() {
  for (const file of files) {
    const filePath = path.join(dataDir, file);
    console.log(`📡 Lecture de l'OSM JSON : ${file}`);
    
    const osmData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    // On extrait la liste des éléments OSM
    const elements = osmData.elements || [];
    
    // On ne garde que les relations (qui représentent les lignes de transport)
    const relations = elements.filter(elem => elem.type === "relation");
    console.log(`📦 ${relations.length} lignes de transport détectées dans ${file}.`);

    for (let i = 0; i < relations.length; i++) {
      const rel = relations[i];
      const tags = rel.tags || {};
      
      // Extraction des chemins (ways) contenant la géométrie
      const waysWithGeometry = (rel.members || []).filter(m => m.type === "way" && m.geometry);

      // Appel de notre fonction RPC Supabase
      const { error } = await supabase.rpc("import_osm_transport_line", {
        p_external_id: `relation/${rel.id}`,
        p_name: tags.name || `Ligne sans nom (${rel.id})`,
        p_type: tags.route || tags.type || "route",
        p_operator: tags.operator || "divers",
        p_network: tags.network || null,
        p_ways_json: JSON.stringify(waysWithGeometry), // On passe les chemins pour PostGIS
        p_source: file
      });

      if (error) {
        console.error(`❌ Erreur sur la relation ${rel.id}:`, error.message);
      }

      if ((i + 1) % 10 === 0 || i === relations.length - 1) {
        console.log(`⚡ Progression dans ${file} : ${i + 1}/${relations.length} lignes traitées`);
      }
    }
    console.log(`✅ Fichier ${file} entièrement traité.`);
  }
  console.log("🎉 Fin de l'importation. Vos itinéraires VTC sont prêts et indexés !");
}

startImport();
  
