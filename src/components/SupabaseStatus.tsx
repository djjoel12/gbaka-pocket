"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SupabaseStatus() {
  const [status, setStatus] = useState<"idle" | "checking" | "connected" | "error">("idle");
  const [message, setMessage] = useState("");

  const checkConnection = async () => {
    setStatus("checking");
    setMessage("Vérification...");

    try {
      const { count, error } = await supabase
        .from("trips")
        .select("*", { count: "exact", head: true });

      if (error) {
        setStatus("error");
        setMessage(`❌ ${error.message}`);
        return;
      }

      setStatus("connected");
      setMessage(`✅ ${count} trajets`);
    } catch (error: any) {
      setStatus("error");
      setMessage(`❌ ${error.message}`);
    }
  };

  return (
    <button
      onClick={checkConnection}
      className="text-[10px] px-2 py-1 rounded border border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400 transition"
    >
      {status === "idle" && "🔌 Supabase"}
      {status === "checking" && "⏳ ..."}
      {status === "connected" && message}
      {status === "error" && message}
    </button>
  );
}
