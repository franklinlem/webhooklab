import { CreateInbox } from "./ui/create-inbox";
import Link from "next/link";

import packageJson from "../package.json";

export default function Home() {
  return (
    <main className="home-shell">
      <header className="brand-bar">
        <Link className="brand" href="/" aria-label="WebhookLab — início">
          <span className="brand-mark">W</span>
          <span>WebhookLab</span>
        </Link>
        <span className="version">v{packageJson.version}</span>
      </header>

      <section className="hero">
        <div className="eyebrow"><span /> LABORATÓRIO HTTP</div>
        <h1>Veja o que seu webhook realmente recebeu.</h1>
        <p className="hero-copy">
          Gere uma URL privada, envie qualquer requisição HTTP e inspecione método,
          headers e payload em tempo real.
        </p>
        <CreateInbox />
        <p className="privacy-note">
          O link do painel funciona como senha. Não o compartilhe. Eventos expiram automaticamente.
        </p>
      </section>

      <section className="feature-grid" aria-label="Recursos">
        <article>
          <span className="feature-number">01</span>
          <h2>Endpoint instantâneo</h2>
          <p>Sem cadastro no MVP. Um clique cria uma URL exclusiva pronta para testes.</p>
        </article>
        <article>
          <span className="feature-number">02</span>
          <h2>Tempo real</h2>
          <p>Novas requisições surgem no painel sem recarregar a página.</p>
        </article>
        <article>
          <span className="feature-number">03</span>
          <h2>Dados protegidos</h2>
          <p>Headers sensíveis são mascarados e endereços IP não são armazenados integralmente.</p>
        </article>
      </section>
    </main>
  );
}
