"use client";

import { useState } from "react";
import GpsRecorder from "@/components/gps/GpsRecorder";

export default function Home() {
  const [route, setRoute] = useState("");

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-6">
      <div className="mx-auto max-w-md">
        {/* En-tête */}
        <header className="mb-8">
          <p className="text-sm font-medium text-blue-600">
            TRANSPORTTICKET.CI
          </p>

          <h1 className="mt-2 text-3xl font-bold text-gray-900">
            Collecte de trajet
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Enregistrez le parcours réel d&apos;une ligne
            de transport.
          </p>
        </header>

        {/* Sélection de la ligne */}
        <section className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
          <label
            htmlFor="route"
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            Sélectionner une ligne
          </label>

          <select
            id="route"
            value={route}
            onChange={(e) => setRoute(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-blue-500"
          >
            <option value="">
              Choisir une ligne
            </option>

            <option value="yopougon-adjame">
              Yopougon Maroc → Adjamé
            </option>

            <option value="abobo-adjame">
              Abobo → Adjamé
            </option>

            <option value="cocody-plateau">
              Cocody → Plateau
            </option>
          </select>
        </section>

        {/* GPS */}
        {route ? (
          <GpsRecorder />
        ) : (
          <div className="rounded-2xl bg-white p-5 text-center text-sm text-gray-500 shadow-sm">
            Sélectionnez une ligne pour commencer
            l&apos;enregistrement.
          </div>
        )}
      </div>
    </main>
  );
}