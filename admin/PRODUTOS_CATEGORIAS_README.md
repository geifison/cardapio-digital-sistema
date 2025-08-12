# 🏷️ Gerenciamento de Produtos & Categorias

## 📋 Visão Geral

A página "Gerenciar Produtos & Categorias" é uma interface moderna e completa para administrar produtos e categorias do sistema de cardápio digital. Ela foi desenvolvida baseada no design e funcionalidades do arquivo `testes/index.php`, mas adaptada e integrada ao sistema admin.

## ✨ Características Principais

### 🎯 Interface em Acordeão
- **Visualização Organizada**: Produtos agrupados por categoria em formato de acordeão
- **Expansão/Colapso**: Cada categoria pode ser expandida ou recolhida
- **Navegação Intuitiva**: Interface limpa e fácil de navegar

### 🔍 Sistema de Filtros Avançados
- **Filtro por Nome**: Busca em produtos e categorias
- **Filtro por Categoria**: Seleção específica de categoria
- **Filtro por Status**: Ativos, inativos ou todos
- **Filtros em Tempo Real**: Resultados atualizados instantaneamente

### ⚡ Controles Rápidos
- **Switches de Status**: Ativar/desativar produtos e categorias com um clique
- **Menu de Ações**: Botão de 3 pontinhos com opções de editar e apagar
- **Feedback Visual**: Indicadores visuais para status ativo/inativo

### 📱 Design Responsivo
- **Mobile-First**: Otimizado para dispositivos móveis
- **Adaptativo**: Layout que se ajusta a diferentes tamanhos de tela
- **Touch-Friendly**: Interface otimizada para toque

## 🚀 Como Acessar

### 1. Via Painel Admin
1. Acesse o painel administrativo (`admin/index.html`)
2. Faça login com suas credenciais
3. Clique na aba "Produtos & Categorias" na navegação
4. Clique em "Abrir Página Completa" para acessar a funcionalidade completa

### 2. Acesso Direto
- URL: `admin/produtos-categorias.html`
- Acesso direto via navegador

## 🛠️ Funcionalidades Implementadas

### ✅ Funcionalidades Completas
- [x] **Carregamento de Dados**: Categorias e produtos via API
- [x] **Renderização Dinâmica**: Interface gerada dinamicamente
- [x] **Sistema de Filtros**: Filtros funcionais e responsivos
- [x] **Controles de Status**: Ativar/desativar produtos e categorias
- [x] **Exclusão**: Apagar produtos e categorias com confirmação
- [x] **Interface Responsiva**: Adaptação para diferentes dispositivos

### 🔄 Funcionalidades Pendentes
- [ ] **Criação**: Modal para criar novos produtos e categorias
- [ ] **Edição**: Modal para editar produtos e categorias existentes
- [ ] **Validações**: Validações de formulário e dados
- [ ] **Notificações**: Sistema de notificações integrado

## 📁 Estrutura de Arquivos

```
admin/
├── produtos-categorias.html          # Página principal
├── assets/
│   ├── css/
│   │   └── admin.css                # Estilos da seção
│   └── js/
│       ├── config.js                # Configurações do sistema
│       ├── utils.js                 # Funções utilitárias
│       └── produtos-categorias.js   # Lógica principal
└── PRODUTOS_CATEGORIAS_README.md    # Este arquivo
```

## 🔧 Tecnologias Utilizadas

- **HTML5**: Estrutura semântica
- **CSS3**: Estilos modernos com variáveis CSS e animações
- **JavaScript ES6+**: Lógica orientada a objetos com classes
- **Fetch API**: Comunicação com backend
- **Font Awesome**: Ícones
- **Google Fonts**: Tipografia (Inter)

## 📱 Responsividade

### Breakpoints
- **Mobile**: < 480px
- **Tablet**: 480px - 768px
- **Desktop**: > 768px

### Adaptações
- **Mobile**: Layout em coluna única, botões maiores
- **Tablet**: Layout intermediário com ajustes de espaçamento
- **Desktop**: Layout completo com todas as funcionalidades

## 🎨 Personalização

### Cores
```css
:root {
    --primary-color: #4f46e5;
    --secondary-color: #10b981;
    --danger-color: #ef4444;
    --gray-100: #f3f4f6;
    --gray-800: #1f2937;
}
```

### Animações
- **Float**: Efeito flutuante no card informativo
- **Transitions**: Transições suaves em todos os elementos
- **Hover Effects**: Efeitos ao passar o mouse

## 🔌 Integração com API

### Endpoints Utilizados
- `GET /api/categories` - Listar categorias
- `GET /api/products` - Listar produtos
- `PATCH /api/categories/{id}` - Atualizar categoria
- `PATCH /api/products/{id}` - Atualizar produto
- `DELETE /api/categories/{id}` - Excluir categoria
- `DELETE /api/products/{id}` - Excluir produto

### Estrutura de Dados
```javascript
// Categoria
{
    id: number,
    name: string,
    active: boolean,
    display_order: number
}

// Produto
{
    id: number,
    name: string,
    price: number,
    active: boolean,
    category_id: number
}
```

## 🚧 Desenvolvimento Futuro

### Próximas Implementações
1. **Modais de Criação/Edição**
   - Formulários para produtos e categorias
   - Validações de entrada
   - Upload de imagens

2. **Sistema de Notificações**
   - Notificações toast
   - Confirmações de ações
   - Mensagens de erro

3. **Funcionalidades Avançadas**
   - Drag & Drop para reordenação
   - Busca avançada
   - Exportação de dados

4. **Melhorias de UX**
   - Loading states
   - Skeleton screens
   - Animações mais elaboradas

## 🐛 Solução de Problemas

### Problemas Comuns
1. **Dados não carregam**
   - Verificar conexão com API
   - Verificar console do navegador
   - Verificar permissões de acesso

2. **Interface não responde**
   - Verificar se JavaScript está carregado
   - Verificar erros no console
   - Recarregar a página

3. **Filtros não funcionam**
   - Verificar se dados estão carregados
   - Verificar IDs dos elementos HTML
   - Verificar eventos JavaScript

## 📞 Suporte

Para suporte técnico ou dúvidas sobre esta funcionalidade:

1. **Verificar Logs**: Console do navegador e logs do servidor
2. **Documentação**: Consultar este README e arquivos relacionados
3. **Desenvolvedor**: Contatar a equipe de desenvolvimento

---

**Versão**: 1.0.0  
**Última Atualização**: Dezembro 2024  
**Desenvolvido por**: Equipe de Desenvolvimento
