"use client";

import { useEffect } from "react";

export default function ErudaDebug() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Vérifier si Eruda est déjà présent
      if (!document.querySelector('script[src*="eruda"]')) {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/eruda";
        script.onload = () => {
          (window as any).eruda.init();
          console.log("✅ Eruda activé !");
          console.log("📱 Console disponible sur mobile");
        };
        script.onerror = () => {
          console.warn("⚠️ Eruda n'a pas pu se charger");
        };
        document.head.appendChild(script);
      }
    }
  }, []);

  return null;
}
