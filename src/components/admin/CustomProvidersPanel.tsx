import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronUp, Plug, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { defaultCustomProvider, type CustomProviderInput } from "@/lib/custom-provider-config";
import {
  deleteCustomProviderFn,
  listCustomProvidersFn,
  saveCustomProviderFn,
} from "@/lib/custom-providers.server";

export function CustomProvidersPanel() {
  const qc = useQueryClient();
  const read = useServerFn(listCustomProvidersFn);
  const { data: providers = [], isLoading } = useQuery({
    queryKey: ["custom-providers"],
    queryFn: () => read(),
  });
  const [editing, setEditing] = useState<CustomProviderInput | null>(null);

  function invalidate() {
    return Promise.all([
      qc.invalidateQueries({ queryKey: ["custom-providers"] }),
      qc.invalidateQueries({ queryKey: ["image-provider"] }),
    ]);
  }

  return (
    <section className="panel mb-8 p-0">
      <h2 className="flex items-center gap-2 border-b border-border px-4 py-3 font-mono text-xs uppercase tracking-wide">
        <Plug className="size-3.5" /> Provedores personalizados
      </h2>
      <p className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground">
        Cadastre Runcrate, TokenHarbor ou outra API de imagens. O modo OpenAI compatível usa um
        modelo que realmente devolve imagens, como FLUX — modelos de texto como DeepSeek, GLM e Qwen
        não geram sprites. As chaves ficam apenas no servidor.
      </p>
      <div className="space-y-2 p-4">
        {isLoading && <p className="text-xs text-muted-foreground">carregando provedores...</p>}
        {providers.map((provider) => (
          <div
            key={provider.id}
            className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{provider.label}</div>
              <div className="truncate font-mono text-[11px] text-muted-foreground">
                {provider.kind === "openai" ? "OpenAI compatível" : "Avançado"} ·{" "}
                {provider.model || "sem modelo fixo"} ·{" "}
                {provider.configured ? provider.maskedKey : "sem chave"}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditing({ ...provider })}>
              Configurar
            </Button>
            <DeleteProvider id={provider.id} label={provider.label} onDone={invalidate} />
          </div>
        ))}
        {!isLoading && !providers.length && (
          <p className="text-xs text-muted-foreground">Nenhuma API personalizada cadastrada.</p>
        )}
        {editing ? (
          <ProviderEditor
            initial={editing}
            onCancel={() => setEditing(null)}
            onDone={async () => {
              setEditing(null);
              await invalidate();
            }}
          />
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setEditing(defaultCustomProvider())}>
            <Plus className="size-4" /> Adicionar API
          </Button>
        )}
      </div>
    </section>
  );
}

function DeleteProvider({
  id,
  label,
  onDone,
}: {
  id: string;
  label: string;
  onDone: () => Promise<unknown>;
}) {
  const remove = useServerFn(deleteCustomProviderFn);
  const mutation = useMutation({
    mutationFn: () => remove({ data: { id } }),
    onSuccess: async () => {
      toast.success("Provedor removido");
      await onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={`Excluir ${label}`}
      disabled={mutation.isPending}
      onClick={() => {
        if (window.confirm(`Excluir o provedor ${label}?`)) mutation.mutate();
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}

function ProviderEditor({
  initial,
  onCancel,
  onDone,
}: {
  initial: CustomProviderInput;
  onCancel: () => void;
  onDone: () => Promise<void>;
}) {
  const save = useServerFn(saveCustomProviderFn);
  const [form, setForm] = useState(initial);
  const [advancedOpen, setAdvancedOpen] = useState(initial.kind === "advanced");
  const set = <K extends keyof CustomProviderInput>(key: K, value: CustomProviderInput[K]) =>
    setForm((old) => ({ ...old, [key]: value }));
  const mutation = useMutation({
    mutationFn: () => save({ data: form }),
    onSuccess: async () => {
      toast.success("API personalizada salva");
      await onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 rounded-md border border-primary/30 bg-primary/5 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome do provedor" id="custom-label">
          <Input
            id="custom-label"
            value={form.label}
            onChange={(e) => set("label", e.target.value)}
            placeholder="Ex.: Runcrate"
          />
        </Field>
        <Field label="Modelo de imagem" id="custom-model">
          <Input
            id="custom-model"
            value={form.model}
            onChange={(e) => set("model", e.target.value)}
            placeholder="Ex.: black-forest-labs/FLUX.1-dev"
            list="custom-image-models"
          />
          <datalist id="custom-image-models">
            <option value="black-forest-labs/FLUX.1-dev" />
            <option value="black-forest-labs/FLUX.1-schnell" />
            <option value="black-forest-labs/FLUX.1-kontext-dev" />
            <option value="stabilityai/stable-diffusion-3-5-large" />
            <option value="ideogram/ideogram-3.0" />
            <option value="openai/gpt-image-2" />
          </datalist>
        </Field>
      </div>
      <Tabs
        value={form.kind}
        onValueChange={(value) => {
          set("kind", value as CustomProviderInput["kind"]);
          setAdvancedOpen(value === "advanced");
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="openai">OpenAI compatível</TabsTrigger>
          <TabsTrigger value="advanced">Avançado</TabsTrigger>
        </TabsList>
      </Tabs>
      {form.kind === "openai" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="URL base (incluindo /v1)" id="custom-base">
            <Input
              id="custom-base"
              value={form.baseUrl}
              onChange={(e) => set("baseUrl", e.target.value)}
              placeholder="https://api.runcrate.ai/v1"
            />
          </Field>
          <Field label="Caminho de geração" id="custom-endpoint">
            <Input
              id="custom-endpoint"
              value={form.endpoint}
              onChange={(e) => set("endpoint", e.target.value)}
              placeholder="/images/generations"
            />
          </Field>
        </div>
      ) : (
        <Field label="URL completa do endpoint de geração" id="custom-full-endpoint">
          <Input
            id="custom-full-endpoint"
            value={form.endpoint}
            onChange={(e) => set("endpoint", e.target.value)}
            placeholder="https://api.exemplo.com/v1/generate"
          />
        </Field>
      )}
      <Field
        label={initial.id ? "Nova chave (vazio mantém a atual)" : "Chave de API"}
        id="custom-key"
      >
        <Input
          id="custom-key"
          type="password"
          autoComplete="off"
          value={form.apiKey ?? ""}
          onChange={(e) => set("apiKey", e.target.value)}
          placeholder="Cole a chave completa"
        />
      </Field>
      <div className="flex items-center gap-2 text-sm">
        <Switch checked={form.enabled} onCheckedChange={(value) => set("enabled", value)} />
        <span>Disponível na ordem de geração</span>
      </div>
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-primary"
        onClick={() => setAdvancedOpen((value) => !value)}
      >
        {advancedOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}{" "}
        Campos JSON e edição
      </button>
      {advancedOpen && (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Campo do prompt" id="custom-prompt-field">
              <Input
                id="custom-prompt-field"
                value={form.promptField}
                onChange={(e) => set("promptField", e.target.value)}
              />
            </Field>
            <Field label="Campo do modelo" id="custom-model-field">
              <Input
                id="custom-model-field"
                value={form.modelField}
                onChange={(e) => set("modelField", e.target.value)}
              />
            </Field>
            <Field label="Imagem na resposta" id="custom-image-path">
              <Input
                id="custom-image-path"
                value={form.imagePath}
                onChange={(e) => set("imagePath", e.target.value)}
                placeholder="data.0.b64_json"
              />
            </Field>
            <Field label="Campo largura" id="custom-width">
              <Input
                id="custom-width"
                value={form.widthField}
                onChange={(e) => set("widthField", e.target.value)}
                placeholder="opcional"
              />
            </Field>
            <Field label="Campo altura" id="custom-height">
              <Input
                id="custom-height"
                value={form.heightField}
                onChange={(e) => set("heightField", e.target.value)}
                placeholder="opcional"
              />
            </Field>
            <Field label="Campo tamanho" id="custom-size">
              <Input
                id="custom-size"
                value={form.sizeField}
                onChange={(e) => set("sizeField", e.target.value)}
                placeholder="size ou vazio"
              />
            </Field>
            <Field label="Cabeçalho de autenticação" id="custom-auth-header">
              <Input
                id="custom-auth-header"
                value={form.authHeader}
                onChange={(e) => set("authHeader", e.target.value)}
              />
            </Field>
            <Field label="Prefixo da chave" id="custom-auth-prefix">
              <Input
                id="custom-auth-prefix"
                value={form.authPrefix}
                onChange={(e) => set("authPrefix", e.target.value)}
                placeholder="Bearer ou vazio"
              />
            </Field>
            <Field label="Método" id="custom-method">
              <select
                id="custom-method"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.method}
                onChange={(e) => set("method", e.target.value as "POST" | "PUT")}
              >
                <option>POST</option>
                <option>PUT</option>
              </select>
            </Field>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Switch
              checked={form.editEnabled}
              onCheckedChange={(value) => set("editEnabled", value)}
            />
            <span>Este provedor aceita edição de imagem</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Para Runcrate, mantenha o endpoint <code>/images/generations</code>. Use um modelo de
            edição como <code>black-forest-labs/FLUX.1-kontext-dev</code>, não DeepSeek. Os demais
            modos do Studio usam o mesmo modelo de imagem.
          </p>
          {form.editEnabled && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={form.kind === "openai" ? "Caminho da edição" : "URL completa da edição"}
                id="custom-edit-endpoint"
              >
                <Input
                  id="custom-edit-endpoint"
                  value={form.editEndpoint}
                  onChange={(e) => set("editEndpoint", e.target.value)}
                />
              </Field>
              <Field label="Campo da imagem original" id="custom-edit-image">
                <Input
                  id="custom-edit-image"
                  value={form.editImageField}
                  onChange={(e) => set("editImageField", e.target.value)}
                />
              </Field>
            </div>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Salvando..." : "Salvar provedor"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {children}
    </div>
  );
}
