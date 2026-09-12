"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateInbox() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/inboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Meu endpoint" }),
      });
      if (!response.ok) throw new Error("Não foi possível criar o endpoint.");
      const data = await response.json();
      router.push(`/inbox/${data.token}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro inesperado.");
      setLoading(false);
    }
  }

  return (
    <div className="create-area">
      <button className="primary-button" type="button" onClick={create} disabled={loading}>
        {loading ? "Criando endpoint…" : "Criar endpoint gratuito"}
        <span aria-hidden="true">↗</span>
      </button>
      {error && <p className="error-message" role="alert">{error}</p>}
    </div>
  );
}

