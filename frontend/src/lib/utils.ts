import type { ClassValue } from "clsx"
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Normaliza URLs de imagem vindas do backend, evitando duplicação de caminhos e tornando absolutas no dev
export function normalizeImageUrl(input?: string | null): string {
  const PLACEHOLDER = '/src/assets/placeholder.svg'
  if (!input || typeof input !== 'string') return PLACEHOLDER
  let v = input.trim()

  // Corrigir duplicações conhecidas
  v = v.replace(/\/cardapio-digital-sistema\/cardapio-digital-sistema\//g, '/cardapio-digital-sistema/')
  v = v.replace(/(^|https?:\/\/localhost\/)cardapio-digital-sistema\/cardapio-digital-sistema\//g, '$1cardapio-digital-sistema/')

  // Se já for absoluta ou data URL, retorna como está (após limpeza)
  if (/^(https?:)?\/\//i.test(v) || v.startsWith('data:')) {
    return v
  }

  const DEV_BASE = 'http://localhost/cardapio-digital-sistema'
  const PROD_BASE = '/cardapio-digital-sistema'
  const BASE = import.meta?.env?.DEV ? DEV_BASE : PROD_BASE

  // Normalizar variações comuns
  if (v.startsWith('/cardapio-digital-sistema/')) {
    return import.meta?.env?.DEV ? `http://localhost${v}` : v
  }
  if (v.startsWith('cardapio-digital-sistema/')) {
    const path = '/' + v
    return import.meta?.env?.DEV ? `http://localhost${path}` : path
  }
  if (v.startsWith('/uploads/')) {
    return `${BASE}${v}`
  }
  if (v.startsWith('uploads/')) {
    return `${BASE}/${v}`
  }

  // Caminho relativo qualquer: não tentar resolver contra Vite, usar placeholder
  return PLACEHOLDER
}
