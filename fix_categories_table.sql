-- Script para corrigir a estrutura da tabela categories
-- Executar este script no phpMyAdmin ou MySQL para corrigir problemas de tipo de dados

USE cardapio_digital;

-- Alterar coluna active de BOOLEAN para TINYINT(1)
ALTER TABLE categories MODIFY COLUMN active TINYINT(1) DEFAULT 1;

-- Verificar se a alteração foi aplicada
DESCRIBE categories;

-- Verificar dados existentes
SELECT id, name, active FROM categories LIMIT 5;
