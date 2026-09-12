"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type EventItem = {
  id: string;
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: string;
  content_type: string | null;
  body_size: number;
  source_ip_hint: string | null;
  received_at: string;
};

type Inbox = {
  name: string;
  hook_url: string;
  retention_hours: number;
  events: EventItem[];
};

const methodClass: Record<string, string> = {
  GET: "method-get",
  POST: "method-post",
  PUT: "method-put",
  PATCH: "method-patch",
  DELETE: "method-delete",
  OPTIONS: "method-options",
};

function prettyBody(event: EventItem) {
  if (!event.body) return "(corpo vazio)";
  if (event.content_type?.includes("json")) {
    try { return JSON.stringify(JSON.parse(event.body), null, 2); } catch { return event.body; }
  }
  return event.body;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(new Date(value));
}

export function InboxDashboard({ token }: { token: string }) {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);

  const selected = useMemo(
    () => inbox?.events.find((event) => event.id === selectedId) ?? inbox?.events[0] ?? null,
    [inbox, selectedId],
  );

  useEffect(() => {
    fetch(`/api/inboxes/${token}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(response.status === 404 ? "Endpoint não encontrado." : "Falha ao carregar endpoint.");
        return response.json() as Promise<Inbox>;
      })
      .then((data) => {
        setInbox(data);
        setSelectedId(data.events[0]?.id ?? null);
      })
      .catch((reason: Error) => setError(reason.message));
    const stream = new EventSource(`/api/inboxes/${token}/stream`);
    stream.onopen = () => setConnected(true);
    stream.onerror = () => setConnected(false);
    stream.addEventListener("webhook", (message) => {
      const event = JSON.parse((message as MessageEvent).data) as EventItem;
      setInbox((current) => current ? { ...current, events: [event, ...current.events].slice(0, 100) } : current);
      setSelectedId(event.id);
    });
    return () => stream.close();
  }, [token]);

  async function copyUrl() {
    if (!inbox) return;
    await navigator.clipboard.writeText(inbox.hook_url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function clearEvents() {
    if (!window.confirm("Excluir todos os eventos deste endpoint?")) return;
    const response = await fetch(`/api/inboxes/${token}/events`, { method: "DELETE" });
    if (response.ok) {
      setInbox((current) => current ? { ...current, events: [] } : current);
      setSelectedId(null);
    }
  }

  async function removeEvent(id: string) {
    const response = await fetch(`/api/inboxes/${token}/events/${id}`, { method: "DELETE" });
    if (response.ok) {
      setInbox((current) => current ? { ...current, events: current.events.filter((item) => item.id !== id) } : current);
      setSelectedId(null);
    }
  }

  if (error) return <main className="state-screen"><h1>{error}</h1><Link href="/">Criar novo endpoint</Link></main>;
  if (!inbox) return <main className="state-screen"><div className="loader" /><p>Carregando painel…</p></main>;

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <Link className="brand compact" href="/"><span className="brand-mark">W</span><span>WebhookLab</span></Link>
        <div className={`connection ${connected ? "online" : "offline"}`}>
          <span /> {connected ? "Tempo real conectado" : "Reconectando"}
        </div>
      </header>

      <section className="endpoint-bar">
        <div>
          <span className="label">SEU ENDPOINT</span>
          <code>{inbox.hook_url}</code>
        </div>
        <button type="button" className="copy-button" onClick={copyUrl}>{copied ? "Copiado!" : "Copiar URL"}</button>
      </section>

      <section className="workspace">
        <aside className="events-panel">
          <div className="panel-heading">
            <div><h1>Requisições</h1><span>{inbox.events.length} de 100 eventos</span></div>
            {inbox.events.length > 0 && <button className="text-button danger" onClick={clearEvents}>Limpar</button>}
          </div>
          <div className="event-list">
            {inbox.events.length === 0 ? (
              <div className="empty-state">
                <div className="pulse-rings"><span /></div>
                <h2>Aguardando requisições</h2>
                <p>Envie uma chamada para o endpoint acima. Ela aparecerá aqui automaticamente.</p>
                <code>{`curl -X POST '${inbox.hook_url}' -H 'Content-Type: application/json' -d '{"teste":true}'`}</code>
              </div>
            ) : inbox.events.map((event) => (
              <button
                type="button"
                key={event.id}
                onClick={() => setSelectedId(event.id)}
                className={`event-row ${selected?.id === event.id ? "selected" : ""}`}
              >
                <span className={`method ${methodClass[event.method] ?? ""}`}>{event.method}</span>
                <span className="event-path">{event.path}</span>
                <time>{formatDate(event.received_at)}</time>
              </button>
            ))}
          </div>
        </aside>

        <article className="details-panel">
          {!selected ? (
            <div className="details-placeholder"><span>↙</span><p>Selecione uma requisição para inspecionar os detalhes.</p></div>
          ) : (
            <>
              <div className="detail-title">
                <div><span className={`method ${methodClass[selected.method] ?? ""}`}>{selected.method}</span><h2>{selected.path}</h2></div>
                <button className="text-button danger" onClick={() => removeEvent(selected.id)}>Excluir evento</button>
              </div>
              <dl className="metadata-grid">
                <div><dt>Recebido</dt><dd>{formatDate(selected.received_at)}</dd></div>
                <div><dt>Tamanho</dt><dd>{selected.body_size} bytes</dd></div>
                <div><dt>Origem aproximada</dt><dd>{selected.source_ip_hint ?? "Indisponível"}</dd></div>
                <div><dt>Content-Type</dt><dd>{selected.content_type ?? "Não informado"}</dd></div>
              </dl>
              <DetailBlock title="Body" value={prettyBody(selected)} />
              <DetailBlock title="Query parameters" value={JSON.stringify(selected.query, null, 2)} />
              <DetailBlock title="Headers" value={JSON.stringify(selected.headers, null, 2)} />
            </>
          )}
        </article>
      </section>
      <footer className="dashboard-footer">Eventos expiram após {inbox.retention_hours} horas · Headers sensíveis são mascarados</footer>
    </main>
  );
}

function DetailBlock({ title, value }: { title: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }
  return (
    <section className="detail-block">
      <div><h3>{title}</h3><button className="text-button" onClick={copy}>{copied ? "Copiado" : "Copiar"}</button></div>
      <pre>{value}</pre>
    </section>
  );
}
