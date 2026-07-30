<?php
/**
 * ShiritoRush - Universal PHP Debug Error Handler
 */
error_reporting(E_ALL);
ini_set('display_errors', 0);

function customPhpErrorHandler($errno, $errstr, $errfile, $errline) {
    if (!(error_reporting() & $errno)) {
        return false;
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error_type' => 'SERVER_ERROR',
        'message' => 'サーバー内部エラーが発生しました'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

set_error_handler("customPhpErrorHandler");

register_shutdown_function(function() {
    $error = error_get_last();
    if ($error !== NULL && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error_type' => 'SERVER_FATAL_ERROR',
            'message' => 'サーバー処理中に修復不可能なエラーが発生しました'
        ], JSON_UNESCAPED_UNICODE);
    }
});
