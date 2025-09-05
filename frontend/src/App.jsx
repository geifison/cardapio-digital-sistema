import { useState, useEffect, useLayoutEffect, useRef } from 'react'
// Remover import de Button pois não será mais usado aqui
// import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Badge } from '@/components/ui/badge.jsx'
// Remover Star do import
import { Search, Clock, Sparkles } from 'lucide-react'
import MenuCard from './components/MenuCard.jsx'
import { CategoryFilter } from './components/CategoryFilter.jsx'
import { CartSidebar } from './components/CartSidebar.jsx'
import { getCategories, getProducts, getCompanyInfo } from '@/lib/api.ts'
import { CartProvider } from '@/stores/cart.jsx'
import { useRealtimeStore, useConnectionStatus } from '@/stores/realtimeStore.js'
import ConnectionStatus from './components/ConnectionStatus.jsx'
import './App.css'
import Footer from './components/Footer.jsx'

function AppContent() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  // Remover estado de showPopular
  // const [showPopular, setShowPopular] = useState(false)
  const [categories, setCategories] = useState([{ id: 'all', name: 'Todos' }])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [companyInfo, setCompanyInfo] = useState(null)
  // Tamanho do quadrado (ajustado proporcionalmente ao comprimento dos nomes)
  const [squareSize, setSquareSize] = useState(56)
  const titleRef = useRef(null)
  const subtitleRef = useRef(null)
  // Novos refs/estados para calcular altura do header e do filtro
  const headerRef = useRef(null)
  const filterRef = useRef(null)
  const [headerHeight, setHeaderHeight] = useState(0)
  const [filterHeight, setFilterHeight] = useState(0)
  
  // Store de tempo real
  const { connect, disconnect, getConnectionInfo } = useRealtimeStore()
  const { isConnected, connectionStatus } = useConnectionStatus()

  // Helper para normalizar URL de imagem (absoluta/relativa)
  const normalizeImageUrl = (url) => {
    if (!url) return ''
    try {
      // Se já for absoluta
      const absolute = new URL(url)
      return absolute.href
    } catch {
      // Relativa ao host atual
      const base = window.location.origin.replace(/\/$/, '')
      const path = url.startsWith('/') ? url : `/${url}`
      return `${base}${path}`
    }
  }

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        setLoading(true)
        setError('')
        const [cats, prods] = await Promise.all([
          getCategories(),
          getProducts(),
        ])
        if (!mounted) return
        const mappedCats = [{ id: 'all', name: 'Todos' }, ...cats.map(c => ({ id: c.id, name: c.name }))]
        setCategories(mappedCats)
        setProducts(prods)
      } catch (e) {
        setError(e?.message || 'Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  // Buscar company_info para preencher o cabeçalho
  useEffect(() => {
    let mounted = true
    getCompanyInfo()
      .then((info) => { if (mounted) setCompanyInfo(info || null) })
      .catch(() => {})
    return () => { mounted = false }
  }, [])
  
  // Inicializar conexão Socket.IO para comunicação em tempo real
  useEffect(() => {
    console.log('Inicializando conexão Socket.IO...')
    connect()
    
    // Cleanup na desmontagem do componente
    return () => {
      console.log('Desconectando Socket.IO...')
      disconnect()
    }
  }, [])
  
  // Log do status da conexão para debug
  useEffect(() => {
    console.log('Status da conexão Socket.IO:', { isConnected, connectionStatus })
  }, [isConnected, connectionStatus])

  // Medir largura dos textos para ajustar tamanho do quadrado
  useLayoutEffect(() => {
    const calc = () => {
      const w1 = titleRef.current?.offsetWidth || 0
      const w2 = subtitleRef.current?.offsetWidth || 0
      const maxW = Math.max(w1, w2)
      // 12% da largura do maior texto, com limites mínimos/máximos
      const size = Math.round(Math.min(96, Math.max(48, maxW * 0.12)))
      setSquareSize(size)
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [companyInfo?.company_name])

  // Calcular dinamicamente a altura do header e do filtro para posicionamento fixo
  useLayoutEffect(() => {
    const calcHeights = () => {
      const h = headerRef.current?.offsetHeight || 0
      const fh = filterRef.current?.offsetHeight || 0
      setHeaderHeight(h)
      setFilterHeight(fh)
      // Atualiza CSS custom properties para uso com Tailwind arbitrary values
      if (typeof document !== 'undefined') {
        const root = document.documentElement
        root.style.setProperty('--header-h', `${h}px`)
        root.style.setProperty('--filter-h', `${fh}px`)
      }
    }
    calcHeights()
    window.addEventListener('resize', calcHeights)
    return () => window.removeEventListener('resize', calcHeights)
  }, [])

  // Sincroniza variáveis CSS caso alturas mudem por outros motivos além de resize
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--header-h', `${headerHeight}px`)
    }
  }, [headerHeight])
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--filter-h', `${filterHeight}px`)
    }
  }, [filterHeight])

  const filteredItems = products
    .filter(item => {
      const name = String(item.name || '').toLowerCase()
      const desc = String(item.description || '').toLowerCase()
      const term = searchTerm.toLowerCase()
      const catOk = selectedCategory === 'all' ? true : String(item.category_id) === String(selectedCategory)
      return catOk && (name.includes(term) || desc.includes(term))
    })



  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [selectedCategory])

  const initials = (companyInfo?.company_name || 'CD')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0])
    .join('')
    .toUpperCase()

  return (
    <div className="min-h-screen bg-background">
      <header ref={headerRef} className="bg-primary text-primary-foreground p-4 sticky top-0 z-40 shadow-md">
        <div className="container mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
              className="flex-shrink-0 overflow-hidden rounded-l-2xl rounded-r-none shadow-sm bg-black/5 backdrop-blur-[1px]"
              style={{ width: squareSize, height: squareSize }}
              aria-hidden="true"
            >
              {companyInfo?.logo_url ? (
                <img
                  src={normalizeImageUrl(companyInfo?.logo_url)}
                  alt={companyInfo?.company_name ? `Logo da ${companyInfo.company_name}` : 'Logo da empresa'}
                  className="w-full h-full object-contain p-1 select-none"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-primary-foreground/80 font-semibold text-lg">
                  {initials}
                </div>
              )}
            </div>
            <div>
              <p ref={subtitleRef} className="text-xs opacity-90 leading-none">Cardápio Digital</p>
              <h1 ref={titleRef} className="text-2xl font-bold leading-tight">{companyInfo?.company_name || ''}</h1>
            </div>
            </div>
            <div className="flex items-center gap-2">
              <ConnectionStatus />
              <Badge variant="secondary" className="bg-green-600 text-white">
                <Clock className="w-3 h-3 mr-1" />
                Aberto
              </Badge>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar pratos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background text-foreground"
            />
          </div>
          {error && (
            <div className="mt-2 text-sm text-red-600">{error}</div>
          )}

          {/* (Filtro de categorias movido para fora do header) */}
        </div>
      </header>

      {/* Seção separada para o filtro de categorias */}
      <div
        ref={filterRef}
        className="container mx-auto p-4 bg-background shadow-sm fixed left-0 right-0 top-[var(--header-h)] z-30"
      >
        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
      </div>
      {/* Espaçador para compensar a altura do filtro fixo */}
      <div className="h-[var(--filter-h)]" />

      <main className="container mx-auto p-4">
        {/* CategoryFilter removido daqui para ficar no header sticky */}

        {loading ? (
          <div className="text-center py-12">Carregando...</div>
        ) : (
          <>
            <div className="container mx-auto px-4 py-6">
              <div className="og-grid og-cols-3">
                {filteredItems.map((item) => (
                  <MenuCard
                    key={item.id}
                    item={{
                      id: item.id,
                      name: item.name,
                      description: item.description || '',
                      price: Number(item.price) || 0,
                      image: item.image_url || '/src/assets/placeholder.svg',
                      popular: item.popular || false,
                      ingredients: Array.isArray(item.ingredients) ? item.ingredients : [],
                      product_type: item.product_type || item.type || '',
                      // Flags de características para badges
                      is_vegetarian: item.is_vegetarian,
                      is_vegan: item.is_vegan,
                      is_gluten_free: item.is_gluten_free,
                      is_spicy: item.is_spicy,
                      // Preço mínimo para pizzas (tamanho mais barato)
                      min_price: item.min_price,
                    }}
                  />
                ))}
              </div>

              {filteredItems.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🔍</div>
                  <h3 className="text-xl font-semibold mb-2">Nenhum item encontrado</h3>
                  <p className="text-muted-foreground">
                    Tente buscar por outro termo ou categoria
                  </p>
                </div>
              )}


              <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-lg mb-8 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5" />
                  <h3 className="text-lg font-bold">Oferta Especial!</h3>
                  <Sparkles className="w-5 h-5" />
                </div>
                <p className="text-sm opacity-90 mb-3">
                  Frete grátis para pedidos acima de R$ 50,00
                </p>
                <Badge className="bg-white text-orange-500 font-semibold">
                  Válido até o final do mês
                </Badge>
              </div>
            </div>
          </>
        )}
      </main>

      <CartSidebar />

      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <CartProvider>
      <AppContent />
    </CartProvider>
  )
}
