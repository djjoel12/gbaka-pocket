"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TestSupabase() {
  const [status, setStatus] = useState("⏳ Test en cours...");
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function testConnection() {
      try {
        // Tester la connexion en comptant les trajets
        const { count, error } = await supabase
          .from("trips")
          .select("*", { count: 'exact', head: true });

        if (error) {
          setStatus("❌ Erreur: " + error.message);
          return;
        }

        setStatus("✅ Connexion réussie !");
        setData({ count });
        console.log("📊 Nombre de trajets:", count);
      } catch (err) {
        setStatus("❌ Erreur: " + err);
      }
    }

    testConnection();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-2xl font-bold mb-4">🧪 Test Supabase</h1>
      <p className="text-lg mb-4">{status}</p>
      {data && (
        <div className="bg-white/10 p-4 rounded">
          <p>📊 {data.count} trajets dans la base</p>
        </div>
      )}
    </div>
  );
}