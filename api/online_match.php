<?php
require_once __DIR__ . '/error_handler.php';

/**
 * ShiritoRush - オンライン1v1対戦 (完全サーバー勝敗一律決定 ＆ 単語検証中タイマー停止) API
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$roomsDir = __DIR__ . '/../data/rooms';
if (!file_exists($roomsDir)) {
    @mkdir($roomsDir, 0777, true);
}
@chmod($roomsDir, 0777);

if (!is_writable($roomsDir)) {
    $tmpDir = sys_get_temp_dir() . '/shiritorush_rooms';
    if (!file_exists($tmpDir)) {
        @mkdir($tmpDir, 0777, true);
    }
    $roomsDir = $tmpDir;
}

$action = isset($_REQUEST['action']) ? trim($_REQUEST['action']) : '';

function getRoomFile($roomsDir, $code) {
    $cleanCode = strtoupper(preg_replace('/[^A-Z0-9]/', '', $code));
    return $roomsDir . '/' . $cleanCode . '.json';
}

function loadRoom($file) {
    if (!file_exists($file)) {
        $altFile = sys_get_temp_dir() . '/shiritorush_rooms/' . basename($file);
        if (file_exists($altFile)) {
            $file = $altFile;
        } else {
            return null;
        }
    }
    $content = @file_get_contents($file);
    return json_decode($content, true);
}

function saveRoom($file, $data) {
    $data['lastUpdated'] = time();
    $dir = dirname($file);
    if (!file_exists($dir)) {
        @mkdir($dir, 0777, true);
    }
    @chmod($dir, 0777);
    $payload = json_encode($data, JSON_UNESCAPED_UNICODE);
    $res = @file_put_contents($file, $payload, LOCK_EX);
    if ($res === false) {
        $altFile = sys_get_temp_dir() . '/shiritorush_rooms/' . basename($file);
        $altDir = dirname($altFile);
        if (!file_exists($altDir)) {
            @mkdir($altDir, 0777, true);
        }
        $resAlt = @file_put_contents($altFile, $payload, LOCK_EX);
        if ($resAlt === false) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'reason' => '対戦データ書き込みエラー: フリーサーバーの書き込み権限をご確認ください'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
}

/**
 * サーバーサイド対局時計 ＆ タイムアップ時の一律勝敗確定判定
 * (プレイヤーの回答入力時間に特化したフェアな時間減算仕様)
 */
function updateServerTimeAndCheckFinish(&$room, $file) {
    if ($room['status'] !== 'playing') return;

    $now = time();
    $turnStart = isset($room['turnStartTime']) ? (int)$room['turnStartTime'] : $now;
    
    // 画面遷移・アニメーション直後の3秒間は猶予期間として減算をスキップ (180秒フルスタート保障)
    $rawElapsed = max(0, $now - $turnStart);
    $elapsed = ($rawElapsed <= 3) ? 0 : ($rawElapsed - 3);

    $activeIdx = (int)$room['activePlayerIndex'];

    if (!isset($room['playerTimes']) || !is_array($room['playerTimes'])) {
        $room['playerTimes'] = [180, 180];
    }

    $calcTimes = $room['playerTimes'];
    $calcTimes[$activeIdx] = max(0, $room['playerTimes'][$activeIdx] - $elapsed);

    // 持ち時間切れ判定 ➔ サーバー側で勝者・敗者を厳格決定
    if ($calcTimes[$activeIdx] <= 0) {
        $room['playerTimes'][$activeIdx] = 0;
        $room['status'] = 'finished';
        $loser = $room['players'][$activeIdx];
        $winnerIdx = ($activeIdx + 1) % count($room['players']);
        $winner = $room['players'][$winnerIdx];

        $room['winnerId'] = $winner['id'];
        $room['loserId'] = $loser['id'];
        $room['finishReason'] = "{$loser['name']} の持ち時間切れによるタイムアップ！";
        $room['lastMessage'] = "{$winner['name']} の勝利！ ({$room['finishReason']})";

        saveRoom($file, $room);
    } else {
        $room['livePlayerTimes'] = $calcTimes;
    }
}


/**
 * 終了済み部屋 ＆ 放置部屋の自動ガベージコレクション（即時物理削除）
 */
function cleanupOldRooms($roomsDir) {
    $files = glob($roomsDir . '/*.json');
    if (!is_array($files)) return;
    $now = time();
    foreach ($files as $file) {
        $room = loadRoom($file);
        if (!$room) {
            @unlink($file);
            continue;
        }
        // 1. 終了済みの部屋 (status === 'finished') ➔ 即時削除
        if (isset($room['status']) && $room['status'] === 'finished') {
            @unlink($file);
            continue;
        }
        // 2. 3分以上更新のない放置部屋 ➔ 削除
        $lastUpdated = isset($room['lastUpdated']) ? (int)$room['lastUpdated'] : 0;
        if ($now - $lastUpdated > 180) {
            @unlink($file);
            continue;
        }
    }
}

// 0. クイックランダムマッチング
if ($action === 'quick_match') {
    cleanupOldRooms($roomsDir);
    $playerName = isset($_REQUEST['name']) ? trim($_REQUEST['name']) : 'プレイヤー';

    $files = glob($roomsDir . '/*.json');
    if (is_array($files)) {
        foreach ($files as $file) {
            $room = loadRoom($file);
            if (!$room || !isset($room['status'])) {
                @unlink($file);
                continue;
            }

            // 終了済み部屋は即時削除
            if ($room['status'] === 'finished') {
                @unlink($file);
                continue;
            }

            // 100% 待機中の空き部屋（status === 'waiting' && players === 1）のみマッチ対象
            if ($room['status'] === 'waiting' && isset($room['players']) && count($room['players']) === 1) {
                $newId = 'p2_' . uniqid();
                $newPlayer = ['id' => $newId, 'name' => $playerName, 'isHost' => false];
                $room['players'][] = $newPlayer;
                $room['status'] = 'playing';
                $room['currentWord'] = 'しりとり';
                $room['usedWords'] = ['しりとり'];
                $room['history'] = [['word' => 'しりとり', 'len' => 4]];
                $room['activePlayerIndex'] = 0;
                $room['turnStartTime'] = time();
                $room['playerTimes'] = [180, 180];
                $room['livePlayerTimes'] = [180, 180];
                $room['winnerId'] = null;
                $room['loserId'] = null;
                $room['finishReason'] = null;
                $room['lastMessage'] = "ランダムマッチ成立！{$playerName} が参戦！1v1対戦開始！";

                saveRoom($file, $room);

                echo json_encode([
                    'success' => true,
                    'matched' => true,
                    'roomCode' => $room['roomCode'],
                    'playerId' => $newId,
                    'room' => $room
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
        }
    }

    do {
        $roomCode = 'RUSH' . rand(100, 999);
        $file = getRoomFile($roomsDir, $roomCode);
    } while (file_exists($file));

    $roomData = [
        'roomCode' => $roomCode,
        'status' => 'waiting',
        'maxPlayers' => 2,
        'players' => [
            ['id' => 'p1_' . uniqid(), 'name' => $playerName, 'isHost' => true]
        ],
        'currentWord' => 'しりとり',
        'activePlayerIndex' => 0,
        'turnStartTime' => time(),
        'playerTimes' => [180, 180],
        'livePlayerTimes' => [180, 180],
        'winnerId' => null,
        'loserId' => null,
        'finishReason' => null,
        'usedWords' => ['しりとり'],
        'history' => [['word' => 'しりとり', 'len' => 4]],
        'lastMessage' => "ランダムマッチ部屋を作成。対戦相手を探しています..."
    ];

    saveRoom($file, $roomData);

    echo json_encode([
        'success' => true,
        'matched' => false,
        'roomCode' => $roomCode,
        'playerId' => $roomData['players'][0]['id'],
        'room' => $roomData
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 1. ルーム作成
if ($action === 'create') {
    cleanupOldRooms($roomsDir);
    $playerName = isset($_REQUEST['name']) ? trim($_REQUEST['name']) : 'プレイヤー1';
    
    do {
        $roomCode = 'RUSH' . rand(100, 999);
        $file = getRoomFile($roomsDir, $roomCode);
    } while (file_exists($file));

    $roomData = [
        'roomCode' => $roomCode,
        'status' => 'waiting',
        'maxPlayers' => 2,
        'players' => [
            ['id' => 'p1_' . uniqid(), 'name' => $playerName, 'isHost' => true]
        ],
        'currentWord' => 'しりとり',
        'activePlayerIndex' => 0,
        'turnStartTime' => time(),
        'playerTimes' => [180, 180],
        'livePlayerTimes' => [180, 180],
        'winnerId' => null,
        'loserId' => null,
        'finishReason' => null,
        'usedWords' => ['しりとり'],
        'history' => [['word' => 'しりとり', 'len' => 4]],
        'lastMessage' => "あい言葉ルーム『{$roomCode}』を作成しました。相手の参加を待っています..."
    ];

    saveRoom($file, $roomData);

    echo json_encode([
        'success' => true,
        'roomCode' => $roomCode,
        'playerId' => $roomData['players'][0]['id'],
        'room' => $roomData
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 2. ルーム参加
if ($action === 'join') {
    $roomCode = isset($_REQUEST['roomCode']) ? trim($_REQUEST['roomCode']) : '';
    $playerName = isset($_REQUEST['name']) ? trim($_REQUEST['name']) : 'プレイヤー2';
    $file = getRoomFile($roomsDir, $roomCode);
    $room = loadRoom($file);

    if (!$room) {
        echo json_encode(['success' => false, 'reason' => '指定されたルームコードが存在しません'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (isset($room['status']) && $room['status'] !== 'waiting') {
        echo json_encode(['success' => false, 'reason' => 'この対戦はすでに開始または終了しています'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (count($room['players']) >= 2) {
        echo json_encode(['success' => false, 'reason' => 'このルームは既に満員(2名)です'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $newId = 'p2_' . uniqid();
    $newPlayer = ['id' => $newId, 'name' => $playerName, 'isHost' => false];
    $room['players'][] = $newPlayer;

    if (count($room['players']) === 2) {
        $room['status'] = 'playing';
        $room['currentWord'] = 'しりとり';
        $room['usedWords'] = ['しりとり'];
        $room['history'] = [['word' => 'しりとり', 'len' => 4]];
        $room['activePlayerIndex'] = 0;
        $room['turnStartTime'] = time();
        $room['playerTimes'] = [180, 180];
        $room['livePlayerTimes'] = [180, 180];
        $room['winnerId'] = null;
        $room['loserId'] = null;
        $room['finishReason'] = null;
        $room['lastMessage'] = "対戦相手 {$playerName} が参加しました！1v1 対戦開始！";
    }

    saveRoom($file, $room);

    echo json_encode([
        'success' => true,
        'roomCode' => $room['roomCode'],
        'playerId' => $newId,
        'room' => $room
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 3. 状態同期ポーリング
if ($action === 'get_state') {
    $roomCode = isset($_REQUEST['roomCode']) ? trim($_REQUEST['roomCode']) : '';
    $file = getRoomFile($roomsDir, $roomCode);
    $room = loadRoom($file);

    if (!$room) {
        echo json_encode(['success' => false, 'reason' => 'ルームが存在しません'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    updateServerTimeAndCheckFinish($room, $file);

    echo json_encode(['success' => true, 'room' => $room], JSON_UNESCAPED_UNICODE);
    exit;
}

// 4. 単語提出 (Wiki検証時間を除外した純粋入力時間のみ減算)
if ($action === 'submit_word') {
    $roomCode = isset($_REQUEST['roomCode']) ? trim($_REQUEST['roomCode']) : '';
    $playerId = isset($_REQUEST['playerId']) ? trim($_REQUEST['playerId']) : '';
    $word = isset($_REQUEST['word']) ? trim($_REQUEST['word']) : '';
    $matchedTitle = isset($_REQUEST['matchedTitle']) ? trim($_REQUEST['matchedTitle']) : $word;
    $typingDuration = isset($_REQUEST['typingDuration']) ? max(0, (int)$_REQUEST['typingDuration']) : 0;

    $file = getRoomFile($roomsDir, $roomCode);
    $room = loadRoom($file);

    if (!$room) {
        echo json_encode(['success' => false, 'reason' => 'ルームが存在しません'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $activeIdx = (int)$room['activePlayerIndex'];
    $activePlayer = $room['players'][$activeIdx];
    if ($activePlayer['id'] !== $playerId) {
        echo json_encode(['success' => false, 'reason' => 'あなたのターンではありません'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (!isset($room['playerTimes']) || !is_array($room['playerTimes'])) {
        $room['playerTimes'] = [180, 180];
    }

    // Wiki検索・検証時間を完全に除外した「純粋な入力思考時間」のみを減算
    $now = time();
    $turnStart = isset($room['turnStartTime']) ? (int)$room['turnStartTime'] : $now;
    $actualElapsed = max(0, $now - $turnStart);

    // クライアント側から入力時間が渡された場合はそれを優先し、無ければ経過時間を使用
    $costTime = ($typingDuration > 0) ? min($typingDuration, $actualElapsed) : $actualElapsed;

    $room['playerTimes'][$activeIdx] = max(0, $room['playerTimes'][$activeIdx] - $costTime);

    // 8文字以上の長語で持ち時間 +5秒延長 (最大上限180秒)
    $wordLen = mb_strlen($word);
    if ($wordLen >= 8) {
        $room['playerTimes'][$activeIdx] = min(180, $room['playerTimes'][$activeIdx] + 5);
    }

    $room['currentWord'] = $word;
    $room['usedWords'][] = $word;
    $room['history'][] = ['word' => $word, 'len' => $wordLen];
    $room['activePlayerIndex'] = ($activeIdx + 1) % count($room['players']);
    $room['turnStartTime'] = time(); // 次のターンの開始タイムスタンプ
    $room['lastMessage'] = "{$activePlayer['name']} が「{$word}」（{$matchedTitle}）を提出！";

    saveRoom($file, $room);

    echo json_encode(['success' => true, 'room' => $room], JSON_UNESCAPED_UNICODE);
    exit;
}

// 5. 規則違反・反則（「ん」付き / 重複 / 誤り）によるサーバー一律勝敗確定
if ($action === 'forfeit') {
    $roomCode = isset($_REQUEST['roomCode']) ? trim($_REQUEST['roomCode']) : '';
    $playerId = isset($_REQUEST['playerId']) ? trim($_REQUEST['playerId']) : '';
    $reason = isset($_REQUEST['reason']) ? trim($_REQUEST['reason']) : 'ルール違反';

    $file = getRoomFile($roomsDir, $roomCode);
    $room = loadRoom($file);

    if ($room && $room['status'] === 'playing') {
        $loserIdx = -1;
        foreach ($room['players'] as $idx => $p) {
            if ($p['id'] === $playerId) {
                $loserIdx = $idx;
                break;
            }
        }

        if ($loserIdx !== -1) {
            $loser = $room['players'][$loserIdx];
            $winnerIdx = ($loserIdx + 1) % count($room['players']);
            $winner = $room['players'][$winnerIdx];

            $room['status'] = 'finished';
            $room['winnerId'] = $winner['id'];
            $room['loserId'] = $loser['id'];
            $room['finishReason'] = "{$loser['name']} の反則: {$reason}";
            $room['lastMessage'] = "{$winner['name']} の勝利！ ({$reason})";

            saveRoom($file, $room);
        }
    }

    echo json_encode(['success' => true, 'room' => $room], JSON_UNESCAPED_UNICODE);
    exit;
}

// 6. 退出 (対戦中の退出は即時敗北 ＆ 残ったプレイヤーの不戦勝確定)
if ($action === 'leave') {
    $roomCode = isset($_REQUEST['roomCode']) ? trim($_REQUEST['roomCode']) : '';
    $playerId = isset($_REQUEST['playerId']) ? trim($_REQUEST['playerId']) : '';

    $file = getRoomFile($roomsDir, $roomCode);
    $room = loadRoom($file);

    if ($room) {
        if ($room['status'] === 'playing') {
            // 対戦中の退出 ➔ 退出したプレイヤーの敗北 ＆ 残ったプレイヤーの不戦勝を即時判定
            $leaverIdx = -1;
            foreach ($room['players'] as $idx => $p) {
                if ($p['id'] === $playerId) {
                    $leaverIdx = $idx;
                    break;
                }
            }

            if ($leaverIdx !== -1) {
                $leaver = $room['players'][$leaverIdx];
                $winnerIdx = ($leaverIdx + 1) % count($room['players']);
                $winner = isset($room['players'][$winnerIdx]) ? $room['players'][$winnerIdx] : null;

                $room['status'] = 'finished';
                $room['loserId'] = $playerId;
                if ($winner) {
                    $room['winnerId'] = $winner['id'];
                    $room['finishReason'] = "対戦相手（{$leaver['name']}）が途中退出しました";
                    $room['lastMessage'] = "対戦相手（{$leaver['name']}）が途中退出しました";
                } else {
                    $room['finishReason'] = "プレイヤーが途中退出しました";
                }
                saveRoom($file, $room);
            }
        } else {
            // 待機中または全プレイヤー退出時のクリーンアップ
            $room['players'] = array_values(array_filter($room['players'], function($p) use ($playerId) {
                return $p['id'] !== $playerId;
            }));
            if (count($room['players']) === 0) {
                @unlink($file);
            } else {
                $room['activePlayerIndex'] = 0;
                if ($room['status'] === 'waiting') {
                    $room['status'] = 'waiting';
                }
                saveRoom($file, $room);
            }
        }
    }

    echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(['success' => false, 'reason' => '無効なアクションです'], JSON_UNESCAPED_UNICODE);
