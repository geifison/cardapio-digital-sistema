<?php
/**
 * Configurações de conexão com o banco de dados e métodos auxiliares.
 */
class Database {
    // Configurações do banco de dados
    private $host = '127.0.0.1';
    private $port = 3306; // Porta padrão do MySQL
    private $db_name = 'cardapio_digital';
    private $username = 'root';
    private $password = '';
    private $charset = 'utf8mb4';

    public $conn;

    /**
     * Conecta ao banco de dados MySQL
     * @param bool $with_db Se a conexão deve ser feita com um banco de dados específico.
     * @return PDO|null
     */
    public function getConnection($with_db = true) {
        $this->conn = null;
        
        try {
            if ($with_db) {
                $dsn = "mysql:host={$this->host};port={$this->port};dbname={$this->db_name};charset={$this->charset}";
            } else {
                $dsn = "mysql:host={$this->host};port={$this->port};charset={$this->charset}";
            }
            
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];
            
            $this->conn = new PDO($dsn, $this->username, $this->password, $options);
        } catch(PDOException $exception) {
            // Lança a exceção para que o script principal possa pegá-la
            throw $exception;
        }

        return $this->conn;
    }

    /**
     * Cria o banco de dados e as tabelas a partir do arquivo SQL
     * @param string $sql_file_path O caminho para o arquivo SQL
     * @return bool Retorna true em caso de sucesso, false em caso de falha.
     */
    public function createDatabase($sql_file_path) {
        try {
            // Conecta ao servidor MySQL sem especificar um banco de dados
            $conn_no_db = $this->getConnection(false);
            
            // Cria o banco de dados se ele não existir
            $sql_create_db = "CREATE DATABASE IF NOT EXISTS " . $this->db_name . " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci";
            $conn_no_db->exec($sql_create_db);
            
            echo "Banco de dados criado com sucesso!<br>";
            
            // Agora, conecta ao banco de dados recém-criado
            $this->conn = $this->getConnection(true);

            // Lê e executa o arquivo SQL
            if (file_exists($sql_file_path)) {
                $sql_content = file_get_contents($sql_file_path);
                
                // Executa o conteúdo do arquivo SQL de uma vez.
                $this->conn->exec($sql_content);
                
                echo "Tabelas criadas e dados iniciais inseridos com sucesso!<br>";
                return true;
            } else {
                echo "Erro: Arquivo database_schema.sql não encontrado em: " . htmlspecialchars($sql_file_path) . "<br>";
                return false;
            }
            
        } catch(PDOException $e) {
            echo "Erro fatal: " . $e->getMessage() . "<br>";
            return false;
        }
    }
}

/**
 * Configurações gerais da aplicação
 */
class Config {
    // URL base da aplicação
    public static $base_url = 'http://localhost/cardapio-digital/';
    
    // Configurações de upload de imagens
    public static $upload_path = 'uploads/';
    public static $max_file_size = 5242880; // 5MB
    public static $allowed_extensions = ['jpg', 'jpeg', 'png', 'gif'];
    
    // Configurações de pedidos
    public static $default_delivery_time = 30; // minutos
    public static $default_delivery_fee = 5.00; // R$
    
    // Configurações de notificação sonora
    public static $sound_enabled = true;
    public static $sound_file = 'assets/sounds/notification.mp3';
}
?>
