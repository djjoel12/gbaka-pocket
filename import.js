import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Lecture des variables identiques à celles des arrêts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Variables d'environnement NEXT_PUBLIC_SUPABASE manquantes dans le processus.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const dataDir = path.join(process.cwd(), "data");

if (!fs.existsSync(dataDir)) {
  console.log("📂 Le dossier /data n'existe pas.");
  process.exit(0);
}

const files = fs.readdirSync(dataDir).filter(file => file.endsWith(".json"));

if (files.length === 0) {
  console.log("📂 Aucun fichier .json trouvé.");
  process.exit(0);
}

async function startImport() {
  for (const file of files) {
    const filePath = path.join(dataDir, file);
    console.log(`📡 Lecture de l'OSM JSON : ${file}`);
    
    const osmData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const elements = osmData.elements || [];
    const relations = elements.filter(elem => elem.type === "relation");
    
    console.log(`📦 ${relations.length} lignes de transport détectées.`);

    for (let i = 0; i < relations.length; i++) {
      const rel = relations[i];
      const tags = rel.tags || {};
      const waysWithGeometry = (rel.members || []).filter(m => m.type === "way" && m.geometry);

      const { error } = await supabase.rpc("import_osm_transport_line", {
        p_external_id: `relation/${rel.id}`,
        p_name: tags.name || `Ligne sans nom (${rel.id})`,
        p_type: tags.route || tags.type || "route",
        p_operator: tags.operator || "divers",
        p_network: tags.network || null,
        p_ways_json: JSON.stringify(waysWithGeometry),
        p_source: file
      });

      if (error) {
        console.error(`❌ Erreur sur la relation ${rel.id}:`, error.message);
      }

      if ((i + 1) % 10 === 0 || i === relations.length - 1) {
        console.log(`⚡ Progression ${file} : ${i + 1}/${relations.length}`);
      }
    }
  }
  console.log("🎉 Fin de l'importation automatique !");
}

startImport();
