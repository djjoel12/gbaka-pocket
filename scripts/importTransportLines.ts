import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant"
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Le fichier est à la racine du projet
const filePath = path.join(
  process.cwd(),
  "gbaka_pocket_lignes_informelles.geojson"
);

const geojson = JSON.parse(fs.readFileSync(filePath, "utf8"));

const rows = geojson.features.map((feature: any) => {
  const p = feature.properties;

  return {
    external_id: p.line_id,
    name: p.name,
    type: p.gbaka_pocket_type,
    operator: p.operator || null,
    network: p.network || null,
    code: p.code || null,
    frequency: p.frequency || null,
    opening_hours: p.opening_hours || null,
    frequency_exceptions: p.frequency_exceptions || null,
    geometry: feature.geometry,
    source: "abidjantransport_lignes.geojson",
    verified: false,
  };
});

console.log(`📦 ${rows.length} lignes à importer...`);

const batchSize = 25;

for (let i = 0; i < rows.length; i += batchSize) {
  const batch = rows.slice(i, i + batchSize);

  const { error } = await supabase
    .from("transport_lines")
    .upsert(batch, {
      onConflict: "external_id",
    });

  if (error) {
    console.error("❌ Erreur :", error);
    process.exit(1);
  }

  console.log(
    `✅ ${Math.min(i + batchSize, rows.length)}/${rows.length} importées`
  );
}

console.log("🎉 Import terminé !");
