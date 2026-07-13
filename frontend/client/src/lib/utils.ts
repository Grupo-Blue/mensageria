import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Remove a barra final da rota. As rotas do wouter casam com e sem ela ("/whatsapp" e
 * "/whatsapp/" levam à mesma tela), mas `useLocation()` devolve o caminho literal — então
 * comparar a location com uma rota exige normalizar antes, ou "/whatsapp/" não seria
 * reconhecida.
 */
export function normalizePath(path: string): string {
  return path.replace(/\/+$/, "") || "/";
}
