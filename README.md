# 🍽️ Sistema de Cardápio Digital

Um sistema completo de cardápio digital com gestão de pedidos em tempo real, desenvolvido especificamente para o mercado brasileiro.

## 📋 Características Principais

### Frontend (Cardápio Digital)
- **Interface Responsiva**: Compatível com smartphones, tablets e desktops
- **Carrinho Inteligente**: Adição/remoção de itens com cálculo automático
- **Cálculo de Troco**: Campo para valor em dinheiro com cálculo automático do troco
- **Personalização de Pedidos**: Observações e modificações nos itens
- **Categorização Visual**: Navegação intuitiva por categorias
- **Badges Informativos**: Identificação de pratos vegetarianos, sem glúten, picantes
- **Checkout Completo**: Formulário detalhado com dados de entrega e pagamento

### Backend (Sistema de Gestão)
- **API RESTful**: Desenvolvida em PHP com arquitetura robusta
- **4 Colunas de Gestão**:
  1. **Novos Pedidos**: Recebimento com notificação sonora
  2. **Em Produção**: Timer de tempo e impressão de comandas
  3. **Em Entrega**: Controle de pedidos em rota
  4. **Finalizados**: Histórico do dia
- **Notificações Sonoras**: Alerta automático para novos pedidos
- **Impressão de Comandas**: Separada para cozinha e cliente
- **Autenticação Segura**: Sistema de login com sessões
- **Relatórios**: Estatísticas de vendas e performance

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: PHP 7.4+, PDO
- **Banco de Dados**: MySQL 5.7+
- **Servidor Web**: Apache com mod_rewrite
- **Arquitetura**: MVC com API RESTful

## 📦 Estrutura do Projeto

```
cardapio-digital/
├── index.html                 # Cardápio digital (frontend)
├── install.php               # Instalador do sistema
├── .htaccess                 # Configurações do Apache
├── assets/                   # Recursos do frontend
│   ├── css/
│   │   └── style.css        # Estilos do cardápio
│   └── js/
│       └── app.js           # JavaScript do cardápio
├── admin/                    # Painel administrativo
│   ├── index.html           # Interface de gestão
│   └── assets/
│       ├── css/
│       │   └── admin.css    # Estilos do admin
│       └── js/
│           └── admin.js     # JavaScript do admin
├── api/                      # API Backend
│   ├── index.php            # Roteador principal
│   └── controllers/         # Controllers da API
│       ├── AuthController.php
│       ├── CategoryController.php
│       ├── OrderController.php
│       └── ProductController.php
├── config/                   # Configurações
│   └── database.php         # Configuração do banco
└── database_schema.sql       # Schema do banco de dados
```

## 🚀 Instalação

### Pré-requisitos
- PHP 7.4 ou superior
- MySQL 5.7 ou superior
- Apache com mod_rewrite habilitado
- Extensões PHP: PDO, pdo_mysql

### Passo a Passo

1. **Faça o upload dos arquivos** para seu servidor web

2. **Configure o banco de dados** em `config/database.php`:
   ```php
   private $host = 'localhost';
   private $db_name = 'cardapio_digital';
   private $username = 'seu_usuario';
   private $password = 'sua_senha';
   ```

3. **Execute o instalador** acessando: `http://seudominio.com/install.php`

4. **Acesse o sistema**:
   - Cardápio: `http://seudominio.com/`
   - Admin: `http://seudominio.com/admin/`

### Credenciais Padrão
- **Email**: admin@cardapio.com
- **Senha**: admin123

⚠️ **Importante**: Altere as credenciais após o primeiro login!

## 📱 Como Usar

### Para Clientes (Cardápio Digital)

1. **Navegação**: Use as categorias para filtrar produtos
2. **Adicionar ao Carrinho**: Clique em "Adicionar" nos produtos desejados
3. **Gerenciar Carrinho**: Ajuste quantidades ou remova itens
4. **Finalizar Pedido**: Clique no carrinho e depois em "Finalizar Pedido"
5. **Preencher Dados**: Complete informações de entrega e pagamento
6. **Confirmar**: Revise o pedido e confirme

### Para Restaurantes (Painel Admin)

#### Gestão de Pedidos (4 Colunas)

**1. Novos Pedidos**
- Pedidos chegam automaticamente com som de notificação
- Clique em "Aceitar" para mover para produção
- Som toca até que a coluna esteja vazia

**2. Em Produção**
- Timer mostra tempo decorrido desde aceitação
- Botão de impressora para comandas:
  - **Cozinha**: Apenas itens e observações
  - **Cliente**: Pedido completo com valores
- Clique na seta para enviar para entrega

**3. Em Entrega**
- Pedidos que saíram para entrega
- Clique no check para finalizar

**4. Finalizados**
- Histórico dos pedidos do dia
- Consulta de detalhes completos

#### Funcionalidades Adicionais

- **Detalhes do Pedido**: Clique em qualquer pedido para ver informações completas
- **Impressão**: Comandas otimizadas para cozinha e cliente
- **Relatórios**: Estatísticas de vendas e performance
- **Atualização Automática**: Pedidos são atualizados a cada 5 segundos
- **Notificação Sonora**: Pode ser ligada/desligada

## 🔧 Configurações Avançadas

### Personalização de Valores
Edite `assets/js/app.js` para alterar:
```javascript
const CONFIG = {
    DELIVERY_FEE: 5.00,  // Taxa de entrega
    CURRENCY: 'R$'       // Moeda
};
```

### Configuração de Som
Adicione arquivos de som em `admin/assets/sounds/`:
- `notification.mp3`
- `notification.ogg`

### Customização Visual
- **Cores**: Edite as variáveis CSS em `:root`
- **Logo**: Substitua o ícone no header
- **Imagens**: Adicione imagens dos produtos via admin

## 🗄️ Estrutura do Banco de Dados

### Tabelas Principais

- **users**: Usuários do sistema administrativo
- **categories**: Categorias de produtos
- **products**: Produtos do cardápio
- **orders**: Pedidos realizados
- **order_items**: Itens de cada pedido

### Relacionamentos
- Produtos pertencem a categorias (N:1)
- Pedidos contêm múltiplos itens (1:N)
- Itens referenciam produtos (N:1)

## 🔒 Segurança

### Medidas Implementadas
- **Autenticação**: Sistema de login com sessões
- **Sanitização**: Dados validados e sanitizados
- **SQL Injection**: Uso de prepared statements
- **XSS**: Headers de segurança configurados
- **CORS**: Configurado para APIs

### Recomendações
- Use HTTPS em produção
- Mantenha PHP e MySQL atualizados
- Faça backups regulares do banco
- Monitore logs de acesso

## 📊 API Endpoints

### Categorias
- `GET /api/categories` - Lista categorias
- `POST /api/categories` - Cria categoria
- `PUT /api/categories/{id}` - Atualiza categoria
- `DELETE /api/categories/{id}` - Remove categoria

### Produtos
- `GET /api/products` - Lista produtos
- `GET /api/products?category_id={id}` - Produtos por categoria
- `POST /api/products` - Cria produto
- `PUT /api/products/{id}` - Atualiza produto
- `DELETE /api/products/{id}` - Remove produto

### Pedidos
- `GET /api/orders` - Lista pedidos
- `GET /api/orders?status={status}` - Pedidos por status
- `GET /api/orders?date={date}` - Pedidos por data
- `POST /api/orders` - Cria pedido
- `PUT /api/orders/{id}` - Atualiza pedido
- `DELETE /api/orders/{id}` - Cancela pedido

### Autenticação
- `POST /api/auth/login` - Fazer login
- `POST /api/auth/logout` - Fazer logout
- `GET /api/auth/verify` - Verificar token

## 🐛 Solução de Problemas

### Problemas Comuns

**1. Erro de Conexão com Banco**
- Verifique credenciais em `config/database.php`
- Confirme se MySQL está rodando
- Teste conexão manualmente

**2. API Não Funciona**
- Verifique se mod_rewrite está habilitado
- Confirme permissões dos arquivos
- Verifique logs do Apache

**3. Som Não Toca**
- Verifique se arquivos de som existem
- Confirme permissões do navegador
- Teste em diferentes navegadores

**4. Pedidos Não Atualizam**
- Verifique conexão com internet
- Confirme se JavaScript está habilitado
- Verifique console do navegador

### Logs e Debug
- Logs do Apache: `/var/log/apache2/error.log`
- Logs PHP: Configurar `error_log` no PHP
- Console do navegador: F12 → Console

## 🔄 Atualizações e Manutenção

### Backup Regular
```sql
mysqldump -u usuario -p cardapio_digital > backup_$(date +%Y%m%d).sql
```

### Limpeza de Dados
- Pedidos antigos podem ser arquivados
- Logs devem ser rotacionados
- Cache pode ser limpo periodicamente

## 📞 Suporte

### Recursos Adicionais
- Documentação da API disponível em `/api/`
- Exemplos de uso nos arquivos JavaScript
- Comentários detalhados no código

### Melhorias Futuras
- Integração com sistemas de pagamento
- App mobile nativo
- Sistema de delivery com GPS
- Relatórios avançados
- Integração com WhatsApp

## 🍕 Funcionalidades de Pizza Gerenciável

### Sistema de Preços Dinâmicos
O sistema agora suporta produtos pizza com preços configuráveis por tamanho, sabor, borda e extras.

#### Funcionalidades Implementadas

**1. Exibição de Preço Mínimo para Pizzas Gerenciáveis**
- **Arquivo**: `assets/js/app.js` - Função `createProductCard()`
- **Funcionalidade**: Produtos pizza gerenciáveis exibem "A partir de [preço mínimo]" no card principal
- **Implementação**: Verifica se `product.product_type === 'pizza'` e `product.min_price > 0`
- **Lógica**: O preço mínimo é baseado **apenas no tamanho mais barato** disponível para aquele produto específico
- **CSS**: Estilos para `.price-label` e `.product-price-container` em `assets/css/style.css`

**2. Cálculo de Preço Mínimo por Produto**
- **Arquivo**: `api/controllers/ProductController.php` - Método `getMinimumPriceForProduct()`
- **Funcionalidade**: Calcula o preço mínimo específico para cada produto pizza
- **Implementação**: JOIN entre tabelas de produtos e tamanhos (sem dependência de sabores)
- **Lógica**: Considera apenas o tamanho mais barato disponível para cada produto específico

**3. API para Preço Mínimo Geral**
- **Arquivo**: `api/controllers/PizzaController.php` - Método `getMinimumPrice()`
- **Endpoint**: `/api/pizza/minimum-price`
- **Funcionalidade**: Retorna o preço mínimo geral de todas as combinações ativas

**4. Integração com Carrinho**
- **Arquivo**: `assets/js/app.js` - Função `addToCart()`
- **Funcionalidade**: Para produtos pizza, abre o pizza builder modal
- **Preço Final**: O preço adicionado ao carrinho é sempre o preço calculado pelo pizza builder

**5. Exibição de Preços nos Cards de Tamanho do Pizza Builder**
- **Arquivo**: `assets/js/app.js` - Função `renderPizzaStep1()`
- **Funcionalidade**: Cards de seleção de tamanho exibem preços individuais
- **Benefício**: Clientes podem ver o preço de cada tamanho antes de selecionar

**6. Atualização do Pizza Builder Standalone**
- **Arquivo**: `pizza-builder.html`
- **Funcionalidade**: Cards de tamanho também exibem preços (valores de exemplo)

### Como Funciona
1. **Card Principal**: Exibe "A partir de R$ X,XX" baseado **apenas no tamanho mais barato** disponível para aquele produto
2. **Pizza Builder**: Abre ao clicar "Adicionar ao Carrinho"
3. **Seleção de Tamanho**: Mostra preços individuais de cada tamanho
4. **Configuração**: Cliente escolhe sabores, bordas e extras
5. **Preço Final**: Calculado dinamicamente baseado nas escolhas
6. **Carrinho**: Adiciona com o preço final configurado (não o "a partir de")

### Mudança de Lógica (v2.0)
**Antes**: O "A partir de" era calculado baseado na combinação mais barata de tamanho + sabor
**Agora**: O "A partir de" é calculado baseado **apenas no tamanho mais barato** disponível para cada produto

**Vantagens da Nova Lógica**:
- ✅ Mais simples e direta
- ✅ Não depende de configuração de preços de sabores
- ✅ Cada produto tem seu próprio preço mínimo baseado nos tamanhos disponíveis
- ✅ Lógica mais previsível para o cliente

### Estrutura do Banco de Dados
- **pizza_sizes**: Tamanhos disponíveis com preços base
- **pizza_flavors**: Sabores disponíveis
- **pizza_flavor_prices**: Preços por combinação de tamanho e sabor
- **pizza_borders**: Bordas disponíveis
- **pizza_extras**: Extras disponíveis
- **product_pizza_***: Relacionamentos entre produtos e configurações

## 📄 Licença

Este projeto foi desenvolvido para uso comercial. Todos os direitos reservados.

---

**Desenvolvido com ❤️ para o mercado brasileiro de food service**

