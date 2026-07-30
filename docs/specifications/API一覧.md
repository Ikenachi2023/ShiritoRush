# ShiritoRush - 実装・利用 API 一覧 仕様書

**作成日時**: 2026-07-28  
**対象コンポーネント**: `api/validate_word.php`, `assets/js/game.js`  
**テーマ**: プロジェクト内で実装・利用している全内部/外部 API エンドポイントの仕様まとめ

---

## 📋 API 一覧概要

ShiritoRush では、爆速 0ms オフライン判定と未知単語の自動認定を両立するため、以下の内部APIおよび外部公開Webサービス API を統合・利用しています。

| API 名 | 種別 | エンドポイント URL / パス | 主な役割 |
| :--- | :---: | :--- | :--- |
| **1. 単語検証 API** | 内部 | `api/validate_word.php` | 4層ハイブリッド（NEologd ＋ Google IME ＋ Wikipedia）判定を行うバックエンドエンドポイント |
| **2. Google IME CGI API** | 外部 | `https://www.google.com/transliterate` | 入力ひらがなを単文節一括で最も自然な漢字・カタカナ候補#1へ変換 |
| **3. Wikipedia Action API** | 外部 | `https://ja.wikipedia.org/w/api.php` | 変換候補#1が Wikipedia の実在する記事・映画・作品タイトルであるか検証 |
| **4. Wikidata Entity Search API** | 外部 | `https://www.wikidata.org/w/api.php` | Wikidata 知識グラフ（アイテムID・説明）に基づく実在エンティティ照合 |
| **5. マスター辞書 Dataset API** | 内部 | `data/neologd_dictionary.json` | 全202万語 (2,021,390件) のマスター辞書ハッシュマップをフロントエンドへ非同期提供 |

---

## 🛠️ 各 API の詳細仕様

### 1. 内部単語検証 API (`api/validate_word.php`)

フロントエンドまたは外部クライアントから送信されたひらがな単語を判定するメイン API。

- **リクエスト**:
  - `GET` / `POST` `api/validate_word.php?word={ひらがな単語}`
- **レスポンス例 (成功時)**:
  ```json
  {
    "valid": true,
    "word": "せんとちひろのかみかくし",
    "matchedTitle": "千と千尋の神隠し",
    "source": "mecab-ipadic-NEologd",
    "reason": "NEologd 辞書『千と千尋の神隠し』として即座に認定！"
  }
  ```
- **レスポンス例 (失敗時)**:
  ```json
  {
    "valid": false,
    "word": "あいうえお",
    "source": "Google IME + Wikipedia API",
    "reason": "辞書およびWikipediaに存在しない単語です"
  }
  ```

---

### 2. Google IME CGI API (`Google CGI API for Japanese Input`)

- **公式ドキュメント**: [https://www.google.co.jp/ime/cgiapi.html](https://www.google.co.jp/ime/cgiapi.html)
- **リクエスト**:
  - `GET` `https://www.google.com/transliterate?langpair=ja-Hira|ja&text={URLエンコードされたひらがな,}`
  - ※公式仕様に従い、文節分割を防ぐため末尾にカンマ `,` を付与。
- **レスポンス例**:
  ```json
  [
    [
      "きみたちはどういきるか,",
      ["君たちはどう生きるか", "キミタチはどう生きるか", "きみたちはどういきるか"]
    ]
  ]
  ```
- **使用箇所**: `assets/js/game.js` (関数: `checkGoogleIMEAndWikipediaFallback`)

---

### 3. Wikipedia Action API (`prop=extracts`)

- **公式ドキュメント**: [https://www.mediawiki.org/wiki/API:Main_page/ja](https://www.mediawiki.org/wiki/API:Main_page/ja)
- **リクエスト**:
  - `GET` `https://ja.wikipedia.org/w/api.php?origin=*&action=query&format=json&prop=extracts&titles={タイトル}&formatversion=2&exintro=1&explaintext=1`
- **レスポンス例 (記事存在時)**:
  ```json
  {
    "query": {
      "pages": [
        {
          "pageid": 3500120,
          "ns": 0,
          "title": "君たちはどう生きるか",
          "extract": "『君たちはどう生きるか』（きみたちはどういきるか）は、スタジオジブリ制作の日本の長編アニメーション映画..."
        }
      ]
    }
  }
  ```
- **使用箇所**: `assets/js/game.js`, `api/validate_word.php`

---

### 4. Wikidata Entity Search API (`action=wbsearchentries`)

- **リクエスト**:
  - `GET` `https://www.wikidata.org/w/api.php?origin=*&action=wbsearchentries&search={単語}&language=ja&type=item&format=json`
- **レスポンス例**:
  ```json
  {
    "search": [
      {
        "id": "Q61057235",
        "label": "鬼滅の刃",
        "description": "日本の連載漫画・アニメ"
      }
    ]
  }
  ```

---

### 5. ローカルマスター辞書 Dataset API (`data/neologd_dictionary.json`)

- **リクエスト**:
  - `GET` `data/neologd_dictionary.json`
- **内容**: 2,021,390 件のキー・バリュー形式 JSON マップ。
- **目的**: アプリ起動時にブラウザの JS メモリマップへ一括常駐させ、0ms オフライン判定を実現。
