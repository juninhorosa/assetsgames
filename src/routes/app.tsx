import { useEffect } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Boxes,
  Gauge,
  Images,
  KeyRound,
  LogOut,
  Plug,
  ShieldCheck,
  Users,
  Wand2,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  const { session, user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: () => fetchIsAdmin(user!.id),
    enabled: !!user,
  });

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

  const groups: { label: string; items: { to: string; label: string; icon: typeof Wand2; exact: boolean }[] }[] = [
    {
      label: "Criar",
      items: [
        { to: "/app", label: "Gerador", icon: Wand2, exact: true },
        { to: "/app/batch", label: "Elenco em lote", icon: Users, exact: false },
      ],
    },
    {
      label: "Arquivos",
      items: [{ to: "/app/library", label: "Biblioteca", icon: Images, exact: false }],
    },
    {
      label: "Conta",
      items: [
        { to: "/app/usage", label: "Uso", icon: Gauge, exact: false },
        { to: "/app/settings/keys", label: "API keys", icon: KeyRound, exact: false },
        ...(isAdmin
          ? [{ to: "/app/admin", label: "Admin", icon: ShieldCheck, exact: false }]
          : []),
      ],
    },
    {
      label: "Docs",
      items: [
        { to: "/docs/connect", label: "Conectar IA", icon: Plug, exact: false },
        { to: "/docs/architecture", label: "Arquitetura", icon: BookOpen, exact: false },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <aside className="hidden border-r border-sidebar-border bg-sidebar lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <Link to="/" className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <span className="neon-shadow flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="size-5" />
          </span>
          <span>
            <strong className="block font-display text-sm tracking-[0.08em] text-sidebar-foreground">FORGE3D</strong>
            <span className="block font-mono text-[9px] uppercase tracking-[0.18em] text-primary">asset studio</span>
          </span>
        </Link>

        <nav className="flex-1 space-y-5 overflow-y-auto p-3">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                  return (
                    <Button key={item.to} variant="ghost" className={`h-10 w-full justify-start px-3 ${active ? "bg-sidebar-accent text-primary" : "text-sidebar-foreground/70"}`} asChild>
                      <Link to={item.to}>
                        <item.icon className="size-4" />
                        <span className="flex-1 text-left">{item.label}</span>
                        {active && <ChevronRight className="size-3" />}
                      </Link>
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 truncate px-3 font-mono text-[10px] text-muted-foreground">{session.user.email}</div>
          <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/70" onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth" });
          }}>
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl lg:hidden">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground"><Boxes className="size-4" /></span>
            <span className="font-display text-sm font-bold tracking-[0.08em]">FORGE3D</span>
          </Link>
          <div className="flex items-center gap-1">
            {groups.slice(0, 2).flatMap((group) => group.items).map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Button key={item.to} size="icon" variant={active ? "secondary" : "ghost"} aria-label={item.label} asChild>
                  <Link to={item.to}><item.icon className="size-4" /></Link>
                </Button>
              );
            })}
            <Button size="icon" variant="ghost" aria-label="Sair" onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}><LogOut className="size-4" /></Button>
          </div>
        </header>

        <Outlet />
      </div>
    </div>
  );
}
