import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { TemplatePreviewButton, type PreviewComponent } from "@/components/TemplatePreview";

/** O mínimo que o seletor precisa saber de um template — o resto fica com quem o usa. */
export interface PickableTemplate {
  id: number;
  name: string;
  language: string;
  category: string;
  alias?: string | null;
  description?: string | null;
  /** Components da Meta (já parseados pelo router) — alimentam a prévia do olhinho. */
  components?: PreviewComponent[];
}

interface TemplatePickerProps<T extends PickableTemplate> {
  templates: T[];
  /** Nome do template selecionado (o nome técnico da Meta — é o que a campanha guarda). */
  value: string;
  onSelect: (template: T) => void;
  emptyMessage?: string;
}

/**
 * Ignora acentos e caixa: buscar "promocao" acha "Promoção". O NFD separa o acento da letra e
 * o range \u0300-\u036f remove os acentos soltos (\p{Diacritic} exigiria target ES6, que o
 * projeto não usa).
 */
export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Escolha de template com busca. Procura no apelido, na descrição E no nome técnico da Meta —
 * o usuário acha pelo nome que ele deu, mas continua vendo o nome real, que é o que de fato
 * é enviado.
 */
export function TemplatePicker<T extends PickableTemplate>({
  templates,
  value,
  onSelect,
  emptyMessage = "Nenhum template encontrado.",
}: TemplatePickerProps<T>) {
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
    <div className="space-y-2">
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
        <p className="text-sm text-muted-foreground py-6 text-center">
          {search.trim() ? `Nenhum template corresponde a "${search.trim()}".` : emptyMessage}
        </p>
      ) : (
        <div className="grid gap-2 max-h-72 overflow-y-auto pr-1">
          {filtered.map((template) => {
            const isSelected = value === template.name;
            return (
              // O olhinho é um botão à parte, fora do botão de selecionar: um dentro do outro
              // seria HTML inválido e o clique na prévia acabaria escolhendo o template.
              <div
                key={template.id}
                className={`flex items-start gap-1 border rounded-lg p-3 transition-colors ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(template)}
                  aria-pressed={isSelected}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {/* O apelido é o rótulo quando existe; o nome da Meta segue visível abaixo,
                          porque é ele que identifica o template do lado de lá. */}
                      <p className="font-medium text-sm truncate">{template.alias || template.name}</p>
                      {template.alias && (
                        <p className="text-xs text-muted-foreground font-mono truncate">{template.name}</p>
                      )}
                      {template.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {template.language}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{template.category}</p>
                </button>
                <TemplatePreviewButton
                  templateLabel={template.alias || template.name}
                  components={template.components}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
