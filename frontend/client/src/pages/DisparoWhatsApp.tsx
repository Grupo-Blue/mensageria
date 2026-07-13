import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { normalizePath } from "@/lib/utils";
import { MessageSquare, Rocket } from "lucide-react";
import BaileysCampaigns from "./BaileysCampaigns";
import WhatsApp from "./WhatsApp";

/** A aba vem da URL: /disparos e /whatsapp continuam valendo e cada uma abre a sua. */
const TAB_ROUTES = {
  disparos: "/disparos",
  conexoes: "/whatsapp",
} as const;

type Tab = keyof typeof TAB_ROUTES;

/**
 * Disparo via WhatsApp (QR Code / Baileys): os disparos e os telefones que os enviam,
 * que antes eram dois itens de menu sem relação aparente entre si.
 */
export default function DisparoWhatsApp() {
  const [location, setLocation] = useLocation();
  // A rota do wouter casa com barra final ("/whatsapp/"), mas o location vem literal —
  // sem normalizar, essa URL renderizaria o shell e cairia na aba errada.
  const path = normalizePath(location);
  const activeTab: Tab = path === TAB_ROUTES.conexoes ? "conexoes" : "disparos";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Disparo via WhatsApp
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Conecte seus telefones por QR Code e envie em massa, com variações
            de texto e intervalos aleatórios para reduzir o risco de banimento.
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={value => setLocation(TAB_ROUTES[value as Tab])}
        >
          {/* Rotulada: a aba Conexões pode conter outras abas, e o leitor de tela precisa distingui-las. */}
          <TabsList aria-label="Seções de Disparo via WhatsApp">
            <TabsTrigger value="disparos" className="gap-2">
              <Rocket className="w-4 h-4" />
              Disparos
            </TabsTrigger>
            <TabsTrigger value="conexoes" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Conexões
            </TabsTrigger>
          </TabsList>

          <TabsContent value="disparos" className="mt-6">
            <BaileysCampaigns />
          </TabsContent>
          <TabsContent value="conexoes" className="mt-6">
            <WhatsApp />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
