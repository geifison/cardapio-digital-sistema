<?php
return [
    // URL do microserviço Node (Socket.IO HTTP endpoints)
    'node_url' => getenv('NODE_REALTIME_URL') ?: 'http://localhost:3000',
    // Segredo compartilhado entre PHP e Node
    'secret' => getenv('REALTIME_SECRET') ?: 'dev-secret',
];