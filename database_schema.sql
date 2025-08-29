-- Criação do banco de dados para o sistema de cardápio digital
-- Database: cardapio_digital

-- Criação da tabela de usuários para o painel administrativo
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(191) UNIQUE NOT NULL, -- Corrigido para 191 para evitar erro de 'key too long' com utf8mb4
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'manager', 'operator', 'kitchen', 'delivery') DEFAULT 'operator',
    user_img VARCHAR(255), -- caminho ou URL da imagem do usuário
    user_phone VARCHAR(20), -- telefone do usuário
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Criação da tabela de categorias de produtos
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    display_order INT DEFAULT 0,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Criação da tabela de produtos
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    image_url VARCHAR(500),
    display_order INT DEFAULT 0,
    active TINYINT(1) DEFAULT 1,
    is_vegetarian TINYINT(1) DEFAULT 0,
    is_vegan TINYINT(1) DEFAULT 0,
    is_gluten_free TINYINT(1) DEFAULT 0,
    is_spicy TINYINT(1) DEFAULT 0,
    preparation_time INT DEFAULT 0, -- em minutos
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Criação da tabela de pedidos
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(20) UNIQUE NOT NULL,
    status ENUM('novo', 'aceito', 'producao', 'entrega', 'finalizado', 'cancelado') DEFAULT 'novo',
    payment_status ENUM('0', '1') NOT NULL DEFAULT '0' AFTER payment_method; -- 0 = não pago, 1 = pago
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_address TEXT,
    customer_neighborhood VARCHAR(255),
    customer_reference TEXT,
    order_type ENUM('delivery', 'retirada', 'balcao') NOT NULL DEFAULT 'delivery',
    payment_method ENUM('dinheiro', 'cartao', 'pix') NOT NULL,
    payment_value DECIMAL(10, 2), -- valor que o cliente vai pagar (para troco)
    total_amount DECIMAL(10, 2) NOT NULL,
    change_amount DECIMAL(10, 2) DEFAULT 0.00, -- troco calculado
    delivery_fee DECIMAL(10, 2) DEFAULT 0.00,
    notes TEXT,
    estimated_delivery_time INT DEFAULT 30, -- em minutos
    accepted_at TIMESTAMP NULL,
    production_started_at TIMESTAMP NULL,
    delivery_started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Criação da tabela de itens do pedido
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    product_name VARCHAR(255) NOT NULL, -- armazenar o nome para histórico
    product_price DECIMAL(10, 2) NOT NULL, -- armazenar o preço para histórico
    quantity INT NOT NULL DEFAULT 1,
    subtotal DECIMAL(10, 2) NOT NULL,
    notes TEXT, -- observações específicas do item
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Criação da tabela de adicionais/extras (opcional para futuras implementações)
CREATE TABLE IF NOT EXISTS product_extras (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Criação da tabela para relacionar extras com itens do pedido
CREATE TABLE IF NOT EXISTS order_item_extras (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_item_id INT NOT NULL,
    extra_id INT NOT NULL,
    extra_name VARCHAR(255) NOT NULL,
    extra_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
    FOREIGN KEY (extra_id) REFERENCES product_extras(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Inserção de dados iniciais

-- Usuário administrador padrão (senha: admin123)
INSERT INTO users (name, email, password, role) VALUES 
('Administrador', 'diretor@gsite.com.br', '$2y$10$Vnz5bL3onS7kTc9jqes/q.vFa1OPivz9AbK9lWZICp/F4Ji69bDVO', 'admin');

-- Categorias iniciais
INSERT INTO categories (name, description, display_order) VALUES 
('Lanches', 'Hambúrgueres, sanduíches e lanches em geral', 1),
('Pizzas', 'Pizzas tradicionais e especiais', 2),
('Bebidas', 'Refrigerantes, sucos e bebidas em geral', 3),
('Sobremesas', 'Doces e sobremesas', 4),
('Pratos Executivos', 'Refeições completas', 5);

-- Produtos de exemplo
INSERT INTO products (category_id, name, description, price, is_vegetarian, preparation_time) VALUES 
-- Lanches
(1, 'X-Burger Clássico', 'Hambúrguer bovino, queijo, alface, tomate, cebola e molho especial', 15.90, FALSE, 15),
(1, 'X-Salada', 'Hambúrguer bovino, queijo, alface, tomate, cebola, ovo e batata palha', 18.90, FALSE, 15),
(1, 'X-Vegetariano', 'Hambúrguer de soja, queijo, alface, tomate, cebola e molho especial', 16.90, TRUE, 12),

-- Pizzas
(2, 'Pizza Margherita', 'Molho de tomate, mussarela, manjericão e azeite', 32.90, TRUE, 25),
(2, 'Pizza Calabresa', 'Molho de tomate, mussarela, calabresa e cebola', 35.90, FALSE, 25),
(2, 'Pizza Portuguesa', 'Molho de tomate, mussarela, presunto, ovos, cebola, azeitona e orégano', 38.90, FALSE, 25),

-- Bebidas
(3, 'Coca-Cola 350ml', 'Refrigerante de cola gelado', 4.50, TRUE, 2),
(3, 'Suco de Laranja Natural', 'Suco natural de laranja 300ml', 6.90, TRUE, 5),
(3, 'Água Mineral 500ml', 'Água mineral sem gás', 2.50, TRUE, 1),

-- Sobremesas
(4, 'Pudim de Leite', 'Pudim caseiro com calda de caramelo', 8.90, TRUE, 5),
(4, 'Brigadeiro Gourmet', 'Brigadeiro artesanal - unidade', 3.50, TRUE, 2),

-- Pratos Executivos
(5, 'Prato Feito Completo', 'Arroz, feijão, bife acebolado, ovo, batata frita e salada', 22.90, FALSE, 20),
(5, 'Filé de Frango Grelhado', 'Filé de frango grelhado com arroz, feijão e legumes', 19.90, FALSE, 18);

-- Criação de índices para melhor performance
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(active);
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- =============================
-- Horários de Funcionamento (Configurações)
-- =============================
CREATE TABLE IF NOT EXISTS settings_business_hours (
    id INT AUTO_INCREMENT PRIMARY KEY,
    weekday ENUM('sunday','monday','tuesday','wednesday','thursday','friday','saturday') UNIQUE NOT NULL,
    closed TINYINT(1) NOT NULL DEFAULT 0,
    open_time TIME NOT NULL DEFAULT '00:00:00',
    close_time TIME NOT NULL DEFAULT '00:00:00',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO settings_business_hours (weekday, closed, open_time, close_time) VALUES
('monday',    0, '09:00:00', '18:00:00'),
('tuesday',   0, '09:00:00', '18:00:00'),
('wednesday', 0, '09:00:00', '18:00:00'),
('thursday',  0, '09:00:00', '18:00:00'),
('friday',    0, '09:00:00', '18:00:00'),
('saturday',  0, '10:00:00', '14:00:00'),
('sunday',    1, '00:00:00', '00:00:00')
ON DUPLICATE KEY UPDATE
closed = VALUES(closed), open_time = VALUES(open_time), close_time = VALUES(close_time);

-- =============================
-- Flags de Configuração (pausa global, etc.)
-- =============================
CREATE TABLE IF NOT EXISTS `settings_flags` (
    `flag_key` VARCHAR(100) NOT NULL PRIMARY KEY,
    `flag_value` VARCHAR(10) NOT NULL DEFAULT '0',
    `extra` TEXT NULL,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================
-- Configurações de Entrega e Cache de Cotações
-- =============================
CREATE TABLE IF NOT EXISTS settings_delivery (
    id INT PRIMARY KEY DEFAULT 1,
    origin_address TEXT NOT NULL,
    origin_lat DECIMAL(10, 8) NOT NULL,
    origin_lng DECIMAL(11, 8) NOT NULL,
    price_per_km DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    min_delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    expose_public_key TINYINT(1) NOT NULL DEFAULT 0,
    mapbox_api_key VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Linha inicial (mantém somente uma configuração)
INSERT INTO settings_delivery (id, origin_address, origin_lat, origin_lng, price_per_km, min_delivery_fee, expose_public_key, mapbox_api_key)
VALUES (1, '', 0, 0, 0.00, 0.00, 0, '')
ON DUPLICATE KEY UPDATE id = VALUES(id);

-- Cache de cotações por endereço normalizado
CREATE TABLE IF NOT EXISTS delivery_quote_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    address_hash CHAR(64) NOT NULL UNIQUE,
    zip VARCHAR(16) NOT NULL,
    street VARCHAR(255) NOT NULL,
    number VARCHAR(32) NOT NULL,
    neighborhood VARCHAR(255) NOT NULL,
    city VARCHAR(255) NOT NULL,
    address_text TEXT NOT NULL,
    client_lat DECIMAL(10, 8) DEFAULT NULL,
    client_lng DECIMAL(11, 8) DEFAULT NULL,
    distance_m INT NOT NULL,
    distance_km DECIMAL(10, 3) NOT NULL,
    fee DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================
-- Informações da Empresa
-- =============================
CREATE TABLE `company_info` (
  id INT NOT NULL AUTO_INCREMENT,
  company_name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  company_color CHAR(7) NOT NULL,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  address TEXT COMMENT 'opcional: cache do endereço gerado via geocoding reverso',
  zip_code VARCHAR(20),
  phone VARCHAR(20) NOT NULL,
  cnpj VARCHAR(20) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
