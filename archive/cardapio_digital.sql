-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Tempo de geração: 11/08/2025 às 03:25
-- Versão do servidor: 9.1.0
-- Versão do PHP: 8.3.14

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Banco de dados: `cardapio_digital`
--

-- --------------------------------------------------------

--
-- Estrutura para tabela `categories`
--

DROP TABLE IF EXISTS `categories`;
CREATE TABLE IF NOT EXISTS `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `display_order` int DEFAULT '0',
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `show_prices` tinyint(1) DEFAULT '1' COMMENT 'Controla se produtos desta categoria devem exibir preços',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `categories`
--

INSERT INTO `categories` (`id`, `name`, `description`, `image_url`, `display_order`, `active`, `created_at`, `updated_at`, `show_prices`) VALUES
(1, 'Lanches', 'Hambúrgueres, sanduíches e lanches em geral', NULL, 1, 1, '2025-08-09 00:28:41', '2025-08-10 06:01:58', 1),
(2, 'Pizzas', 'Pizzas tradicionais e especiais', NULL, 3, 1, '2025-08-09 00:28:41', '2025-08-10 06:01:58', 1),
(3, 'Bebidas', 'Refrigerantes, sucos e bebidas em geral', NULL, 0, 1, '2025-08-09 00:28:41', '2025-08-10 06:01:58', 1),
(4, 'Sobremesas', 'Doces e sobremesas', NULL, 5, 1, '2025-08-09 00:28:41', '2025-08-10 06:01:58', 1),
(5, 'Pratos Executivos', 'Refeições completas', NULL, 4, 1, '2025-08-09 00:28:41', '2025-08-10 06:01:58', 1),
(8, 'Pastel', 'Pasteis frequinhos', NULL, 2, 1, '2025-08-10 05:38:53', '2025-08-10 06:01:58', 1);

-- --------------------------------------------------------

--
-- Estrutura para tabela `orders`
--

DROP TABLE IF EXISTS `orders`;
CREATE TABLE IF NOT EXISTS `orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_number` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('novo','aceito','producao','entrega','finalizado','cancelado') COLLATE utf8mb4_unicode_ci DEFAULT 'novo',
  `customer_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_address` text COLLATE utf8mb4_unicode_ci,
  `customer_neighborhood` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_reference` text COLLATE utf8mb4_unicode_ci,
  `payment_method` enum('dinheiro','cartao','pix') COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_value` decimal(10,2) DEFAULT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `change_amount` decimal(10,2) DEFAULT '0.00',
  `delivery_fee` decimal(10,2) DEFAULT '0.00',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `estimated_delivery_time` int DEFAULT '30',
  `accepted_at` timestamp NULL DEFAULT NULL,
  `production_started_at` timestamp NULL DEFAULT NULL,
  `delivery_started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_number` (`order_number`),
  KEY `idx_orders_status` (`status`),
  KEY `idx_orders_created_at` (`created_at`)
) ENGINE=MyISAM AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `orders`
--

INSERT INTO `orders` (`id`, `order_number`, `status`, `customer_name`, `customer_phone`, `customer_address`, `customer_neighborhood`, `customer_reference`, `payment_method`, `payment_value`, `total_amount`, `change_amount`, `delivery_fee`, `notes`, `estimated_delivery_time`, `accepted_at`, `production_started_at`, `delivery_started_at`, `completed_at`, `created_at`, `updated_at`) VALUES
(1, '2508099463', 'finalizado', 'João Silva (Teste)', '(11) 99999-9999', 'Rua das Flores, 123', 'Centro', NULL, 'dinheiro', NULL, 25.90, 0.00, 5.00, 'Pedido de teste - sem cebola', 30, '2025-08-09 02:09:23', NULL, '2025-08-09 02:10:31', '2025-08-09 02:10:38', '2025-08-09 01:52:29', '2025-08-09 02:10:38'),
(2, '2508093391', 'finalizado', 'Maria Santos (Novo Pedido)', '(11) 98765-4321', 'Av. Paulista, 1000', 'Bela Vista', NULL, 'dinheiro', NULL, 32.90, 0.00, 5.00, 'Pedido de teste - sem cebola no lanche', 30, '2025-08-09 02:28:14', NULL, '2025-08-09 02:58:44', '2025-08-09 02:59:03', '2025-08-09 02:27:44', '2025-08-09 02:59:03'),
(3, '2508091894', 'finalizado', 'Teste Simples', '11999999999', 'Rua Simples, 123', '', '', 'dinheiro', NULL, 5.00, 0.00, 5.00, '', 30, '2025-08-09 02:58:29', NULL, '2025-08-09 09:11:14', '2025-08-09 09:11:30', '2025-08-09 02:53:06', '2025-08-09 09:11:30'),
(4, '2508097564', 'finalizado', 'Teste Frontend', '11999999999', 'Rua Frontend, 123', 'Centro', '', 'dinheiro', NULL, 20.90, 0.00, 5.00, 'Teste direto', 30, '2025-08-09 02:58:34', NULL, '2025-08-09 11:07:18', '2025-08-09 11:07:40', '2025-08-09 02:57:54', '2025-08-09 11:07:40'),
(5, '2508091645', 'finalizado', 'GEIFISON QUEIROZ OLIVEIRA', '71999494975', 'Rua José Leite', 'caji', '', 'pix', NULL, 24.90, 0.00, 5.00, '', 30, '2025-08-09 02:58:32', NULL, '2025-08-09 09:11:18', '2025-08-09 09:11:26', '2025-08-09 02:58:09', '2025-08-09 09:11:26'),
(6, '2508091731', 'finalizado', 'GEIFISON QUEIROZ OLIVEIRA', '71999494975', 'Rua José Leite', 'caji', '', 'pix', NULL, 40.90, 0.00, 5.00, '', 30, '2025-08-09 03:17:12', NULL, '2025-08-09 11:07:16', '2025-08-09 11:07:31', '2025-08-09 03:06:14', '2025-08-09 11:07:31'),
(7, '2508092922', 'finalizado', 'Cliente Teste Som', '(11) 99999-9999', 'Rua do Som, 123', 'Centro', NULL, 'dinheiro', NULL, 45.80, 0.00, 5.00, 'Pedido para testar o som em loop', 30, '2025-08-09 03:17:10', NULL, '2025-08-09 11:07:15', '2025-08-09 11:07:29', '2025-08-09 03:06:15', '2025-08-09 11:07:29'),
(8, '2508091891', 'finalizado', 'Teste Som Final', '(11) 99999-9999', 'Rua do Som Final, 123', 'Centro', NULL, 'dinheiro', NULL, 28.90, 0.00, 5.00, 'Teste do som sem botão de controle', 30, '2025-08-09 03:17:07', NULL, '2025-08-09 11:07:13', '2025-08-09 11:07:27', '2025-08-09 03:12:59', '2025-08-09 11:07:27'),
(9, '2508091744', 'finalizado', 'wemmely', '71993210590', 'Rua José Leite 686', 'Jose Mender de Queiroz', 'fica próximo a creche atrás do arena mix', 'dinheiro', 50.00, 27.90, 22.10, 5.00, '', 30, '2025-08-09 03:20:03', NULL, '2025-08-09 11:07:11', '2025-08-09 11:07:26', '2025-08-09 03:19:48', '2025-08-09 11:07:26'),
(10, '2508091443', 'finalizado', 'Debug Som', '(11) 99999-9999', 'Rua Debug, 123', 'Centro', NULL, 'dinheiro', NULL, 25.90, 0.00, 5.00, 'Teste de debug do som', 30, '2025-08-09 03:22:07', NULL, '2025-08-09 11:07:09', '2025-08-09 11:07:24', '2025-08-09 03:21:57', '2025-08-09 11:07:24'),
(11, '2508095480', 'finalizado', 'Maria Silva Santos', '(11) 98765-4321', 'Rua das Flores, 123', 'Jardim das Flores', 'Próximo ao mercado', 'dinheiro', 50.00, 45.80, 4.20, 5.00, 'Sem cebola no lanche e sem gelo no refrigerante', 30, NULL, NULL, '2025-08-09 03:42:26', '2025-08-09 05:48:36', '2025-08-09 03:27:19', '2025-08-09 05:48:36'),
(12, '2508099538', 'finalizado', 'GEIFISON QUEIROZ OLIVEIRA', '71999494975', 'Rua José Leite', 'caji', '', 'pix', NULL, 20.90, 0.00, 5.00, '', 30, '2025-08-09 05:15:42', NULL, '2025-08-09 11:07:07', '2025-08-09 11:07:22', '2025-08-09 05:15:19', '2025-08-09 11:07:22'),
(13, '2508092937', 'finalizado', 'GEIFISON QUEIROZ OLIVEIRA', '71999494975', 'Rua José Leite', 'caji', '', 'pix', NULL, 23.90, 0.00, 5.00, '', 30, '2025-08-09 06:22:50', NULL, '2025-08-09 06:23:56', '2025-08-09 08:52:21', '2025-08-09 06:22:39', '2025-08-09 08:52:21'),
(14, '2508099586', 'finalizado', 'GEIFISON QUEIROZ OLIVEIRA', '71999494975', 'Rua José Leite', 'caji', '', 'dinheiro', 100.00, 44.00, 56.00, 5.00, '', 30, '2025-08-09 06:29:11', NULL, '2025-08-09 08:52:26', '2025-08-09 09:11:22', '2025-08-09 06:29:03', '2025-08-09 09:11:22'),
(15, '2508097700', 'finalizado', 'GEIFISON QUEIROZ OLIVEIRA', '71999494975', 'Rua José Leite', 'caji', '', 'cartao', NULL, 69.00, 0.00, 5.00, '', 30, '2025-08-09 07:40:06', NULL, '2025-08-09 11:07:04', '2025-08-09 11:07:20', '2025-08-09 07:39:55', '2025-08-09 11:07:20'),
(16, '2508097836', 'aceito', 'wemmely', '71993210590', 'Rua wilton, 332a\nPonto de referência: fica próximo a creche atrás do arena mix', 'Jose Mender de Queiroz', 'fica próximo a creche atrás do arena mix', 'cartao', NULL, 30.00, 0.00, 5.00, '', 30, '2025-08-09 11:25:59', NULL, NULL, NULL, '2025-08-09 11:25:39', '2025-08-09 11:25:59'),
(17, '2508099089', 'aceito', 'Geifison Queiroz Oliveira', '71999494975', 'Av. José Leite, 1869-1709 - Quintas do Picuaia, Lauro de Freitas - BA, 42700-000, Brasil', 'Caji', 'fica próximo a Papibu', 'cartao', NULL, 30.00, 0.00, 5.00, '', 30, '2025-08-09 11:31:16', NULL, NULL, NULL, '2025-08-09 11:31:06', '2025-08-09 11:31:16'),
(18, '2508098965', 'entrega', 'Geifison Queiroz Oliveira', '71999494975', 'Rua José Leite 686', 'Caji', 'fica próximo a Papibu', 'dinheiro', 100.00, 30.00, 70.00, 5.00, 'sem cebola', 30, '2025-08-09 21:59:21', NULL, '2025-08-10 05:43:45', NULL, '2025-08-09 21:59:12', '2025-08-10 05:43:45'),
(19, '2508103119', 'aceito', 'GEIFISON QUEIROZ OLIVEIRA', '71999494975', 'Rua José Leite', 'caji', '', 'cartao', NULL, 89.80, 0.00, 5.00, '', 30, '2025-08-10 05:42:59', NULL, NULL, NULL, '2025-08-10 05:42:31', '2025-08-10 05:42:59');

-- --------------------------------------------------------

--
-- Estrutura para tabela `order_items`
--

DROP TABLE IF EXISTS `order_items`;
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `product_id` int NOT NULL,
  `product_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_price` decimal(10,2) NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `subtotal` decimal(10,2) NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  KEY `idx_order_items_order` (`order_id`)
) ENGINE=MyISAM AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `order_items`
--

INSERT INTO `order_items` (`id`, `order_id`, `product_id`, `product_name`, `product_price`, `quantity`, `subtotal`, `notes`, `created_at`) VALUES
(1, 1, 1, 'X-Burger Clássico', 15.90, 1, 15.90, '', '2025-08-09 01:52:29'),
(2, 1, 3, 'Coca-Cola 350ml', 5.00, 1, 5.00, '', '2025-08-09 01:52:29'),
(3, 2, 1, 'X-Burger Clássico', 15.90, 1, 15.90, '', '2025-08-09 02:27:44'),
(4, 2, 2, 'X-Salada', 12.00, 1, 12.00, 'Sem cebola', '2025-08-09 02:27:44'),
(5, 3, 1, 'X-Burger', 15.90, 1, 15.90, '', '2025-08-09 02:53:06'),
(6, 4, 1, 'X-Burger Clássico', 15.90, 1, 15.90, '', '2025-08-09 02:57:54'),
(7, 5, 13, 'Filé de Frango Grelhado', 19.90, 1, 19.90, '', '2025-08-09 02:58:09'),
(8, 6, 5, 'Pizza Calabresa', 35.90, 1, 35.90, '', '2025-08-09 03:06:14'),
(9, 7, 1, 'X-Burger Clássico', 15.90, 2, 31.80, '', '2025-08-09 03:06:15'),
(10, 7, 3, 'Coca-Cola 350ml', 4.50, 2, 9.00, '', '2025-08-09 03:06:15'),
(11, 8, 2, 'X-Salada', 18.90, 1, 18.90, '', '2025-08-09 03:12:59'),
(12, 9, 12, 'Prato Feito Completo', 22.90, 1, 22.90, '', '2025-08-09 03:19:48'),
(13, 10, 1, 'X-Burger Clássico', 15.90, 1, 15.90, '', '2025-08-09 03:21:57'),
(14, 11, 1, 'X-Burger Clássico', 15.90, 2, 31.80, 'Sem cebola', '2025-08-09 03:27:19'),
(15, 11, 3, 'Coca-Cola 350ml', 4.50, 1, 4.50, 'Sem gelo', '2025-08-09 03:27:19'),
(16, 11, 4, 'Pizza Margherita', 32.90, 1, 32.90, '', '2025-08-09 03:27:19'),
(17, 12, 1, 'X-Burger Clássico', 15.90, 1, 15.90, '', '2025-08-09 05:15:19'),
(18, 13, 2, 'X-Salada', 18.90, 1, 18.90, '', '2025-08-09 06:22:39'),
(19, 14, 17, 'Média - Margherita, Calabresa', 39.00, 1, 39.00, 'Pizza personalizada: Grande - Margherita, Pepperoni - Borda: Chocolate', '2025-08-09 06:29:03'),
(20, 15, -2147483648, 'Monte Sua Pizza - Grande', 34.00, 1, 34.00, 'Sabores: Calabresa, Portuguesa', '2025-08-09 07:39:55'),
(21, 15, -2147483648, 'Monte Sua Pizza - Média', 30.00, 1, 30.00, 'Sabores: Pepperoni, Quatro Queijos', '2025-08-09 07:39:55'),
(22, 16, 25, 'Pizza em dobro - Família em Dobro', 25.00, 1, 25.00, 'Sabores: Banana com Canela, Bacon, Banana com Canela, Chocolate, Chocolate com Morango, Chocolate', '2025-08-09 11:25:39'),
(23, 17, 25, 'Pizza em dobro - Família em Dobro', 25.00, 1, 25.00, 'Sabores: Bacon (4x), Banana com Canela (2x)', '2025-08-09 11:31:06'),
(24, 18, 25, 'Pizza em dobro - Família em Dobro', 25.00, 1, 25.00, 'Sabores: Atum, Bacon (3x)', '2025-08-09 21:59:12'),
(25, 19, 30, 'Teste de Produto - Média', 34.90, 1, 34.90, 'Sabores: Atum (2x)', '2025-08-10 05:42:31'),
(26, 19, 31, 'Monte Sua pizza - Grande', 49.90, 1, 49.90, 'Sabores: Bacon (2x)', '2025-08-10 05:42:31');

-- --------------------------------------------------------

--
-- Estrutura para tabela `order_item_extras`
--

DROP TABLE IF EXISTS `order_item_extras`;
CREATE TABLE IF NOT EXISTS `order_item_extras` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_item_id` int NOT NULL,
  `extra_id` int NOT NULL,
  `extra_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `extra_price` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `order_item_id` (`order_item_id`),
  KEY `extra_id` (`extra_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `pizza_borders`
--

DROP TABLE IF EXISTS `pizza_borders`;
CREATE TABLE IF NOT EXISTS `pizza_borders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `additional_price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `display_order` int DEFAULT '0',
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `pizza_borders`
--

INSERT INTO `pizza_borders` (`id`, `name`, `description`, `additional_price`, `display_order`, `active`, `created_at`, `updated_at`) VALUES
(1, 'Tradicional', 'Borda tradicional sem recheio', 0.00, 1, 1, '2025-08-09 04:58:38', '2025-08-09 04:58:38'),
(2, 'Catupiry', 'Borda recheada com catupiry', 8.00, 2, 1, '2025-08-09 04:58:38', '2025-08-09 04:58:38'),
(3, 'Cheddar', 'Borda recheada com cheddar', 8.00, 3, 1, '2025-08-09 04:58:38', '2025-08-09 04:58:38'),
(4, 'Chocolate', 'Borda doce com chocolate', 6.00, 4, 1, '2025-08-09 04:58:38', '2025-08-09 04:58:38'),
(5, 'Tradicional', 'Borda tradicional da massa', 0.00, 1, 1, '2025-08-09 05:49:24', '2025-08-09 05:49:24'),
(6, 'Recheada Catupiry', 'Borda recheada com catupiry', 5.00, 2, 1, '2025-08-09 05:49:24', '2025-08-09 05:49:24'),
(7, 'Recheada Cheddar', 'Borda recheada com cheddar', 5.00, 3, 1, '2025-08-09 05:49:24', '2025-08-09 05:49:24'),
(8, 'Recheada Chocolate', 'Borda recheada com chocolate', 6.00, 4, 1, '2025-08-09 05:49:24', '2025-08-09 05:49:24');

-- --------------------------------------------------------

--
-- Estrutura para tabela `pizza_extras`
--

DROP TABLE IF EXISTS `pizza_extras`;
CREATE TABLE IF NOT EXISTS `pizza_extras` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `category` enum('queijo','carne','vegetal','molho','outro') COLLATE utf8mb4_unicode_ci DEFAULT 'outro',
  `display_order` int DEFAULT '0',
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `pizza_extras`
--

INSERT INTO `pizza_extras` (`id`, `name`, `description`, `price`, `category`, `display_order`, `active`, `created_at`, `updated_at`) VALUES
(1, 'Bacon', 'Bacon crocante', 5.00, 'carne', 1, 1, '2025-08-09 04:58:38', '2025-08-09 04:58:38'),
(2, 'Cebola', 'Cebola caramelizada', 3.00, 'vegetal', 2, 1, '2025-08-09 04:58:38', '2025-08-09 04:58:38'),
(3, 'Azeitona', 'Azeitonas pretas', 3.00, 'vegetal', 3, 1, '2025-08-09 04:58:38', '2025-08-09 04:58:38'),
(4, 'Milho', 'Milho verde', 3.00, 'vegetal', 4, 1, '2025-08-09 04:58:38', '2025-08-09 04:58:38'),
(5, 'Tomate', 'Tomate fresco', 3.00, 'vegetal', 5, 1, '2025-08-09 04:58:38', '2025-08-09 04:58:38'),
(6, 'Queijo Extra', 'Queijo mussarela extra', 4.00, 'queijo', 6, 1, '2025-08-09 04:58:38', '2025-08-09 04:58:38'),
(7, 'Catupiry', 'Catupiry cremoso', 4.00, 'queijo', 7, 1, '2025-08-09 04:58:38', '2025-08-09 04:58:38'),
(8, 'Molho Especial', 'Molho especial da casa', 2.00, 'molho', 8, 1, '2025-08-09 04:58:38', '2025-08-09 04:58:38'),
(9, 'Mussarela Extra', 'Queijo mussarela adicional', 3.00, 'queijo', 1, 1, '2025-08-09 05:49:25', '2025-08-09 05:49:25'),
(10, 'Parmesão', 'Queijo parmesão ralado', 4.00, 'queijo', 2, 1, '2025-08-09 05:49:25', '2025-08-09 05:49:25'),
(11, 'Catupiry', 'Queijo catupiry', 3.50, 'queijo', 3, 1, '2025-08-09 05:49:25', '2025-08-09 05:49:25'),
(12, 'Gorgonzola', 'Queijo gorgonzola', 5.00, 'queijo', 4, 1, '2025-08-09 05:49:25', '2025-08-09 05:49:25'),
(13, 'Bacon', 'Bacon em cubos', 4.50, 'carne', 5, 1, '2025-08-09 05:49:25', '2025-08-09 05:49:25'),
(14, 'Pepperoni', 'Pepperoni fatiado', 4.00, 'carne', 6, 1, '2025-08-09 05:49:25', '2025-08-09 05:49:25'),
(15, 'Frango Desfiado', 'Frango desfiado', 3.50, 'carne', 7, 1, '2025-08-09 05:49:25', '2025-08-09 05:49:25'),
(16, 'Calabresa', 'Calabresa fatiada', 3.00, 'carne', 8, 1, '2025-08-09 05:49:25', '2025-08-09 05:49:25'),
(17, 'Cebola', 'Cebola caramelizada', 2.00, 'vegetal', 9, 1, '2025-08-09 05:49:25', '2025-08-09 05:49:25'),
(18, 'Tomate', 'Tomate fatiado', 2.00, 'vegetal', 10, 1, '2025-08-09 05:49:25', '2025-08-09 05:49:25'),
(19, 'Pimentão', 'Pimentão colorido', 2.50, 'vegetal', 11, 1, '2025-08-09 05:49:25', '2025-08-09 05:49:25'),
(20, 'Azeitonas', 'Azeitonas pretas', 2.50, 'vegetal', 12, 1, '2025-08-09 05:49:25', '2025-08-09 05:49:25');

-- --------------------------------------------------------

--
-- Estrutura para tabela `pizza_flavors`
--

DROP TABLE IF EXISTS `pizza_flavors`;
CREATE TABLE IF NOT EXISTS `pizza_flavors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `ingredients` text COLLATE utf8mb4_unicode_ci,
  `category` enum('tradicional','especial','doce','vegetariana','vegana') COLLATE utf8mb4_unicode_ci DEFAULT 'tradicional',
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `display_order` int DEFAULT '0',
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `category_value` decimal(8,2) DEFAULT '0.00',
  `is_vegan` tinyint(1) DEFAULT '0',
  `is_gluten_free` tinyint(1) DEFAULT '0',
  `is_spicy` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=48 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `pizza_flavors`
--

INSERT INTO `pizza_flavors` (`id`, `name`, `description`, `ingredients`, `category`, `image_url`, `display_order`, `active`, `created_at`, `updated_at`, `category_value`, `is_vegan`, `is_gluten_free`, `is_spicy`) VALUES
(1, 'Margherita', 'Pizza clássica italiana', 'Molho de tomate, mussarela, manjericão fresco, azeite', 'tradicional', NULL, 1, 1, '2025-08-09 04:58:38', '2025-08-09 04:58:38', 0.00, 0, 0, 0),
(2, 'Calabresa', 'Pizza com linguiça calabresa', 'Molho de tomate, mussarela, linguiça calabresa, cebola', 'tradicional', NULL, 2, 1, '2025-08-09 04:58:38', '2025-08-09 04:58:38', 0.00, 0, 0, 0),
(3, 'Portuguesa', 'Pizza portuguesa tradicional', 'Molho de tomate, mussarela, presunto, ovos, cebola, azeitonas', 'tradicional', NULL, 3, 1, '2025-08-09 04:58:38', '2025-08-09 04:58:38', 0.00, 0, 0, 0),
(4, 'Quatro Queijos', 'Pizza com quatro tipos de queijo', 'Molho de tomate, mussarela, provolone, parmesão, gorgonzola', 'tradicional', NULL, 4, 1, '2025-08-09 04:58:38', '2025-08-09 04:58:38', 0.00, 0, 0, 0),
(5, 'Frango com Catupiry', 'Pizza com frango desfiado', 'Molho de tomate, mussarela, frango desfiado, catupiry', 'especial', NULL, 5, 1, '2025-08-09 04:58:38', '2025-08-09 04:58:38', 0.00, 0, 0, 0),
(6, 'Lombo Canadense', 'Pizza com lombo canadense', 'Molho de tomate, mussarela, lombo canadense, cebola', 'especial', NULL, 6, 1, '2025-08-09 04:58:38', '2025-08-09 04:58:38', 0.00, 0, 0, 0),
(7, 'Camarão', 'Pizza com camarão', 'Molho de tomate, mussarela, camarão, cebola, tomate', 'especial', NULL, 7, 1, '2025-08-09 04:58:38', '2025-08-09 04:58:38', 0.00, 0, 0, 0),
(8, 'Chocolate', 'Pizza doce com chocolate', 'Chocolate, leite condensado, granulado', 'doce', NULL, 8, 1, '2025-08-09 04:58:38', '2025-08-09 04:58:38', 0.00, 0, 0, 0),
(9, 'Margherita', 'Molho de tomate, mussarela e manjericão', 'Molho de tomate, mussarela, manjericão', 'tradicional', NULL, 1, 1, '2025-08-09 05:49:24', '2025-08-09 05:49:24', 0.00, 0, 0, 0),
(10, 'Pepperoni', 'Molho de tomate, mussarela e pepperoni', 'Molho de tomate, mussarela, pepperoni', 'tradicional', NULL, 2, 1, '2025-08-09 05:49:24', '2025-08-09 05:49:24', 0.00, 0, 0, 0),
(11, 'Quatro Queijos', 'Molho de tomate e quatro tipos de queijo', 'Molho de tomate, mussarela, parmesão, provolone, gorgonzola', 'tradicional', NULL, 3, 1, '2025-08-09 05:49:24', '2025-08-09 05:49:24', 0.00, 0, 0, 0),
(12, 'Calabresa', 'Molho de tomate, mussarela e calabresa', 'Molho de tomate, mussarela, calabresa, cebola', 'tradicional', NULL, 4, 1, '2025-08-09 05:49:24', '2025-08-09 05:49:24', 0.00, 0, 0, 0),
(13, 'Portuguesa', 'Molho de tomate, mussarela, presunto, ovos e azeitonas', 'Molho de tomate, mussarela, presunto, ovos, azeitonas, cebola', 'tradicional', NULL, 5, 1, '2025-08-09 05:49:24', '2025-08-09 05:49:24', 0.00, 0, 0, 0),
(14, 'Frango com Catupiry', 'Molho de tomate, mussarela, frango desfiado e catupiry', 'Molho de tomate, mussarela, frango desfiado, catupiry', 'especial', NULL, 6, 1, '2025-08-09 05:49:24', '2025-08-09 05:49:24', 0.00, 0, 0, 0),
(15, 'Strogonoff', 'Molho de tomate, mussarela, strogonoff de frango', 'Molho de tomate, mussarela, strogonoff de frango, batata palha', 'especial', NULL, 7, 1, '2025-08-09 05:49:24', '2025-08-09 05:49:24', 0.00, 0, 0, 0),
(16, 'Bacon', 'Molho de tomate, mussarela e bacon', 'Molho de tomate, mussarela, bacon, cebola', 'especial', NULL, 8, 1, '2025-08-09 05:49:24', '2025-08-09 05:49:24', 0.00, 0, 0, 0),
(17, 'Atum', 'Molho de tomate, mussarela e atum', 'Molho de tomate, mussarela, atum, cebola, azeitonas', 'especial', NULL, 9, 1, '2025-08-09 05:49:24', '2025-08-09 05:49:24', 0.00, 0, 0, 0),
(18, 'Carne Seca', 'Molho de tomate, mussarela e carne seca', 'Molho de tomate, mussarela, carne seca, cebola', 'especial', NULL, 10, 1, '2025-08-09 05:49:24', '2025-08-09 05:49:24', 0.00, 0, 0, 0),
(19, 'Chocolate', 'Chocolate ao leite derretido', 'Chocolate ao leite', 'doce', NULL, 11, 1, '2025-08-09 05:49:24', '2025-08-09 05:49:24', 0.00, 0, 0, 0),
(20, 'Chocolate com Morango', 'Chocolate ao leite e morangos', 'Chocolate ao leite, morangos', 'doce', NULL, 12, 1, '2025-08-09 05:49:24', '2025-08-09 05:49:24', 0.00, 0, 0, 0),
(21, 'Banana com Canela', 'Banana caramelizada com canela', 'Banana, canela, açúcar mascavo', 'doce', NULL, 13, 1, '2025-08-09 05:49:24', '2025-08-09 05:49:24', 0.00, 0, 0, 0),
(22, 'Margherita', 'Molho de tomate, mussarela e manjericão', NULL, 'tradicional', NULL, 0, 1, '2025-08-09 06:20:22', '2025-08-09 06:20:22', 0.00, 0, 0, 0),
(23, 'Pepperoni', 'Molho de tomate, mussarela e pepperoni', NULL, 'tradicional', NULL, 0, 1, '2025-08-09 06:20:22', '2025-08-09 06:20:22', 0.00, 0, 0, 0),
(24, 'Quatro Queijos', 'Molho de tomate e quatro tipos de queijo', NULL, 'tradicional', NULL, 0, 1, '2025-08-09 06:20:22', '2025-08-09 06:20:22', 0.00, 0, 0, 0),
(25, 'Calabresa', 'Molho de tomate, mussarela e calabresa', NULL, 'tradicional', NULL, 0, 1, '2025-08-09 06:20:22', '2025-08-09 06:20:22', 0.00, 0, 0, 0),
(26, 'Portuguesa', 'Molho de tomate, mussarela, presunto, ovos e azeitonas', NULL, 'tradicional', NULL, 0, 1, '2025-08-09 06:20:22', '2025-08-09 06:20:22', 0.00, 0, 0, 0),
(27, 'Frango com Catupiry', 'Molho de tomate, mussarela, frango desfiado e catupiry', NULL, 'especial', NULL, 0, 1, '2025-08-09 06:20:22', '2025-08-09 06:20:22', 0.00, 0, 0, 0),
(28, 'Strogonoff', 'Molho de tomate, mussarela, strogonoff de frango', NULL, 'especial', NULL, 0, 1, '2025-08-09 06:20:22', '2025-08-09 06:20:22', 0.00, 0, 0, 0),
(29, 'Bacon', 'Molho de tomate, mussarela e bacon', NULL, 'especial', NULL, 0, 1, '2025-08-09 06:20:22', '2025-08-09 06:20:22', 0.00, 0, 0, 0),
(31, 'Carne Seca', 'Molho de tomate, mussarela e carne seca', NULL, 'especial', NULL, 0, 1, '2025-08-09 06:20:22', '2025-08-09 06:20:22', 0.00, 0, 0, 0),
(32, 'Chocolate', 'Chocolate ao leite derretido', NULL, 'doce', NULL, 0, 1, '2025-08-09 06:20:22', '2025-08-09 06:20:22', 0.00, 0, 0, 0),
(33, 'Chocolate com Morango', 'Chocolate ao leite e morangos', NULL, 'doce', NULL, 0, 1, '2025-08-09 06:20:22', '2025-08-09 06:20:22', 0.00, 0, 0, 0),
(34, 'Banana com Canela', 'Banana caramelizada com canela', NULL, 'doce', NULL, 0, 1, '2025-08-09 06:20:22', '2025-08-09 06:20:22', 0.00, 0, 0, 0),
(35, 'Margherita', 'Molho de tomate, mussarela e manjericão', NULL, 'tradicional', NULL, 0, 1, '2025-08-09 06:20:44', '2025-08-09 06:20:44', 0.00, 0, 0, 0),
(36, 'Pepperoni', 'Molho de tomate, mussarela e pepperoni', NULL, 'tradicional', NULL, 0, 1, '2025-08-09 06:20:44', '2025-08-09 06:20:44', 0.00, 0, 0, 0),
(37, 'Quatro Queijos', 'Molho de tomate e quatro tipos de queijo', NULL, 'tradicional', NULL, 0, 1, '2025-08-09 06:20:44', '2025-08-09 06:20:44', 0.00, 0, 0, 0),
(38, 'Calabresa', 'Molho de tomate, mussarela e calabresa', NULL, 'tradicional', NULL, 0, 1, '2025-08-09 06:20:44', '2025-08-09 06:20:44', 0.00, 0, 0, 0),
(39, 'Portuguesa', 'Molho de tomate, mussarela, presunto, ovos e azeitonas', NULL, 'tradicional', NULL, 0, 1, '2025-08-09 06:20:44', '2025-08-09 06:20:44', 0.00, 0, 0, 0),
(40, 'Frango com Catupiry', 'Molho de tomate, mussarela, frango desfiado e catupiry', NULL, 'especial', NULL, 0, 1, '2025-08-09 06:20:44', '2025-08-09 06:20:44', 0.00, 0, 0, 0),
(41, 'Strogonoff', 'Molho de tomate, mussarela, strogonoff de frango', NULL, 'especial', NULL, 0, 1, '2025-08-09 06:20:44', '2025-08-09 06:20:44', 0.00, 0, 0, 0),
(42, 'Bacon', 'Molho de tomate, mussarela e bacon', '', 'tradicional', '', 0, 1, '2025-08-09 06:20:44', '2025-08-10 03:47:57', 2.50, 0, 0, 0),
(43, 'Atum', 'Molho de tomate, mussarela e atum', '', 'especial', '', 0, 1, '2025-08-09 06:20:44', '2025-08-10 03:36:44', 5.50, 0, 0, 0),
(44, 'Carne Seca', 'Molho de tomate, mussarela e carne seca', NULL, 'especial', NULL, 0, 1, '2025-08-09 06:20:44', '2025-08-09 06:20:44', 0.00, 0, 0, 0),
(45, 'Chocolate', 'Chocolate ao leite derretido', NULL, 'doce', NULL, 0, 1, '2025-08-09 06:20:44', '2025-08-09 06:20:44', 0.00, 0, 0, 0),
(46, 'Chocolate com Morango', 'Chocolate ao leite e morangos', NULL, 'doce', NULL, 0, 1, '2025-08-09 06:20:44', '2025-08-09 06:20:44', 0.00, 0, 0, 0),
(47, 'Banana com Canela', 'Banana caramelizada com canela', NULL, 'doce', NULL, 0, 1, '2025-08-09 06:20:44', '2025-08-09 06:20:44', 0.00, 0, 0, 0);

-- --------------------------------------------------------

--
-- Estrutura para tabela `pizza_flavor_prices`
--

DROP TABLE IF EXISTS `pizza_flavor_prices`;
CREATE TABLE IF NOT EXISTS `pizza_flavor_prices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `flavor_id` int NOT NULL,
  `size_id` int NOT NULL,
  `price` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `flavor_id` (`flavor_id`),
  KEY `idx_pizza_flavor_prices_size` (`size_id`)
) ENGINE=MyISAM AUTO_INCREMENT=80 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `pizza_flavor_prices_backup_20250809_232817`
--

DROP TABLE IF EXISTS `pizza_flavor_prices_backup_20250809_232817`;
CREATE TABLE IF NOT EXISTS `pizza_flavor_prices_backup_20250809_232817` (
  `id` int NOT NULL DEFAULT '0',
  `flavor_id` int NOT NULL,
  `size_id` int NOT NULL,
  `price` decimal(10,2) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `pizza_flavor_prices_backup_20250809_232817`
--

INSERT INTO `pizza_flavor_prices_backup_20250809_232817` (`id`, `flavor_id`, `size_id`, `price`) VALUES
(1, 1, 1, 25.00),
(2, 2, 1, 28.00),
(3, 3, 1, 30.00),
(4, 4, 1, 26.00),
(5, 5, 1, 29.00),
(6, 6, 1, 32.00),
(7, 7, 1, 35.00),
(8, 8, 1, 31.00),
(9, 9, 1, 30.00),
(10, 10, 1, 38.00),
(11, 11, 1, 22.00),
(12, 12, 1, 25.00),
(13, 13, 1, 23.00),
(14, 1, 2, 30.00),
(15, 2, 2, 33.00),
(16, 3, 2, 35.00),
(17, 4, 2, 31.00),
(18, 5, 2, 34.00),
(19, 6, 2, 37.00),
(20, 7, 2, 40.00),
(21, 8, 2, 36.00),
(22, 9, 2, 35.00),
(23, 10, 2, 43.00),
(24, 11, 2, 27.00),
(25, 12, 2, 30.00),
(26, 13, 2, 28.00),
(27, 1, 3, 40.00),
(28, 2, 3, 43.00),
(29, 3, 3, 45.00),
(30, 4, 3, 41.00),
(31, 5, 3, 44.00),
(32, 6, 3, 47.00),
(33, 7, 3, 50.00),
(34, 8, 3, 46.00),
(35, 9, 3, 45.00),
(36, 10, 3, 53.00),
(37, 11, 3, 37.00),
(38, 12, 3, 40.00),
(39, 13, 3, 38.00),
(40, 8, 4, 31.08),
(41, 8, 14, 49.08),
(42, 17, 4, 28.49),
(43, 17, 14, 44.99),
(44, 18, 4, 25.90),
(45, 18, 14, 40.90),
(46, 19, 4, 31.08),
(47, 19, 14, 49.08),
(48, 20, 4, 31.08),
(49, 20, 14, 49.08),
(50, 25, 4, 25.90),
(51, 25, 14, 40.90),
(52, 27, 4, 25.90),
(53, 27, 14, 40.90),
(54, 29, 4, 25.90),
(55, 29, 14, 40.90),
(56, 31, 4, 25.90),
(57, 31, 14, 40.90),
(58, 32, 4, 31.08),
(59, 32, 14, 49.08),
(60, 33, 4, 31.08),
(61, 33, 14, 49.08),
(62, 34, 4, 25.90),
(63, 34, 14, 40.90),
(64, 38, 4, 25.90),
(65, 38, 14, 40.90),
(66, 40, 4, 25.90),
(67, 40, 14, 40.90),
(68, 42, 4, 25.90),
(69, 42, 14, 40.90),
(70, 43, 4, 28.49),
(71, 43, 14, 44.99),
(72, 44, 4, 25.90),
(73, 44, 14, 40.90),
(74, 45, 4, 31.08),
(75, 45, 14, 49.08),
(76, 46, 4, 31.08),
(77, 46, 14, 49.08),
(78, 47, 4, 25.90),
(79, 47, 14, 40.90);

-- --------------------------------------------------------

--
-- Estrutura para tabela `pizza_products`
--

DROP TABLE IF EXISTS `pizza_products`;
CREATE TABLE IF NOT EXISTS `pizza_products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `size_id` int NOT NULL,
  `flavor_id` int NOT NULL,
  `border_id` int DEFAULT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  KEY `size_id` (`size_id`),
  KEY `flavor_id` (`flavor_id`),
  KEY `border_id` (`border_id`)
) ENGINE=MyISAM AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `pizza_products`
--

INSERT INTO `pizza_products` (`id`, `product_id`, `size_id`, `flavor_id`, `border_id`, `total_price`, `created_at`) VALUES
(1, 15, 3, 1, 1, 50.00, '2025-08-09 05:17:32'),
(2, 15, 3, 2, 1, 50.00, '2025-08-09 05:17:32'),
(3, 15, 3, 3, 1, 50.00, '2025-08-09 05:17:32'),
(4, 17, 2, 1, 4, 39.00, '2025-08-09 06:28:41'),
(5, 17, 2, 2, 4, 39.00, '2025-08-09 06:28:41'),
(6, 18, 3, 2, 4, 56.00, '2025-08-09 06:31:27'),
(7, 18, 3, 6, 4, 56.00, '2025-08-09 06:31:27'),
(8, 18, 3, 7, 4, 56.00, '2025-08-09 06:31:27');

-- --------------------------------------------------------

--
-- Estrutura para tabela `pizza_product_extras`
--

DROP TABLE IF EXISTS `pizza_product_extras`;
CREATE TABLE IF NOT EXISTS `pizza_product_extras` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pizza_product_id` int NOT NULL,
  `extra_id` int NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `pizza_product_id` (`pizza_product_id`),
  KEY `extra_id` (`extra_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `pizza_sizes`
--

DROP TABLE IF EXISTS `pizza_sizes`;
CREATE TABLE IF NOT EXISTS `pizza_sizes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `slices` int NOT NULL,
  `max_flavors` int NOT NULL DEFAULT '1',
  `base_price` decimal(10,2) DEFAULT '0.00',
  `display_order` int DEFAULT '0',
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `price` decimal(8,2) DEFAULT '0.00',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `pizza_sizes`
--

INSERT INTO `pizza_sizes` (`id`, `name`, `description`, `slices`, `max_flavors`, `base_price`, `display_order`, `active`, `created_at`, `updated_at`, `price`) VALUES
(4, 'Família em Dobro', 'Pizza extra grande, ideal para 6-8 pessoas', 12, 4, 0.00, 0, 1, '2025-08-09 04:58:38', '2025-08-09 23:00:40', 119.90),
(14, 'Grande em Dobro', 'Duas pizzas Deliciosa 2 sabores em cada', 0, 4, 0.00, 0, 1, '2025-08-09 22:04:39', '2025-08-09 22:04:39', 89.90),
(8, 'Média', 'Pizza média com 6 fatias', 6, 2, 0.00, 0, 1, '2025-08-09 06:20:22', '2025-08-09 23:26:54', 34.90),
(9, 'Grande', 'Pizza grande com 8 fatias', 8, 2, 0.00, 0, 1, '2025-08-09 06:20:22', '2025-08-09 23:00:58', 49.90),
(10, 'Família', 'Pizza família com 12 fatias', 12, 3, 0.00, 0, 1, '2025-08-09 06:20:22', '2025-08-09 23:27:16', 60.90);

-- --------------------------------------------------------

--
-- Estrutura para tabela `products`
--

DROP TABLE IF EXISTS `products`;
CREATE TABLE IF NOT EXISTS `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `price` decimal(10,2) NOT NULL,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `display_order` int DEFAULT '0',
  `active` tinyint(1) DEFAULT '1',
  `is_vegetarian` tinyint(1) DEFAULT '0',
  `is_vegan` tinyint(1) DEFAULT '0',
  `is_gluten_free` tinyint(1) DEFAULT '0',
  `is_spicy` tinyint(1) DEFAULT '0',
  `preparation_time` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `product_type` enum('comum','pizza') COLLATE utf8mb4_unicode_ci DEFAULT 'comum',
  `category_value` decimal(10,2) DEFAULT NULL COMMENT 'Preço de categoria - controla se deve exibir preços',
  PRIMARY KEY (`id`),
  KEY `idx_products_category` (`category_id`),
  KEY `idx_products_active` (`active`),
  KEY `idx_products_type` (`product_type`)
) ENGINE=MyISAM AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `products`
--

INSERT INTO `products` (`id`, `category_id`, `name`, `description`, `price`, `image_url`, `display_order`, `active`, `is_vegetarian`, `is_vegan`, `is_gluten_free`, `is_spicy`, `preparation_time`, `created_at`, `updated_at`, `product_type`, `category_value`) VALUES
(1, 1, 'X-Burger Clássico', 'Hambúrguer bovino, queijo, alface, tomate, cebola e molho especial', 15.90, NULL, 0, 1, 0, 0, 0, 0, 15, '2025-08-09 00:28:41', '2025-08-09 00:28:41', 'comum', NULL),
(2, 1, 'X-Salada', 'Hambúrguer bovino, queijo, alface, tomate, cebola, ovo e batata palha', 18.90, NULL, 0, 1, 0, 0, 0, 0, 15, '2025-08-09 00:28:41', '2025-08-09 00:28:41', 'comum', NULL),
(3, 1, 'X-Vegetariano', 'Hambúrguer de soja, queijo, alface, tomate, cebola e molho especial', 16.90, '', 1, 1, 1, 0, 0, 0, 12, '2025-08-09 00:28:41', '2025-08-09 04:15:59', 'comum', NULL),
(4, 2, 'Pizza Margherita', 'Molho de tomate, mussarela, manjericão e azeite', 32.90, NULL, 0, 1, 1, 0, 0, 0, 25, '2025-08-09 00:28:41', '2025-08-09 23:59:09', 'comum', 32.90),
(5, 2, 'Pizza Calabresa', 'Molho de tomate, mussarela, calabresa e cebola', 35.90, NULL, 0, 1, 0, 0, 0, 0, 25, '2025-08-09 00:28:41', '2025-08-09 23:59:09', 'comum', 35.90),
(17, 2, 'Média - Margherita, Calabresa', 'Pizza Média com Margherita, Calabresa', 39.00, NULL, 0, 1, 0, 0, 0, 0, 0, '2025-08-09 06:28:41', '2025-08-09 23:59:09', 'comum', 39.00),
(7, 3, 'Coca-Cola 350ml', 'Refrigerante de cola gelado', 4.50, NULL, 0, 1, 1, 0, 0, 0, 2, '2025-08-09 00:28:41', '2025-08-09 04:19:58', 'comum', NULL),
(8, 3, 'Suco de Laranja Natural', 'Suco natural de laranja 300ml', 6.90, NULL, 0, 1, 1, 0, 0, 0, 5, '2025-08-09 00:28:41', '2025-08-09 00:28:41', 'comum', NULL),
(9, 3, 'Água Mineral 500ml', 'Água mineral sem gás', 2.50, NULL, 0, 1, 1, 0, 0, 0, 1, '2025-08-09 00:28:41', '2025-08-09 00:28:41', 'comum', NULL),
(10, 4, 'Pudim de Leite', 'Pudim caseiro com calda de caramelo', 8.90, NULL, 0, 1, 1, 0, 0, 0, 5, '2025-08-09 00:28:41', '2025-08-09 00:28:41', 'comum', NULL),
(11, 4, 'Brigadeiro Gourmet', 'Brigadeiro artesanal - unidade', 3.50, NULL, 0, 0, 1, 0, 0, 0, 2, '2025-08-09 00:28:41', '2025-08-09 08:05:36', 'comum', NULL),
(12, 5, 'Prato Feito Completo', 'Arroz, feijão, bife acebolado, ovo, batata frita e salada', 22.90, NULL, 0, 1, 0, 0, 0, 0, 20, '2025-08-09 00:28:41', '2025-08-09 00:28:41', 'comum', NULL),
(13, 5, 'Filé de Frango Grelhado', 'Filé de frango grelhado com arroz, feijão e legumes', 19.90, NULL, 0, 1, 0, 0, 0, 0, 18, '2025-08-09 00:28:41', '2025-08-09 00:28:41', 'comum', NULL),
(31, 2, 'Monte Sua pizza', 'Monte sua pizza', 0.00, '', 0, 1, 0, 0, 0, 0, 30, '2025-08-09 23:39:16', '2025-08-09 23:59:09', 'pizza', 25.00),
(25, 2, 'Pizza em dobro', '', 0.00, '', 1, 1, 0, 0, 0, 0, 0, '2025-08-09 10:11:37', '2025-08-09 23:59:09', 'pizza', 25.00),
(28, 2, 'Pizza Especial da Casa', 'Pizza personalizada com sabores tradicionais selecionados especialmente pela casa', 0.00, NULL, 0, 1, 0, 0, 0, 0, 0, '2025-08-09 10:41:17', '2025-08-09 23:59:09', 'pizza', 25.00),
(30, 2, 'Teste de Produto', '', 0.00, '', 1, 1, 0, 0, 0, 0, 0, '2025-08-09 11:08:55', '2025-08-09 23:59:09', 'pizza', 25.00),
(38, 8, 'Pastel de Frango', 'Pastel de frango fresquinho feito na hora', 12.90, '', 0, 1, 0, 0, 0, 0, 0, '2025-08-10 05:39:59', '2025-08-10 05:39:59', 'comum', NULL);

-- --------------------------------------------------------

--
-- Estrutura para tabela `product_extras`
--

DROP TABLE IF EXISTS `product_extras`;
CREATE TABLE IF NOT EXISTS `product_extras` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `product_pizza_borders`
--

DROP TABLE IF EXISTS `product_pizza_borders`;
CREATE TABLE IF NOT EXISTS `product_pizza_borders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `pizza_border_id` int NOT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_product_border` (`product_id`,`pizza_border_id`),
  KEY `pizza_border_id` (`pizza_border_id`),
  KEY `idx_product_pizza_borders_product` (`product_id`)
) ENGINE=MyISAM AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `product_pizza_borders`
--

INSERT INTO `product_pizza_borders` (`id`, `product_id`, `pizza_border_id`, `active`, `created_at`) VALUES
(5, 28, 1, 1, '2025-08-09 10:41:17'),
(6, 28, 2, 1, '2025-08-09 10:41:17'),
(7, 30, 1, 1, '2025-08-09 11:08:55');

-- --------------------------------------------------------

--
-- Estrutura para tabela `product_pizza_extras`
--

DROP TABLE IF EXISTS `product_pizza_extras`;
CREATE TABLE IF NOT EXISTS `product_pizza_extras` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `pizza_extra_id` int NOT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_product_extra` (`product_id`,`pizza_extra_id`),
  KEY `pizza_extra_id` (`pizza_extra_id`),
  KEY `idx_product_pizza_extras_product` (`product_id`)
) ENGINE=MyISAM AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `product_pizza_extras`
--

INSERT INTO `product_pizza_extras` (`id`, `product_id`, `pizza_extra_id`, `active`, `created_at`) VALUES
(17, 25, 19, 1, '2025-08-09 22:05:36'),
(18, 25, 20, 1, '2025-08-09 22:05:36'),
(3, 28, 1, 1, '2025-08-09 10:41:17'),
(4, 28, 2, 1, '2025-08-09 10:41:17'),
(5, 28, 5, 1, '2025-08-09 10:41:17'),
(6, 28, 6, 1, '2025-08-09 10:41:17'),
(7, 29, 8, 1, '2025-08-09 10:41:21'),
(8, 29, 17, 1, '2025-08-09 10:41:21'),
(16, 25, 18, 1, '2025-08-09 22:05:36'),
(15, 25, 17, 1, '2025-08-09 22:05:36'),
(14, 25, 8, 1, '2025-08-09 22:05:36'),
(19, 31, 2, 1, '2025-08-09 23:39:16'),
(20, 31, 10, 1, '2025-08-09 23:39:16'),
(21, 31, 4, 1, '2025-08-09 23:39:16'),
(22, 31, 13, 1, '2025-08-09 23:39:16'),
(23, 31, 5, 1, '2025-08-09 23:39:16'),
(24, 31, 6, 1, '2025-08-09 23:39:16');

-- --------------------------------------------------------

--
-- Estrutura para tabela `product_pizza_flavors`
--

DROP TABLE IF EXISTS `product_pizza_flavors`;
CREATE TABLE IF NOT EXISTS `product_pizza_flavors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `pizza_flavor_id` int NOT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_product_flavor` (`product_id`,`pizza_flavor_id`),
  KEY `pizza_flavor_id` (`pizza_flavor_id`),
  KEY `idx_product_pizza_flavors_product` (`product_id`)
) ENGINE=MyISAM AUTO_INCREMENT=111 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `product_pizza_flavors`
--

INSERT INTO `product_pizza_flavors` (`id`, `product_id`, `pizza_flavor_id`, `active`, `created_at`) VALUES
(65, 25, 20, 1, '2025-08-09 22:05:36'),
(64, 25, 19, 1, '2025-08-09 22:05:36'),
(63, 25, 18, 1, '2025-08-09 22:05:36'),
(15, 28, 1, 1, '2025-08-09 10:41:17'),
(16, 28, 2, 1, '2025-08-09 10:41:17'),
(17, 28, 3, 1, '2025-08-09 10:41:17'),
(18, 28, 4, 1, '2025-08-09 10:41:17'),
(19, 28, 5, 1, '2025-08-09 10:41:17'),
(20, 29, 23, 1, '2025-08-09 10:41:21'),
(21, 29, 36, 1, '2025-08-09 10:41:21'),
(22, 29, 39, 1, '2025-08-09 10:41:21'),
(23, 29, 24, 1, '2025-08-09 10:41:21'),
(24, 29, 37, 1, '2025-08-09 10:41:21'),
(62, 25, 17, 1, '2025-08-09 22:05:36'),
(61, 25, 8, 1, '2025-08-09 22:05:36'),
(60, 25, 27, 1, '2025-08-09 22:05:36'),
(59, 25, 40, 1, '2025-08-09 22:05:36'),
(58, 25, 33, 1, '2025-08-09 22:05:36'),
(57, 25, 46, 1, '2025-08-09 22:05:36'),
(56, 25, 32, 1, '2025-08-09 22:05:36'),
(55, 25, 45, 1, '2025-08-09 22:05:36'),
(54, 25, 31, 1, '2025-08-09 22:05:36'),
(53, 25, 44, 1, '2025-08-09 22:05:36'),
(52, 25, 25, 1, '2025-08-09 22:05:36'),
(51, 25, 38, 1, '2025-08-09 22:05:36'),
(50, 25, 34, 1, '2025-08-09 22:05:36'),
(49, 25, 47, 1, '2025-08-09 22:05:36'),
(48, 25, 29, 1, '2025-08-09 22:05:36'),
(47, 25, 42, 1, '2025-08-09 22:05:36'),
(46, 25, 43, 1, '2025-08-09 22:05:36'),
(45, 30, 43, 1, '2025-08-09 11:08:55'),
(66, 31, 43, 1, '2025-08-09 23:39:16'),
(67, 31, 42, 1, '2025-08-09 23:39:16'),
(68, 31, 29, 1, '2025-08-09 23:39:16'),
(69, 31, 47, 1, '2025-08-09 23:39:16'),
(70, 31, 34, 1, '2025-08-09 23:39:16'),
(71, 31, 38, 1, '2025-08-09 23:39:16'),
(72, 31, 25, 1, '2025-08-09 23:39:16'),
(73, 31, 44, 1, '2025-08-09 23:39:16'),
(74, 31, 45, 1, '2025-08-09 23:39:16'),
(75, 31, 32, 1, '2025-08-09 23:39:16'),
(76, 31, 46, 1, '2025-08-09 23:39:16'),
(77, 31, 33, 1, '2025-08-09 23:39:16'),
(78, 31, 40, 1, '2025-08-09 23:39:16'),
(79, 31, 27, 1, '2025-08-09 23:39:16'),
(80, 31, 22, 1, '2025-08-09 23:39:16'),
(81, 31, 35, 1, '2025-08-09 23:39:16'),
(82, 31, 23, 1, '2025-08-09 23:39:16'),
(83, 31, 36, 1, '2025-08-09 23:39:16'),
(84, 31, 39, 1, '2025-08-09 23:39:16'),
(85, 31, 26, 1, '2025-08-09 23:39:16'),
(86, 31, 24, 1, '2025-08-09 23:39:16'),
(87, 31, 37, 1, '2025-08-09 23:39:16'),
(88, 31, 28, 1, '2025-08-09 23:39:16'),
(89, 31, 41, 1, '2025-08-09 23:39:16'),
(90, 31, 1, 1, '2025-08-09 23:39:16'),
(91, 31, 9, 1, '2025-08-09 23:39:16'),
(92, 31, 2, 1, '2025-08-09 23:39:16'),
(93, 31, 10, 1, '2025-08-09 23:39:16'),
(94, 31, 3, 1, '2025-08-09 23:39:16'),
(95, 31, 11, 1, '2025-08-09 23:39:16'),
(96, 31, 12, 1, '2025-08-09 23:39:16'),
(97, 31, 4, 1, '2025-08-09 23:39:16'),
(98, 31, 5, 1, '2025-08-09 23:39:16'),
(99, 31, 13, 1, '2025-08-09 23:39:16'),
(100, 31, 14, 1, '2025-08-09 23:39:16'),
(101, 31, 6, 1, '2025-08-09 23:39:16'),
(102, 31, 7, 1, '2025-08-09 23:39:16'),
(103, 31, 15, 1, '2025-08-09 23:39:16'),
(104, 31, 16, 1, '2025-08-09 23:39:16'),
(105, 31, 8, 1, '2025-08-09 23:39:16'),
(106, 31, 17, 1, '2025-08-09 23:39:16'),
(107, 31, 18, 1, '2025-08-09 23:39:16'),
(108, 31, 19, 1, '2025-08-09 23:39:16'),
(109, 31, 20, 1, '2025-08-09 23:39:16'),
(110, 31, 21, 1, '2025-08-09 23:39:16');

-- --------------------------------------------------------

--
-- Estrutura para tabela `product_pizza_sizes`
--

DROP TABLE IF EXISTS `product_pizza_sizes`;
CREATE TABLE IF NOT EXISTS `product_pizza_sizes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `pizza_size_id` int NOT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_product_size` (`product_id`,`pizza_size_id`),
  KEY `pizza_size_id` (`pizza_size_id`),
  KEY `idx_product_pizza_sizes_product` (`product_id`)
) ENGINE=MyISAM AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `product_pizza_sizes`
--

INSERT INTO `product_pizza_sizes` (`id`, `product_id`, `pizza_size_id`, `active`, `created_at`) VALUES
(1, 21, 4, 1, '2025-08-09 09:48:36'),
(21, 25, 4, 1, '2025-08-09 22:05:35'),
(6, 24, 4, 1, '2025-08-09 09:58:28'),
(5, 24, 10, 1, '2025-08-09 09:58:28'),
(13, 28, 1, 1, '2025-08-09 10:41:17'),
(14, 28, 2, 1, '2025-08-09 10:41:17'),
(15, 29, 4, 1, '2025-08-09 10:41:21'),
(16, 29, 9, 1, '2025-08-09 10:41:21'),
(18, 30, 4, 1, '2025-08-09 11:08:55'),
(19, 30, 9, 1, '2025-08-09 11:08:55'),
(20, 30, 8, 1, '2025-08-09 11:08:55'),
(22, 25, 14, 1, '2025-08-09 22:05:35'),
(23, 31, 10, 1, '2025-08-09 23:39:16'),
(24, 31, 9, 1, '2025-08-09 23:39:16'),
(25, 31, 8, 1, '2025-08-09 23:39:16');

-- --------------------------------------------------------

--
-- Estrutura para tabela `users`
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('admin','manager','operator') COLLATE utf8mb4_unicode_ci DEFAULT 'operator',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password`, `role`, `created_at`, `updated_at`) VALUES
(1, 'Administrador', 'admin@cardapio.com', '$2y$12$INF9RaavxjmiuiwDfrdwnOOJqRD9dlVJqqsP1mHVyxoKbR4azeS0i', 'admin', '2025-08-09 00:28:41', '2025-08-09 01:23:46');
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
