import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Phone,
  CheckCircle2,
  XCircle,
  Building2,
  Key,
  FileText,
  ExternalLink,
  Send,
  MessageSquare,
  PlusCircle,
  Info,
  Edit,
  Search,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BlacklistManager from "@/components/BlacklistManager";
import { TemplatePicker, foldText } from "@/components/TemplatePicker";
import { TemplatePreviewButton, type PreviewComponent } from "@/components/TemplatePreview";

interface TemplateComponent {
  type: string;
  text?: string;
  example?: {
    body_text_named_params?: Array<{
      param_name: string;
      example: string;
    }>;
  };
}

interface TemplateButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phoneNumber?: string;
}

export default function WhatsAppBusiness() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [isCreateTemplateDialogOpen, setIsCreateTemplateDialogOpen] = useState(false);
  
  // Test message state
  const [testAccountId, setTestAccountId] = useState<number | null>(null);
  const [testTemplateName, setTestTemplateName] = useState("");
  const [testTemplateLanguage, setTestTemplateLanguage] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});
  
  // Create template state
  const [createTemplateAccountId, setCreateTemplateAccountId] = useState<number | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    language: "pt_BR",
    category: "MARKETING" as "UTILITY" | "MARKETING" | "AUTHENTICATION",
    headerType: "NONE" as "NONE" | "TEXT",
    headerText: "",
    bodyText: "",
    footerText: "",
    buttons: [] as TemplateButton[],
    variableType: "NAMED" as "NAMED" | "POSITIONAL",
    variableExamples: {} as Record<string, string>,
  });
  
  const [newAccount, setNewAccount] = useState({
    name: "",
    phoneNumberId: "",
    businessAccountId: "",
    accessToken: "",
  });

  const { data: accounts, isLoading, refetch } = trpc.whatsappBusiness.list.useQuery(undefined, {
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const { data: testTemplates } = trpc.whatsappBusiness.getTemplates.useQuery(
    { accountId: testAccountId! },
    { enabled: !!testAccountId }
  );

  const utils = trpc.useUtils();

  const createMutation = trpc.whatsappBusiness.create.useMutation({
    onSuccess: () => {
      toast.success("Conta adicionada com sucesso!");
      setIsAddDialogOpen(false);
      setNewAccount({ name: "", phoneNumberId: "", businessAccountId: "", accessToken: "" });
      utils.whatsappBusiness.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.whatsappBusiness.delete.useMutation({
    onSuccess: () => {
      toast.success("Conta removida com sucesso!");
      utils.whatsappBusiness.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const syncTemplatesMutation = trpc.whatsappBusiness.syncTemplates.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} templates sincronizados!`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const testMessageMutation = trpc.whatsappBusiness.testMessage.useMutation({
    onSuccess: (data) => {
      toast.success(`Mensagem enviada! ID: ${data.messageId}`);
      setIsTestDialogOpen(false);
      setTestPhone("");
      setTestVariables({});
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const createTemplateMutation = trpc.whatsappBusiness.createTemplate.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        // Template foi rejeitado pela Meta
        toast.error(data.message, {
          duration: 10000, // Mostra por mais tempo para o usuário ler
        });
      }
      setIsCreateTemplateDialogOpen(false);
      resetNewTemplate();
      utils.whatsappBusiness.getTemplates.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetNewTemplate = () => {
    setNewTemplate({
      name: "",
      language: "pt_BR",
      category: "MARKETING",
      headerType: "NONE",
      headerText: "",
      bodyText: "",
      footerText: "",
      buttons: [],
      variableType: "NAMED",
      variableExamples: {},
    });
    setCreateTemplateAccountId(null);
  };

  // Detectar variáveis no texto do template
  const detectedVariables = useMemo(() => {
    const matches = newTemplate.bodyText.match(/\{\{([^}]+)\}\}/g) || [];
    return [...new Set(matches)].map(v => v.replace(/[{}]/g, "").trim());
  }, [newTemplate.bodyText]);

  // Atualizar exemplo de variável
  const updateVariableExample = (varName: string, example: string) => {
    setNewTemplate(prev => ({
      ...prev,
      variableExamples: {
        ...prev.variableExamples,
        [varName]: example,
      },
    }));
  };

  const addButton = () => {
    if (newTemplate.buttons.length >= 3) {
      toast.error("Máximo de 3 botões permitidos");
      return;
    }
    setNewTemplate(prev => ({
      ...prev,
      buttons: [...prev.buttons, { type: "QUICK_REPLY", text: "" }],
    }));
  };

  const removeButton = (index: number) => {
    setNewTemplate(prev => ({
      ...prev,
      buttons: prev.buttons.filter((_, i) => i !== index),
    }));
  };

  const updateButton = (index: number, updates: Partial<TemplateButton>) => {
    setNewTemplate(prev => ({
      ...prev,
      buttons: prev.buttons.map((btn, i) => i === index ? { ...btn, ...updates } : btn),
    }));
  };

  const handleCreateTemplate = () => {
    if (!createTemplateAccountId) {
      toast.error("Selecione uma conta");
      return;
    }
    if (!newTemplate.name.trim()) {
      toast.error("Nome do template é obrigatório");
      return;
    }
    if (!newTemplate.bodyText.trim()) {
      toast.error("Corpo da mensagem é obrigatório");
      return;
    }

    createTemplateMutation.mutate({
      accountId: createTemplateAccountId,
      name: newTemplate.name,
      language: newTemplate.language,
      category: newTemplate.category,
      headerType: newTemplate.headerType,
      headerText: newTemplate.headerType === "TEXT" ? newTemplate.headerText : undefined,
      bodyText: newTemplate.bodyText,
      footerText: newTemplate.footerText || undefined,
      buttons: newTemplate.buttons.length > 0 ? newTemplate.buttons : undefined,
    });
  };

  // Get selected template for test
  const selectedTestTemplate = useMemo(() => {
    if (!testTemplates || !testTemplateName) return null;
    return testTemplates.find((t) => t.name === testTemplateName);
  }, [testTemplates, testTemplateName]);

  // Extract variables from selected test template
  const testTemplateVariables = useMemo(() => {
    if (!selectedTestTemplate) return [];
    
    const variables: string[] = [];
    const components = selectedTestTemplate.components as TemplateComponent[];
    
    components.forEach((component) => {
      if (component.type === "BODY" && component.text) {
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
    });
    
    return variables;
  }, [selectedTestTemplate]);

  // Handle send test message
  const handleSendTest = () => {
    if (!testAccountId || !testTemplateName || !testPhone) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // Build body params in order
    const bodyParams = testTemplateVariables.map((varName) => ({
      value: testVariables[varName] || "",
      parameterName: /^\d+$/.test(varName) ? undefined : varName,
    })).filter(p => p.value);

    testMessageMutation.mutate({
      accountId: testAccountId,
      recipientPhone: testPhone,
      templateName: testTemplateName,
      templateLanguage: testTemplateLanguage || "pt_BR",
      bodyParams: bodyParams.length > 0 ? bodyParams : undefined,
    });
  };

  const handleAddAccount = () => {
    if (!newAccount.name || !newAccount.phoneNumberId || !newAccount.businessAccountId || !newAccount.accessToken) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    createMutation.mutate(newAccount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Barra de ações — o título da página é do shell (Disparos via API Oficial). */}
        <div className="flex justify-end items-start">
          <div className="flex gap-2">
            {/* Test Message Button */}
            {accounts && accounts.length > 0 && (
              <Dialog open={isTestDialogOpen} onOpenChange={(open) => {
                setIsTestDialogOpen(open);
                if (!open) {
                  setTestAccountId(null);
                  setTestTemplateName("");
                  setTestTemplateLanguage("");
                  setTestPhone("");
                  setTestVariables({});
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Send className="w-4 h-4 mr-2" />
                    Enviar Teste
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      Enviar Mensagem de Teste
                    </DialogTitle>
                    <DialogDescription>
                      Teste um template de mensagem antes de criar uma campanha
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {/* Account Selection */}
                    <div className="space-y-2">
                      <Label>Conta WhatsApp Business *</Label>
                      <Select
                        value={testAccountId?.toString() || ""}
                        onValueChange={(val) => {
                          setTestAccountId(parseInt(val));
                          setTestTemplateName("");
                          setTestTemplateLanguage("");
                          setTestVariables({});
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma conta" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id.toString()}>
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Template Selection */}
                    {testAccountId && (
                      <div className="space-y-2">
                        <Label>Template de Mensagem *</Label>
                        <TemplatePicker
                          // Remonta ao trocar de conta: sem isto, a busca digitada para a conta
                          // anterior continuaria filtrando a lista da nova, que apareceria vazia.
                          key={testAccountId}
                          templates={(testTemplates ?? []).filter(t => t.status === "APPROVED")}
                          value={testTemplateName}
                          onSelect={(template) => {
                            setTestTemplateName(template.name);
                            setTestTemplateLanguage(template.language);
                            setTestVariables({});
                          }}
                          emptyMessage="Nenhum template aprovado nesta conta. Sincronize os templates."
                        />
                      </div>
                    )}

                    {/* Phone Number */}
                    <div className="space-y-2">
                      <Label>Número de Telefone *</Label>
                      <Input
                        placeholder="Ex: 5511999999999"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                      />
                      <p className="text-xs text-gray-500">
                        Com código do país (55 para Brasil)
                      </p>
                    </div>

                    {/* Template Variables */}
                    {testTemplateVariables.length > 0 && (
                      <div className="space-y-3">
                        <Label>Variáveis do Template</Label>
                        {testTemplateVariables.map((varName) => {
                          const components = selectedTestTemplate?.components as TemplateComponent[];
                          const bodyComponent = components?.find((c) => c.type === "BODY");
                          const namedParam = bodyComponent?.example?.body_text_named_params?.find(
                            (p) => p.param_name === varName
                          );
                          
                          return (
                            <div key={varName} className="space-y-1">
                              <Label className="text-sm font-normal">
                                {`{{${varName}}}`}
                                {namedParam?.example && (
                                  <span className="text-gray-400 ml-2">(ex: {namedParam.example})</span>
                                )}
                              </Label>
                              <Input
                                placeholder={namedParam?.example || `Valor para {{${varName}}}`}
                                value={testVariables[varName] || ""}
                                onChange={(e) => setTestVariables(prev => ({
                                  ...prev,
                                  [varName]: e.target.value,
                                }))}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Template Preview */}
                    {selectedTestTemplate && (
                      <div className="space-y-2">
                        <Label>Preview do Template</Label>
                        <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                          {(() => {
                            const components = selectedTestTemplate.components as TemplateComponent[];
                            const bodyComponent = components.find((c) => c.type === "BODY");
                            let text = bodyComponent?.text || "Sem conteúdo";
                            
                            testTemplateVariables.forEach((varName) => {
                              const value = testVariables[varName] || `{{${varName}}}`;
                              const escapedVarName = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                              text = text.replace(new RegExp(`\\{\\{${escapedVarName}\\}\\}`, "g"), value);
                            });
                            
                            return <p className="whitespace-pre-wrap">{text}</p>;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsTestDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleSendTest} 
                      disabled={testMessageMutation.isPending || !testAccountId || !testTemplateName || !testPhone}
                    >
                      {testMessageMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Enviar Teste
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {/* Create Template Button */}
            {accounts && accounts.length > 0 && (
              <Dialog open={isCreateTemplateDialogOpen} onOpenChange={(open) => {
                setIsCreateTemplateDialogOpen(open);
                if (!open) resetNewTemplate();
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Criar Template
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Criar Novo Template
                    </DialogTitle>
                    <DialogDescription>
                      Crie um template de mensagem para enviar via WhatsApp Business API
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {/* Account Selection */}
                    <div className="space-y-2">
                      <Label>Conta WhatsApp Business *</Label>
                      <Select
                        value={createTemplateAccountId?.toString() || ""}
                        onValueChange={(val) => setCreateTemplateAccountId(parseInt(val))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma conta" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id.toString()}>
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Template Name */}
                    <div className="space-y-2">
                      <Label>Nome do Template *</Label>
                      <Input
                        placeholder="Ex: promocao_natal_2024"
                        value={newTemplate.name}
                        onChange={(e) => setNewTemplate(prev => ({ 
                          ...prev, 
                          name: e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
                        }))}
                      />
                      <p className="text-xs text-gray-500">
                        Apenas letras minúsculas, números e underscores
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Category */}
                      <div className="space-y-2">
                        <Label>Categoria *</Label>
                        <Select
                          value={newTemplate.category}
                          onValueChange={(val) => setNewTemplate(prev => ({ 
                            ...prev, 
                            category: val as typeof newTemplate.category 
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MARKETING">Marketing</SelectItem>
                            <SelectItem value="UTILITY">Utilitário</SelectItem>
                            <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Language */}
                      <div className="space-y-2">
                        <Label>Idioma *</Label>
                        <Select
                          value={newTemplate.language}
                          onValueChange={(val) => setNewTemplate(prev => ({ ...prev, language: val }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pt_BR">Português (Brasil)</SelectItem>
                            <SelectItem value="en">Inglês</SelectItem>
                            <SelectItem value="en_US">Inglês (EUA)</SelectItem>
                            <SelectItem value="es">Espanhol</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Header (optional) */}
                    <div className="space-y-2">
                      <Label>Cabeçalho (opcional)</Label>
                      <Select
                        value={newTemplate.headerType}
                        onValueChange={(val) => setNewTemplate(prev => ({ 
                          ...prev, 
                          headerType: val as typeof newTemplate.headerType 
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">Sem cabeçalho</SelectItem>
                          <SelectItem value="TEXT">Texto</SelectItem>
                        </SelectContent>
                      </Select>
                      {newTemplate.headerType === "TEXT" && (
                        <Input
                          placeholder="Texto do cabeçalho"
                          value={newTemplate.headerText}
                          onChange={(e) => setNewTemplate(prev => ({ ...prev, headerText: e.target.value }))}
                        />
                      )}
                    </div>

                    {/* Body */}
                    <div className="space-y-2">
                      <Label>Corpo da Mensagem *</Label>
                      <Textarea
                        placeholder="Digite a mensagem. Use {{nome}} para variáveis nomeadas ou {{1}} para variáveis numeradas."
                        value={newTemplate.bodyText}
                        onChange={(e) => setNewTemplate(prev => ({ ...prev, bodyText: e.target.value }))}
                        rows={5}
                      />
                      <div className="flex items-start gap-2 text-xs text-gray-500">
                        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>
                          Use variáveis como {"{{nome}}"} ou {"{{1}}"} para personalização. 
                          Máximo 1024 caracteres.
                        </span>
                      </div>
                    </div>

                    {/* Variable Configuration - appears when variables are detected */}
                    {detectedVariables.length > 0 && (
                      <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2">
                          <Info className="w-4 h-4 text-blue-600" />
                          <Label className="text-blue-800 font-medium">
                            Configuração das Variáveis ({detectedVariables.length} detectadas)
                          </Label>
                        </div>
                        
                        {/* Variable Type */}
                        <div className="space-y-2">
                          <Label className="text-sm">Tipo de Variável</Label>
                          <Select
                            value={newTemplate.variableType}
                            onValueChange={(val) => setNewTemplate(prev => ({ 
                              ...prev, 
                              variableType: val as "NAMED" | "POSITIONAL" 
                            }))}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NAMED">Nome (ex: {`{{nome}}`})</SelectItem>
                              <SelectItem value="POSITIONAL">Número (ex: {`{{1}}`})</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-blue-600">
                            {newTemplate.variableType === "NAMED" 
                              ? "Variáveis identificadas por nome. Ex: {{nome}}, {{empresa}}"
                              : "Variáveis serão convertidas para números. Ex: {{1}}, {{2}}"
                            }
                          </p>
                        </div>

                        {/* Variable Examples */}
                        <div className="space-y-2">
                          <Label className="text-sm">Amostras de Variáveis (obrigatório)</Label>
                          <p className="text-xs text-blue-600 mb-2">
                            Informe exemplos realistas para cada variável. A Meta usa esses exemplos para aprovar o template.
                          </p>
                          <div className="space-y-2">
                            {detectedVariables.map((varName, index) => (
                              <div key={varName} className="flex items-center gap-2">
                                <div className="w-24 flex-shrink-0">
                                  <span className="text-sm font-mono bg-blue-100 px-2 py-1 rounded text-blue-700">
                                    {newTemplate.variableType === "POSITIONAL" ? `{{${index + 1}}}` : `{{${varName}}}`}
                                  </span>
                                </div>
                                <Input
                                  placeholder={
                                    varName.toLowerCase().includes('nome') ? 'Ex: João' :
                                    varName.toLowerCase().includes('empresa') ? 'Ex: Empresa ABC' :
                                    varName.toLowerCase().includes('valor') ? 'Ex: R$ 1.500,00' :
                                    varName.toLowerCase().includes('data') ? 'Ex: 15/01/2025' :
                                    `Ex: Valor de ${varName}`
                                  }
                                  value={newTemplate.variableExamples[varName] || ""}
                                  onChange={(e) => updateVariableExample(varName, e.target.value)}
                                  className="bg-white"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Footer (optional) */}
                    <div className="space-y-2">
                      <Label>Rodapé (opcional)</Label>
                      <Input
                        placeholder="Ex: Responda SAIR para cancelar"
                        value={newTemplate.footerText}
                        onChange={(e) => setNewTemplate(prev => ({ ...prev, footerText: e.target.value }))}
                        maxLength={60}
                      />
                      <p className="text-xs text-gray-500">Máximo 60 caracteres</p>
                    </div>

                    {/* Buttons (optional) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Botões (opcional)</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addButton}
                          disabled={newTemplate.buttons.length >= 3}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Adicionar
                        </Button>
                      </div>
                      
                      {newTemplate.buttons.map((button, index) => (
                        <div key={index} className="flex gap-2 items-start p-3 border rounded-lg">
                          <div className="flex-1 space-y-2">
                            <Select
                              value={button.type}
                              onValueChange={(val) => updateButton(index, { 
                                type: val as TemplateButton["type"],
                                url: undefined,
                                phoneNumber: undefined,
                              })}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="QUICK_REPLY">Resposta Rápida</SelectItem>
                                <SelectItem value="URL">Link (URL)</SelectItem>
                                <SelectItem value="PHONE_NUMBER">Ligar</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Texto do botão"
                              value={button.text}
                              onChange={(e) => updateButton(index, { text: e.target.value })}
                              maxLength={25}
                            />
                            {button.type === "URL" && (
                              <Input
                                placeholder="https://exemplo.com"
                                value={button.url || ""}
                                onChange={(e) => updateButton(index, { url: e.target.value })}
                              />
                            )}
                            {button.type === "PHONE_NUMBER" && (
                              <Input
                                placeholder="+5511999999999"
                                value={button.phoneNumber || ""}
                                onChange={(e) => updateButton(index, { phoneNumber: e.target.value })}
                              />
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeButton(index)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                      
                      {newTemplate.buttons.length === 0 && (
                        <p className="text-xs text-gray-500">
                          Adicione até 3 botões interativos
                        </p>
                      )}
                    </div>

                    {/* Template Preview */}
                    {(newTemplate.bodyText || newTemplate.headerText) && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          Prévia do Template
                        </Label>
                        <div className="bg-[#e5ddd5] p-4 rounded-lg">
                          <div className="max-w-[320px] ml-auto">
                            <div className="bg-[#dcf8c6] rounded-lg shadow-sm overflow-hidden">
                              {/* Header */}
                              {newTemplate.headerType === "TEXT" && newTemplate.headerText && (
                                <div className="px-3 pt-2 pb-1">
                                  <p className="font-semibold text-sm text-gray-900">
                                    {newTemplate.headerText}
                                  </p>
                                </div>
                              )}
                              
                              {/* Body */}
                              <div className="px-3 py-2">
                                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                                  {newTemplate.bodyText || "Digite o corpo da mensagem..."}
                                </p>
                              </div>
                              
                              {/* Footer */}
                              {newTemplate.footerText && (
                                <div className="px-3 pb-2">
                                  <p className="text-xs text-gray-500">
                                    {newTemplate.footerText}
                                  </p>
                                </div>
                              )}
                              
                              {/* Timestamp */}
                              <div className="px-3 pb-1 flex justify-end">
                                <span className="text-[10px] text-gray-500">
                                  {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              
                              {/* Buttons */}
                              {newTemplate.buttons.length > 0 && (
                                <div className="border-t border-gray-200">
                                  {newTemplate.buttons.map((btn, idx) => (
                                    <div
                                      key={idx}
                                      className={`text-center py-2 text-sm text-blue-500 font-medium ${
                                        idx > 0 ? "border-t border-gray-200" : ""
                                      }`}
                                    >
                                      {btn.type === "URL" && "🔗 "}
                                      {btn.type === "PHONE_NUMBER" && "📞 "}
                                      {btn.text || `Botão ${idx + 1}`}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            
                            {/* Variables info */}
                            {newTemplate.bodyText.match(/\{\{[^}]+\}\}/g) && (
                              <div className="mt-2 text-xs text-gray-600 bg-white/50 rounded p-2">
                                <p className="font-medium mb-1">Variáveis detectadas:</p>
                                <div className="flex flex-wrap gap-1">
                                  {[...new Set(newTemplate.bodyText.match(/\{\{[^}]+\}\}/g))].map((v, i) => (
                                    <span key={i} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                      {v}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm font-medium text-blue-900 mb-2">
                        Sobre a aprovação de templates
                      </p>
                      <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                        <li>Templates precisam ser aprovados pela Meta antes do uso</li>
                        <li>A aprovação geralmente leva de minutos a 24 horas</li>
                        <li>Templates de Marketing podem ter restrições em alguns países</li>
                        <li>Evite conteúdo promocional excessivo para aumentar aprovação</li>
                      </ul>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateTemplateDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleCreateTemplate} 
                      disabled={createTemplateMutation.isPending || !createTemplateAccountId || !newTemplate.name || !newTemplate.bodyText}
                    >
                      {createTemplateMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        <>
                          <PlusCircle className="w-4 h-4 mr-2" />
                          Criar Template
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {/* Add Account Button */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Conta
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Adicionar Conta WhatsApp Business</DialogTitle>
                <DialogDescription>
                  Conecte sua conta da API oficial do WhatsApp Business (Meta Cloud API)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Conta</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Conta Principal"
                    value={newAccount.name}
                    onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumberId">Phone Number ID</Label>
                  <Input
                    id="phoneNumberId"
                    placeholder="Ex: 123456789012345"
                    value={newAccount.phoneNumberId}
                    onChange={(e) => setNewAccount({ ...newAccount, phoneNumberId: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">
                    Encontre no Meta Business Suite {">"} WhatsApp {">"} API Setup
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessAccountId">WhatsApp Business Account ID</Label>
                  <Input
                    id="businessAccountId"
                    placeholder="Ex: 123456789012345"
                    value={newAccount.businessAccountId}
                    onChange={(e) => setNewAccount({ ...newAccount, businessAccountId: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accessToken">Access Token Permanente</Label>
                  <Input
                    id="accessToken"
                    type="password"
                    placeholder="EAAx..."
                    value={newAccount.accessToken}
                    onChange={(e) => setNewAccount({ ...newAccount, accessToken: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">
                    Crie um token permanente em{" "}
                    <a
                      href="https://developers.facebook.com/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      developers.facebook.com
                    </a>
                  </p>
                </div>

                {/* Help Section */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-900 mb-2">
                    Como obter as credenciais:
                  </p>
                  <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Acesse o Meta Business Suite</li>
                    <li>Vá em WhatsApp {">"} Configuracoes da API</li>
                    <li>Copie o Phone Number ID e Business Account ID</li>
                    <li>Crie um token permanente no Facebook Developers</li>
                  </ol>
                  <a
                    href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-2"
                  >
                    Ver documentacao completa
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddAccount} disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Validando...
                    </>
                  ) : (
                    "Adicionar"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Accounts List */}
        {accounts && accounts.length > 0 ? (
          <div className="grid gap-4">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onDelete={() => deleteMutation.mutate({ id: account.id })}
                onSyncTemplates={() => syncTemplatesMutation.mutate({ accountId: account.id })}
                isSyncing={syncTemplatesMutation.isPending}
                isDeleting={deleteMutation.isPending}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma conta configurada
              </h3>
              <p className="text-gray-500 text-center max-w-md mb-4">
                Adicione sua conta da API oficial do WhatsApp Business para comecar a enviar campanhas de marketing.
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Primeira Conta
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Blacklist Section */}
        {accounts && accounts.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Blacklist de Contatos</h2>
            <p className="text-sm text-muted-foreground">
              Gerencie os contatos que não devem receber mensagens. Contatos são adicionados automaticamente quando respondem "SAIR" ou similar.
            </p>
            <Tabs defaultValue={accounts[0]?.id.toString()}>
              <TabsList aria-label="Contas da blacklist" className="w-full flex-wrap h-auto gap-1">
                {accounts.map((account) => (
                  <TabsTrigger key={account.id} value={account.id.toString()} className="flex-grow">
                    {account.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {accounts.map((account) => (
                <TabsContent key={account.id} value={account.id.toString()}>
                  <BlacklistManager accountId={account.id} accountName={account.name} />
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Sobre a API Oficial do WhatsApp Business
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Vantagens</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Conta oficial e verificada
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Sem risco de banimento
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Suporte a templates aprovados
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Metricas de entrega e leitura
                  </li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Requisitos</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-blue-500" />
                    Conta Meta Business verificada
                  </li>
                  <li className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-blue-500" />
                    Numero de telefone dedicado
                  </li>
                  <li className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    Templates de mensagem aprovados
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Webhook Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Configuracao do Webhook (Status em Tempo Real)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Configure o webhook no Meta Business Suite para receber atualizacoes de status das mensagens (enviada, entregue, lida, falhou).
            </p>

            <div className="bg-gray-50 border rounded-lg p-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">URL do Webhook</p>
                <code className="text-sm bg-white px-2 py-1 rounded border block mt-1 break-all">
                  {window.location.origin}/api/whatsapp-business/webhook
                </code>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Token de Verificacao</p>
                <code className="text-sm bg-white px-2 py-1 rounded border block mt-1">
                  mensageria_webhook_token
                </code>
                <p className="text-xs text-gray-500 mt-1">
                  Ou defina WHATSAPP_WEBHOOK_VERIFY_TOKEN no .env
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 mb-2">Como configurar no Meta:</p>
              <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                <li>Acesse o Meta for Developers (developers.facebook.com)</li>
                <li>Selecione seu App {">"} WhatsApp {">"} Configuracao</li>
                <li>Em "Webhook", clique em "Editar"</li>
                <li>Cole a URL do webhook e o token de verificacao</li>
                <li>Selecione os campos: messages, message_echoes</li>
                <li>Clique em "Verificar e Salvar"</li>
              </ol>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}

interface AccountCardProps {
  account: {
    id: number;
    name: string;
    phoneNumberId: string;
    businessAccountId: string;
    isActive: boolean;
    createdAt: Date;
  };
  onDelete: () => void;
  onSyncTemplates: () => void;
  isSyncing: boolean;
  isDeleting: boolean;
}

function AccountCard({ account, onDelete, onSyncTemplates, isSyncing, isDeleting }: AccountCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState({
    name: account.name,
    phoneNumberId: account.phoneNumberId,
    businessAccountId: account.businessAccountId,
    accessToken: "",
    isActive: account.isActive,
  });

  const utils = trpc.useUtils();

  const { data: phoneInfo, isLoading: isLoadingPhone } = trpc.whatsappBusiness.getPhoneInfo.useQuery(
    { accountId: account.id },
    {
      refetchInterval: false,
      refetchOnWindowFocus: false,
      retry: false,
    }
  );

  const { data: templates } = trpc.whatsappBusiness.getTemplates.useQuery(
    { accountId: account.id },
    {
      refetchInterval: false,
      refetchOnWindowFocus: false,
    }
  );

  const updateMutation = trpc.whatsappBusiness.update.useMutation({
    onSuccess: () => {
      toast.success("Conta atualizada com sucesso!");
      utils.whatsappBusiness.list.invalidate();
      setIsEditOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleUpdate = () => {
    const updatePayload: any = {
      id: account.id,
      name: editData.name,
      phoneNumberId: editData.phoneNumberId,
      businessAccountId: editData.businessAccountId,
      isActive: editData.isActive,
    };
    
    // Só envia o token se foi alterado
    if (editData.accessToken.trim()) {
      updatePayload.accessToken = editData.accessToken;
    }
    
    updateMutation.mutate(updatePayload);
  };

  const approvedTemplates = templates?.filter((t) => t.status === "APPROVED") || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              {account.name}
              <Badge variant={account.isActive ? "default" : "secondary"}>
                {account.isActive ? "Ativa" : "Inativa"}
              </Badge>
            </CardTitle>
            <CardDescription>
              Phone Number ID: {account.phoneNumberId}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncTemplates}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span className="ml-2 hidden sm:inline">Sincronizar Templates</span>
            </Button>
            
            {/* Edit Button */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Edit className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Editar Conta WhatsApp Business</DialogTitle>
                  <DialogDescription>
                    Atualize os dados da conexão com a API do WhatsApp Business
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Nome da Conta</Label>
                    <Input
                      id="edit-name"
                      value={editData.name}
                      onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Minha Empresa"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-phoneNumberId">Phone Number ID</Label>
                    <Input
                      id="edit-phoneNumberId"
                      value={editData.phoneNumberId}
                      onChange={(e) => setEditData(prev => ({ ...prev, phoneNumberId: e.target.value }))}
                      placeholder="Ex: 123456789012345"
                    />
                    <p className="text-xs text-gray-500">
                      Encontre em: Meta Business Suite → WhatsApp → Configurações da API
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-businessAccountId">WhatsApp Business Account ID</Label>
                    <Input
                      id="edit-businessAccountId"
                      value={editData.businessAccountId}
                      onChange={(e) => setEditData(prev => ({ ...prev, businessAccountId: e.target.value }))}
                      placeholder="Ex: 123456789012345"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-accessToken">Access Token</Label>
                    <Input
                      id="edit-accessToken"
                      type="password"
                      value={editData.accessToken}
                      onChange={(e) => setEditData(prev => ({ ...prev, accessToken: e.target.value }))}
                      placeholder="Deixe vazio para manter o atual"
                    />
                    <p className="text-xs text-gray-500">
                      Só preencha se quiser trocar o token. Deixe vazio para manter o atual.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="edit-isActive"
                      checked={editData.isActive}
                      onChange={(e) => setEditData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="rounded"
                    />
                    <Label htmlFor="edit-isActive">Conta ativa</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar Alterações"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover conta?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acao ira remover a conta "{account.name}" e todos os templates sincronizados.
                    Campanhas existentes nao serao afetadas.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Removendo..." : "Remover"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-3 gap-4">
          {/* Phone Info */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase">Telefone</p>
            {isLoadingPhone ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : phoneInfo ? (
              <div>
                <p className="text-sm font-medium">{phoneInfo.display_phone_number}</p>
                <p className="text-xs text-gray-500">{phoneInfo.verified_name}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">-</p>
            )}
          </div>

          {/* Quality Rating */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase">Qualidade</p>
            {phoneInfo?.quality_rating ? (
              <Badge
                variant={
                  phoneInfo.quality_rating === "GREEN"
                    ? "default"
                    : phoneInfo.quality_rating === "YELLOW"
                    ? "secondary"
                    : "destructive"
                }
              >
                {phoneInfo.quality_rating}
              </Badge>
            ) : (
              <p className="text-sm text-gray-500">-</p>
            )}
          </div>

          {/* Templates */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase">Templates Aprovados</p>
            <p className="text-sm font-medium">
              {approvedTemplates.length} template{approvedTemplates.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Templates: o nome da Meta é técnico, então cada um pode ganhar um apelido local. */}
        {(templates?.length ?? 0) > 0 && <TemplateManager templates={templates ?? []} />}
      </CardContent>
    </Card>
  );
}

interface ManagedTemplate {
  id: number;
  name: string;
  language: string;
  status: string;
  alias?: string | null;
  description?: string | null;
  components?: PreviewComponent[];
}

/**
 * Gestão dos apelidos. Tem busca pelo mesmo motivo que o seletor tem: uma conta com dezenas de
 * templates de nome técnico é exatamente onde achar o certo é difícil.
 *
 * Lista TODOS os status (não só APPROVED): um template ainda pendente de aprovação também merece
 * ser apelidado antes de entrar em uso.
 */
function TemplateManager({ templates }: { templates: ManagedTemplate[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = foldText(search.trim());
    if (!term) return templates;
    return templates.filter((template) =>
      [template.alias, template.description, template.name].some(
        (field) => field && foldText(field).includes(term),
      ),
    );
  }, [templates, search]);

  return (
    <div className="mt-4 pt-4 border-t space-y-2">
      <p className="text-xs font-medium text-gray-500 uppercase">Templates e apelidos</p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por apelido, descrição ou nome do template..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Nenhum template corresponde a "{search.trim()}".
        </p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {filtered.map((template) => (
            <TemplateRow key={template.id} template={template} />
          ))}
        </div>
      )}
    </div>
  );
}

interface TemplateRowProps {
  template: {
    id: number;
    name: string;
    language: string;
    status: string;
    alias?: string | null;
    description?: string | null;
    components?: PreviewComponent[];
  };
}

/**
 * Uma linha de template com o apelido local. O nome da Meta fica sempre visível — é ele que
 * identifica o template do lado de lá e é ele que a campanha envia.
 */
function TemplateRow({ template }: TemplateRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [alias, setAlias] = useState(template.alias ?? "");
  const [description, setDescription] = useState(template.description ?? "");
  const utils = trpc.useUtils();

  const updateAliasMutation = trpc.whatsappBusiness.updateTemplateAlias.useMutation({
    onSuccess: () => {
      toast.success("Apelido salvo!");
      utils.whatsappBusiness.getTemplates.invalidate();
      setIsOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="flex items-start justify-between gap-3 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{template.alias || template.name}</p>
        {template.alias && (
          <p className="text-xs text-muted-foreground font-mono truncate">{template.name}</p>
        )}
        {template.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{template.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {/* Templates não aprovados também podem ser apelidados — só não aparecem para seleção. */}
        {template.status !== "APPROVED" && (
          <Badge variant="secondary" className="text-xs">{template.status}</Badge>
        )}
        <Badge variant="outline" className="text-xs">{template.language}</Badge>
        <TemplatePreviewButton
          templateLabel={template.alias || template.name}
          components={template.components}
        />
        <Dialog
          open={isOpen}
          onOpenChange={(open) => {
            // Ao reabrir, parte sempre do que está salvo — não de uma edição abandonada.
            if (open) {
              setAlias(template.alias ?? "");
              setDescription(template.description ?? "");
            }
            setIsOpen(open);
          }}
        >
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={`Editar apelido de ${template.name}`}>
              <Edit className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apelido do template</DialogTitle>
              <DialogDescription>
                Um nome que faça sentido para você. Só vale aqui no sistema — na Meta o template
                continua sendo <span className="font-mono">{template.name}</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`alias-${template.id}`}>Apelido</Label>
                <Input
                  id={`alias-${template.id}`}
                  value={alias}
                  maxLength={120}
                  placeholder="Ex.: Promoção Black Friday"
                  onChange={(e) => setAlias(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`desc-${template.id}`}>Descrição</Label>
                <Textarea
                  id={`desc-${template.id}`}
                  value={description}
                  maxLength={500}
                  rows={3}
                  placeholder="Quando usar este template?"
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={updateAliasMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={() =>
                  updateAliasMutation.mutate({
                    templateId: template.id,
                    alias: alias.trim() || null,
                    description: description.trim() || null,
                  })
                }
                disabled={updateAliasMutation.isPending}
              >
                {updateAliasMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
