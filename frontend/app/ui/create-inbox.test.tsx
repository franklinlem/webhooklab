import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateInbox } from "./create-inbox";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("CreateInbox", () => {
  beforeEach(() => {
    push.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ token: "new-token" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    ));
  });

  it("cria um endpoint com o nome informado", async () => {
    const user = userEvent.setup();
    render(<CreateInbox />);

    const input = screen.getByLabelText("Nome do endpoint");
    await user.clear(input);
    await user.type(input, "Integração pagamentos");
    await user.click(screen.getByRole("button", { name: /criar endpoint gratuito/i }));

    expect(fetch).toHaveBeenCalledWith("/api/inboxes", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ name: "Integração pagamentos" }),
    }));
    expect(push).toHaveBeenCalledWith("/inbox/new-token");
  });

  it("não permite criar com um nome composto apenas por espaços", async () => {
    const user = userEvent.setup();
    render(<CreateInbox />);

    const input = screen.getByLabelText("Nome do endpoint");
    await user.clear(input);
    await user.type(input, "   ");

    expect(screen.getByRole("button", { name: /criar endpoint gratuito/i })).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
