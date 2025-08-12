<?php
/**
 * EventManager - Emissor simples de eventos para SSE baseado em arquivo
 */
class EventManager {
    private static $eventsFile;

    private static function ensureInit() {
        if (!self::$eventsFile) {
            self::$eventsFile = __DIR__ . '/../logs/events.log';
            $dir = dirname(self::$eventsFile);
            if (!is_dir($dir)) {
                @mkdir($dir, 0777, true);
            }
            if (!file_exists(self::$eventsFile)) {
                @touch(self::$eventsFile);
            }
        }
    }

    /**
     * Emite um evento persistindo em arquivo de log
     * @param string $type Nome do evento (ex: products_updated)
     * @param array $payload Dados adicionais do evento
     */
    public static function emit(string $type, array $payload = []) : void {
        self::ensureInit();
        $event = [
            'id' => self::generateEventId(),
            'type' => $type,
            'payload' => $payload,
            'timestamp' => date('c')
        ];
        // Grava uma linha JSON por evento
        $line = json_encode($event) . PHP_EOL;
        @file_put_contents(self::$eventsFile, $line, FILE_APPEND | LOCK_EX);
    }

    /**
     * Lê eventos novos a partir de um deslocamento (byte offset) do arquivo
     * @param int $offset posição em bytes para iniciar leitura
     * @return array [events => array, newOffset => int]
     */
    public static function readSinceOffset(int $offset) : array {
        self::ensureInit();
        $size = @filesize(self::$eventsFile) ?: 0;
        if ($offset > $size) $offset = 0; // arquivo foi truncado

        $fp = @fopen(self::$eventsFile, 'r');
        if (!$fp) return ['events' => [], 'newOffset' => $size];
        @fseek($fp, $offset);

        $events = [];
        while (($line = fgets($fp)) !== false) {
            $line = trim($line);
            if ($line === '') continue;
            $decoded = json_decode($line, true);
            if (is_array($decoded) && isset($decoded['id'])) {
                $events[] = $decoded;
            }
        }
        $newOffset = ftell($fp);
        @fclose($fp);
        return ['events' => $events, 'newOffset' => $newOffset];
    }

    private static function generateEventId() : string {
        // ID baseado em timestamp com microsegundos
        $micro = microtime(true);
        return sprintf('%.6f', $micro);
    }
}


