# Cardápio Digital - Pizzaria & Hamburgueria

Um cardápio digital moderno e dinâmico desenvolvido com React e shadcn/ui, focado em usabilidade móvel e experiência de e-commerce otimizada.

## 🚀 Funcionalidades

### ✨ Interface Principal
- **Design Responsivo**: Otimizado para dispositivos móveis e desktop
- **Header Fixo**: Com busca em tempo real e status de funcionamento
- **Filtros de Categoria**: Navegação intuitiva entre pizzas, hambúrgueres e acompanhamentos
- **Modo "Mais Populares"**: Destaque para os itens mais vendidos

### 🛒 Sistema de Carrinho
- **Carrinho Flutuante**: Botão fixo com contador de itens
- **Sidebar Interativa**: Visualização completa dos itens selecionados
- **Controle de Quantidade**: Botões para aumentar/diminuir quantidades
- **Cálculo Automático**: Subtotal, taxa de entrega e total

### 💳 Checkout Completo
- **Processo em 3 Etapas**:
  1. **Dados de Entrega**: Nome, telefone, email, endereço
  2. **Pagamento**: Cartão de crédito/débito, PIX, dinheiro na entrega
  3. **Confirmação**: Resumo completo do pedido
- **Validação de Formulários**: Campos obrigatórios e formatação
- **Confirmação Visual**: Tela de sucesso com número do pedido

### 🎯 Recursos de E-commerce
- **Recomendações Inteligentes**: "Você também pode gostar"
- **Badges de Popularidade**: Destaque para itens populares
- **Banner Promocional**: Ofertas especiais e promoções
- **Busca Avançada**: Pesquisa por nome e descrição dos produtos

### 📱 Otimização Mobile
- **Touch-Friendly**: Botões e elementos otimizados para toque
- **Navegação Suave**: Transições e animações fluidas
- **Layout Adaptativo**: Grid responsivo que se adapta ao tamanho da tela
- **Performance**: Carregamento rápido e interface otimizada

## 🛠️ Tecnologias Utilizadas

- **React 18**: Framework principal
- **Vite**: Build tool e desenvolvimento
- **Tailwind CSS**: Estilização utilitária
- **shadcn/ui**: Componentes de interface
- **Lucide React**: Ícones modernos
- **JavaScript ES6+**: Lógica da aplicação

## 📦 Estrutura do Projeto

```
cardapio-digital/
├── src/
│   ├── components/
│   │   ├── MenuCard.jsx           # Card de produto
│   │   ├── CategoryFilter.jsx     # Filtro de categorias
│   │   ├── CartSidebar.jsx        # Sidebar do carrinho
│   │   ├── CheckoutModal.jsx      # Modal de checkout
│   │   └── ProductRecommendations.jsx # Recomendações
│   ├── data/
│   │   └── menuData.js           # Dados dos produtos
│   ├── assets/                   # Imagens dos produtos
│   ├── App.jsx                   # Componente principal
│   └── main.jsx                  # Ponto de entrada
├── public/                       # Arquivos estáticos
└── package.json                  # Dependências
```

## 🚀 Como Executar

1. **Instalar dependências**:
   ```bash
   cd cardapio-digital
   pnpm install
   ```

2. **Executar em desenvolvimento**:
   ```bash
   pnpm run dev
   ```

3. **Build para produção**:
   ```bash
   pnpm run build
   ```

## 🎨 Design System

### Cores Principais
- **Verde**: `#16a34a` (botões de ação)
- **Laranja**: `#ea580c` (badges populares)
- **Vermelho**: `#dc2626` (contador do carrinho)
- **Gradiente**: Laranja para vermelho (banner promocional)

### Componentes shadcn/ui Utilizados
- Button, Input, Badge, Card
- Sheet (sidebar), Dialog (modal)
- Separator, Label, Textarea
- RadioGroup (seleção de pagamento)

## 📱 Responsividade

- **Mobile First**: Design otimizado para dispositivos móveis
- **Breakpoints**: 
  - `sm`: 640px+ (tablets)
  - `md`: 768px+ (desktop pequeno)
  - `lg`: 1024px+ (desktop grande)

## 🔧 Funcionalidades Técnicas

### Estado da Aplicação
- **useState**: Gerenciamento de estado local
- **useEffect**: Efeitos colaterais e ciclo de vida
- **Persistência**: Estado do carrinho mantido durante a sessão

### Interações
- **Busca em Tempo Real**: Filtro instantâneo conforme digitação
- **Animações Suaves**: Transições CSS e hover effects
- **Feedback Visual**: Estados de loading e confirmação

### Performance
- **Otimização de Imagens**: Formato WebP e lazy loading
- **Bundle Splitting**: Carregamento otimizado de componentes
- **CSS Purging**: Remoção de estilos não utilizados

## 🎯 Experiência do Usuário

### Fluxo Principal
1. **Navegação**: Usuário explora o cardápio por categoria ou busca
2. **Seleção**: Adiciona itens ao carrinho com feedback visual
3. **Revisão**: Visualiza itens no carrinho e ajusta quantidades
4. **Checkout**: Preenche dados de entrega e pagamento
5. **Confirmação**: Recebe confirmação do pedido com número de rastreamento

### Microinterações
- **Hover Effects**: Destaque visual em botões e cards
- **Loading States**: Indicadores de carregamento
- **Success Feedback**: Confirmações visuais de ações
- **Error Handling**: Tratamento de erros com mensagens claras

## 🚀 Próximos Passos

### Melhorias Futuras
- **Integração com API**: Backend para persistência de dados
- **Sistema de Usuários**: Login e histórico de pedidos
- **Pagamentos Reais**: Integração com gateways de pagamento
- **Notificações**: Push notifications para status do pedido
- **Analytics**: Tracking de conversões e comportamento

### Otimizações
- **PWA**: Progressive Web App para instalação
- **Offline Mode**: Funcionalidade offline básica
- **Performance**: Lazy loading e code splitting avançado
- **SEO**: Otimização para mecanismos de busca

---

**Desenvolvido com ❤️ usando React e shadcn/ui**

