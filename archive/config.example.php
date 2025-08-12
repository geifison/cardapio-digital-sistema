<?php
/**
 * Arquivo de Configuração de Exemplo
 * Copie este arquivo para config.php e ajuste as configurações conforme necessário
 */

// Configurações do Banco de Dados
define('DB_HOST', 'localhost');
define('DB_NAME', 'cardapio_digital');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

// Configurações da Aplicação
define('APP_NAME', 'Sabor & Cia');
define('APP_URL', 'http://localhost/cardapio-digital/');
define('APP_ENV', 'development'); // development, production

// Configurações de Segurança
define('JWT_SECRET', 'cardapio_digital_secret_2024_change_this_in_production');
define('SESSION_LIFETIME', 86400); // 24 horas em segundos

// Configurações de Upload
define('UPLOAD_PATH', 'uploads/');
define('MAX_FILE_SIZE', 5242880); // 5MB
define('ALLOWED_EXTENSIONS', ['jpg', 'jpeg', 'png', 'gif']);

// Configurações de Pedidos
define('DEFAULT_DELIVERY_FEE', 5.00);
define('DEFAULT_DELIVERY_TIME', 30); // minutos
define('ORDER_TIMEOUT', 3600); // 1 hora em segundos

// Configurações de Email (para futuras implementações)
define('SMTP_HOST', 'smtp.gmail.com');
define('SMTP_PORT', 587);
define('SMTP_USER', 'seu-email@gmail.com');
define('SMTP_PASS', 'sua-senha');
define('SMTP_FROM', 'noreply@seurestaurante.com');
define('SMTP_FROM_NAME', 'Sistema de Pedidos');

// Configurações de Notificações
define('SOUND_ENABLED', true);
define('SOUND_FILE', 'assets/sounds/notification.mp3');
define('REFRESH_INTERVAL', 5000); // 5 segundos

// Configurações de Relatórios
define('TIMEZONE', 'America/Sao_Paulo');
define('DATE_FORMAT', 'd/m/Y');
define('TIME_FORMAT', 'H:i');
define('DATETIME_FORMAT', 'd/m/Y H:i:s');

// Configurações de Cache
define('CACHE_ENABLED', false);
define('CACHE_LIFETIME', 3600); // 1 hora

// Configurações de Log
define('LOG_ENABLED', true);
define('LOG_PATH', 'logs/');
define('LOG_LEVEL', 'INFO'); // DEBUG, INFO, WARNING, ERROR

// Configurações de Backup
define('BACKUP_ENABLED', false);
define('BACKUP_PATH', 'backups/');
define('BACKUP_RETENTION_DAYS', 30);

// Configurações de Integração (para futuras implementações)
define('WHATSAPP_API_ENABLED', false);
define('WHATSAPP_API_TOKEN', '');
define('WHATSAPP_PHONE', '');

define('PAYMENT_GATEWAY_ENABLED', false);
define('PAYMENT_GATEWAY_KEY', '');
define('PAYMENT_GATEWAY_SECRET', '');

// Configurações de Impressão
define('PRINTER_ENABLED', false);
define('PRINTER_IP', '192.168.1.100');
define('PRINTER_PORT', 9100);

// Configurações de Delivery
define('DELIVERY_ZONES', [
    'Centro' => 0.00,
    'Zona Norte' => 3.00,
    'Zona Sul' => 5.00,
    'Zona Leste' => 4.00,
    'Zona Oeste' => 4.00
]);

// Configurações de Horário de Funcionamento
define('OPENING_HOURS', [
    'monday' => ['open' => '18:00', 'close' => '23:00'],
    'tuesday' => ['open' => '18:00', 'close' => '23:00'],
    'wednesday' => ['open' => '18:00', 'close' => '23:00'],
    'thursday' => ['open' => '18:00', 'close' => '23:00'],
    'friday' => ['open' => '18:00', 'close' => '00:00'],
    'saturday' => ['open' => '18:00', 'close' => '00:00'],
    'sunday' => ['open' => '18:00', 'close' => '23:00']
]);

// Configurações de Tema/Visual
define('THEME_PRIMARY_COLOR', '#ff6b35');
define('THEME_SECONDARY_COLOR', '#2c3e50');
define('THEME_ACCENT_COLOR', '#f39c12');
define('THEME_SUCCESS_COLOR', '#27ae60');
define('THEME_DANGER_COLOR', '#e74c3c');

// Configurações de SEO
define('META_TITLE', 'Cardápio Digital - Sabor & Cia');
define('META_DESCRIPTION', 'Faça seu pedido online de forma rápida e prática');
define('META_KEYWORDS', 'delivery, comida, restaurante, pedido online');

// Configurações de Analytics (para futuras implementações)
define('GOOGLE_ANALYTICS_ID', '');
define('FACEBOOK_PIXEL_ID', '');

// Configurações de Manutenção
define('MAINTENANCE_MODE', false);
define('MAINTENANCE_MESSAGE', 'Sistema em manutenção. Voltamos em breve!');

// Configurações de Debug
if (APP_ENV === 'development') {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
    define('DEBUG_MODE', true);
} else {
    error_reporting(0);
    ini_set('display_errors', 0);
    define('DEBUG_MODE', false);
}

// Configurações de Timezone
date_default_timezone_set(TIMEZONE);

// Função para carregar configurações personalizadas
function loadCustomConfig() {
    $customConfigFile = __DIR__ . '/config.custom.php';
    if (file_exists($customConfigFile)) {
        require_once $customConfigFile;
    }
}

// Carrega configurações personalizadas se existirem
loadCustomConfig();
?>

