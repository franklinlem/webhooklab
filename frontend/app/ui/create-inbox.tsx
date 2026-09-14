"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateInbox() {
  const router = useRouter();
  const [name, setName] = useState("Meu endpoint");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/inboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
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
    <form className="create-area" onSubmit={create}>
      <label className="field-label" htmlFor="endpoint-name">Nome do endpoint</label>
      <div className="create-controls">
        <input
          id="endpoint-name"
          className="name-input"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={1}
          maxLength={80}
          required
          disabled={loading}
          autoComplete="off"
          aria-describedby={error ? "create-error" : undefined}
        />
        <button className="primary-button" type="submit" disabled={loading || !name.trim()}>
        {loading ? "Criando endpoint…" : "Criar endpoint gratuito"}
        <span aria-hidden="true">↗</span>
        </button>
      </div>
      {error && <p id="create-error" className="error-message" role="alert">{error}</p>}
    </form>
  );
}
