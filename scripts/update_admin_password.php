<?php
// Atualiza a senha do admin para 'admin123' (ou valor via argv)
require_once __DIR__ . '/../config/database.php';

try {
    $db = new Database();
    $pdo = $db->getConnection();

    $email = 'diretor@gsite.com.br';
    $newPassword = $argv[1] ?? 'admin123';

    $hash = password_hash($newPassword, PASSWORD_DEFAULT);

    $stmt = $pdo->prepare("UPDATE users SET password = :password WHERE email = :email");
    $stmt->execute([':password' => $hash, ':email' => $email]);

    echo "Senha atualizada para {$email}. Linhas afetadas: " . $stmt->rowCount() . PHP_EOL;
} catch (Throwable $e) {
    fwrite(STDERR, 'Erro: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}