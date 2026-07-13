import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { normalizePath } from "@/lib/utils";
import { Building2, Megaphone } from "lucide-react";
import Campaigns from "./Campaigns";
import WhatsAppBusiness from "./WhatsAppBusiness";

/** A aba vem da URL: /campaigns e /whatsapp-business continuam valendo. */
const TAB_ROUTES = {
  campanhas: "/campaigns",
  contas: "/whatsapp-business",
} as const;

type Tab = keyof typeof TAB_ROUTES;

/**
 * Disparos via API Oficial (Meta): as campanhas por template e as contas Business que as
 * enviam — antes, dois itens de menu que não diziam pertencer ao mesmo canal.
 */
export default function DisparoApiOficial() {
  const [location, setLocation] = useLocation();
  // A rota do wouter casa com barra final ("/whatsapp-business/"), mas o location vem
  // literal — sem normalizar, essa URL renderizaria o shell e cairia na aba errada.
  const path = normalizePath(location);
  const activeTab: Tab = path === TAB_ROUTES.contas ? "contas" : "campanhas";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Disparos via API Oficial
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Envie por templates aprovados na API oficial da Meta — o único canal
            que confirma entrega e leitura.
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={value => setLocation(TAB_ROUTES[value as Tab])}
        >
          {/* Rotulada: a aba Contas tem abas internas (uma por conta Meta) na seção de blacklist. */}
          <TabsList aria-label="Seções de Disparos via API Oficial">
            <TabsTrigger value="campanhas" className="gap-2">
              <Megaphone className="w-4 h-4" />
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="contas" className="gap-2">
              <Building2 className="w-4 h-4" />
              Contas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="campanhas" className="mt-6">
            <Campaigns />
          </TabsContent>
          <TabsContent value="contas" className="mt-6">
            <WhatsAppBusiness />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
