import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Variables Supabase manquantes");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const dataDir = path.join(process.cwd(), "data");

const getRowsFromCSV = (fileContent: string) => {
  const lines = fileContent.split("\n").filter(line => line.trim() !== "");
  if (lines.length < 2) return [];

  const headers = lines[0].split("\t");
  const rows = lines.slice(1).map((line) => {
    const columns = line.split("\t");
    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header] = columns[index]?.trim() ?? null;
    });
    return obj;
  });
  return rows;
};

async function importData() {
  const files = fs.readdirSync(dataDir).filter((file) => file.endsWith(".csv"));
  console.log(`📂 ${files.length} fichiers CSV trouvés.`);

  let totalRows = 0;
  const batchSize = 25;

  for (const file of files) {
    console.log(`\n📂 Lecture du fichier : ${file}`);
    const filePath = path.join(dataDir, file);
    const content = fs.readFileSync(filePath, "utf8");
    const csvRows = getRowsFromCSV(content);

    const rows = csvRows.map((row: any) => {
      const osmId = parseInt(row["@id"], 10); 
      if (isNaN(osmId)) return null;

      return {
        osm_id: osmId,
        name: row["name"] || null,
        latitude: parseFloat(row["@lat"]) || null,
        longitude: parseFloat(row["@lon"]) || null,
        highway: row["highway"] || null,
        public_transport: row["public_transport"] || null,
        operator: row["operator"] || null,
        shelter: row["shelter"] || null,
        official_status: row["official_status"] || null,
        tags: row["tags"] ? JSON.parse(row["tags"]) : {},
        source: file,
      };
    }).filter(row => row !== null && row.latitude !== null && row.longitude !== null);

    console.log(`📦 ${rows.length} arrêts à importer depuis ce fichier...`);

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from("osm_stops").upsert(batch, {
        onConflict: "osm_id",
      });
      if (error) {
        console.error(`❌ Erreur pour le fichier ${file}:`, error);
        process.exit(1);
      }
      console.log(`✅ ${Math.min(i + batchSize, rows.length)}/${rows.length} importées`);
    }
    totalRows += rows.length;
  }

  console.log(`\n🎉 Import terminé ! Total : ${totalRows} arrêts importés dans osm_stops.`);
}

importData();
