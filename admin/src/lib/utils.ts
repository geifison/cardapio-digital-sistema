import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- Currency (BRL) utilities ---
// Formata um número para moeda BRL (Ex: R$ 1.234,50)
export function formatCurrencyBRL(value: number | string | null | undefined): string {
  const num = typeof value === 'string' ? Number(value) : (value ?? 0)
  const safe = Number.isFinite(num) ? (num as number) : 0
  return safe.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Faz o parse de um texto de moeda BRL para número (em reais)
// Ex: "R$ 1.234,50" -> 1234.5
export function parseCurrencyBRL(input: string): number {
  if (!input) return 0
  const digits = input.replace(/\D/g, '')
  if (!digits) return 0
  return Number(digits) / 100
}

// Aplica máscara dinâmica: mantém apenas dígitos e retorna { masked, value }
export function applyCurrencyMaskBRL(raw: string): { masked: string; value: number } {
  const value = Math.round(Number(raw.replace(/\D/g, ""))) / 100 
  const masked = formatCurrencyBRL(value)
  return { masked, value }
}

// Máscara de CNPJ (XX.XXX.XXX/XXXX-XX)
export function applyCNPJMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

// Máscara de telefone brasileiro (flexível para celular e fixo)
export function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// Extrair apenas dígitos de campo com máscara
export function extractDigits(value: string): string {
  return value.replace(/\D/g, '');
}

// Validação de CNPJ (formato básico)
export function isValidCNPJFormat(cnpj: string): boolean {
  const digits = extractDigits(cnpj);
  return digits.length === 14;
}

// Validação de telefone brasileiro (formato básico)
export function isValidPhoneFormat(phone: string): boolean {
  const digits = extractDigits(phone);
  return digits.length >= 10 && digits.length <= 11;
}

// Helper para normalizar URLs de imagem do backend (corrige caminhos antigos)
export function normalizeImageUrl(url?: string | null): string {
  if (!url) return ""
  // Regra base da app (onde o PHP está servido)
  const basePrefix = "/cardapio-digital-sistema"

  try {
    const u = new URL(url)
    // Somente normaliza se for ambiente local
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      // Colapsar prefixo duplicado, se existir
      u.pathname = u.pathname.replace(
        /\/cardapio-digital-sistema\/cardapio-digital-sistema\//,
        "/cardapio-digital-sistema/"
      )
    }
    return u.toString()
  } catch {
    // URL relativa
    let p = url
    // Colapsar prefixo duplicado, se existir
    p = p.replace(
      /\/cardapio-digital-sistema\/cardapio-digital-sistema\//,
      "/cardapio-digital-sistema/"
    )
    // Se vier apenas como "/uploads/...", prefixa uma única vez
    if (p.startsWith("/uploads/")) {
      p = `${basePrefix}${p}`
    }
    return p
  }
}

// --- Texto: normalização e remoção de acentos ---
// Normaliza string para lower-case e remove acentos/diacríticos
export function normalizeText(text?: string | null): string {
  if (!text) return ""
  try {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
  } catch {
    return String(text).toLowerCase().trim()
  }
}

// Constrói URL de asset público respeitando BASE_URL (Vite)
export function assetUrl(path: string): string {
  const base = ((import.meta as any).env?.BASE_URL as string) || "/";
  const trimmedBase = base.replace(/\/+$/, ""); // remove barras finais
  const p = path.startsWith("/") ? path : `/${path}`;
  // Se BASE_URL for absoluto (http...), respeita-o; caso contrário, retorna caminho relativo ao host atual
  if (/^https?:\/\//i.test(base)) {
    return `${trimmedBase}${p}`;
  }
  return `${trimmedBase}${p}` || p;
}