import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Save,
  Upload,
  Plus,
  Trash2,
  Users,
  User,
  FileText,
  Settings,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";

interface Recipient {
  phoneNumber: string;
  name?: string;
  variables?: Record<string, string>;
}

interface TemplateComponent {
  type: string;
  format?: string;
  text?: string;
  example?: {
    body_text?: string[][];
    header_text?: string[];
    body_text_named_params?: Array<{
      param_name: string;
      example: string;
    }>;
  };
}

export default function CampaignNew() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("pt_BR");
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [variableUseRecipientName, setVariableUseRecipientName] = useState<Record<string, boolean>>({});
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [newRecipient, setNewRecipient] = useState({ phoneNumber: "", name: "" });
  const [csvText, setCsvText] = useState("");

  // Scheduling state
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  // Retry configuration state
  const [autoRetryEnabled, setAutoRetryEnabled] = useState(true);
  const [maxRetries, setMaxRetries] = useState(3);
  const [retryDelayMinutes, setRetryDelayMinutes] = useState(30);

  // Queries
  const { data: businessAccounts, isLoading: isLoadingAccounts } = trpc.whatsappBusiness.list.useQuery(undefined, {
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const { data: templates, isLoading: isLoadingTemplates } = trpc.whatsappBusiness.getTemplates.useQuery(
    { accountId: businessAccountId! },
    {
      enabled: !!businessAccountId,
      refetchInterval: false,
      refetchOnWindowFocus: false,
    }
  );

  const utils = trpc.useUtils();

  // Mutations
  const createCampaignMutation = trpc.campaigns.create.useMutation({
    onSuccess: (data) => {
      // Add recipients
      if (recipients.length > 0) {
        addRecipientsMutation.mutate({
          campaignId: data.id,
          recipients: recipients.map((r) => ({
            phoneNumber: r.phoneNumber,
            name: r.name,
            variables: r.variables ? JSON.stringify(r.variables) : undefined,
          })),
        });
      } else {
        toast.success("Campanha criada com sucesso!");
        navigate(`/campaigns/${data.id}`);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const addRecipientsMutation = trpc.campaigns.addRecipients.useMutation({
    onSuccess: (_, variables) => {
      toast.success("Campanha criada com sucesso!");
      // Get campaign ID from the create mutation result
      const campaignId = createCampaignMutation.data?.id;
      if (campaignId) {
        navigate(`/campaigns/${campaignId}`);
      } else {
        navigate("/campaigns");
      }
    },
    onError: (error) => {
      toast.error(`Campanha criada, mas erro ao adicionar destinatarios: ${error.message}`);
      navigate("/campaigns");
    },
  });

  const syncTemplatesMutation = trpc.whatsappBusiness.syncTemplates.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} templates sincronizados!`);
      utils.whatsappBusiness.getTemplates.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Get selected template
  const selectedTemplate = useMemo(() => {
    if (!templates || !templateName) return null;
    return templates.find((t) => t.name === templateName);
  }, [templates, templateName]);

  // Extract variables from template (supports both {{1}} and {{name}} formats)
  const templateVariableNames = useMemo(() => {
    if (!selectedTemplate) return [];

    const variables: string[] = [];
    const components = selectedTemplate.components as TemplateComponent[];

    components.forEach((component) => {
      if (component.type === "BODY" && component.text) {
        // Extract all variables: {{1}}, {{2}}, {{name}}, {{nome_do_lead}}, etc.
        const matches = component.text.match(/\{\{([^}]+)\}\}/g);
        if (matches) {
          matches.forEach((match) => {
            const varName = match.replace(/[{}]/g, "").trim();
            if (!variables.includes(varName)) {
              variables.push(varName);
            }
          });
        }
      }
      
      // Also check for named params in example section
      if (component.type === "BODY" && component.example?.body_text_named_params) {
        component.example.body_text_named_params.forEach((param: any) => {
          if (param.param_name && !variables.includes(param.param_name)) {
            variables.push(param.param_name);
          }
        });
      }
    });

    // Sort: numbers first (numerically), then strings (alphabetically)
    return variables.sort((a, b) => {
      const aIsNum = /^\d+$/.test(a);
      const bIsNum = /^\d+$/.test(b);
      if (aIsNum && bIsNum) return parseInt(a) - parseInt(b);
      if (aIsNum) return -1;
      if (bIsNum) return 1;
      return a.localeCompare(b);
    });
  }, [selectedTemplate]);

  // Get template preview text
  const templatePreviewText = useMemo(() => {
    if (!selectedTemplate) return "";

    const components = selectedTemplate.components as TemplateComponent[];
    const bodyComponent = components.find((c) => c.type === "BODY");

    if (!bodyComponent?.text) return "";

    let text = bodyComponent.text;
    templateVariableNames.forEach((varName) => {
      let value: string;
      if (variableUseRecipientName[varName]) {
        value = "[Nome do Destinatário]";
      } else {
        value = templateVariables[varName] || `{{${varName}}}`;
      }
      // Escape special regex characters in variable name
      const escapedVarName = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(new RegExp(`\\{\\{${escapedVarName}\\}\\}`, "g"), value);
    });

    return text;
  }, [selectedTemplate, templateVariables, templateVariableNames, variableUseRecipientName]);

  // Approved templates only
  const approvedTemplates = useMemo(() => {
    return templates?.filter((t) => t.status === "APPROVED") || [];
  }, [templates]);

  // Handle CSV import
  const handleImportCSV = () => {
    if (!csvText.trim()) {
      toast.error("Cole o conteudo CSV primeiro");
      return;
    }

    const lines = csvText.trim().split("\n");
    const newRecipients: Recipient[] = [];

    lines.forEach((line, index) => {
      const parts = line.split(/[,;\t]/).map((p) => p.trim());
      if (parts.length > 0 && parts[0]) {
        // Clean phone number
        const phoneNumber = parts[0].replace(/\D/g, "");
        if (phoneNumber.length >= 10) {
          newRecipients.push({
            phoneNumber,
            name: parts[1] || undefined,
          });
        }
      }
    });

    if (newRecipients.length === 0) {
      toast.error("Nenhum numero valido encontrado");
      return;
    }

    setRecipients((prev) => [...prev, ...newRecipients]);
    setCsvText("");
    toast.success(`${newRecipients.length} destinatarios adicionados`);
  };

  // Handle add single recipient
  const handleAddRecipient = () => {
    const phoneNumber = newRecipient.phoneNumber.replace(/\D/g, "");
    if (phoneNumber.length < 10) {
      toast.error("Numero de telefone invalido");
      return;
    }

    setRecipients((prev) => [
      ...prev,
      { phoneNumber, name: newRecipient.name || undefined },
    ]);
    setNewRecipient({ phoneNumber: "", name: "" });
  };

  // Handle remove recipient
  const handleRemoveRecipient = (index: number) => {
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle create campaign
  const handleCreate = () => {
    if (!name.trim()) {
      toast.error("Nome da campanha e obrigatorio");
      return;
    }
    if (!businessAccountId) {
      toast.error("Selecione uma conta WhatsApp Business");
      return;
    }
    if (!templateName) {
      toast.error("Selecione um template");
      return;
    }
    if (recipients.length === 0) {
      toast.error("Adicione pelo menos um destinatario");
      return;
    }

    // Validate scheduling
    let scheduledAt: Date | undefined;
    if (isScheduled) {
      if (!scheduledDate || !scheduledTime) {
        toast.error("Selecione a data e horario para o agendamento");
        return;
      }
      scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
      if (scheduledAt <= new Date()) {
        toast.error("A data de agendamento deve ser no futuro");
        return;
      }
    }

    // Build template variables with special marker for recipient name
    const finalTemplateVariables: Record<string, string> = { ...templateVariables };
    
    // Add special marker for variables that use recipient name
    Object.entries(variableUseRecipientName).forEach(([varName, useRecipient]) => {
      if (useRecipient) {
        finalTemplateVariables[varName] = "__RECIPIENT_NAME__";
      }
    });

    createCampaignMutation.mutate({
      businessAccountId,
      name: name.trim(),
      description: description.trim() || undefined,
      templateName,
      templateLanguage,
      templateVariables: Object.keys(finalTemplateVariables).length > 0
        ? JSON.stringify(finalTemplateVariables)
        : undefined,
      scheduledAt: scheduledAt?.toISOString(),
      // Retry configuration
      autoRetryEnabled,
      maxRetries,
      retryDelayMinutes,
    });
  };

  // Step validation
  const canProceedToStep2 = !!businessAccountId && !!templateName;
  const canProceedToStep3 = templateVariableNames.length === 0 || Object.keys(templateVariables).length > 0;
  const canCreate = !!name && recipients.length > 0;

  if (isLoadingAccounts) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    );
  }

  if (!businessAccounts || businessAccounts.length === 0) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" asChild>
            <Link href="/campaigns">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Link>
          </Button>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-yellow-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Configure o WhatsApp Business primeiro
              </h3>
              <p className="text-gray-500 text-center max-w-md mb-4">
                Para criar campanhas, voce precisa conectar uma conta da API oficial do WhatsApp Business.
              </p>
              <Button asChild>
                <Link href="/whatsapp-business">
                  Configurar WhatsApp Business
                </Link>
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
            <Link href="/campaigns">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Nova Campanha</h1>
            <p className="text-gray-600 mt-1">
              Crie uma campanha de marketing via WhatsApp Business API
            </p>
          </div>
        </div>

        {/* Steps Indicator */}
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
                {s === 1 ? "Template" : s === 2 ? "Variaveis" : "Destinatarios"}
              </span>
              {s < 3 && <div className="w-12 h-0.5 bg-gray-200" />}
            </div>
          ))}
        </div>

        {/* Step 1: Select Template */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Selecionar Template
              </CardTitle>
              <CardDescription>
                Escolha a conta e o template de mensagem aprovado pela Meta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Campaign Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Campanha *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Black Friday 2024"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Descricao (opcional)</Label>
                <Textarea
                  id="description"
                  placeholder="Descricao da campanha..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Business Account */}
              <div className="space-y-2">
                <Label>Conta WhatsApp Business *</Label>
                <Select
                  value={businessAccountId?.toString() || ""}
                  onValueChange={(val) => {
                    setBusinessAccountId(parseInt(val));
                    setTemplateName("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id.toString()}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Templates */}
              {businessAccountId && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Template de Mensagem *</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => syncTemplatesMutation.mutate({ accountId: businessAccountId })}
                      disabled={syncTemplatesMutation.isPending}
                    >
                      {syncTemplatesMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : null}
                      Sincronizar Templates
                    </Button>
                  </div>

                  {isLoadingTemplates ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : approvedTemplates.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>Nenhum template aprovado encontrado.</p>
                      <p className="text-sm">Sincronize os templates ou crie um no Meta Business Suite.</p>
                    </div>
                  ) : (
                    <div className="grid gap-2 max-h-64 overflow-y-auto">
                      {approvedTemplates.map((template) => (
                        <div
                          key={template.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            templateName === template.name
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                          onClick={() => {
                            setTemplateName(template.name);
                            setTemplateLanguage(template.language);
                            setTemplateVariables({});
                            setVariableUseRecipientName({});
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{template.name}</p>
                              <p className="text-sm text-gray-500">
                                {template.category} | {template.language}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {template.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Template Preview */}
              {selectedTemplate && (
                <div className="space-y-2">
                  <Label>Preview do Template</Label>
                  <div className="p-4 bg-gray-50 rounded-lg border">
                    <p className="text-sm whitespace-pre-wrap">
                      {(selectedTemplate.components as TemplateComponent[])
                        .find((c) => c.type === "BODY")?.text || "Sem conteudo"}
                    </p>
                  </div>
                </div>
              )}

              {/* Next Button */}
              <div className="flex justify-end pt-4">
                <Button onClick={() => setStep(2)} disabled={!canProceedToStep2}>
                  Proximo
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Variables */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Configurar Variaveis
              </CardTitle>
              <CardDescription>
                Preencha os valores padrao para as variaveis do template
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {templateVariableNames.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
                  <p>Este template nao possui variaveis.</p>
                  <p className="text-sm">Continue para adicionar destinatarios.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {templateVariableNames.map((varName) => {
                      // Find example for this variable if available
                      const components = selectedTemplate?.components as TemplateComponent[];
                      const bodyComponent = components?.find((c) => c.type === "BODY");
                      const namedParam = bodyComponent?.example?.body_text_named_params?.find(
                        (p) => p.param_name === varName
                      );
                      const exampleValue = namedParam?.example;
                      const useRecipientName = variableUseRecipientName[varName] || false;
                      
                      return (
                        <div key={varName} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`var-${varName}`}>
                              Variavel {`{{${varName}}}`}
                              {exampleValue && (
                                <span className="text-gray-400 font-normal ml-2">
                                  (ex: {exampleValue})
                                </span>
                              )}
                            </Label>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`use-recipient-${varName}`}
                                checked={useRecipientName}
                                onCheckedChange={(checked) => {
                                  setVariableUseRecipientName((prev) => ({
                                    ...prev,
                                    [varName]: checked === true,
                                  }));
                                  // Clear the manual value when using recipient name
                                  if (checked) {
                                    setTemplateVariables((prev) => {
                                      const newVars = { ...prev };
                                      delete newVars[varName];
                                      return newVars;
                                    });
                                  }
                                }}
                              />
                              <Label
                                htmlFor={`use-recipient-${varName}`}
                                className="text-sm font-normal text-gray-600 cursor-pointer flex items-center gap-1"
                              >
                                <User className="w-3 h-3" />
                                Usar nome do destinatario
                              </Label>
                            </div>
                          </div>
                          {useRecipientName ? (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-sm text-blue-700">
                              <User className="w-4 h-4" />
                              Esta variavel usara automaticamente o nome de cada destinatario
                            </div>
                          ) : (
                            <Input
                              id={`var-${varName}`}
                              placeholder={exampleValue || `Valor para {{${varName}}}`}
                              value={templateVariables[varName] || ""}
                              onChange={(e) =>
                                setTemplateVariables((prev) => ({
                                  ...prev,
                                  [varName]: e.target.value,
                                }))
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Live Preview */}
                  <div className="space-y-2">
                    <Label>Preview da Mensagem</Label>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm whitespace-pre-wrap">{templatePreviewText}</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      Os valores podem ser personalizados por destinatario
                    </p>
                  </div>
                </>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
                <Button onClick={() => setStep(3)}>
                  Proximo
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Recipients */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Adicionar Destinatarios
              </CardTitle>
              <CardDescription>
                Adicione os numeros de telefone que receberao a campanha
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Tabs defaultValue="manual">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual">Adicionar Manual</TabsTrigger>
                  <TabsTrigger value="csv">Importar CSV</TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="space-y-4 mt-4">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Numero (ex: 5511999999999)"
                        value={newRecipient.phoneNumber}
                        onChange={(e) =>
                          setNewRecipient((prev) => ({ ...prev, phoneNumber: e.target.value }))
                        }
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        placeholder="Nome (opcional)"
                        value={newRecipient.name}
                        onChange={(e) =>
                          setNewRecipient((prev) => ({ ...prev, name: e.target.value }))
                        }
                      />
                    </div>
                    <Button onClick={handleAddRecipient}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="csv" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Cole aqui os dados CSV (telefone,nome)&#10;Exemplo:&#10;5511999999999,Joao&#10;5511888888888,Maria"
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                      rows={6}
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-gray-500">
                        Formato: numero,nome (separados por virgula, ponto-e-virgula ou tab)
                      </p>
                      <Button onClick={handleImportCSV} size="sm">
                        <Upload className="w-4 h-4 mr-2" />
                        Importar
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Recipients List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Destinatarios ({recipients.length})</Label>
                  {recipients.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={() => setRecipients([])}
                    >
                      Limpar Todos
                    </Button>
                  )}
                </div>

                {recipients.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border rounded-lg">
                    <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>Nenhum destinatario adicionado</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                    {recipients.map((recipient, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 hover:bg-gray-50"
                      >
                        <div>
                          <p className="font-medium">{recipient.phoneNumber}</p>
                          {recipient.name && (
                            <p className="text-sm text-gray-500">{recipient.name}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveRecipient(index)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Scheduling */}
              <div className="space-y-4 border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium">Agendar Envio</p>
                      <p className="text-sm text-gray-500">Defina uma data e horario para o envio automatico</p>
                    </div>
                  </div>
                  <Switch
                    checked={isScheduled}
                    onCheckedChange={setIsScheduled}
                  />
                </div>

                {isScheduled && (
                  <div className="grid sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="scheduledDate" className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Data
                      </Label>
                      <Input
                        id="scheduledDate"
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="scheduledTime" className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Horario
                      </Label>
                      <Input
                        id="scheduledTime"
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Retry Configuration */}
              <div className="space-y-4 border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium">Retry Automatico</p>
                      <p className="text-sm text-gray-500">Retentar automaticamente mensagens que falharem</p>
                    </div>
                  </div>
                  <Switch
                    checked={autoRetryEnabled}
                    onCheckedChange={setAutoRetryEnabled}
                  />
                </div>

                {autoRetryEnabled && (
                  <div className="grid sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="maxRetries">Max. Tentativas</Label>
                      <Select
                        value={maxRetries.toString()}
                        onValueChange={(val) => setMaxRetries(parseInt(val))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <SelectItem key={n} value={n.toString()}>
                              {n} {n === 1 ? "tentativa" : "tentativas"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="retryDelay">Intervalo entre Retries</Label>
                      <Select
                        value={retryDelayMinutes.toString()}
                        onValueChange={(val) => setRetryDelayMinutes(parseInt(val))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 minutos</SelectItem>
                          <SelectItem value="30">30 minutos</SelectItem>
                          <SelectItem value="60">1 hora</SelectItem>
                          <SelectItem value="120">2 horas</SelectItem>
                          <SelectItem value="360">6 horas</SelectItem>
                          <SelectItem value="720">12 horas</SelectItem>
                          <SelectItem value="1440">24 horas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Resumo da Campanha</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li><strong>Nome:</strong> {name || "-"}</li>
                  <li><strong>Template:</strong> {templateName || "-"}</li>
                  <li><strong>Destinatarios:</strong> {recipients.length}</li>
                  {isScheduled && scheduledDate && scheduledTime && (
                    <li className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <strong>Agendado para:</strong> {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString('pt-BR')}
                    </li>
                  )}
                  {!isScheduled && (
                    <li><strong>Envio:</strong> Imediato (apos criar)</li>
                  )}
                  <li className="flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    <strong>Auto-retry:</strong> {autoRetryEnabled
                      ? `${maxRetries} tentativas, intervalo de ${retryDelayMinutes}min`
                      : "Desativado"}
                  </li>
                </ul>
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!canCreate || createCampaignMutation.isPending || addRecipientsMutation.isPending}
                >
                  {createCampaignMutation.isPending || addRecipientsMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Criar Campanha
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
