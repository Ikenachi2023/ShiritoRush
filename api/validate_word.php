<?php
/**
 * ShiritoRush - 4層ハイブリッド単語・映画判定 API (v16 セクション構造化版)
 * 
 * 1. HTTPヘッダー・入力サニタイズ
 * 2. ひらがな正規化・バリデーション
 * 3. 第1層: NEologd 202万語ローカル辞書照合 (0ms)
 * 4. 第2層: ディスクキャッシュ層照合
 * 5. 第3層: Google IME CGI API 単文節一括変換 (#1候補抽出)
 * 6. 第4層: Wikipedia Action API 記事存在確認 (prop=extracts)
 * 7. レスポンス整形 ＆ ディスクキャッシュ保存
 */

/* =========================================================================
 * SECTION 1: HTTP HEADERS & INPUT SANITIZATION (レスポンスヘッダー ＆ 入力取得)
 * ========================================================================= */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$rawWord = isset($_REQUEST['word']) ? trim($_REQUEST['word']) : '';

if (empty($rawWord)) {
    echo json_encode(['valid' => false, 'reason' => '単語が入力されていません'], JSON_UNESCAPED_UNICODE);
    exit;
}


/* =========================================================================
 * SECTION 2: HIRAGANA NORMALIZATION & VALIDATION (ひらがな正規化 ＆ バリデーション)
 * ========================================================================= */
function katakanaToHiragana($str) {
    return mb_convert_kana($str, 'c', 'UTF-8');
}

$word = katakanaToHiragana($rawWord);

if (!preg_match('/^[ぁ-んー]+$/u', $word)) {
    echo json_encode(['valid' => false, 'reason' => 'ひらがなのみ入力可能です'], JSON_UNESCAPED_UNICODE);
    exit;
}


/* =========================================================================
 * SECTION 3: LAYER 1 - 2.02M NEOLOGD MASTER DICTIONARY (202万語ローカル辞書 0ms)
 * ========================================================================= */
$dictFile = __DIR__ . '/../data/neologd_dictionary.json';
if (file_exists($dictFile)) {
    $neologdDict = json_decode(file_get_contents($dictFile), true);
    if (isset($neologdDict[$word])) {
        $matchedTitle = $neologdDict[$word];
        echo json_encode([
            'valid' => true,
            'word' => $word,
            'matchedTitle' => $matchedTitle,
            'source' => 'mecab-ipadic-NEologd',
            'reason' => "NEologd 辞書『{$matchedTitle}』として即座に認定！"
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}


/* =========================================================================
 * SECTION 4: LAYER 2 - DISK CACHE CHECK (ローカルディスクキャッシュ参照)
 * ========================================================================= */
$cacheDir = __DIR__ . '/../data/cache';
if (!file_exists($cacheDir)) {
    @mkdir($cacheDir, 0777, true);
}
$cacheFile = $cacheDir . '/google_wiki_' . md5($word) . '.json';
$cacheTTL = 86400 * 7; // 7日間

if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < $cacheTTL)) {
    $cachedData = file_get_contents($cacheFile);
    if ($cachedData !== false) {
        echo $cachedData;
        exit;
    }
}


/* =========================================================================
 * SECTION 5: LAYER 3 - GOOGLE IME CGI API (単文節一括変換 #1候補抽出)
 * ========================================================================= */
$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => "User-Agent: ShiritoRushApp/1.0 (contact@shiritorush.example.com)\r\n",
        'timeout' => 3.5
    ]
]);

// 公式仕様: 末尾にカンマを付与して単文節一括変換
$encodedQuery = urlencode($word . ',');
$googleImeUrl = "https://www.google.com/transliterate?langpair=ja-Hira|ja&text={$encodedQuery}";
$resIme = @file_get_contents($googleImeUrl, false, $context);

$topCandidate = '';

if ($resIme !== false) {
    $imeData = json_decode($resIme, true);
    if (is_array($imeData)) {
        $segments = [];
        foreach ($imeData as $seg) {
            if (isset($seg[0]) && $seg[0] !== ',') {
                if (isset($seg[1][0])) {
                    $segments[] = $seg[1][0]; // 1つ目の変換候補
                }
            }
        }
        $topCandidate = implode('', $segments);
    }
}

if (empty($topCandidate)) {
    $topCandidate = $word;
}


/* =========================================================================
 * SECTION 6: LAYER 4 - WIKIPEDIA ACTION API (記事存在チェック)
 * ========================================================================= */
$encodedTitle = urlencode($topCandidate);
$wikiUrl = "https://ja.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&titles={$encodedTitle}&formatversion=2&exintro=1&explaintext=1";
$resWiki = @file_get_contents($wikiUrl, false, $context);

$isValid = false;
$matchedTitle = '';

if ($resWiki !== false) {
    $wikiData = json_decode($resWiki, true);
    if (isset($wikiData['query']['pages']) && count($wikiData['query']['pages']) > 0) {
        $page = $wikiData['query']['pages'][0];
        if (!isset($page['missing']) && isset($page['pageid']) && (int)$page['pageid'] > 0) {
            $isValid = true;
            $matchedTitle = isset($page['title']) ? $page['title'] : $topCandidate;
        }
    }
}


/* =========================================================================
 * SECTION 7: RESPONSE SERIALIZATION & CACHE STORAGE (結果出力 ＆ キャッシュ保存)
 * ========================================================================= */
$result = [
    'valid' => $isValid,
    'word' => $word,
    'candidate' => $topCandidate,
    'matchedTitle' => $matchedTitle,
    'source' => 'Google IME + Wikipedia API',
    'reason' => $isValid ? "Google IME ➔ Wikipedia『{$matchedTitle}』として認定！" : "辞書およびWikipediaに存在しない単語です"
];

$jsonResult = json_encode($result, JSON_UNESCAPED_UNICODE);

if (file_exists($cacheDir) && is_writable($cacheDir)) {
    @file_put_contents($cacheFile, $jsonResult);
}

echo $jsonResult;
