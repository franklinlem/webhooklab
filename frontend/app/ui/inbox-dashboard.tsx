"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("ALL");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");

  const methods = useMemo(
    () => [...new Set(inbox?.events.map((event) => event.method) ?? [])].sort(),
    [inbox],
  );

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return (inbox?.events ?? []).filter((event) => {
      if (method !== "ALL" && event.method !== method) return false;
      if (!normalizedQuery) return true;
      const searchable = [
        event.method,
        event.path,
        event.body,
        JSON.stringify(event.query),
        JSON.stringify(event.headers),
      ].join(" ").toLocaleLowerCase("pt-BR");
      return searchable.includes(normalizedQuery);
    });
  }, [inbox, method, query]);

  const selected = useMemo(
    () => filteredEvents.find((event) => event.id === selectedId) ?? filteredEvents[0] ?? null,
    [filteredEvents, selectedId],
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

  useEffect(() => {
    if (!deleteOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !deleting) {
        setDeleteOpen(false);
        setDeleteConfirmation("");
      }
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [deleteOpen, deleting]);

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

  async function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nameDraft.trim()) return;
    setSavingName(true);
    setActionError("");
    try {
      const response = await fetch(`/api/inboxes/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameDraft }),
      });
      if (!response.ok) throw new Error("Não foi possível alterar o nome do endpoint.");
      const data = await response.json() as { name: string };
      setInbox((current) => current ? { ...current, name: data.name } : current);
      setNameDraft(data.name);
      setEditingName(false);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Erro inesperado.");
    } finally {
      setSavingName(false);
    }
  }

  async function deleteEndpoint() {
    if (deleteConfirmation !== "EXCLUIR") return;
    setDeleting(true);
    setActionError("");
    try {
      const response = await fetch(`/api/inboxes/${token}`, { method: "DELETE" });
      if (response.status !== 204) throw new Error("Não foi possível excluir o endpoint.");
      router.replace("/");
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Erro inesperado.");
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (error) return <main className="state-screen"><h1>{error}</h1><Link href="/">Criar novo endpoint</Link></main>;
  if (!inbox) return <main className="state-screen"><div className="loader" /><p>Carregando painel…</p></main>;

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <Link className="brand compact" href="/"><span className="brand-mark">W</span><span>WebhookLab</span></Link>
        <div className={`connection ${connected ? "online" : "offline"}`} role="status" aria-live="polite">
          <span /> {connected ? "Tempo real conectado" : "Reconectando"}
        </div>
      </header>

      <section className="endpoint-bar">
        <div>
          <span className="label">{inbox.name}</span>
          <code>{inbox.hook_url}</code>
        </div>
        <div className="endpoint-actions">
          <button type="button" className="copy-button" onClick={copyUrl}>{copied ? "Copiado!" : "Copiar URL"}</button>
          <button
            type="button"
            className="copy-button"
            onClick={() => { setNameDraft(inbox.name); setEditingName(true); setActionError(""); }}
          >Editar nome</button>
          <button type="button" className="copy-button danger-button" onClick={() => setDeleteOpen(true)}>Excluir endpoint</button>
        </div>
      </section>

      {editingName && (
        <form className="edit-name-bar" onSubmit={saveName}>
          <label htmlFor="edit-endpoint-name">Novo nome</label>
          <input
            id="edit-endpoint-name"
            className="name-input"
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            minLength={1}
            maxLength={80}
            required
            autoFocus
          />
          <button className="copy-button" type="submit" disabled={savingName || !nameDraft.trim()}>{savingName ? "Salvando…" : "Salvar"}</button>
          <button className="text-button" type="button" onClick={() => setEditingName(false)}>Cancelar</button>
        </form>
      )}
      {actionError && <p className="dashboard-error" role="alert">{actionError}</p>}

      <section className="workspace">
        <aside className="events-panel">
          <div className="panel-heading">
            <div><h1>Requisições</h1><span aria-live="polite">{filteredEvents.length} visíveis de {inbox.events.length} eventos</span></div>
            {inbox.events.length > 0 && <button className="text-button danger" onClick={clearEvents}>Limpar</button>}
          </div>
          <div className="event-filters" role="search" aria-label="Filtrar requisições">
            <label className="sr-only" htmlFor="event-search">Pesquisar requisições</label>
            <input
              id="event-search"
              type="search"
              placeholder="Pesquisar caminho, body ou header"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <label className="sr-only" htmlFor="method-filter">Filtrar por método</label>
            <select id="method-filter" value={method} onChange={(event) => setMethod(event.target.value)}>
              <option value="ALL">Todos</option>
              {methods.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="event-list">
            {inbox.events.length === 0 ? (
              <div className="empty-state">
                <div className="pulse-rings"><span /></div>
                <h2>Aguardando requisições</h2>
                <p>Envie uma chamada para o endpoint acima. Ela aparecerá aqui automaticamente.</p>
                <code>{`curl -X POST '${inbox.hook_url}' -H 'Content-Type: application/json' -d '{"teste":true}'`}</code>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="no-results">
                <h2>Nenhuma requisição encontrada</h2>
                <p>Ajuste a pesquisa ou o filtro por método.</p>
                <button type="button" className="text-button" onClick={() => { setQuery(""); setMethod("ALL"); }}>Limpar filtros</button>
              </div>
            ) : filteredEvents.map((event) => (
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

      {deleteOpen && (
        <div className="dialog-backdrop" role="presentation">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description">
            <h2 id="delete-title">Excluir “{inbox.name}”?</h2>
            <p id="delete-description">O endpoint e todos os eventos serão excluídos permanentemente. Digite <strong>EXCLUIR</strong> para confirmar.</p>
            <label htmlFor="delete-confirmation">Confirmação</label>
            <input
              id="delete-confirmation"
              className="name-input"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              autoFocus
              autoComplete="off"
            />
            <div className="dialog-actions">
              <button type="button" className="text-button" onClick={() => { setDeleteOpen(false); setDeleteConfirmation(""); }}>Cancelar</button>
              <button type="button" className="copy-button danger-button" disabled={deleting || deleteConfirmation !== "EXCLUIR"} onClick={deleteEndpoint}>
                {deleting ? "Excluindo…" : "Excluir permanentemente"}
              </button>
            </div>
          </section>
        </div>
      )}
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
