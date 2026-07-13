import { Fragment, type ReactNode } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Eye, ExternalLink, Phone, Reply, Image as ImageIcon, FileText, Video } from "lucide-react";

export interface PreviewButton {
  type: string;
  text: string;
  url?: string;
  phone_number?: string;
}

export interface PreviewComponent {
  type: string;
  format?: string;
  text?: string;
  buttons?: PreviewButton[];
}

/**
 * Marcação do WhatsApp: *negrito*, _itálico_, ~riscado~. As variáveis ({{1}}, {{nome}}) viram
 * um chip — o ponto do preview é justamente mostrar ONDE elas entram no texto.
 */
function renderWhatsappText(text: string): ReactNode {
  const parts = text.split(/(\{\{[^}]+\}\}|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g);

  return parts.map((part, index) => {
    if (!part) return null;
    const key = `${index}-${part}`;

    if (part.startsWith("{{") && part.endsWith("}}")) {
      return (
        <span
          key={key}
          className="inline-block rounded bg-amber-100 text-amber-900 px-1 text-[11px] font-medium align-baseline"
        >
          {part.slice(2, -2).trim()}
        </span>
      );
    }
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) {
      return <strong key={key}>{part.slice(1, -1)}</strong>;
    }
    if (part.length > 2 && part.startsWith("_") && part.endsWith("_")) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (part.length > 2 && part.startsWith("~") && part.endsWith("~")) {
      return <s key={key}>{part.slice(1, -1)}</s>;
    }
    // Quebras de linha vêm do texto da Meta e precisam sobreviver ao render.
    return (
      <Fragment key={key}>
        {part.split("\n").map((line, i, lines) => (
          <Fragment key={i}>
            {line}
            {i < lines.length - 1 && <br />}
          </Fragment>
        ))}
      </Fragment>
    );
  });
}

const HEADER_MEDIA_ICON: Record<string, typeof ImageIcon> = {
  IMAGE: ImageIcon,
  VIDEO: Video,
  DOCUMENT: FileText,
};

function ButtonIcon({ type }: { type: string }) {
  if (type === "URL") return <ExternalLink className="w-3.5 h-3.5" />;
  if (type === "PHONE_NUMBER") return <Phone className="w-3.5 h-3.5" />;
  return <Reply className="w-3.5 h-3.5" />;
}

/**
 * A mensagem como o destinatário a vê: bolha branca de mensagem recebida, sobre o papel de
 * parede da conversa. Nada aqui é enviado — é só leitura do template.
 */
export function WhatsappPreview({ components }: { components: PreviewComponent[] }) {
  const header = components.find((c) => c.type === "HEADER");
  const body = components.find((c) => c.type === "BODY");
  const footer = components.find((c) => c.type === "FOOTER");
  const buttons = components.find((c) => c.type === "BUTTONS")?.buttons ?? [];

  const HeaderIcon = header?.format ? HEADER_MEDIA_ICON[header.format] : undefined;

  return (
    <div className="rounded-lg bg-[#efe7dd] dark:bg-[#0b141a] p-3">
      <div className="max-w-[280px]">
        <div className="relative rounded-lg rounded-tl-none bg-white dark:bg-[#202c33] shadow-sm px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
          {header?.format === "TEXT" && header.text && (
            <p className="font-bold mb-1 leading-snug">{renderWhatsappText(header.text)}</p>
          )}
          {HeaderIcon && (
            <div className="mb-2 flex h-20 items-center justify-center rounded bg-black/5 dark:bg-white/5 text-muted-foreground">
              <HeaderIcon className="w-6 h-6" />
            </div>
          )}

          {body?.text ? (
            <p className="whitespace-pre-wrap leading-snug break-words">
              {renderWhatsappText(body.text)}
            </p>
          ) : (
            <p className="text-muted-foreground italic">Este template não tem corpo de mensagem.</p>
          )}

          {footer?.text && (
            <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
              {footer.text}
            </p>
          )}

          <div className="mt-1 flex justify-end">
            <span className="text-[10px] text-gray-400">
              {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>

        {buttons.length > 0 && (
          <div className="mt-1 space-y-1">
            {buttons.map((button, index) => (
              <div
                key={`${button.type}-${index}`}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-white dark:bg-[#202c33] py-1.5 text-[13px] font-medium text-[#00a5f4] shadow-sm"
              >
                <ButtonIcon type={button.type} />
                {button.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface TemplatePreviewButtonProps {
  templateLabel: string;
  components?: PreviewComponent[];
}

/**
 * O olhinho: abre a prévia ao passar o mouse (e ao focar pelo teclado, que o HoverCard do Radix
 * também cobre — hover puro deixaria o teclado de fora).
 */
export function TemplatePreviewButton({ templateLabel, components }: TemplatePreviewButtonProps) {
  const parsed = Array.isArray(components) ? components : [];

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Visualizar template ${templateLabel}`}
          // Sem isto, clicar no olhinho dentro de um formulário submeteria a página.
          onClick={(e) => e.preventDefault()}
        >
          <Eye className="w-4 h-4" />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent side="left" align="start" className="w-auto p-2">
        {parsed.length > 0 ? (
          <WhatsappPreview components={parsed} />
        ) : (
          <p className="text-sm text-muted-foreground p-2">Prévia indisponível para este template.</p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
