import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InboxDashboard } from "./inbox-dashboard";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

class EventSourceMock {
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {}
  addEventListener() {}
  close() {}
}

const inbox = {
  name: "Pagamentos",
  hook_url: "https://example.test/hook/token",
  retention_hours: 168,
  events: [
    {
      id: "event-post",
      method: "POST",
      path: "/orders",
      query: { source: "shop" },
      headers: { "content-type": "application/json" },
      body: '{"customer":"Franklin"}',
      content_type: "application/json",
      body_size: 23,
      source_ip_hint: "192.168.1.0/24",
      received_at: "2026-09-14T00:00:00Z",
    },
    {
      id: "event-get",
      method: "GET",
      path: "/health",
      query: {},
      headers: {},
      body: "",
      content_type: null,
      body_size: 0,
      source_ip_hint: null,
      received_at: "2026-09-14T00:01:00Z",
    },
  ],
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("InboxDashboard", () => {
  beforeEach(() => {
    replace.mockReset();
    vi.stubGlobal("EventSource", EventSourceMock);
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") return jsonResponse({ name: "Pedidos" });
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return jsonResponse(inbox);
    }));
  });

  it("pesquisa, filtra por método e atualiza a contagem", async () => {
    const user = userEvent.setup();
    render(<InboxDashboard token="token" />);
    await screen.findByText("Pagamentos");

    expect(screen.getByText("2 visíveis de 2 eventos")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Pesquisar requisições"), "Franklin");
    expect(screen.getByText("1 visíveis de 2 eventos")).toBeInTheDocument();
    expect(screen.getAllByText("/orders").length).toBeGreaterThan(0);

    await user.clear(screen.getByLabelText("Pesquisar requisições"));
    await user.selectOptions(screen.getByLabelText("Filtrar por método"), "GET");
    expect(screen.getByText("1 visíveis de 2 eventos")).toBeInTheDocument();
    expect(screen.getAllByText("/health").length).toBeGreaterThan(0);
    expect(screen.queryByText("/orders")).not.toBeInTheDocument();
  });

  it("edita e exibe o novo nome do endpoint", async () => {
    const user = userEvent.setup();
    render(<InboxDashboard token="token" />);
    await screen.findByText("Pagamentos");

    await user.click(screen.getByRole("button", { name: "Editar nome" }));
    const input = screen.getByLabelText("Novo nome");
    await user.clear(input);
    await user.type(input, "Pedidos");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(screen.getByText("Pedidos")).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith("/api/inboxes/token", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ name: "Pedidos" }),
    }));
  });

  it("exige confirmação textual antes de excluir o endpoint", async () => {
    const user = userEvent.setup();
    render(<InboxDashboard token="token" />);
    await screen.findByText("Pagamentos");

    await user.click(screen.getByRole("button", { name: "Excluir endpoint" }));
    const dialog = screen.getByRole("dialog", { name: /excluir “Pagamentos”/i });
    const deleteButton = within(dialog).getByRole("button", { name: "Excluir permanentemente" });
    expect(deleteButton).toBeDisabled();

    await user.type(within(dialog).getByLabelText("Confirmação"), "EXCLUIR");
    expect(deleteButton).toBeEnabled();
    await user.click(deleteButton);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(fetch).toHaveBeenCalledWith("/api/inboxes/token", { method: "DELETE" });
  });
});
