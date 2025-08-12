<?php
/**
 * Controller para gerenciamento de autenticação
 */

class AuthController {
    private $db;
    
    public function __construct($database) {
        $this->db = $database;
    }
    
    /**
     * Realiza login do usuário
     * @param array $data Dados de login (email e password)
     */
    public function login($data) {
        try {
            // Validação dos dados
            if (empty($data['email']) || empty($data['password'])) {
                http_response_code(400);
                echo json_encode([
                    'error' => true,
                    'message' => 'Email e senha são obrigatórios'
                ]);
                return;
            }
            
            // Busca o usuário
            $query = "SELECT id, name, email, password, role FROM users WHERE email = :email";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':email', $data['email']);
            $stmt->execute();
            
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Verificação da senha
            if (!$user || !password_verify($data['password'], $user['password'])) {
                http_response_code(401);
                echo json_encode([
                    'error' => true,
                    'message' => 'Credenciais inválidas'
                ]);
                return;
            }
            
            // Armazena os dados do usuário na sessão
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['user_name'] = $user['name'];
            $_SESSION['user_email'] = $user['email'];
            $_SESSION['user_role'] = $user['role'];
            
            echo json_encode([
                'success' => true,
                'message' => 'Login realizado com sucesso',
                'data' => [
                    'user' => [
                        'id' => $user['id'],
                        'name' => $user['name'],
                        'email' => $user['email'],
                        'role' => $user['role']
                    ]
                ]
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'error' => true,
                'message' => 'Erro ao realizar login',
                'details' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Realiza logout do usuário
     */
    public function logout() {
        try {
            session_unset();
            session_destroy();
            
            echo json_encode([
                'success' => true,
                'message' => 'Logout realizado com sucesso'
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'error' => true,
                'message' => 'Erro ao realizar logout',
                'details' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Verifica se o usuário está autenticado
     */
    public function verifyToken() {
        try {
            if (isset($_SESSION['user_id'])) {
                // Busca dados atualizados do usuário
                $query = "SELECT id, name, email, role FROM users WHERE id = :id";
                $stmt = $this->db->prepare($query);
                $stmt->bindParam(':id', $_SESSION['user_id'], PDO::PARAM_INT);
                $stmt->execute();
                
                $user = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($user) {
                    echo json_encode([
                        'success' => true,
                        'data' => [
                            'user' => $user,
                            'authenticated' => true
                        ]
                    ]);
                    return;
                }
            }
            
            // Se não houver sessão ativa
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Não autenticado',
                'data' => [
                    'authenticated' => false
                ]
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'error' => true,
                'message' => 'Erro ao verificar autenticação',
                'details' => $e->getMessage()
            ]);
        }
    }

    /**
     * Middleware para verificar autenticação em rotas protegidas
     */
    public static function requireAuth($db) {
        if (!isset($_SESSION['user_id'])) {
            http_response_code(401);
            echo json_encode([
                'error' => true,
                'message' => 'Acesso não autorizado'
            ]);
            exit();
        }
        
        // Retorna os dados da sessão
        return $_SESSION;
    }
}
