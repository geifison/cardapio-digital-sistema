import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { getPizzaSizes, getProductPizzaSizes, getPizzaFlavors, getPizzaBorders, getPizzaExtras } from '@/lib/api.ts'

// Paleta de cores para segmentos de sabores na pizza (determinística)
const PIZZA_COLORS = [
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
  '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'
]

// Formatter de moeda BRL (Shadcn-like)
const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
function normalizePrice(value) {
  if (value == null) return 0
  if (typeof value === 'number') return isNaN(value) ? 0 : value
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(',', '.'))
    return isNaN(n) ? 0 : n
  }
  const n = Number(value)
  return isNaN(n) ? 0 : n
}
function formatBRL(value) {
  return currencyFormatter.format(normalizePrice(value))
}

export default function PizzaBuilderModal({ isOpen, onClose, product, onConfirm }) {
  // Estado principal
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [sizes, setSizes] = useState([])
  const [flavors, setFlavors] = useState([])
  const [borders, setBorders] = useState([])
  const [extras, setExtras] = useState([])

  const [selectedSizeId, setSelectedSizeId] = useState(null)
  const [selectedBorderId, setSelectedBorderId] = useState(null)
  // Mapa de partes por sabor: { [flavorId]: count }
  const [flavorParts, setFlavorParts] = useState({})
  const [selectedExtraIds, setSelectedExtraIds] = useState([])

  // Filtros
  const [flavorCategory, setFlavorCategory] = useState('all')
  const [extraCategory, setExtraCategory] = useState('all')

  // Resumo
  const [observations, setObservations] = useState('')
  const [preferences, setPreferences] = useState([]) // valores livres: ['Bem passada', 'Queijo extra', ...]

  // Carregamento de dados (tamanhos/sabores/bordas/extras) com fallback do produto
  useEffect(() => {
    if (!isOpen) return
    let mounted = true
    async function load() {
      try {
        setLoading(true)
        setError('')
        const sizesData = Array.isArray(product?.pizza_sizes) && product.pizza_sizes.length > 0
          ? product.pizza_sizes
          : product?.id 
            ? await getProductPizzaSizes(product.id).catch(() => [])
            : await getPizzaSizes().catch(() => [
                { id: 1, name: 'Pequena', slices: 4, max_flavors: 1, price: 25.00, description: 'Ideal para 1-2 pessoas' },
                { id: 2, name: 'Média', slices: 6, max_flavors: 2, price: 35.00, description: 'Ideal para 2-3 pessoas' },
                { id: 3, name: 'Grande', slices: 8, max_flavors: 3, price: 45.00, description: 'Ideal para 3-4 pessoas' },
                { id: 4, name: 'Família', slices: 12, max_flavors: 4, price: 55.00, description: 'Ideal para 4-6 pessoas' }
              ])
        const flavorsData = Array.isArray(product?.pizza_flavors) && product.pizza_flavors.length > 0
          ? product.pizza_flavors
          : await getPizzaFlavors().catch(() => [
              { id: 1, name: 'Margherita', category: 'tradicional', description: 'Molho de tomate, mussarela e manjericão' },
              { id: 2, name: 'Pepperoni', category: 'tradicional', description: 'Molho de tomate, mussarela e pepperoni' },
              { id: 3, name: 'Quatro Queijos', category: 'especial', description: 'Mussarela, parmesão, gorgonzola e catupiry' },
              { id: 4, name: 'Portuguesa', category: 'especial', description: 'Presunto, ovos, cebola, azeitona e ervilha' },
              { id: 5, name: 'Chocolate', category: 'doce', description: 'Chocolate ao leite derretido' },
              { id: 6, name: 'Brigadeiro', category: 'doce', description: 'Brigadeiro cremoso com granulado' }
            ])
        const bordersData = Array.isArray(product?.pizza_borders) && product.pizza_borders.length > 0
          ? product.pizza_borders
          : await getPizzaBorders().catch(() => [
              { id: 1, name: 'Tradicional', price: 0.00, description: 'Borda tradicional' },
              { id: 2, name: 'Catupiry', price: 5.00, description: 'Borda recheada com catupiry' },
              { id: 3, name: 'Cheddar', price: 4.50, description: 'Borda recheada com cheddar' },
              { id: 4, name: 'Chocolate', price: 6.00, description: 'Borda doce com chocolate' }
            ])
        const extrasData = Array.isArray(product?.pizza_extras) && product.pizza_extras.length > 0
          ? product.pizza_extras
          : await getPizzaExtras().catch(() => [
              { id: 1, name: 'Mussarela Extra', category: 'queijo', price: 3.00, description: 'Queijo mussarela adicional' },
              { id: 2, name: 'Catupiry', category: 'queijo', price: 4.00, description: 'Catupiry cremoso' },
              { id: 3, name: 'Parmesão', category: 'queijo', price: 3.50, description: 'Parmesão ralado' },
              { id: 4, name: 'Pepperoni Extra', category: 'carne', price: 5.00, description: 'Pepperoni adicional' },
              { id: 5, name: 'Bacon', category: 'carne', price: 4.50, description: 'Bacon crocante' },
              { id: 6, name: 'Frango Desfiado', category: 'carne', price: 4.00, description: 'Frango desfiado' },
              { id: 7, name: 'Cebola', category: 'vegetal', price: 2.00, description: 'Cebola caramelizada' },
              { id: 8, name: 'Tomate', category: 'vegetal', price: 1.50, description: 'Tomate fresco' },
              { id: 9, name: 'Pimentão', category: 'vegetal', price: 2.00, description: 'Pimentão colorido' }
            ])
        if (!mounted) return
        setSizes(sizesData || [])
        setFlavors(flavorsData || [])
        setBorders(bordersData || [])
        setExtras(extrasData || [])
        
        // Selecionar borda padrão (Tradicional) automaticamente
        if (bordersData && bordersData.length > 0) {
          const defaultBorder = bordersData.find(b => b.name === 'Tradicional') || bordersData[0]
          setSelectedBorderId(defaultBorder.id)
        }
      } catch (e) {
        setError(e?.message || 'Falha ao carregar dados de pizza')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [isOpen])

  // Reset ao abrir
  useEffect(() => {
    if (!isOpen) return
    setCurrentStep(1)
    setSelectedSizeId(null)
    setFlavorParts({})
    setSelectedExtraIds([])
    setFlavorCategory('all')
    setExtraCategory('all')
    setObservations('')
    setPreferences([])
  }, [isOpen])

  const selectedSize = useMemo(() => sizes.find(s => String(s.id) === String(selectedSizeId)) || null, [sizes, selectedSizeId])
  const selectedBorder = useMemo(() => borders.find(b => String(b.id) === String(selectedBorderId)) || null, [borders, selectedBorderId])
  const maxFlavors = selectedSize?.max_flavors || 1

  // Total de partes usadas
  const usedParts = useMemo(() => Object.values(flavorParts).reduce((a, b) => a + (b || 0), 0), [flavorParts])

  // Lógica condicional para determinar passos disponíveis
  const hasBorders = useMemo(() => borders.length > 0, [borders])
  const hasExtras = useMemo(() => extras.length > 0, [extras])
  
  // Determinar próximo passo após sabores
  const getNextStepAfterFlavors = useMemo(() => {
    if (hasBorders) return 3 // Step 3: Bordas
    if (hasExtras) return 4 // Step 4: Adicionais
    return 5 // Step 5: Resumo
  }, [hasBorders, hasExtras])
  
  // Determinar próximo passo após bordas
  const getNextStepAfterBorders = useMemo(() => {
    if (hasExtras) return 4 // Step 4: Adicionais
    return 5 // Step 5: Resumo
  }, [hasExtras])

  // Avanço automático do passo 2 (Sabores) quando atingir o limite
  useEffect(() => {
    if (currentStep === 2 && selectedSize && usedParts > 0 && usedParts === (maxFlavors || 1)) {
      setCurrentStep(getNextStepAfterFlavors)
    }
  }, [currentStep, selectedSize, usedParts, maxFlavors, getNextStepAfterFlavors])

  // Base price do tamanho
  const basePrice = useMemo(() => {
    const base = normalizePrice(
      selectedSize?.final_price ??
      selectedSize?.price_final ??
      selectedSize?.base_price ??
      selectedSize?.price ?? 0
    )
    return isNaN(base) ? 0 : base
  }, [selectedSize])

  // Preço da borda
  const borderPrice = useMemo(() => {
    return normalizePrice(selectedBorder?.price || 0)
  }, [selectedBorder])

  // Soma de extras
  const extrasSum = useMemo(() => {
    return selectedExtraIds
      .map(id => {
        const extra = extras.find(e => e.id === id)
        return normalizePrice(extra?.price || 0)
      })
      .reduce((a, b) => a + b, 0)
  }, [selectedExtraIds, extras])

  // Soma dos valores de categoria dos sabores selecionados
  const flavorsSum = useMemo(() => {
    return Object.entries(flavorParts)
      .filter(([_, count]) => count > 0)
      .map(([flavorId, count]) => {
        const flavor = flavors.find(f => f.id === parseInt(flavorId))
        const categoryValue = flavor?.category_value || 0
        return categoryValue > 0 ? categoryValue * count : 0
      })
      .reduce((a, b) => a + b, 0)
  }, [flavorParts, flavors])

  // Preço total = base + borda + extras + sabores
  const totalPrice = useMemo(() => {
    return basePrice + borderPrice + extrasSum + flavorsSum
  }, [basePrice, borderPrice, extrasSum, flavorsSum])

  // Filtragens
  const filteredFlavors = useMemo(() => {
    if (flavorCategory === 'all') return flavors
    return flavors.filter(f => (f.category || '').toLowerCase() === flavorCategory)
  }, [flavors, flavorCategory])

  const filteredExtras = useMemo(() => {
    if (extraCategory === 'all') return extras
    return extras.filter(e => (e.category || '').toLowerCase() === extraCategory)
  }, [extras, extraCategory])

  // Cálculo visual do círculo da pizza (conic-gradient com partes)
  const pizzaGradient = useMemo(() => {
    if (!selectedSize || usedParts === 0) {
      return 'radial-gradient(circle at center, #fde68a 0%, #f59e0b 70%)' // fundo base quando vazio
    }
    const total = usedParts || 1
    const entries = Object.entries(flavorParts).filter(([, count]) => count > 0)
    let start = 0
    const segments = entries.map(([flavorId, count], idx) => {
      const pct = (count / total) * 100
      const end = start + pct
      const color = colorForFlavorId(Number(flavorId))
      const seg = `${color} ${start}% ${end}%`
      start = end
      return seg
    })
    return `conic-gradient(${segments.join(', ')})`
  }, [flavorParts, usedParts, selectedSize])

  function colorForFlavorId(id) {
    const idx = Math.abs(Number(id)) % PIZZA_COLORS.length
    return PIZZA_COLORS[idx]
  }

  // Ações de step
  const canGoNextFromStep1 = !!selectedSize
  const canContinueFromFlavors = usedParts > 0 && usedParts === (maxFlavors || 1)
  const canContinueFromBorders = selectedBorderId !== null

  function goNext() {
    if (currentStep === 2) {
      setCurrentStep(getNextStepAfterFlavors)
    } else if (currentStep === 3 && hasBorders) {
      setCurrentStep(getNextStepAfterBorders)
    } else {
      setCurrentStep(prev => Math.min(5, prev + 1))
    }
  }

  function goPrev() {
    if (currentStep === 4 && !hasBorders) {
      setCurrentStep(2) // Volta direto para sabores se não há bordas
    } else if (currentStep === 5 && !hasExtras && !hasBorders) {
      setCurrentStep(2) // Volta direto para sabores se não há bordas nem extras
    } else if (currentStep === 5 && !hasExtras && hasBorders) {
      setCurrentStep(3) // Volta para bordas se não há extras
    } else {
      setCurrentStep(prev => Math.max(1, prev - 1))
    }
  }

  // Progress bar: pode clicar para voltar em steps concluídos
  function canJumpToStep(step) {
    if (step < currentStep) return true
    return false
  }

  function jumpToStep(step) {
    if (canJumpToStep(step)) setCurrentStep(step)
  }

  // Seleção de tamanho
  function selectSize(id) {
    const previousSizeId = selectedSizeId
    setSelectedSizeId(id)
    
    // Só reseta sabores se realmente mudou o tamanho (não apenas navegação)
    if (previousSizeId !== id && previousSizeId !== null) {
      setFlavorParts({})
      setFlavorCategory('all')
    }
    
    // Avanço para próxima etapa apenas se não estava em uma etapa posterior
    if (currentStep === 1) {
      setCurrentStep(2)
    }
  }

  function selectBorder(borderId) {
    setSelectedBorderId(borderId)
  }

  // Controles de sabor (partes)
  function incFlavor(flavorId) {
    if (!selectedSize) return
    if (usedParts >= (maxFlavors || 1)) return
    setFlavorParts(prev => ({ ...prev, [flavorId]: Math.max(0, (prev[flavorId] || 0) + 1) }))
  }
  function decFlavor(flavorId) {
    setFlavorParts(prev => {
      const next = { ...prev }
      const cur = Math.max(0, (next[flavorId] || 0) - 1)
      if (cur === 0) delete next[flavorId]
      else next[flavorId] = cur
      return next
    })
  }
  function removeFlavor(flavorId) {
    setFlavorParts(prev => {
      const next = { ...prev }
      delete next[flavorId]
      return next
    })
  }

  // Extras
  function toggleExtra(id) {
    setSelectedExtraIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // Preferências
  function togglePref(value) {
    setPreferences(prev => prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value])
  }

  // Resumo de sabores com quantidades
  const flavorsSummaryText = useMemo(() => {
    const map = new Map()
    Object.entries(flavorParts).forEach(([fid, count]) => {
      const flavor = flavors.find(f => String(f.id) === String(fid))
      if (!flavor || !count) return
      map.set(flavor.name, (map.get(flavor.name) || 0) + count)
    })
    const parts = []
    for (const [name, count] of map.entries()) {
      parts.push(count > 1 ? `${name} (${count}x)` : name)
    }
    return parts.join(', ')
  }, [flavorParts, flavors])

  function handleConfirm() {
    if (!selectedSize) return
    // Construir nome detalhado incluindo sabores, borda e extras
    const flavorPart = flavorsSummaryText ? ` (${flavorsSummaryText})` : ''
    const borderPart = selectedBorder?.name !== 'Tradicional' ? ` [Borda: ${selectedBorder?.name}]` : ''
    const extrasPart = selectedExtraIds.length ? ` [Extras: ${selectedExtraIds.map(id => extras.find(e => e.id === id)?.name).filter(Boolean).join(', ')}]` : ''
    const prefsPart = preferences.length ? ` [Prefs: ${preferences.join(', ')}]` : ''
    const obsPart = observations ? ` [Obs: ${observations}]` : ''

    const itemName = `${product?.name || 'Pizza'} - ${selectedSize?.name || ''}${flavorPart}${borderPart}${extrasPart}${prefsPart}${obsPart}`
    const itemId = `${product?.id || 'pizza'}-${selectedSize?.id || 's'}-${selectedBorder?.id || 'b'}-${Date.now()}`
    const price = totalPrice || Number(product?.price) || 0
    const image = product?.image || product?.image_url || ''

    onConfirm?.({ id: itemId, name: itemName, price, image, quantity: 1 })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-lg w-[98%] max-w-5xl max-h-[92vh] overflow-hidden border" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold w-full text-center">🍕 {product?.name || 'Monte Sua Pizza'}</h3>
          <button onClick={onClose} className="hover:bg-muted w-9 h-9 rounded grid place-items-center border absolute right-4"><span className="sr-only">Fechar</span>✕</button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto" style={{ maxHeight: '78vh' }}>
          {loading && <div className="text-center">Carregando...</div>}
          {error && <div className="text-destructive text-sm text-center">{error}</div>}

          {!loading && !error && (
            <>
              {/* Progress */}
              <div className="flex items-center justify-center gap-3">
                {(() => {
                  const steps = [
                    { num: 1, label: 'Tamanho' },
                    { num: 2, label: 'Sabores' }
                  ]
                  if (hasBorders) steps.push({ num: 3, label: 'Bordas' })
                  if (hasExtras) steps.push({ num: 4, label: 'Adicionais' })
                  steps.push({ num: 5, label: 'Resumo' })
                  
                  return steps.map(step => (
                    <div key={step.num} className={`flex items-center gap-2`}>
                      <button
                        className={`w-8 h-8 rounded-full text-sm font-bold grid place-items-center ${currentStep === step.num ? 'bg-primary text-primary-foreground' : step.num < currentStep ? 'bg-green-600 text-white' : 'bg-muted text-foreground/70'}`}
                        onClick={() => jumpToStep(step.num)}
                        disabled={!canJumpToStep(step.num)}
                        title={step.num < currentStep ? 'Voltar para o passo ' + step.num : 'Em progresso'}
                      >{step.num}</button>
                      <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
                    </div>
                  ))
                })()
                }
              </div>

              {/* Step 1: Tamanho */}
              {currentStep === 1 && (
                <section className="text-center">
                  <div className="mb-2">
                    <h4 className="font-semibold">Escolha o Tamanho da Sua Pizza</h4>
                    <p className="text-sm text-muted-foreground">O tamanho define quantos sabores você pode escolher</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3" id="sizesGrid">
                    {sizes.map(s => {
                      const sizePrice = s.final_price ?? s.price_final ?? s.base_price ?? s.price ?? 0
                      const selected = String(selectedSizeId) === String(s.id)
                      return (
                        <button
                          key={s.id}
                          onClick={() => selectSize(s.id)}
                          className={`text-left border rounded-lg p-3 hover:border-primary transition ${selected ? 'border-primary ring-2 ring-ring/30' : ''}`}
                        >
                          <div className="text-2xl">🍕</div>
                          <div className="font-semibold text-sm">
                            {`Pizza ${s.name} ${s.slices} fatias (até ${s.max_flavors || 1} sabor${(s.max_flavors || 1) > 1 ? 'es' : ''}) ${formatBRL(s.final_price ?? s.price_final ?? s.base_price ?? s.price ?? 0)}`}
                          </div>
                          {s.description && <div className="text-xs text-muted-foreground mt-1">{s.description}</div>}
                        </button>
                      )})}
                  </div>
                </section>
              )}

              {/* Step 2: Sabores */}
              {currentStep === 2 && (
                <section className="text-center">
                  <div className="mb-2">
                    <h4 className="font-semibold">Escolha os Sabores</h4>
                    <p className="text-sm text-muted-foreground">Selecione até <span className="font-semibold">{maxFlavors}</span> sabor(es)</p>
                    <div className="text-xs text-muted-foreground mt-1">Partes usadas: <strong>{usedParts}</strong> / <strong>{maxFlavors}</strong></div>
                  </div>

                  {/* Layout simplificado: removido o círculo visual da pizza */}
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <div className="flex flex-wrap justify-center gap-2 mb-3">
                        {[
                          { key: 'all', label: 'Todos' },
                          { key: 'tradicional', label: 'Tradicionais' },
                          { key: 'especial', label: 'Especiais' },
                          { key: 'doce', label: 'Doces' },
                        ].map(c => (
                          <button
                            key={c.key}
                            onClick={() => setFlavorCategory(c.key)}
                            className={`px-3 py-1 rounded-full text-sm border ${flavorCategory === c.key ? 'bg-foreground text-background border-foreground' : 'bg-background text-foreground/80'}`}
                          >{c.label}</button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2" id="flavorsGrid">
                        {filteredFlavors.map(f => {
                          const count = flavorParts[f.id] || 0
                          const reached = usedParts >= (maxFlavors || 1)
                          const active = count > 0
                          return (
                            <div key={f.id} className={`border rounded-md p-2 text-center ${active ? 'border-primary ring-2 ring-ring/30' : ''}`}>
                              <div className="font-medium">{f.name}</div>
                              {f.description && <div className="text-xs text-muted-foreground">{f.description}</div>}
                              {f.category_value && f.category_value > 0 && <div className="text-xs text-primary font-medium">{formatBRL(f.category_value)}</div>}
                              <div className="flex flex-wrap gap-1 mt-1 justify-center">
                                {f.is_vegan === 1 && <Badge variant="outline" className="text-xs">🌱 Vegano</Badge>}
                                {f.is_gluten_free === 1 && <Badge variant="outline" className="text-xs">🌾 Sem Glúten</Badge>}
                                {f.is_spicy === 1 && <Badge variant="outline" className="text-xs">🌶️ Picante</Badge>}
                              </div>
                              <div className="flex items-center gap-2 mt-2 justify-center">
                                <button className="w-7 h-7 rounded-full border" onClick={() => decFlavor(f.id)} disabled={count === 0}>-</button>
                                <span className="min-w-[1.5rem] text-center" aria-label="partes">{count}</span>
                                <button className="w-7 h-7 rounded-full border" onClick={() => incFlavor(f.id)} disabled={reached}>+</button>
                                {active && (
                                  <button className="ml-auto text-xs text-destructive" onClick={() => removeFlavor(f.id)}>remover</button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Step 3: Bordas */}
              {currentStep === 3 && hasBorders && (
                <section className="text-center">
                  <div className="mb-2">
                    <h4 className="font-semibold">Escolha a Borda</h4>
                    <p className="text-sm text-muted-foreground">Selecione o tipo de borda para sua pizza</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3" id="bordersGrid">
                    {borders.map(b => {
                      const selected = String(selectedBorderId) === String(b.id)
                      return (
                        <button
                          key={b.id}
                          onClick={() => selectBorder(b.id)}
                          className={`text-center border rounded-lg p-3 hover:border-primary transition ${selected ? 'border-primary ring-2 ring-ring/30' : ''}`}
                        >
                          <div className="text-2xl">🍞</div>
                          <div className="font-semibold">{b.name}</div>
                          {b.description && <div className="text-xs text-muted-foreground">{b.description}</div>}
                          <div className="text-sm font-semibold mt-1 text-primary">{b.price > 0 ? `+ ${formatBRL(b.price)}` : 'Grátis'}</div>
                        </button>
                      )}
                    )}
                  </div>
                </section>
              )}

              {/* Step 4: Adicionais */}
              {currentStep === 4 && hasExtras && (
                <section className="text-center">
                  <div className="mb-2">
                    <h4 className="font-semibold">Adicionais (Opcional)</h4>
                    <p className="text-sm text-muted-foreground">Adicione ingredientes extras à sua pizza</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 mb-3">
                    {[
                      { key: 'all', label: 'Todos' },
                      { key: 'queijo', label: 'Queijos' },
                      { key: 'carne', label: 'Carnes' },
                      { key: 'vegetal', label: 'Vegetais' },
                    ].map(c => (
                      <button
                        key={c.key}
                        onClick={() => setExtraCategory(c.key)}
                        className={`px-3 py-1 rounded-full text-sm border ${extraCategory === c.key ? 'bg-foreground text-background border-foreground' : 'bg-background text-foreground/80'}`}
                      >{c.label}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2" id="extrasGrid">
                    {filteredExtras.map(e => {
                      const active = selectedExtraIds.includes(e.id)
                      return (
                        <button key={e.id} onClick={() => toggleExtra(e.id)} className={`text-center border rounded-md p-2 hover:border-green-600 ${active ? 'border-green-600 ring-2 ring-green-500/20' : ''}`}>
                          <div className="font-medium">{e.name}</div>
                          {e.description && <div className="text-xs text-muted-foreground">{e.description}</div>}
                          <div className="text-sm font-semibold text-green-700 mt-1">+ {formatBRL(e.price)}</div>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Step 5: Resumo */}
              {currentStep === 5 && (
                <section className="text-center">
                  <div className="mb-2">
                    <h4 className="font-semibold">Resumo da Sua Pizza</h4>
                    <p className="text-sm text-muted-foreground">Confirme os detalhes antes de adicionar ao carrinho</p>
                  </div>

                  {/* Layout simplificado: apenas texto, sem gráfico circular */}
                  <div className="grid grid-cols-1 gap-4">
                    <div className="grid gap-3">
                      <div>
                        <h5 className="font-semibold">Tamanho</h5>
                        <p className="text-foreground">{selectedSize?.name || '-'} {selectedSize ? <span className="text-muted-foreground">— {formatBRL(basePrice)}</span> : null}</p>
                      </div>
                      <div>
                        <h5 className="font-semibold">Sabores</h5>
                        <p className="text-foreground">{flavorsSummaryText || '-'}</p>
                      </div>
                      {hasBorders && (
                        <div>
                          <h5 className="font-semibold">Borda</h5>
                          <p className="text-foreground">{selectedBorder?.name || '-'} {selectedBorder && borderPrice > 0 ? <span className="text-muted-foreground">— {formatBRL(borderPrice)}</span> : null}</p>
                        </div>
                      )}
                      {hasExtras && selectedExtraIds.length > 0 && (
                        <div>
                          <h5 className="font-semibold">Adicionais</h5>
                          <p className="text-foreground">{selectedExtraIds.map(id => extras.find(e => e.id === id)?.name).filter(Boolean).join(', ')}</p>
                          <p className="text-xs text-muted-foreground">Subtotal adicionais: {formatBRL(extrasSum)}</p>
                        </div>
                      )}
                      <div>
                        <h5 className="font-semibold">Preço Total</h5>
                        <p className="text-2xl font-bold text-green-700">{formatBRL(totalPrice)}</p>
                        <p className="text-xs text-muted-foreground">{formatBRL(basePrice)} (tamanho) {flavorsSum > 0 ? `+ ${formatBRL(flavorsSum)} (sabores)` : ''} {borderPrice > 0 ? `+ ${formatBRL(borderPrice)} (borda)` : ''} {selectedExtraIds.length > 0 ? `+ ${formatBRL(extrasSum)} (adicionais)` : ''}</p>
                      </div>
                      <div>
                        <h5 className="font-semibold">Observações (Opcional)</h5>
                        <textarea value={observations} onChange={e => setObservations(e.target.value)} rows={3} placeholder="Ex: Sem cebola, bem passada, etc..." className="w-full p-2 border rounded-md" />
                      </div>
                      <div>
                        <h5 className="font-semibold">Preferências de Preparo</h5>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                          {['Bem passada','Queijo extra','Borda crocante','Sem cebola'].map(v => (
                            <label key={v} className="flex items-center gap-2 justify-center">
                              <input type="checkbox" checked={preferences.includes(v)} onChange={() => togglePref(v)} /> {v}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-4 border-t pt-4">
                    <Button variant="outline" onClick={goPrev}><span className="mr-1">←</span> Voltar</Button>
                    <Button className="bg-green-600 hover:bg-green-700" onClick={handleConfirm}>Adicionar ao carrinho</Button>
                  </div>
                </section>
              )}

              {/* Footer fixo com preço e navegação quando não estiver no resumo */}
              {currentStep !== 5 && (
                <section className="flex items-center justify-between border rounded-lg p-3">
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Preço total</div>
                    <div className="text-2xl font-bold text-green-700">{formatBRL(totalPrice)}</div>
                  </div>
                  <div className="flex gap-2">
                    {currentStep > 1 && <Button variant="outline" onClick={goPrev}>Voltar</Button>}
                    {currentStep === 1 && <Button onClick={() => canGoNextFromStep1 && setCurrentStep(2)} disabled={!canGoNextFromStep1}>Continuar</Button>}
                    {currentStep === 2 && <Button onClick={() => canContinueFromFlavors && goNext()} disabled={!canContinueFromFlavors}>Continuar</Button>}
                    {currentStep === 3 && hasBorders && <Button onClick={() => canContinueFromBorders && goNext()} disabled={!canContinueFromBorders}>Continuar</Button>}
                    {currentStep === 4 && hasExtras && <Button onClick={goNext}>Continuar</Button>}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}