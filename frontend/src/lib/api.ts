// Base da API: dev usa proxy do Vite, prod usa caminho do WAMP
export const API_BASE = import.meta.env.DEV
  ? '/api/'
  : '/cardapio-digital-sistema/api/'

export async function getCategories() {
  const r = await fetch(API_BASE + 'categories')
  if (!r.ok) throw new Error('Falha ao carregar categorias')
  const json = await r.json()
  return json?.data ?? []
}

export async function getProducts() {
  const r = await fetch(API_BASE + 'products?active=true')
  if (!r.ok) throw new Error('Falha ao carregar produtos')
  const json = await r.json()
  return json?.data ?? []
}

export async function getCompanyInfo() {
  // Usar endpoint público sem necessidade de autenticação
  const r = await fetch(API_BASE + 'settings/company-info-public')
  if (!r.ok) throw new Error('Falha ao carregar company info')
  const json = await r.json()
  return json?.data ?? null
}

// --- Novos endpoints públicos de status de negócio ---
export async function getBusinessHours() {
  const r = await fetch(API_BASE + 'settings/business-hours')
  if (!r.ok) throw new Error('Falha ao carregar horários de funcionamento')
  const json = await r.json()
  return json?.data ?? null
}

export async function getPauseState() {
  const r = await fetch(API_BASE + 'settings/pause')
  if (!r.ok) throw new Error('Falha ao carregar estado de pausa')
  const json = await r.json()
  return json?.data ?? { paused: false, message: '' }
}

// Criar novo pedido (público)
export async function createOrder(payload) {
  const r = await fetch(API_BASE + 'orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await r.json().catch(() => ({}))
  if (!r.ok || json?.error) {
    const msg = json?.message || 'Falha ao criar pedido'
    throw new Error(msg)
  }
  return json
}

export async function getPizzaSizes() {
  const r = await fetch(API_BASE + 'pizza/sizes')
  if (!r.ok) throw new Error(`Erro ao buscar tamanhos: ${r.status}`)
  const json = await r.json()
  return json?.data ?? []
}

export async function getProductPizzaSizes(productId: number) {
  const r = await fetch(API_BASE + `pizza/product-sizes/${productId}`)
  if (!r.ok) throw new Error(`Erro ao buscar tamanhos do produto: ${r.status}`)
  const json = await r.json()
  // Backend pode retornar { data: { sizes: [...] } } ou { data: [...] }
  const raw = json?.data?.sizes ?? json?.data ?? []
  const arr = Array.isArray(raw) ? raw : []
  // Normaliza preço em final_price para consumo consistente no frontend
  return arr.map((s: any) => ({
    ...s,
    final_price: Number(
      (s && (s.final_price ?? s.price_final ?? s.price ?? s.base_price)) ?? 0
    )
  }))
}

export async function getPizzaFlavors() {
  const r = await fetch(API_BASE + 'pizza/flavors')
  if (!r.ok) throw new Error(`Erro ao buscar sabores: ${r.status}`)
  const json = await r.json()
  return json?.data ?? []
}

export async function getPizzaBorders() {
  const r = await fetch(API_BASE + 'pizza/borders')
  if (!r.ok) throw new Error(`Erro ao buscar bordas: ${r.status}`)
  const json = await r.json()
  return json?.data ?? []
}

export async function getPizzaExtras() {
  const r = await fetch(API_BASE + 'pizza/extras')
  if (!r.ok) throw new Error(`Erro ao buscar extras: ${r.status}`)
  const json = await r.json()
  return json?.data ?? []
}

// Novo: obter chave pública do Mapbox (se configurada)
export async function getMapboxPublicKey() {
  try {
    const r = await fetch(API_BASE + 'mapbox/public-key')
    if (!r.ok) return null
    const json = await r.json()
    return json?.public_key || null
  } catch (_) {
    return null
  }
}