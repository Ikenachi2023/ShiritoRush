<?php
require_once __DIR__ . '/error_handler.php';

/**
 * ShiritoRush - 202万語 NEologd マスター辞書配信用 API (403 回避用 PHP ストリーミング)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=86400'); // 24時間キャッシュ許可

$dictFile = __DIR__ . '/../data/neologd_dictionary.json';

if (!file_exists($dictFile)) {
    http_response_code(444);
    echo json_encode(['error' => 'Dictionary file not found']);
    exit;
}

// 202万語辞書ファイルを直接出力
readfile($dictFile);
exit;
