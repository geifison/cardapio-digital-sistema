import { useState, useRef } from 'react'
import PizzaBuilderModal from './PizzaBuilderModal.jsx'
import { normalizeImageUrl } from '@/lib/utils.ts'
import { Badge } from '@/components/ui/badge.jsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog.jsx'
import { Button } from '@/components/ui/button.jsx'
import { ShoppingCart, Plus } from 'lucide-react'
import { useCart } from '@/stores/cart.jsx'

export default function MenuCard({ item, onOpenPizzaBuilder }) {
  const [openPizza, setOpenPizza] = useState(false)
  const [openDetails, setOpenDetails] = useState(false)
  const suppressNextOpenRef = useRef(false)
  const { addItem } = useCart()

  const isPizza = String(item?.product_type || item?.type || '').toLowerCase() === 'pizza'

  // Preço exibido no card: para pizzas usa min_price do backend ou calcula localmente; demais: price_final > price
  const displayPrice = isPizza
    ? (item?.min_price ?? deriveMinPizzaPrice(item))
    : (item?.price_final ?? item?.price ?? 0)

  const formatBRL = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)

  function formatPriceParts(value) {
    const n = Number(value) || 0
    const f = n.toFixed(2)
    const [integer, decimals] = f.split('.')
    const symbol = 'R$'
    return { integer, decimals, symbol }
  }

  function deriveMinPizzaPrice(pizza) {
    const base = Number(pizza?.base_price || pizza?.price || 0)
    const sizes = Array.isArray(pizza?.sizes_prices) ? pizza.sizes_prices : []
    const minSize = sizes.length > 0 ? Math.min(...sizes.map((p) => Number(p) || 0)) : 0
    const extras = Array.isArray(pizza?.default_extras_prices) ? pizza.default_extras_prices : []
    const minExtras = extras.length > 0 ? Math.min(...extras.map((p) => Number(p) || 0)) : 0
    const candidates = [base, minSize, minExtras].filter((v) => v > 0)
    return candidates.length > 0 ? Math.min(...candidates) : base
  }

  // Flag booleana (0/1, '0'/'1', true/false)
  function truthyFlag(v) {
    return v === 1
  }

  const imgSrc = normalizeImageUrl(item?.image || item?.image_url)
  const priceParts = formatPriceParts(displayPrice)

  // Ao clicar no card: se for pizza, abre o PizzaBuilder imediatamente; caso contrário, abre detalhes
  const handleCardOpen = () => {
    if (suppressNextOpenRef.current) return
    if (isPizza) {
      setOpenPizza(true)
      onOpenPizzaBuilder?.(item)
    } else {
      setOpenDetails(true)
    }
  }
  const handleCloseDetails = () => setOpenDetails(false)

  const handleAddFromDialog = () => {
    if (isPizza) {
      setOpenDetails(false)
      setOpenPizza(true)
      onOpenPizzaBuilder?.(item)
    } else {
      addItem(item)
      setOpenDetails(false) // Fecha o modal após adicionar ao carrinho
    }
  }

  const handleDetailsOpenChange = (nextOpen) => {
    setOpenDetails(nextOpen)
    if (!nextOpen) {
      suppressNextOpenRef.current = true
      setTimeout(() => {
        suppressNextOpenRef.current = false
      }, 250)
    }
  }

  return (
    <div
      className="og-card cursor-pointer relative"
      role="button"
      tabIndex={0}
      onClick={handleCardOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleCardOpen()
        }
      }}
    >
      {/* Imagem com badge de preço sobreposto no canto superior direito */}
      <div className="og-media">
        {imgSrc ? (
          <img src={imgSrc} alt={item?.name || 'Item do cardápio'} />
        ) : (
          <img src="/src/assets/placeholder.svg" alt="sem imagem" />
        )}
        <Badge className="og-price-badge bg-[#16a34a] text-white/95 shadow-sm rounded-full px-2.5 py-1 text-[0.8rem] font-semibold leading-none whitespace-nowrap">
          <span className="inline-flex items-baseline leading-none">
            {isPizza && (
              <span className="text-[0.72em] mr-1">A partir de</span>
            )}
            <span aria-hidden className="text-[0.72em] mr-1">{priceParts.symbol}</span>
            <span>{priceParts.integer}</span>
            <span className="text-[0.72em]">,{priceParts.decimals}</span>
          </span>
        </Badge>
      </div>

      <div className="og-content">
        {/* Badges de características: abaixo da badge de preço */}
        {(truthyFlag(item?.is_vegetarian) || truthyFlag(item?.is_vegan) || truthyFlag(item?.is_gluten_free) || truthyFlag(item?.is_spicy)) && (
          <div className="flex flex-wrap items-center gap-1 mb-2 opacity-90 text-[0.72rem]">
            {truthyFlag(item?.is_vegetarian) && (
              <Badge className="rounded-full px-2 py-0.5 bg-[#16a34a] text-white">Vegetariano</Badge>
            )}
            {truthyFlag(item?.is_vegan) && (
              <Badge className="rounded-full px-2 py-0.5 bg-[#60a5fa] text-black">Vegano</Badge>
            )}
            {truthyFlag(item?.is_gluten_free) && (
              <Badge className="rounded-full px-2 py-0.5 bg-[#facc15] text-black">Sem glúten</Badge>
            )}
            {truthyFlag(item?.is_spicy) && (
              <Badge className="rounded-full px-2 py-0.5 bg-[#ef4444] text-white">Apimentado</Badge>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 6 }}>
          <h3 className="m-0 font-bold text-[1.1rem] text-zinc-900 dark:text-zinc-100">{item?.name || 'Nome do produto'}</h3>
        </div>

        {item?.description && (
          <p className="og-muted" style={{ minHeight: 44 }}>{item.description}</p>
        )}

        {/* Tamanhos (se houver) */}
        {Array.isArray(item?.sizes) && item.sizes.length > 0 && (
          <div style={{ margin: '8px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="og-muted" style={{ fontSize: '.85rem' }}>Tamanho:</span>
            {item.sizes.map((s) => (
              <button key={s} className="og-tab" type="button">{s}</button>
            ))}
          </div>
        )}

        {/* Opções extras (se houver) */}
        {Array.isArray(item?.options) && item.options.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '6px 0 10px' }}>
            {item.options.map((o) => (
              <button key={o.id} className="og-tab" type="button">
                {o.label} {o.price ? (<small> (+{formatBRL(o.price)})</small>) : null}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Botão rápido de adicionar (ícone +) fixo no canto inferior direito */}
      <button
        type="button"
        aria-label="Adicionar"
        className="absolute bottom-[10px] right-[10px] inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 border border-zinc-200 shadow-md hover:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/30 text-green-600"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (isPizza) {
            setOpenPizza(true)
            onOpenPizzaBuilder?.(item)
          } else {
            addItem(item)
          }
        }}
      >
        <Plus className="h-5 w-5" />
      </button>

      {/* Modal de detalhes do produto */}
      <Dialog open={openDetails} onOpenChange={handleDetailsOpenChange}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          <div className="w-full">
            {imgSrc ? (
              <img className="w-full h-56 object-cover sm:h-64" src={imgSrc} alt={item?.name || 'Item do cardápio'} />
            ) : (
              <img className="w-full h-56 object-cover sm:h-64" src="/src/assets/placeholder.svg" alt="sem imagem" />
            )}
          </div>
          <div className="p-5 space-y-4">
            <DialogHeader className="space-y-1">
              <DialogTitle>{item?.name || 'Nome do produto'}</DialogTitle>
              {item?.description && (
                <DialogDescription>{item.description}</DialogDescription>
              )}
            </DialogHeader>

            {(truthyFlag(item?.is_vegetarian) || truthyFlag(item?.is_vegan) || truthyFlag(item?.is_gluten_free) || truthyFlag(item?.is_spicy)) && (
              <div className="flex flex-wrap items-center gap-2">
                {truthyFlag(item?.is_vegetarian) && (
                  <Badge className="rounded-full px-2 py-0.5 bg-[#16a34a] text-white">Vegetariano</Badge>
                )}
                {truthyFlag(item?.is_vegan) && (
                  <Badge className="rounded-full px-2 py-0.5 bg-[#60a5fa] text-black">Vegano</Badge>
                )}
                {truthyFlag(item?.is_gluten_free) && (
                  <Badge className="rounded-full px-2 py-0.5 bg-[#facc15] text-black">Sem glúten</Badge>
                )}
                {truthyFlag(item?.is_spicy) && (
                  <Badge className="rounded-full px-2 py-0.5 bg-[#ef4444] text-white">Apimentado</Badge>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-xl font-semibold">
                {formatBRL(displayPrice)}
              </div>
              <Button className="bg-green-600 hover:bg-green-700" onClick={handleAddFromDialog}>
                <ShoppingCart className="w-4 h-4 mr-2" />
                Adicionar ao carrinho
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {openPizza && (
        <PizzaBuilderModal
          isOpen={openPizza}
          product={item}
          onClose={() => setOpenPizza(false)}
          onConfirm={(pizzaItem) => {
            addItem(pizzaItem)
            setOpenPizza(false) // Fecha o modal após adicionar ao carrinho
          }}
        />
      )}
    </div>
  )
}

