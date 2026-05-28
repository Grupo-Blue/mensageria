import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { trpc } from "@/lib/trpc";
import { normalizePhoneNumber } from "@shared/phoneUtils";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Users,
  MessageSquareText,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  List,
  FileText,
  ClipboardList,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const MAX_VARIANTS = 5;

interface Recipient {
  phoneNumber: string;
  name?: string;
  variables?: Record<string, string>;
}

type ConnectionRow = { id: number; identification: string; phoneNumber: string | null; status: string };

function normalizePhone(p: string): string | null {
  return normalizePhoneNumber(p || "");
}

/** Faz parse de números colados (um por linha ou separados por vírgula/ponto-e-vírgula). */
function parsePastedNumbers(text: string): Recipient[] {
  const tokens = text.split(/[\n,;]+/).map((t) => t.trim()).filter(Boolean);
  const recipients: Recipient[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const phone = normalizePhone(token);
    if (phone && !seen.has(phone)) {
      seen.add(phone);
      recipients.push({ phoneNumber: phone });
    }
  }
  return recipients;
}

/**
 * Faz parse de CSV. Detecta cabeçalho automaticamente: se a 1ª célula da 1ª linha
 * não parece telefone, a linha é tratada como cabeçalho — colunas extras viram
 * variáveis `{{campo}}` com o nome do cabeçalho.
 */
function parseRecipientsCsv(text: string): {
  recipients: Recipient[];
  variableNames: string[];
  ignored: number;
} {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { recipients: [], variableNames: [], ignored: 0 };

  const split = (line: string) => line.split(/[,;\t]/).map((c) => c.trim());
  const firstCols = split(lines[0]);
  const hasHeader = !normalizePhone(firstCols[0] ?? "");

  let phoneIdx = 0;
  let nameIdx = 1;
  let varCols: Array<{ idx: number; name: string }> = [];
  let dataLines = lines;

  if (hasHeader) {
    dataLines = lines.slice(1);
    const headers = firstCols.map((h) => h.toLowerCase());
    const pIdx = headers.findIndex((h) => /tel|fone|phone|whats|n[uú]mero|celular/.test(h));
    const nIdx = headers.findIndex((h) => /nome|name/.test(h));
    phoneIdx = pIdx >= 0 ? pIdx : 0;
    nameIdx = nIdx >= 0 ? nIdx : -1;
    varCols = firstCols
      .map((h, idx) => ({ idx, name: h.trim() }))
      .filter((c) => c.idx !== phoneIdx && c.idx !== nameIdx && c.name.length > 0);
  }

  const recipients: Recipient[] = [];
  let ignored = 0;
  for (const line of dataLines) {
    const cols = split(line);
    const phone = normalizePhone(cols[phoneIdx] ?? "");
    if (!phone) {
      ignored++;
      continue;
    }
    const name = nameIdx >= 0 ? cols[nameIdx] || undefined : undefined;
    let variables: Record<string, string> | undefined;
    if (varCols.length > 0) {
      const collected: Record<string, string> = {};
      for (const vc of varCols) {
        const val = cols[vc.idx];
        if (val) collected[vc.name] = val;
      }
      if (Object.keys(collected).length > 0) variables = collected;
    }
    recipients.push({ phoneNumber: phone, name, variables });
  }
  return { recipients, variableNames: varCols.map((c) => c.name), ignored };
}

export default function BaileysCampaignNew() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);

  // Passo 1 — mensagem
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // Multi-conexão: usuário seleciona N conexões; scheduler faz round-robin.
  const [connectionIds, setConnectionIds] = useState<number[]>([]);
  const [variants, setVariants] = useState<string[]>([""]);
  // Mídia opcional (compartilhada por todos os destinatários)
  const [mediaType, setMediaType] = useState<"" | "image" | "document" | "audio">("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaFileName, setMediaFileName] = useState("");
  const [mediaMimeType, setMediaMimeType] = useState("");

  // Passo 2 — destinatários
  const [recipientSource, setRecipientSource] = useState<"list" | "paste" | "csv">("list");
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [csvText, setCsvText] = useState("");

  // Passo 3 — envio
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [autoRetryEnabled, setAutoRetryEnabled] = useState(true);
  const [maxRetries, setMaxRetries] = useState(3);
  const [retryDelayMinutes, setRetryDelayMinutes] = useState(30);
  const [minDelaySeconds, setMinDelaySeconds] = useState(8);
  const [maxDelaySeconds, setMaxDelaySeconds] = useState(25);
  const [dailyLimitEnabled, setDailyLimitEnabled] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(200);

  const { data: connections, isLoading: isLoadingConnections } = trpc.whatsapp.list.useQuery(undefined, {
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });
  const { data: contactLists } = trpc.contactLists.list.useQuery(undefined, {
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });
  const { data: listContacts, isLoading: isLoadingListContacts } = trpc.contactLists.getContacts.useQuery(
    { listId: selectedListId ?? 0, statusFilter: "active" },
    { enabled: !!selectedListId },
  );

  const createMutation = trpc.baileysCampaigns.create.useMutation();
  const addRecipientsMutation = trpc.baileysCampaigns.addRecipients.useMutation();

  const nonEmptyVariants = useMemo(
    () => variants.map((v) => v.trim()).filter(Boolean),
    [variants],
  );
  const pasteParsed = useMemo(() => parsePastedNumbers(pasteText), [pasteText]);
  const csvParsed = useMemo(() => parseRecipientsCsv(csvText), [csvText]);

  const finalRecipients: Recipient[] = useMemo(() => {
    if (recipientSource === "list") {
      return (listContacts ?? []).map((c) => ({
        phoneNumber: c.phoneNumber,
        name: c.name || undefined,
      }));
    }
    if (recipientSource === "paste") return pasteParsed;
    return csvParsed.recipients;
  }, [recipientSource, listContacts, pasteParsed, csvParsed]);

  const addVariant = () => {
    if (variants.length < MAX_VARIANTS) setVariants([...variants, ""]);
  };
  const removeVariant = (idx: number) => {
    if (variants.length > 1) setVariants(variants.filter((_, i) => i !== idx));
  };
  const updateVariant = (idx: number, value: string) => {
    setVariants(variants.map((v, i) => (i === idx ? value : v)));
  };

  const mediaConfigured = mediaType !== "";
  const mediaValid = !mediaConfigured || mediaUrl.trim().length > 0;
  const canProceedStep1 =
    connectionIds.length > 0 &&
    name.trim().length > 0 &&
    nonEmptyVariants.length >= 1 &&
    mediaValid;
  const canProceedStep2 = finalRecipients.length > 0;
  const isSubmitting = createMutation.isPending || addRecipientsMutation.isPending;

  const handleCreate = async () => {
    if (!canProceedStep1) {
      toast.error("Selecione ao menos uma conexão, preencha o nome e uma variação de mensagem");
      return;
    }
    if (!canProceedStep2) {
      toast.error("Adicione ao menos um destinatário");
      return;
    }
    if (maxDelaySeconds < minDelaySeconds) {
      toast.error("O intervalo máximo deve ser maior ou igual ao mínimo");
      return;
    }

    let scheduledAt: string | undefined;
    if (isScheduled) {
      if (!scheduledDate || !scheduledTime) {
        toast.error("Selecione a data e o horário do agendamento");
        return;
      }
      const when = new Date(`${scheduledDate}T${scheduledTime}`);
      if (Number.isNaN(when.getTime()) || when <= new Date()) {
        toast.error("A data de agendamento deve estar no futuro");
        return;
      }
      scheduledAt = when.toISOString();
    }

    const recipientsToSend = finalRecipients;
    try {
      const created = await createMutation.mutateAsync({
        connectionIds,
        name: name.trim(),
        description: description.trim() || undefined,
        messageVariants: nonEmptyVariants,
        scheduledAt,
        autoRetryEnabled,
        maxRetries,
        retryDelayMinutes,
        minDelaySeconds,
        maxDelaySeconds,
        dailyLimit: dailyLimitEnabled ? dailyLimit : undefined,
        mediaUrl: mediaConfigured && mediaUrl.trim() ? mediaUrl.trim() : undefined,
        mediaType: mediaConfigured ? (mediaType as "image" | "document" | "audio") : undefined,
        mediaFileName:
          mediaConfigured && mediaType === "document" && mediaFileName.trim()
            ? mediaFileName.trim()
            : undefined,
        mediaMimeType:
          mediaConfigured && mediaMimeType.trim() ? mediaMimeType.trim() : undefined,
      });

      await addRecipientsMutation.mutateAsync({
        campaignId: created.id,
        recipients: recipientsToSend.map((r) => ({
          phoneNumber: r.phoneNumber,
          name: r.name,
          variables:
            r.variables && Object.keys(r.variables).length > 0
              ? JSON.stringify(r.variables)
              : undefined,
        })),
      });

      toast.success("Disparo criado com sucesso!");
      navigate(`/disparos/${created.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao criar o disparo";
      toast.error(message);
    }
  };

  if (isLoadingConnections) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    );
  }

  if (!connections || connections.length === 0) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" asChild>
            <Link href="/disparos">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Link>
          </Button>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-yellow-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Conecte um WhatsApp primeiro
              </h3>
              <p className="text-gray-500 text-center max-w-md mb-4">
                Para criar disparos, conecte um número de WhatsApp lendo o QR Code.
              </p>
              <Button asChild>
                <Link href="/whatsapp">Conectar WhatsApp</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/disparos">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Novo Disparo</h1>
            <p className="text-gray-600 mt-1">
              Disparo em massa via WhatsApp conectado por QR Code
            </p>
          </div>
        </div>

        {/* Indicador de passos */}
        <div className="flex items-center justify-center gap-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step === s
                    ? "bg-blue-600 text-white"
                    : step > s
                      ? "bg-green-600 text-white"
                      : "bg-gray-200 text-gray-600"
                }`}
              >
                {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
              </div>
              <span className={`text-sm ${step === s ? "font-medium" : "text-gray-500"}`}>
                {s === 1 ? "Mensagem" : s === 2 ? "Destinatários" : "Envio"}
              </span>
              {s < 3 && <div className="w-12 h-0.5 bg-gray-200" />}
            </div>
          ))}
        </div>

        {/* Passo 1 — Mensagem */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquareText className="w-5 h-5" />
                Mensagem e conexão
              </CardTitle>
              <CardDescription>
                Escolha o WhatsApp que vai disparar e escreva as variações da mensagem
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do disparo *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Promoção de fim de ano"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  placeholder="Anotações internas sobre este disparo..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Conexões WhatsApp * <span className="text-gray-500 font-normal">({connectionIds.length} selecionada{connectionIds.length === 1 ? "" : "s"})</span>
                </Label>
                <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
                  {connections.map((conn: ConnectionRow) => {
                    const checked = connectionIds.includes(conn.id);
                    return (
                      <label
                        key={conn.id}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(val) => {
                            setConnectionIds((prev) =>
                              val
                                ? Array.from(new Set([...prev, conn.id]))
                                : prev.filter((id) => id !== conn.id),
                            );
                          }}
                        />
                        <div className="flex-1 text-sm">
                          <div className="font-medium text-gray-900">
                            {conn.identification}
                            {conn.phoneNumber ? ` (${conn.phoneNumber})` : ""}
                          </div>
                          <div className={`text-xs ${conn.status === "connected" ? "text-green-600" : "text-gray-500"}`}>
                            {conn.status === "connected" ? "conectado" : "desconectado"}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <p>
                    O disparo distribui as mensagens em <strong>round-robin</strong> entre as conexões
                    selecionadas. Conexões com warmup esgotado são puladas automaticamente.
                  </p>
                  {connections.length > 1 && (
                    <button
                      type="button"
                      className="text-blue-600 hover:underline whitespace-nowrap ml-3"
                      onClick={() =>
                        setConnectionIds(
                          connectionIds.length === connections.length
                            ? []
                            : connections.map((c: ConnectionRow) => c.id),
                        )
                      }
                    >
                      {connectionIds.length === connections.length ? "Limpar" : "Selecionar todas"}
                    </button>
                  )}
                </div>
              </div>

              {/* Editor de variações */}
              <div className="space-y-3">
                <Label>Variações da mensagem *</Label>
                <p className="text-sm text-gray-500">
                  Escreva até {MAX_VARIANTS} versões da mensagem. Cada contato recebe uma
                  escolhida aleatoriamente — variar o texto reduz o risco de banimento. Use{" "}
                  <code className="px-1 bg-gray-100 rounded">{"{{nome}}"}</code> para inserir o
                  nome do contato.
                </p>
                {variants.map((variant, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-gray-500">Variação {idx + 1}</Label>
                      {variants.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-red-600"
                          onClick={() => removeVariant(idx)}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Remover
                        </Button>
                      )}
                    </div>
                    <Textarea
                      value={variant}
                      onChange={(e) => updateVariant(idx, e.target.value)}
                      placeholder="Ex: Oi {{nome}}, tudo bem? Temos uma novidade para você..."
                      rows={3}
                    />
                  </div>
                ))}
                {variants.length < MAX_VARIANTS && (
                  <Button variant="outline" size="sm" onClick={addVariant}>
                    <Plus className="w-3 h-3 mr-1" />
                    Adicionar variação
                  </Button>
                )}

                {nonEmptyVariants.length > 0 && (
                  <div className="p-3 bg-gray-50 border rounded-lg space-y-2">
                    <p className="text-xs font-medium text-gray-500">
                      Pré-visualização (nome de exemplo: "Maria")
                    </p>
                    {nonEmptyVariants.map((v, i) => (
                      <p
                        key={i}
                        className="text-sm text-gray-700 whitespace-pre-wrap border-l-2 border-blue-300 pl-2"
                      >
                        {v.replace(/\{\{\s*nome\s*\}\}/gi, "Maria")}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Mídia opcional */}
              <div className="space-y-3 border-t pt-6">
                <Label>Mídia (opcional)</Label>
                <p className="text-sm text-gray-500">
                  Anexe uma imagem, documento ou áudio enviado para todos. Para imagem e
                  documento, as variações da mensagem viram a legenda; em áudio o texto é
                  ignorado (WhatsApp não permite legenda em áudio).
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select
                      value={mediaType || "none"}
                      onValueChange={(v) => setMediaType((v === "none" ? "" : v) as "" | "image" | "document" | "audio")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem mídia</SelectItem>
                        <SelectItem value="image">Imagem</SelectItem>
                        <SelectItem value="document">Documento</SelectItem>
                        <SelectItem value="audio">Áudio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {mediaConfigured && (
                    <div className="space-y-1">
                      <Label className="text-xs">URL pública</Label>
                      <Input
                        value={mediaUrl}
                        onChange={(e) => setMediaUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  )}
                </div>
                {mediaConfigured && mediaType === "document" && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome do arquivo</Label>
                      <Input
                        value={mediaFileName}
                        onChange={(e) => setMediaFileName(e.target.value)}
                        placeholder="contrato.pdf"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Mimetype</Label>
                      <Input
                        value={mediaMimeType}
                        onChange={(e) => setMediaMimeType(e.target.value)}
                        placeholder="application/pdf"
                      />
                    </div>
                  </div>
                )}
                {mediaConfigured && mediaType === "audio" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Mimetype (opcional)</Label>
                    <Input
                      value={mediaMimeType}
                      onChange={(e) => setMediaMimeType(e.target.value)}
                      placeholder="audio/mp4"
                    />
                  </div>
                )}
                {mediaConfigured && !mediaUrl.trim() && (
                  <p className="text-xs text-red-600">
                    Informe a URL pública da mídia.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Passo 2 — Destinatários */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Destinatários
              </CardTitle>
              <CardDescription>Escolha de onde vêm os contatos deste disparo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup
                value={recipientSource}
                onValueChange={(val) => setRecipientSource(val as "list" | "paste" | "csv")}
                className="grid sm:grid-cols-3 gap-3"
              >
                <Label
                  htmlFor="src-list"
                  className="flex items-center gap-2 border rounded-lg p-3 cursor-pointer has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50"
                >
                  <RadioGroupItem value="list" id="src-list" />
                  <List className="w-4 h-4" />
                  Lista de contatos
                </Label>
                <Label
                  htmlFor="src-paste"
                  className="flex items-center gap-2 border rounded-lg p-3 cursor-pointer has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50"
                >
                  <RadioGroupItem value="paste" id="src-paste" />
                  <ClipboardList className="w-4 h-4" />
                  Colar números
                </Label>
                <Label
                  htmlFor="src-csv"
                  className="flex items-center gap-2 border rounded-lg p-3 cursor-pointer has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50"
                >
                  <RadioGroupItem value="csv" id="src-csv" />
                  <FileText className="w-4 h-4" />
                  Importar CSV
                </Label>
              </RadioGroup>

              {recipientSource === "list" && (
                <div className="space-y-2">
                  <Label>Lista de contatos</Label>
                  {contactLists && contactLists.length > 0 ? (
                    <Select
                      value={selectedListId?.toString() ?? ""}
                      onValueChange={(val) => setSelectedListId(parseInt(val, 10))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma lista" />
                      </SelectTrigger>
                      <SelectContent>
                        {contactLists.map((list) => (
                          <SelectItem key={list.id} value={list.id.toString()}>
                            {list.name} ({list.totalContacts} contatos)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      Nenhuma lista de contatos. Crie uma na página de Disparos.
                    </p>
                  )}
                  {selectedListId && (
                    <p className="text-sm text-gray-600">
                      {isLoadingListContacts
                        ? "Carregando contatos..."
                        : `${listContacts?.length ?? 0} contato(s) ativo(s) nesta lista`}
                    </p>
                  )}
                </div>
              )}

              {recipientSource === "paste" && (
                <div className="space-y-2">
                  <Label htmlFor="paste">Números (um por linha)</Label>
                  <Textarea
                    id="paste"
                    placeholder={"5511999999999\n5511888888888"}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={8}
                  />
                  <p className="text-xs text-gray-500">
                    Use o formato internacional (código do país + DDD + número).{" "}
                    {pasteParsed.length} número(s) válido(s) detectado(s).
                  </p>
                </div>
              )}

              {recipientSource === "csv" && (
                <div className="space-y-2">
                  <Label htmlFor="csv">Conteúdo CSV</Label>
                  <Textarea
                    id="csv"
                    placeholder={"telefone,nome,empresa\n5511999999999,Maria,Blue\n5511888888888,João,Acme"}
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    rows={8}
                  />
                  <p className="text-xs text-gray-500">
                    Colunas separadas por vírgula, ponto-e-vírgula ou tab. A 1ª coluna é o
                    telefone; se houver cabeçalho, colunas extras viram variáveis{" "}
                    <code className="px-1 bg-gray-100 rounded">{"{{campo}}"}</code>.
                  </p>
                  <p className="text-sm text-gray-600">
                    {csvParsed.recipients.length} destinatário(s) válido(s)
                    {csvParsed.ignored > 0 ? ` · ${csvParsed.ignored} linha(s) ignorada(s)` : ""}
                    {csvParsed.variableNames.length > 0
                      ? ` · variáveis: ${csvParsed.variableNames.join(", ")}`
                      : ""}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-700">
                  {finalRecipients.length} destinatário(s) selecionado(s) para este disparo
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Passo 3 — Envio */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                Configurações de envio
              </CardTitle>
              <CardDescription>Agendamento, proteção anti-ban e reenvio</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Agendamento */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Agendar envio
                    </Label>
                    <p className="text-xs text-gray-500">
                      Se desligado, o disparo começa assim que você clicar em "Iniciar".
                    </p>
                  </div>
                  <Switch checked={isScheduled} onCheckedChange={setIsScheduled} />
                </div>
                {isScheduled && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="date" className="text-xs">Data</Label>
                      <Input
                        id="date"
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="time" className="text-xs">Horário</Label>
                      <Input
                        id="time"
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t pt-6 space-y-3">
                <Label className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Proteção anti-ban
                </Label>
                <p className="text-xs text-gray-500">
                  As mensagens são enviadas com um intervalo aleatório entre o mínimo e o máximo
                  abaixo. Intervalos maiores e irregulares reduzem o risco de banimento.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="minDelay" className="text-xs">Intervalo mínimo (segundos)</Label>
                    <Input
                      id="minDelay"
                      type="number"
                      min={1}
                      max={3600}
                      value={minDelaySeconds}
                      onChange={(e) => setMinDelaySeconds(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="maxDelay" className="text-xs">Intervalo máximo (segundos)</Label>
                    <Input
                      id="maxDelay"
                      type="number"
                      min={1}
                      max={3600}
                      value={maxDelaySeconds}
                      onChange={(e) => setMaxDelaySeconds(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    />
                  </div>
                </div>
                {maxDelaySeconds < minDelaySeconds && (
                  <p className="text-xs text-red-600">
                    O intervalo máximo deve ser maior ou igual ao mínimo.
                  </p>
                )}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <Label className="text-sm">Limite diário de mensagens</Label>
                    <p className="text-xs text-gray-500">
                      Útil para aquecer números novos. Ao atingir o limite, o disparo continua no
                      dia seguinte.
                    </p>
                  </div>
                  <Switch checked={dailyLimitEnabled} onCheckedChange={setDailyLimitEnabled} />
                </div>
                {dailyLimitEnabled && (
                  <div className="space-y-1">
                    <Label htmlFor="dailyLimit" className="text-xs">Mensagens por dia</Label>
                    <Input
                      id="dailyLimit"
                      type="number"
                      min={1}
                      max={100000}
                      value={dailyLimit}
                      onChange={(e) => setDailyLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    />
                  </div>
                )}
              </div>

              {/* Reenvio */}
              <div className="border-t pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Reenvio automático de falhas</Label>
                    <p className="text-xs text-gray-500">
                      Tenta reenviar automaticamente as mensagens que falharem.
                    </p>
                  </div>
                  <Switch checked={autoRetryEnabled} onCheckedChange={setAutoRetryEnabled} />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Máximo de tentativas</Label>
                    <Select
                      value={maxRetries.toString()}
                      onValueChange={(val) => setMaxRetries(parseInt(val, 10))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3, 5, 10].map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n} {n === 1 ? "tentativa" : "tentativas"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Intervalo entre tentativas</Label>
                    <Select
                      value={retryDelayMinutes.toString()}
                      onValueChange={(val) => setRetryDelayMinutes(parseInt(val, 10))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[15, 30, 60, 120, 360, 1440].map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n < 60 ? `${n} minutos` : `${n / 60} hora(s)`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Resumo */}
              <div className="border-t pt-6">
                <p className="text-sm font-medium text-gray-700 mb-2">Resumo</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• {nonEmptyVariants.length} variação(ões) de mensagem</li>
                  <li>• {finalRecipients.length} destinatário(s)</li>
                  <li>• Intervalo de {minDelaySeconds}s a {maxDelaySeconds}s entre mensagens</li>
                  {dailyLimitEnabled && <li>• Limite de {dailyLimit} mensagens/dia</li>}
                  <li>
                    • {isScheduled
                      ? `Agendado para ${scheduledDate || "—"} ${scheduledTime || ""}`
                      : "Início manual"}
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navegação */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={(step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2)}
            >
              Próximo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={isSubmitting || !canProceedStep2}>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Criar Disparo
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
