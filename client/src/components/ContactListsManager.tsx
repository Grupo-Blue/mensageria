import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { normalizePhoneNumber, formatPhoneForDisplay, parseContactRow, isLandline } from "@/lib/phoneUtils";
import * as XLSX from "xlsx";
import {
  Loader2,
  Plus,
  MoreVertical,
  Trash2,
  Edit,
  Users,
  Upload,
  Building2,
  UserX,
  UserCheck,
  AlertTriangle,
  Ban,
  Eye,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  XCircle,
  Phone,
  PhoneOff,
  Copy,
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContactList {
  id: number;
  name: string;
  company: string | null;
  description: string | null;
  totalContacts: number;
  invalidContacts: number;
  optedOutContacts: number;
  createdAt: Date;
}

interface ContactListItem {
  id: number;
  listId: number;
  phoneNumber: string;
  name: string | null;
  email: string | null;
  status: "active" | "invalid" | "opted_out" | "spam_reported";
  optedOutAt: Date | null;
  optedOutReason: string | null;
  createdAt: Date;
}

interface ParsedContact {
  phoneNumber: string;
  originalPhone: string;
  name?: string;
  email?: string;
  isValid: boolean;
  isLandline?: boolean;
  isDuplicate?: boolean;
}

export default function ContactListsManager() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingList, setEditingList] = useState<ContactList | null>(null);

  // Form state
  const [newListName, setNewListName] = useState("");
  const [newListCompany, setNewListCompany] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  
  // Import state
  const [csvText, setCsvText] = useState("");
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importTab, setImportTab] = useState<string>("file");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const utils = trpc.useUtils();

  // Queries
  const { data: lists, isLoading: isLoadingLists } = trpc.contactLists.list.useQuery(undefined, {
    enabled: isExpanded,
  });

  const { data: contacts, isLoading: isLoadingContacts } = trpc.contactLists.getContacts.useQuery(
    { listId: selectedListId! },
    { enabled: !!selectedListId }
  );

  // Mutations
  const createListMutation = trpc.contactLists.create.useMutation({
    onSuccess: () => {
      toast.success("Lista criada com sucesso!");
      utils.contactLists.list.invalidate();
      setIsCreateOpen(false);
      resetCreateForm();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateListMutation = trpc.contactLists.update.useMutation({
    onSuccess: () => {
      toast.success("Lista atualizada!");
      utils.contactLists.list.invalidate();
      setIsEditOpen(false);
      setEditingList(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteListMutation = trpc.contactLists.delete.useMutation({
    onSuccess: () => {
      toast.success("Lista removida!");
      utils.contactLists.list.invalidate();
      if (selectedListId) {
        setSelectedListId(null);
        setCurrentPage(1);
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const addContactsMutation = trpc.contactLists.addContacts.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.added} contatos adicionados${data.duplicates > 0 ? `, ${data.duplicates} duplicados ignorados` : ""}`);
      utils.contactLists.list.invalidate();
      utils.contactLists.getContacts.invalidate();
      setIsImportOpen(false);
      resetImportState();
    },
    onError: (error) => toast.error(error.message),
  });

  const optOutContactMutation = trpc.contactLists.optOutContact.useMutation({
    onSuccess: () => {
      toast.success("Contato removido da lista!");
      utils.contactLists.list.invalidate();
      utils.contactLists.getContacts.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const reactivateContactMutation = trpc.contactLists.reactivateContact.useMutation({
    onSuccess: () => {
      toast.success("Contato reativado!");
      utils.contactLists.list.invalidate();
      utils.contactLists.getContacts.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteContactMutation = trpc.contactLists.deleteContact.useMutation({
    onSuccess: () => {
      toast.success("Contato excluído!");
      utils.contactLists.list.invalidate();
      utils.contactLists.getContacts.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const resetCreateForm = () => {
    setNewListName("");
    setNewListCompany("");
    setNewListDescription("");
  };

  const resetImportState = () => {
    setCsvText("");
    setParsedContacts([]);
    setImportTab("file");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Processa contatos: marca telefones fixos e duplicados (mantém o mais recente)
  const processAndDeduplicateContacts = (contacts: ParsedContact[]): ParsedContact[] => {
    // Primeiro, marca telefones fixos
    const markedContacts = contacts.map(contact => {
      if (!contact.isValid && contact.originalPhone) {
        // Verifica se é telefone fixo
        const landline = isLandline(contact.originalPhone);
        return { ...contact, isLandline: landline };
      }
      return contact;
    });

    // Depois, remove duplicados (mantém o mais recente - último na lista)
    // Percorre de trás para frente para manter o mais recente
    const seen = new Map<string, number>(); // phoneNumber -> index
    const result: ParsedContact[] = [];
    
    for (let i = markedContacts.length - 1; i >= 0; i--) {
      const contact = markedContacts[i];
      if (contact.phoneNumber && contact.isValid) {
        if (seen.has(contact.phoneNumber)) {
          // Este é duplicado (e mais antigo), marca como tal
          result.unshift({ ...contact, isDuplicate: true, isValid: false });
        } else {
          seen.set(contact.phoneNumber, i);
          result.unshift(contact);
        }
      } else {
        result.unshift(contact);
      }
    }
    
    return result;
  };

  const handleCreateList = () => {
    if (!newListName.trim()) {
      toast.error("Nome da lista é obrigatório");
      return;
    }
    createListMutation.mutate({
      name: newListName.trim(),
      company: newListCompany.trim() || undefined,
      description: newListDescription.trim() || undefined,
    });
  };

  const handleUpdateList = () => {
    if (!editingList) return;
    updateListMutation.mutate({
      id: editingList.id,
      name: editingList.name,
      company: editingList.company || undefined,
      description: editingList.description || undefined,
    });
  };

  // Process file (CSV or Excel)
  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    const contacts: ParsedContact[] = [];

    try {
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
        // Process CSV/TXT
        const text = await file.text();
        const lines = text.trim().split(/\r?\n/);
        
        // Try to detect header row
        const firstRow = lines[0].split(/[,;\t]/).map(s => s.trim());
        const hasHeader = firstRow.some(h => 
          /^(telefone|phone|celular|mobile|whatsapp|numero|number|fone|nome|name|email)$/i.test(h)
        );
        
        const startIndex = hasHeader ? 1 : 0;
        const headers = hasHeader ? firstRow : undefined;

        for (let i = startIndex; i < lines.length; i++) {
          const row = lines[i].split(/[,;\t]/).map(s => s.trim().replace(/^["']|["']$/g, ""));
          if (row.length === 0 || (row.length === 1 && !row[0])) continue;
          
          const parsed = parseContactRow(row, headers);
          
          if (parsed) {
            // Usa o índice real onde encontrou o telefone para o originalPhone
            const phoneIdx = parsed.phoneIndex ?? 0;
            const originalPhone = row[phoneIdx] || row[0] || "";
            contacts.push({
              phoneNumber: parsed.phoneNumber,
              name: parsed.name,
              email: parsed.email,
              originalPhone,
              isValid: !!parsed.phoneNumber,
            });
          } else if (row[0]) {
            // Invalid contact - tenta extrair nome da segunda coluna mesmo assim
            contacts.push({
              phoneNumber: "",
              originalPhone: row[0],
              name: row[1] || undefined,
              isValid: false,
            });
          }
        }
      } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        // Process Excel
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        
        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        
        if (jsonData.length === 0) {
          toast.error("Planilha vazia");
          setIsProcessing(false);
          return;
        }

        // Try to detect header row
        const firstRow = jsonData[0].map(v => String(v || "").trim());
        const hasHeader = firstRow.some(h => 
          /^(telefone|phone|celular|mobile|whatsapp|numero|number|fone|nome|name|email)$/i.test(h)
        );
        
        const startIndex = hasHeader ? 1 : 0;
        const headers = hasHeader ? firstRow : undefined;

        for (let i = startIndex; i < jsonData.length; i++) {
          const row = jsonData[i].map(v => String(v || "").trim());
          if (row.length === 0 || (row.length === 1 && !row[0])) continue;
          
          const parsed = parseContactRow(row, headers);
          
          if (parsed) {
            // Usa o índice real onde encontrou o telefone para o originalPhone
            const phoneIdx = parsed.phoneIndex ?? 0;
            const originalPhone = String(jsonData[i][phoneIdx] || jsonData[i][0] || "");
            contacts.push({
              phoneNumber: parsed.phoneNumber,
              name: parsed.name,
              email: parsed.email,
              originalPhone,
              isValid: !!parsed.phoneNumber,
            });
          } else if (jsonData[i][0]) {
            // Invalid contact - tenta extrair nome da segunda coluna mesmo assim
            contacts.push({
              phoneNumber: "",
              originalPhone: String(jsonData[i][0]),
              name: jsonData[i][1] ? String(jsonData[i][1]) : undefined,
              isValid: false,
            });
          }
        }
      } else {
        toast.error("Formato não suportado. Use CSV, TXT, XLS ou XLSX.");
        setIsProcessing(false);
        return;
      }

      // Processa e deduplica os contatos
      const processedContacts = processAndDeduplicateContacts(contacts);
      setParsedContacts(processedContacts);
      
      const validCount = processedContacts.filter(c => c.isValid).length;
      const invalidCount = processedContacts.filter(c => !c.isValid && !c.isDuplicate).length;
      const duplicateCount = processedContacts.filter(c => c.isDuplicate).length;
      const landlineCount = processedContacts.filter(c => c.isLandline).length;
      
      let message = `${contacts.length} linhas processadas: ${validCount} válidas`;
      if (invalidCount > 0) message += `, ${invalidCount} inválidas`;
      if (duplicateCount > 0) message += `, ${duplicateCount} duplicadas`;
      if (landlineCount > 0) message += `, ${landlineCount} telefones fixos`;
      
      toast.success(message);
    } catch (error: any) {
      console.error("Error processing file:", error);
      toast.error(`Erro ao processar arquivo: ${error.message}`);
    }
    
    setIsProcessing(false);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Process CSV text
  const processCSVText = () => {
    if (!csvText.trim()) {
      toast.error("Cole o conteúdo CSV primeiro");
      return;
    }

    const lines = csvText.trim().split(/\r?\n/);
    const contacts: ParsedContact[] = [];
    
    // Try to detect header row
    const firstRow = lines[0].split(/[,;\t]/).map(s => s.trim());
    const hasHeader = firstRow.some(h => 
      /^(telefone|phone|celular|mobile|whatsapp|numero|number|fone|nome|name|email)$/i.test(h)
    );
    
    const startIndex = hasHeader ? 1 : 0;
    const headers = hasHeader ? firstRow : undefined;

    for (let i = startIndex; i < lines.length; i++) {
      const row = lines[i].split(/[,;\t]/).map(s => s.trim().replace(/^["']|["']$/g, ""));
      if (row.length === 0 || (row.length === 1 && !row[0])) continue;
      
      const parsed = parseContactRow(row, headers);
      
      if (parsed) {
        // Usa o índice real onde encontrou o telefone para o originalPhone
        const phoneIdx = parsed.phoneIndex ?? 0;
        contacts.push({
          phoneNumber: parsed.phoneNumber,
          name: parsed.name,
          email: parsed.email,
          originalPhone: row[phoneIdx] || row[0] || "",
          isValid: !!parsed.phoneNumber,
        });
      } else if (row[0]) {
        contacts.push({
          phoneNumber: "",
          originalPhone: row[0],
          name: row[1] || undefined,
          isValid: false,
        });
      }
    }

    // Processa e deduplica os contatos
    const processedContacts = processAndDeduplicateContacts(contacts);
    setParsedContacts(processedContacts);
    
    const validCount = processedContacts.filter(c => c.isValid).length;
    const invalidCount = processedContacts.filter(c => !c.isValid && !c.isDuplicate).length;
    const duplicateCount = processedContacts.filter(c => c.isDuplicate).length;
    const landlineCount = processedContacts.filter(c => c.isLandline).length;
    
    let message = `${contacts.length} linhas processadas: ${validCount} válidas`;
    if (invalidCount > 0) message += `, ${invalidCount} inválidas`;
    if (duplicateCount > 0) message += `, ${duplicateCount} duplicadas`;
    if (landlineCount > 0) message += `, ${landlineCount} telefones fixos`;
    
    toast.success(message);
  };

  // Import contacts
  const handleImport = () => {
    if (!selectedListId) return;
    
    const validContacts = parsedContacts.filter(c => c.isValid);
    
    if (validContacts.length === 0) {
      toast.error("Nenhum contato válido para importar");
      return;
    }

    addContactsMutation.mutate({
      listId: selectedListId,
      contacts: validContacts.map(c => ({
        phoneNumber: c.phoneNumber,
        name: c.name,
        email: c.email,
      })),
    });
  };

  const getStatusBadge = (status: string, reason?: string | null) => {
    switch (status) {
      case "active":
        return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Ativo</Badge>;
      case "invalid":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">Inválido</Badge>;
      case "opted_out":
        return (
          <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
            Saiu {reason === "sair" && "(SAIR)"}
          </Badge>
        );
      case "spam_reported":
        return <Badge variant="destructive">Spam</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const selectedList = lists?.find((l) => l.id === selectedListId);
  const validContactsCount = parsedContacts.filter(c => c.isValid).length;
  const invalidContactsCount = parsedContacts.filter(c => !c.isValid && !c.isDuplicate && !c.isLandline).length;
  const duplicateContactsCount = parsedContacts.filter(c => c.isDuplicate).length;
  const landlineContactsCount = parsedContacts.filter(c => c.isLandline).length;

  return (
    <Card className="border-2 border-dashed">
      <CardHeader 
        className="cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Listas de Contatos</CardTitle>
              <CardDescription>
                Gerencie suas listas de destinatários para campanhas
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lists && lists.length > 0 && (
              <Badge variant="secondary">{lists.length} listas</Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Actions */}
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              {selectedListId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedListId(null);
                    setCurrentPage(1);
                  }}
                >
                  ← Voltar às Listas
                </Button>
              )}
            </div>
            {!selectedListId && (
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Lista
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Nova Lista</DialogTitle>
                    <DialogDescription>
                      Crie uma lista para organizar seus contatos
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="list-name">Nome da Lista *</Label>
                      <Input
                        id="list-name"
                        placeholder="Ex: Clientes VIP"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="list-company">Empresa (opcional)</Label>
                      <Input
                        id="list-company"
                        placeholder="Ex: Empresa XYZ"
                        value={newListCompany}
                        onChange={(e) => setNewListCompany(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="list-description">Descrição (opcional)</Label>
                      <Textarea
                        id="list-description"
                        placeholder="Descrição da lista..."
                        value={newListDescription}
                        onChange={(e) => setNewListDescription(e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateList} disabled={createListMutation.isPending}>
                      {createListMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Criar Lista
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            {selectedListId && (
              <Dialog open={isImportOpen} onOpenChange={(open) => {
                setIsImportOpen(open);
                if (!open) resetImportState();
              }}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Upload className="w-4 h-4 mr-2" />
                    Importar Contatos
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Importar Contatos</DialogTitle>
                    <DialogDescription>
                      Faça upload de um arquivo CSV ou Excel, ou cole os dados diretamente
                    </DialogDescription>
                  </DialogHeader>
                  
                  <Tabs value={importTab} onValueChange={setImportTab} className="mt-4">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="file" className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4" />
                        Upload de Arquivo
                      </TabsTrigger>
                      <TabsTrigger value="text" className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Colar Texto
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="file" className="space-y-4 mt-4">
                      {/* File Upload Zone */}
                      <div
                        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv,.txt,.xlsx,.xls"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        {isProcessing ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                            <p className="text-sm text-gray-600">Processando arquivo...</p>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                            <p className="font-medium text-gray-700">
                              Arraste um arquivo aqui ou clique para selecionar
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              Suporta CSV, TXT, XLS e XLSX
                            </p>
                          </>
                        )}
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Formatos de telefone aceitos:</p>
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 font-mono">
                            <span>5561998626334</span>
                            <span>+5561998626334</span>
                            <span>61998626334</span>
                            <span>+55 (61) 99862-6334</span>
                            <span>556198626334 (sem 9º dígito)</span>
                            <span>6198626334 (sem 9º dígito)</span>
                          </div>
                        </div>
                        <div className="border-t pt-2">
                          <p className="text-sm font-medium text-gray-700 mb-2">Regras de validação:</p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            <li className="flex items-center gap-2">
                              <PhoneOff className="w-3 h-3 text-yellow-600" />
                              <span><strong>Telefones fixos</strong> (não começam com 9,8,7,6) são ignorados - não recebem WhatsApp</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Copy className="w-3 h-3 text-orange-600" />
                              <span><strong>Duplicados</strong> são removidos - apenas o mais recente é mantido</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="text" className="space-y-4 mt-4">
                      <Textarea
                        placeholder="Cole aqui os dados CSV ou texto separado por vírgula/tab:&#10;5511999999999,João Silva,joao@email.com&#10;+55 (11) 98888-8888,Maria Santos"
                        value={csvText}
                        onChange={(e) => setCsvText(e.target.value)}
                        rows={8}
                        className="font-mono text-sm"
                      />
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-gray-500">
                          Formato: telefone,nome,email (separados por vírgula, ponto-e-vírgula ou tab)
                        </p>
                        <Button onClick={processCSVText} size="sm" variant="secondary">
                          Processar Texto
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* Preview */}
                  {parsedContacts.length > 0 && (
                    <div className="space-y-4 mt-4 border-t pt-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h4 className="font-medium">Preview dos Contatos</h4>
                        <div className="flex items-center gap-3 text-sm flex-wrap">
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="w-4 h-4" />
                            {validContactsCount} válidos
                          </span>
                          {duplicateContactsCount > 0 && (
                            <span className="flex items-center gap-1 text-orange-600">
                              <Copy className="w-4 h-4" />
                              {duplicateContactsCount} duplicados
                            </span>
                          )}
                          {landlineContactsCount > 0 && (
                            <span className="flex items-center gap-1 text-yellow-600">
                              <PhoneOff className="w-4 h-4" />
                              {landlineContactsCount} fixos
                            </span>
                          )}
                          {invalidContactsCount > 0 && (
                            <span className="flex items-center gap-1 text-red-600">
                              <XCircle className="w-4 h-4" />
                              {invalidContactsCount} inválidos
                            </span>
                          )}
                        </div>
                      </div>

                      {validContactsCount > 0 && (
                        <Progress 
                          value={(validContactsCount / parsedContacts.length) * 100} 
                          className="h-2"
                        />
                      )}

                      <div className="border rounded-lg max-h-64 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">Status</TableHead>
                              <TableHead>Original</TableHead>
                              <TableHead>Normalizado</TableHead>
                              <TableHead>Nome</TableHead>
                              <TableHead className="w-24">Motivo</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {parsedContacts.slice(0, 100).map((contact, index) => (
                              <TableRow 
                                key={index} 
                                className={
                                  contact.isValid 
                                    ? "" 
                                    : contact.isDuplicate 
                                      ? "bg-orange-50" 
                                      : contact.isLandline 
                                        ? "bg-yellow-50" 
                                        : "bg-red-50"
                                }
                              >
                                <TableCell>
                                  {contact.isValid ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                  ) : contact.isDuplicate ? (
                                    <Copy className="w-4 h-4 text-orange-600" />
                                  ) : contact.isLandline ? (
                                    <PhoneOff className="w-4 h-4 text-yellow-600" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-red-600" />
                                  )}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {contact.originalPhone}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {contact.isValid ? (
                                    <span className="flex items-center gap-1">
                                      <Phone className="w-3 h-3" />
                                      {formatPhoneForDisplay(contact.phoneNumber)}
                                    </span>
                                  ) : contact.isDuplicate ? (
                                    <span className="text-orange-600 flex items-center gap-1">
                                      <Phone className="w-3 h-3" />
                                      {formatPhoneForDisplay(contact.phoneNumber)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {contact.name || "-"}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {contact.isValid ? (
                                    <span className="text-green-600">OK</span>
                                  ) : contact.isDuplicate ? (
                                    <span className="text-orange-600">Duplicado</span>
                                  ) : contact.isLandline ? (
                                    <span className="text-yellow-600">Fixo</span>
                                  ) : (
                                    <span className="text-red-600">Inválido</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {parsedContacts.length > 100 && (
                          <div className="p-2 text-center text-sm text-gray-500 bg-gray-50">
                            Mostrando 100 de {parsedContacts.length} contatos
                          </div>
                        )}
                      </div>

                      <Button
                        onClick={() => setParsedContacts([])}
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Limpar Preview
                      </Button>
                    </div>
                  )}

                  <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setIsImportOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleImport} 
                      disabled={addContactsMutation.isPending || validContactsCount === 0}
                    >
                      {addContactsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Importar {validContactsCount} Contatos
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Lists View */}
          {!selectedListId && (
            <>
              {isLoadingLists ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : lists && lists.length > 0 ? (
                <div className="grid gap-3">
                  {lists.map((list) => (
                    <div
                      key={list.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => {
                          setSelectedListId(list.id);
                          setCurrentPage(1);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="font-medium">{list.name}</div>
                          {list.company && (
                            <Badge variant="outline" className="text-xs">
                              <Building2 className="w-3 h-3 mr-1" />
                              {list.company}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {list.totalContacts} contatos
                          </span>
                          {list.invalidContacts > 0 && (
                            <span className="flex items-center gap-1 text-yellow-600">
                              <AlertTriangle className="w-3 h-3" />
                              {list.invalidContacts} inválidos
                            </span>
                          )}
                          {list.optedOutContacts > 0 && (
                            <span className="flex items-center gap-1 text-orange-600">
                              <UserX className="w-3 h-3" />
                              {list.optedOutContacts} saíram
                            </span>
                          )}
                          <span>
                            Criada {formatDistanceToNow(new Date(list.createdAt), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedListId(list.id);
                            setCurrentPage(1);
                          }}>
                            <Eye className="w-4 h-4 mr-2" />
                            Ver Contatos
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setEditingList(list);
                            setIsEditOpen(true);
                          }}>
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir lista?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação irá remover permanentemente a lista "{list.name}" e todos os seus contatos.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteListMutation.mutate({ id: list.id })}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Nenhuma lista criada</p>
                  <p className="text-sm">Crie uma lista para começar a organizar seus contatos</p>
                </div>
              )}
            </>
          )}

          {/* Contacts View */}
          {selectedListId && selectedList && (
            <div className="space-y-4">
              {/* List Header */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-medium">{selectedList.name}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    {selectedList.company && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {selectedList.company}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-green-600">
                      <UserCheck className="w-3 h-3" />
                      {selectedList.totalContacts - selectedList.invalidContacts - selectedList.optedOutContacts} ativos
                    </span>
                    {selectedList.optedOutContacts > 0 && (
                      <span className="flex items-center gap-1 text-orange-600">
                        <UserX className="w-3 h-3" />
                        {selectedList.optedOutContacts} saíram
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Contacts Table */}
              {isLoadingContacts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : contacts && contacts.length > 0 ? (
                <>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contacts
                          .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                          .map((contact) => (
                            <TableRow key={contact.id}>
                              <TableCell className="font-mono">
                                {formatPhoneForDisplay(contact.phoneNumber)}
                              </TableCell>
                              <TableCell>{contact.name || "-"}</TableCell>
                              <TableCell>{getStatusBadge(contact.status, contact.optedOutReason)}</TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {contact.status === "active" ? (
                                      <>
                                        <DropdownMenuItem
                                          onClick={() => optOutContactMutation.mutate({ id: contact.id, reason: "manual" })}
                                        >
                                          <UserX className="w-4 h-4 mr-2" />
                                          Remover da Lista
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => optOutContactMutation.mutate({ id: contact.id, reason: "spam" })}
                                          className="text-red-600"
                                        >
                                          <Ban className="w-4 h-4 mr-2" />
                                          Marcar como Spam
                                        </DropdownMenuItem>
                                      </>
                                    ) : (
                                      <DropdownMenuItem
                                        onClick={() => reactivateContactMutation.mutate({ id: contact.id })}
                                      >
                                        <UserCheck className="w-4 h-4 mr-2" />
                                        Reativar Contato
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem
                                          onSelect={(e) => e.preventDefault()}
                                          className="text-red-600"
                                        >
                                          <Trash2 className="w-4 h-4 mr-2" />
                                          Excluir
                                        </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Esta ação irá remover permanentemente o contato {contact.phoneNumber}.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => deleteContactMutation.mutate({ id: contact.id })}
                                            className="bg-red-600 hover:bg-red-700"
                                          >
                                            Excluir
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Pagination */}
                  {contacts.length > itemsPerPage && (
                    <div className="flex items-center justify-between border-t pt-4">
                      <div className="text-sm text-gray-500">
                        Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, contacts.length)} de {contacts.length} contatos
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronsLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <div className="flex items-center gap-1 mx-2">
                          {Array.from({ length: Math.ceil(contacts.length / itemsPerPage) }, (_, i) => i + 1)
                            .filter(page => {
                              const totalPages = Math.ceil(contacts.length / itemsPerPage);
                              if (totalPages <= 7) return true;
                              if (page === 1 || page === totalPages) return true;
                              if (Math.abs(page - currentPage) <= 1) return true;
                              return false;
                            })
                            .map((page, idx, arr) => {
                              const showEllipsisBefore = idx > 0 && page - arr[idx - 1] > 1;
                              return (
                                <span key={page} className="flex items-center">
                                  {showEllipsisBefore && <span className="px-1 text-gray-400">...</span>}
                                  <Button
                                    variant={currentPage === page ? "default" : "outline"}
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setCurrentPage(page)}
                                  >
                                    {page}
                                  </Button>
                                </span>
                              );
                            })}
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(p => Math.min(Math.ceil(contacts.length / itemsPerPage), p + 1))}
                          disabled={currentPage >= Math.ceil(contacts.length / itemsPerPage)}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(Math.ceil(contacts.length / itemsPerPage))}
                          disabled={currentPage >= Math.ceil(contacts.length / itemsPerPage)}
                        >
                          <ChevronsRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-500 border rounded-lg">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Nenhum contato nesta lista</p>
                  <p className="text-sm">Importe contatos via arquivo ou texto</p>
                </div>
              )}
            </div>
          )}

          {/* Edit List Dialog */}
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Lista</DialogTitle>
              </DialogHeader>
              {editingList && (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-list-name">Nome da Lista *</Label>
                    <Input
                      id="edit-list-name"
                      value={editingList.name}
                      onChange={(e) => setEditingList({ ...editingList, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-list-company">Empresa</Label>
                    <Input
                      id="edit-list-company"
                      value={editingList.company || ""}
                      onChange={(e) => setEditingList({ ...editingList, company: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-list-description">Descrição</Label>
                    <Textarea
                      id="edit-list-description"
                      value={editingList.description || ""}
                      onChange={(e) => setEditingList({ ...editingList, description: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdateList} disabled={updateListMutation.isPending}>
                  {updateListMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      )}
    </Card>
  );
}
