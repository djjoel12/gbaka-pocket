"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SupabaseStatus() {
  const [status, setStatus] = useState<"idle" | "checking" | "connected" | "error">("idle");
  const [message, setMessage] = useState("");

  const checkConnection = async () => {
    setStatus("checking");
    setMessage("Vérification en cours...");

    try {
      const { count, error } = await supabase
        .from("trips")
        .select("*", { count: "exact", head: true });

      if (error) {
        setStatus("error");
        setMessage(`❌ Erreur: ${error.message}`);
        return;
      }

      setStatus("connected");
      setMessage(`✅ Connecté ! ${count} trajets dans la base`);
    } catch (error: any) {
      setStatus("error");
      setMessage(`❌ Erreur: ${error.message}`);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={checkConnection}
        className="text-xs px-3 py-1.5 rounded-lg border border-white/20 text-white/60 hover:bg-white/5 transition"
      >
        🔌 Vérifier Supabase
      </button>
      {status !== "idle" && (
        <span className={`text-xs ${status === "connected" ? "text-green-400" : "text-red-400"}`}>
          {message}
        </span>
      )}
    </div>
  );
      }
