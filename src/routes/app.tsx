import { useEffect } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Boxes, Gauge, Images, KeyRound, LogOut, ShieldCheck, Users, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { fetchIsAdmin } from "@/lib/admin-repo";
import { useAuth } from "@/hooks/use-auth.tsx";


export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Estúdio — Forge3D Asset Studio" },
      {
        name: "description",
        content:
          "Workspace de geração de assets: style profile, prompt, preview em streaming e exportação por engine.",
      },
      { property: "og:title", content: "Estúdio — Forge3D Asset Studio" },
      {
        property: "og:description",
        content: "Gere e exporte assets 2D de jogo com estilo consistente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AppLayout,
});

function AppLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="font-mono text-xs text-muted-foreground">carregando estúdio…</span>
      </div>
    );
  }
  if (!session) return null;

  const nav = [
    { to: "/app", label: "Gerador", icon: Wand2, exact: true },
    { to: "/app/batch", label: "Elenco em lote", icon: Users, exact: false },
    { to: "/app/library", label: "Biblioteca", icon: Images, exact: false },
    { to: "/app/usage", label: "Uso", icon: Gauge, exact: false },
    { to: "/app/settings/keys", label: "API keys", icon: KeyRound, exact: false },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <Boxes className="size-5 text-primary" />
          <span className="font-mono text-xs tracking-tight">FORGE3D</span>
        </Link>

        <nav className="flex items-center gap-1">
          {nav.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <Button
                key={item.to}
                size="sm"
                variant={active ? "secondary" : "ghost"}
                asChild
              >
                <Link to={item.to}>
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              </Button>
            );
          })}
          <Button size="sm" variant="ghost" asChild>
            <Link to="/docs/connect">Conectar IA</Link>
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link to="/docs/architecture">Arquitetura</Link>
          </Button>

        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
            {session.user.email}
          </span>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Sair"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      {/* Required: nested routes render here. */}
      <Outlet />
    </div>
  );
}
