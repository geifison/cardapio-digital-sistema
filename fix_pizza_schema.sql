-- Corrige/instala o schema necessário para "Pizzas Gerenciáveis"
-- Execute este script no banco "cardapio_digital" (phpMyAdmin ou mysql CLI)

-- 1) Coluna product_type em products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type ENUM('comum','pizza') NOT NULL DEFAULT 'comum' AFTER preparation_time;

-- 2) Tabelas base de pizza
CREATE TABLE IF NOT EXISTS pizza_sizes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slices INT NOT NULL,
  max_flavors INT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  description TEXT,
  display_order INT DEFAULT 0,
  active TINYINT(1) DEFAULT 1
);

CREATE TABLE IF NOT EXISTS pizza_flavors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL,
  category_value DECIMAL(10,2) DEFAULT 0.00,
  description TEXT,
  ingredients TEXT,
  image_url VARCHAR(500),
  display_order INT DEFAULT 0,
  active TINYINT(1) DEFAULT 1,
  is_vegan TINYINT(1) DEFAULT 0,
  is_gluten_free TINYINT(1) DEFAULT 0,
  is_spicy TINYINT(1) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pizza_borders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  additional_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  description TEXT,
  display_order INT DEFAULT 0,
  active TINYINT(1) DEFAULT 1
);

CREATE TABLE IF NOT EXISTS pizza_extras (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  description TEXT,
  display_order INT DEFAULT 0,
  active TINYINT(1) DEFAULT 1
);

-- 3) Tabelas de relação produto x pizza (com coluna active, usada pelos SELECTs)
CREATE TABLE IF NOT EXISTS product_pizza_sizes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  pizza_size_id INT NOT NULL,
  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pps_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_pps_size FOREIGN KEY (pizza_size_id) REFERENCES pizza_sizes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_pizza_flavors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  pizza_flavor_id INT NOT NULL,
  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ppf_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_ppf_flavor FOREIGN KEY (pizza_flavor_id) REFERENCES pizza_flavors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_pizza_borders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  pizza_border_id INT NOT NULL,
  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ppb_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_ppb_border FOREIGN KEY (pizza_border_id) REFERENCES pizza_borders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_pizza_extras (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  pizza_extra_id INT NOT NULL,
  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ppe_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_ppe_extra FOREIGN KEY (pizza_extra_id) REFERENCES pizza_extras(id) ON DELETE CASCADE
);

-- 4) (Opcional) Tabela de preços por sabor/tamanho, usada por alguns fluxos
CREATE TABLE IF NOT EXISTS pizza_flavor_prices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  flavor_id INT NOT NULL,
  size_id INT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  UNIQUE KEY uq_flavor_size (flavor_id, size_id),
  CONSTRAINT fk_pfp_flavor FOREIGN KEY (flavor_id) REFERENCES pizza_flavors(id) ON DELETE CASCADE,
  CONSTRAINT fk_pfp_size FOREIGN KEY (size_id) REFERENCES pizza_sizes(id) ON DELETE CASCADE
);

-- 5) Índices úteis
CREATE INDEX IF NOT EXISTS idx_pps_product ON product_pizza_sizes(product_id);
CREATE INDEX IF NOT EXISTS idx_ppf_product ON product_pizza_flavors(product_id);
CREATE INDEX IF NOT EXISTS idx_ppb_product ON product_pizza_borders(product_id);
CREATE INDEX IF NOT EXISTS idx_ppe_product ON product_pizza_extras(product_id);


