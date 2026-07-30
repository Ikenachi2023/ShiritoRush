/**
 * ShiritoRush - フロントエンドメインゲームロジック
 * 
 * 1. DOM SELECTORS & GLOBAL GAME STATE
 * 2. MASTER DICTIONARY MEMORY LOADER
 * 3. CANVAS PARTICLE ANIMATION SYSTEM
 * 4. HIRAGANA & SHIRITORI RULE HELPERS
 * 5. HYBRID WORD VALIDATION ENGINE
 * 6. UI RENDERING & FEEDBACK DISPLAY
 * 7. GAME LIFECYCLE & ONLINE MATCHMAKING
 * 8. MODAL DIALOGS & EVENT LISTENERS
 */

document.addEventListener('DOMContentLoaded', () => {

  /* =========================================================================
   * SECTION 1: DOM SELECTORS & GLOBAL GAME STATE (DOM要素取得 ＆ ゲーム状態管理)
   * ========================================================================= */
  // 画面要素
  const titleScreen = document.getElementById('title-screen');
  const gameScreen = document.getElementById('game-screen');
  const btnStartGame = document.getElementById('btn-start-game');
  const btnTitleRules = document.getElementById('btn-title-rules');
  const btnOnlineLobby = document.getElementById('btn-online-lobby');

  // インゲーム表示・入力要素
  const currentWordDisplay = document.getElementById('current-word-display');
  const wordInput = document.getElementById('word-input');
  const wordForm = document.getElementById('word-form');
  const messageBanner = document.getElementById('message-banner');
  const btnSubmit = document.getElementById('btn-submit');
  const recentWordsList = document.getElementById('recent-words-list');
  const historyTotalCount = document.getElementById('history-total-count');

  // バッジ・ヘッダー要素
  const comboBadge = document.getElementById('combo-badge');
  const comboCountEl = document.getElementById('combo-count');
  const turnTextEl = document.getElementById('turn-text');
  const turnIndicator = document.getElementById('turn-indicator');

  // 固定ナビゲーションボタン
  const btnNavSettings = document.getElementById('btn-nav-settings');
  const btnNavExit = document.getElementById('btn-nav-exit');

  // モーダルダイアログ要素
  const settingsModal = document.getElementById('settings-modal');
  const rulesModal = document.getElementById('rules-modal');
  const resultModal = document.getElementById('result-modal');
  const exitModal = document.getElementById('exit-modal');
  const onlineLobbyModal = document.getElementById('online-lobby-modal');

  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnModalRules = document.getElementById('btn-modal-rules');
  const btnCloseRules = document.getElementById('btn-close-rules');
  const btnConfirmExit = document.getElementById('btn-confirm-exit');
  const btnCancelExit = document.getElementById('btn-cancel-exit');

  const resultTitle = document.getElementById('result-title');
  const resultBody = document.getElementById('result-body');
  const btnResultRestart = document.getElementById('btn-result-restart');

  // オンライン対戦ロビーDOM
  const onlinePlayerNameInput = document.getElementById('online-player-name');
  const btnCreateRoom = document.getElementById('btn-create-room');
  const btnJoinRoomAction = document.getElementById('btn-join-room-action');
  const onlineRoomCodeInput = document.getElementById('online-room-code-input');
  const roomStatusPanel = document.getElementById('room-status-panel');
  const roomCodeDisplay = document.getElementById('room-code-display');
  const roomPlayersList = document.getElementById('room-players-list');
  const btnStartOnlineGame = document.getElementById('btn-start-online-game');
  const btnCloseOnlineLobby = document.getElementById('btn-close-online-lobby');

  // --- 将棋風対局時計 (持ち時間 各3分/180秒) ＆ レート状態変数 ---
  const MATCH_TIME_LIMIT = 180; // 各自 3分 (180秒)
  let userTimeLeft = MATCH_TIME_LIMIT;
  let oppTimeLeft = MATCH_TIME_LIMIT;
  let matchTimerInterval = null;
  let activeTurn = 'user'; // 'user' or 'opp'
  let turnStartTimestamp = Date.now();

  const userClockBox = document.getElementById('user-clock-box');
  const userClockTime = document.getElementById('user-clock-time');
  const userClockLabel = document.getElementById('user-clock-label');
  const oppClockBox = document.getElementById('opp-clock-box');
  const oppClockTime = document.getElementById('opp-clock-time');
  const oppClockLabel = document.getElementById('opp-clock-label');

  // --- ゲーム進行 ＆ レート状態変数 ---
  const INITIAL_WORD = 'しりとり';
  let currentWord = INITIAL_WORD;
  let usedWordsSet = new Set([INITIAL_WORD]);
  let fullHistory = [{ word: INITIAL_WORD, len: INITIAL_WORD.length }];
  let isGameOver = false;
  let comboCount = 0;
  let maxComboCount = 0;
  let totalCharCount = INITIAL_WORD.length;
  let lastEndingChar = '';

  // --- オンライン対戦状態変数 ---
  let isOnlineMode = false;
  let onlineRoomCode = null;
  let onlineMyPlayerId = null;
  let onlinePollInterval = null;
  let onlineRoomData = null;

  // --- ランダム和風プレイヤー名ジェネレーター (625パターン) ---
  const NAME_PREFIXES = [
    '疾風の', '閃光の', '伝説の', '無敵の', '紅蓮の',
    '黄金の', '天空の', '深海の', '漆黒の', '幻影の',
    '銀河の', '極限の', '電撃の', '熱血の', '孤高の',
    '神速の', '英傑の', '破天荒の', '月光の', '覇王の',
    '疾走の', '蒼炎の', '光速の', '絶対の', '究極の'
  ];

  const NAME_NOUNS = [
    'しりとり王', '速読士', '剣士', '龍', '勇者',
    '賢者', '騎士', '忍者', '鳳凰', '覇者',
    '疾風', '達人', '王者', '獅子', '狼',
    '神童', '鬼才', '猛者', '主', '巨星',
    '精鋭', '名手', '鬼神', '帝王', '怪童'
  ];

  function generateRandomPlayerName() {
    const p = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
    const n = NAME_NOUNS[Math.floor(Math.random() * NAME_NOUNS.length)];
    return p + n;
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function startMatchTimer() {
    stopMatchTimer();
    matchTimerInterval = setInterval(() => {
      if (isGameOver) {
        stopMatchTimer();
        return;
      }

      if (activeTurn === 'user') {
        userTimeLeft--;
        if (userTimeLeft <= 30) {
          if (userClockBox) userClockBox.classList.add('warning');
        }
        if (userTimeLeft <= 0) {
          userTimeLeft = 0;
          updateClockDisplay();
          triggerGameOver('持ち時間切れ（タイムアップ）による敗北！');
          return;
        }
      } else {
        oppTimeLeft--;
        if (oppTimeLeft <= 30) {
          if (oppClockBox) oppClockBox.classList.add('warning');
        }
        if (oppTimeLeft <= 0) {
          oppTimeLeft = 0;
          updateClockDisplay();
          triggerGameOver('相手の持ち時間切れによる勝利！');
          return;
        }
      }

      updateClockDisplay();
    }, 1000);
  }

  function stopMatchTimer() {
    if (matchTimerInterval) {
      clearInterval(matchTimerInterval);
      matchTimerInterval = null;
    }
  }

  function updateClockDisplay() {
    if (userClockTime) userClockTime.textContent = formatTime(userTimeLeft);
    if (oppClockTime) oppClockTime.textContent = formatTime(oppTimeLeft);
  }


  /* =========================================================================
   * SECTION 2: MASTER DICTIONARY MEMORY LOADER (202万語 NEologd インメモリエンジン)
   * ========================================================================= */
  let neologdMasterDict = null;
  let isDictLoading = false;

  async function loadMasterDictionary() {
    if (neologdMasterDict !== null || isDictLoading) return;
    isDictLoading = true;
    try {
      let res = await fetch('data/neologd_dictionary.json');
      if (!res.ok) {
        res = await fetch('api/get_dictionary.php');
      }
      if (res.ok) {
        neologdMasterDict = await res.json();
      }
    } catch (err) {
      try {
        const phpRes = await fetch('api/get_dictionary.php');
        if (phpRes.ok) {
          neologdMasterDict = await phpRes.json();
        }
      } catch (phpErr) {
        neologdMasterDict = {};
      }
    } finally {
      isDictLoading = false;
    }
  }

  loadMasterDictionary();

  const NEOLOGD_SEED_DICT = {
    "りすとら": "リストラ (リストラクチャリング)",
    "らっぱ": "ラッパ (楽器)",
    "らーめんしょっぷ": "ラーメンショップ (ラーメン店)",
    "りーち": "リーチ (麻雀・ゴルフ・達成前)",
    "らんどせる": "ランドセル (学用品)",
    "りんご": "リンゴ (果物)",
    "りす": "リス (動物)",
    "しりとり": "しりとり (遊戯)",
    "たいたにっく": "タイタニック (映画)",
    "せんとちひろのかみかくし": "千と千尋の神隠し (映画)"
  };


  /* =========================================================================
   * SECTION 3: VISUAL ANIMATION HELPERS (クリーンCSSエフェクトエンジン)
   * ========================================================================= */

  function emitTargetWordSparkle() {
    currentWordDisplay.classList.add('target-aura');
    setTimeout(() => currentWordDisplay.classList.remove('target-aura'), 500);
  }

  function emitTacticalBurst() {
    currentWordDisplay.classList.add('pop-anim');
    setTimeout(() => currentWordDisplay.classList.remove('pop-anim'), 400);
  }


  /* =========================================================================
   * SECTION 4: HIRAGANA & SHIRITORI RULE HELPERS (文字正規化・しりとり規則判定)
   * ========================================================================= */
  function getEffectiveEndChar(word) {
    if (!word) return '';
    let lastChar = word.slice(-1);
    if (lastChar === 'ー' && word.length > 1) {
      lastChar = word.slice(-2, -1);
    }
    const smallToBigMap = {
      'ぁ': 'あ', 'ぃ': 'い', 'ぅ': 'う', 'ぇ': 'え', 'ぉ': 'お',
      'っ': 'つ', 'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ', 'ゎ': 'わ'
    };
    return smallToBigMap[lastChar] || lastChar;
  }

  function getEndCharPrompt(word) {
    if (!word) return '';
    let lastChar = word.slice(-1);
    if (lastChar === 'ー' && word.length > 1) {
      lastChar = word.slice(-2, -1);
    }
    const smallToBigMap = {
      'ぁ': 'あ', 'ぃ': 'い', 'ぅ': 'う', 'ぇ': 'え', 'ぉ': 'お',
      'っ': 'つ', 'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ', 'ゎ': 'わ'
    };
    if (smallToBigMap[lastChar]) {
      return `「${lastChar}」（${smallToBigMap[lastChar]}）`;
    }
    return `「${lastChar}」`;
  }

  function getEffectiveStartChar(word) {
    if (!word) return '';
    const firstChar = word.charAt(0);
    const smallToBigMap = {
      'ぁ': 'あ', 'ぃ': 'い', 'ぅ': 'う', 'ぇ': 'え', 'ぉ': 'お',
      'っ': 'つ', 'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ', 'ゎ': 'わ'
    };
    return smallToBigMap[firstChar] || firstChar;
  }

  function isHiraganaOnly(text) {
    return /^[ぁ-んー]+$/.test(text);
  }

  function getRateRankInfo(rate) {
    if (rate >= 2400) return { rank: 'MASTER', icon: '👑', color: '#ff007f' };
    if (rate >= 2100) return { rank: 'PLATINUM', icon: '💎', color: '#00f0ff' };
    if (rate >= 1800) return { rank: 'GOLD', icon: '🥇', color: '#ffd700' };
    if (rate >= 1500) return { rank: 'SILVER', icon: '🥈', color: '#c0c0c0' };
    return { rank: 'BRONZE', icon: '🥉', color: '#cd7f32' };
  }


  async function checkWordValidity(hiraWord) {
    if (neologdMasterDict && neologdMasterDict[hiraWord]) {
      const match = neologdMasterDict[hiraWord];
      return {
        valid: true,
        word: hiraWord,
        matchedTitle: match,
        source: 'mecab-ipadic-NEologd',
        reason: `NEologd『${match}』として認定`
      };
    }

    if (NEOLOGD_SEED_DICT[hiraWord]) {
      const match = NEOLOGD_SEED_DICT[hiraWord];
      return {
        valid: true,
        word: hiraWord,
        matchedTitle: match,
        source: 'mecab-ipadic-NEologd',
        reason: `NEologd『${match}』として認定`
      };
    }

    // 100% サーバーサイド Wikipedia Action API ＆ Google IME 判定 (api/validate_word.php)
    try {
      const res = await fetch(`api/validate_word.php?word=${encodeURIComponent(hiraWord)}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          if (data.valid && neologdMasterDict) {
            neologdMasterDict[hiraWord] = data.matchedTitle || hiraWord;
          }
          return data;
        }
      }
    } catch (err) {
    }

    return {
      valid: false,
      word: hiraWord,
      source: 'Server API',
      reason: '辞書およびWikipediaに該当する記事が存在しません'
    };
  }


  /* =========================================================================
   * SECTION 6: UI RENDERING & FEEDBACK DISPLAY (画面描画 ＆ メッセージ通知)
   * ========================================================================= */
  function renderCurrentWord() {
    if (!currentWord) return;

    if (currentWord.endsWith('ー') && currentWord.length > 1) {
      // 伸ばし棒「ー」で終わる場合は、前の文字と伸ばし棒の両方を赤くハイライト
      const bodyText = currentWord.slice(0, -2);
      const targetChars = currentWord.slice(-2);
      currentWordDisplay.innerHTML = `${bodyText}<span class="target-char">${targetChars}</span>`;
    } else {
      const bodyText = currentWord.slice(0, -1);
      const lastChar = currentWord.slice(-1);
      currentWordDisplay.innerHTML = `${bodyText}<span class="target-char">${lastChar}</span>`;
    }
    
    const promptText = getEndCharPrompt(currentWord);
    wordInput.placeholder = `${promptText}から始まるひらがな...`;
  }

  function renderRecentWords() {
    recentWordsList.innerHTML = '';
    historyTotalCount.textContent = `total ${fullHistory.length}words`;

    const recent3 = fullHistory.slice(-3).reverse();

    for (let i = 0; i < 3; i++) {
      const slot = document.createElement('div');
      const item = recent3[i];

      if (item) {
        slot.className = `recent-slot filled ${i === 0 ? 'latest' : ''}`;
        slot.innerHTML = `
          <span class="slot-word">${item.word}</span>
          <span class="slot-len">${item.len}文字</span>
        `;
      } else {
        slot.className = 'recent-slot';
        slot.innerHTML = `<span class="slot-empty">---</span>`;
      }
      recentWordsList.appendChild(slot);
    }
  }

  function showMessage(text, type = 'error') {
    messageBanner.textContent = text;
    messageBanner.className = `message-banner show ${type}`;

    if (type === 'error') {
      currentWordDisplay.classList.add('shake');
      setTimeout(() => currentWordDisplay.classList.remove('shake'), 300);
    }
  }

  function clearMessage() {
    messageBanner.textContent = '';
    messageBanner.className = 'message-banner';
  }

  function updateStatsDisplay() {
    if (comboCount > 0) {
      comboBadge.classList.remove('hidden');
      comboCountEl.textContent = comboCount;
      
      comboBadge.classList.remove('pop-anim');
      void comboBadge.offsetWidth;
      comboBadge.classList.add('pop-anim');
    } else {
      comboBadge.classList.add('hidden');
    }
  }


  /* =========================================================================
   * SECTION 7: GAME LIFECYCLE & ONLINE MATCHMAKING (シングル/オンライン対戦同期)
   * ========================================================================= */
  function startNewGame(isOnline = false) {
    isOnlineMode = isOnline;
    currentWord = INITIAL_WORD;
    usedWordsSet = new Set([INITIAL_WORD]);
    fullHistory = [{ word: INITIAL_WORD, len: INITIAL_WORD.length }];
    isGameOver = false;
    comboCount = 0;
    maxComboCount = 0;
    totalCharCount = INITIAL_WORD.length;
    internalScore = 400;
    lastEndingChar = getEffectiveEndChar(INITIAL_WORD);

    userTimeLeft = MATCH_TIME_LIMIT;
    oppTimeLeft = MATCH_TIME_LIMIT;
    activeTurn = 'user';

    if (!isOnline) {
      // シングルプレイ時: 上の表示を「残り時間」のみ表示
      if (turnIndicator) turnIndicator.classList.add('hidden');
      if (oppClockBox) oppClockBox.classList.add('hidden');
      if (userClockBox) {
        userClockBox.classList.add('single-mode');
        if (userClockLabel) userClockLabel.textContent = '残り時間';
      }
    } else {
      // オンライン対戦時: 将棋風対局時計 ＆ ターンインジケーター表示 (プレイヤー名表示)
      if (turnIndicator) turnIndicator.classList.remove('hidden');
      if (oppClockBox) oppClockBox.classList.remove('hidden');
      if (userClockBox) {
        userClockBox.classList.remove('single-mode');
        const myName = onlinePlayerNameInput ? onlinePlayerNameInput.value.trim() || 'あなた' : 'あなた';
        if (userClockLabel) userClockLabel.textContent = myName;
      }
      if (oppClockLabel) oppClockLabel.textContent = '対戦相手';
    }

    wordInput.value = '';
    clearMessage();

    if (isOnline) {
      wordInput.disabled = true;
      wordInput.blur(); // Android仮想キーボードの自動暴発防止
      btnSubmit.disabled = true;
      wordInput.placeholder = '対戦相手の入力を待っています...';
    } else {
      wordInput.disabled = false;
      btnSubmit.disabled = false;
      wordInput.focus();
    }

    turnTextEl.textContent = isOnline ? 'オンライン対戦中' : 'あなた のターン';

    renderCurrentWord();
    renderRecentWords();
    updateStatsDisplay();
    updateClockDisplay();
    startMatchTimer();

    titleScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    btnNavExit.classList.remove('hidden');
  }

  function exitToTitle() {
    if (isOnlineMode && onlineRoomCode && onlineMyPlayerId) {
      // オンライン対戦中の途中退出 ➔ サーバーへ通知して相手の不戦勝を即時確定
      fetch(`api/online_match.php?action=leave&roomCode=${onlineRoomCode}&playerId=${onlineMyPlayerId}`);
    }

    stopMatchTimer();
    stopOnlinePolling();
    isOnlineMode = false;
    onlineRoomCode = null;
    onlineMyPlayerId = null;

    gameScreen.classList.add('hidden');
    titleScreen.classList.remove('hidden');
    btnNavExit.classList.add('hidden');
    closeAllModals();
  }

  let isSubmittingWord = false;

  /**
   * 単語送信メインハンドラー (ダブルクリック・連打ロック ＆ コンボ累進加点システム)
   */
  async function handleWordSubmit() {
    if (isGameOver || isSubmittingWord) return;
    isSubmittingWord = true;

    try {
      const inputVal = wordInput.value.trim();

      if (!inputVal) {
        showMessage('単語を入力してください！', 'error');
        return;
      }

    if (!isHiraganaOnly(inputVal)) {
      showMessage('ひらがなのみ入力可能です！', 'error');
      return;
    }

    const prevEndChar = getEffectiveEndChar(currentWord);
    const inputStartChar = getEffectiveStartChar(inputVal);

    if (prevEndChar !== inputStartChar) {
      showMessage(`「${prevEndChar}」から始まる単語を入力してください！`, 'error');
      return;
    }

    if (usedWordsSet.has(inputVal)) {
      if (isOnlineMode && onlineRoomCode && onlineMyPlayerId) {
        fetch(`api/online_match.php?action=forfeit&roomCode=${onlineRoomCode}&playerId=${onlineMyPlayerId}&reason=${encodeURIComponent('「' + inputVal + '」は過去に使用された重複単語です！')}`);
      }
      triggerGameOver(`「${inputVal}」は過去に使用された単語です！`);
      return;
    }

    const inputEndChar = getEffectiveEndChar(inputVal);
    if (inputEndChar === 'ん') {
      if (isOnlineMode && onlineRoomCode && onlineMyPlayerId) {
        fetch(`api/online_match.php?action=forfeit&roomCode=${onlineRoomCode}&playerId=${onlineMyPlayerId}&reason=${encodeURIComponent('「' + inputVal + '」は「ん」で終わる反則です！')}`);
      }
      triggerGameOver(`「${inputVal}」は「ん」で終わるためゲームオーバー！`);
      return;
    }

    // --- 単語判定 (Wiki検索中の時間は対局タイマー減算から完全除外) ---
    const typingDuration = turnStartTimestamp ? Math.max(1, Math.floor((Date.now() - turnStartTimestamp) / 1000)) : 1;

    wordInput.disabled = true;
    btnSubmit.disabled = true;
    showMessage(`「${inputVal}」を単語・Wikipediaで検証中... 🔍`, 'success');

    const checkResult = await checkWordValidity(inputVal);

    wordInput.disabled = false;
    btnSubmit.disabled = false;

    if (!checkResult.valid) {
      showMessage(`「${inputVal}」は辞書・Wikipedia上に存在しない言葉です！ ❌`, 'error');
      wordInput.focus();
      return;
    }

    // --- 正常提出・スコア ＆ コンボ累進加点計算 ---
    emitTargetWordSparkle();

    const previousCombo = comboCount;
    if (lastEndingChar && lastEndingChar === inputEndChar) {
      comboCount++;
    } else {
      comboCount = 0;
    }
    lastEndingChar = inputEndChar;

    if (comboCount > maxComboCount) {
      maxComboCount = comboCount;
    }

    const wordLen = inputVal.length;
    totalCharCount += wordLen;

    // 1. 長文ボーナス ＆ 2文字以下減点ペナルティ
    let longBonus = 0;
    let longLabel = '';
    if (wordLen <= 2) {
      longBonus = -200; // 基本100ptとあわせて -100pt の減点ペナルティ
      longLabel = '⚠️ 2文字以下減点 -100pt';
    } else if (wordLen >= 8) {
      longBonus = 400;
      longLabel = '👑 EXCELLENT LONG TITLE! +5秒延長';
      emitTacticalBurst();

      // 8文字以上の単語で持ち時間を5秒延長
      if (activeTurn === 'user') {
        userTimeLeft += 5;
      } else {
        oppTimeLeft += 5;
      }
      updateClockDisplay();
    } else if (wordLen >= 6) {
      longBonus = 200;
      longLabel = '✨ Great Title!';
      emitTacticalBurst();
    } else if (wordLen >= 4) {
      longBonus = 150;
      longLabel = '🌟 Good Length!';
    }

    // 2. コンボ数による累進加点システム
    let comboBonus = 0;
    let comboLabel = '';

    if (comboCount > 0) {
      if (comboCount === 1) {
        comboBonus = 200;
        comboLabel = '🔥 COMBO x1! +200pt';
      } else if (comboCount === 2) {
        comboBonus = 400;
        comboLabel = '⚡ SUPER COMBO x2! +400pt';
        emitTacticalBurst();
      } else if (comboCount === 3) {
        comboBonus = 700;
        comboLabel = '💥 MEGA COMBO x3! +700pt';
        emitTacticalBurst();
      } else {
        comboBonus = comboCount * 300;
        comboLabel = `👑 ULTRA COMBO x${comboCount}! +${comboBonus}pt`;
        emitTacticalBurst();
      }
    }

    const basePoints = 100 + longBonus;
    const turnScore = basePoints + comboBonus;

    internalScore += turnScore;

    currentWord = inputVal;
    usedWordsSet.add(inputVal);
    fullHistory.push({ word: inputVal, len: wordLen });

    // オンラインモード時のAPI同期 (Wiki検索中の時間はタイマー減算から完全除外)
    if (isOnlineMode && onlineRoomCode && onlineMyPlayerId) {
      fetch(`api/online_match.php?action=submit_word&roomCode=${onlineRoomCode}&playerId=${onlineMyPlayerId}&word=${encodeURIComponent(inputVal)}&matchedTitle=${encodeURIComponent(checkResult.matchedTitle || inputVal)}&typingDuration=${typingDuration}`);
    }

    // ① 中央単語表示エリア直上: 浮遊スコア ＆ Good Length! ポップアップ
    const floatingContainer = document.getElementById('floating-toast-container');
    if (floatingContainer) {
      floatingContainer.innerHTML = '';
      const scoreToast = document.createElement('div');
      scoreToast.className = 'floating-toast-score';
      if (turnScore >= 0) {
        scoreToast.textContent = `+${turnScore} pt`;
        scoreToast.style.color = 'var(--accent-yellow)';
      } else {
        scoreToast.textContent = `${turnScore} pt`;
        scoreToast.style.color = 'var(--accent-pink)';
      }
      floatingContainer.appendChild(scoreToast);

      if (longLabel) {
        const badgeToast = document.createElement('div');
        badgeToast.className = 'floating-toast-badge';
        badgeToast.textContent = longLabel;
        if (wordLen <= 2) {
          badgeToast.style.background = 'rgba(244, 63, 94, 0.25)';
          badgeToast.style.borderColor = 'var(--accent-pink)';
        }
        floatingContainer.appendChild(badgeToast);
      }

      setTimeout(() => { floatingContainer.innerHTML = ''; }, 1300);
    }

    // ② アリーナ右上角: コンボ特大加点 (SUPER/MEGA/ULTRA COMBO!) 専用トースト
    const tacticalCorner = document.getElementById('tactical-toast-corner');
    if (tacticalCorner) {
      if (comboLabel) {
        tacticalCorner.textContent = comboLabel.replace(/[()]/g, '');
        tacticalCorner.classList.remove('hidden');
        setTimeout(() => { tacticalCorner.classList.add('hidden'); }, 1800);
      } else {
        tacticalCorner.classList.add('hidden');
      }
    }

    // ③ 画面下部バナー: カッコ書き無しの洗練された確認メッセージ
    const matchedTitle = checkResult.matchedTitle;
    let msg = `「${inputVal}」を確認！`;
    if (matchedTitle && matchedTitle !== inputVal) {
      msg = `「${inputVal}」➡ ${matchedTitle} 認定！`;
    }
    showMessage(msg, 'success');

    renderCurrentWord();
    renderRecentWords();
    updateStatsDisplay();



    wordInput.value = '';
    wordInput.focus();
    } finally {
      isSubmittingWord = false;
    }
  }

  /**
   * ゲーム終了・リザルト表示 (シングル対戦: スコア判定 / オンライン対戦: 勝敗判定)
   */
  function triggerGameOver(reason, isWinOverride = null) {
    isGameOver = true;
    stopMatchTimer();
    wordInput.disabled = true;
    btnSubmit.disabled = true;


    showMessage(`ゲーム終了: ${reason}`, 'gameover');

    const rallyCount = fullHistory.length;
    const avgLenNum = (totalCharCount / rallyCount);
    const avgLenStr = avgLenNum.toFixed(1);
    const isHighAvg = (avgLenNum >= 5.0);

    resultTitle.textContent = 'GAME OVER';

    if (isOnlineMode) {
      // --- オンライン対戦時: WIN 🎉 と LOSE 💀 の特大勝利・敗北バナーを表示 ---
      const isWin = (isWinOverride !== null)
        ? isWinOverride
        : ((onlineRoomData && onlineRoomData.winnerId) 
            ? (onlineRoomData.winnerId === onlineMyPlayerId)
            : (reason.includes('途中退出') || reason.includes('勝利') || reason.includes('🎉')));
      
      resultTitle.textContent = isWin ? 'VICTORY' : 'DEFEAT';

      const bannerHtml = isWin ? `
        <div style="background: rgba(52, 211, 153, 0.15); border: 2px solid #34d399; padding: 20px; border-radius: 24px; margin: 14px 0; text-align: center; box-shadow: 0 0 24px rgba(52, 211, 153, 0.25);">
          <div style="font-size: 2.8rem; font-weight: 900; color: #34d399; letter-spacing: 2px; text-shadow: 0 0 20px rgba(52, 211, 153, 0.6);">
            WIN 🎉
          </div>
          <div style="font-size: 0.95rem; color: #a7f3d0; margin-top: 6px; font-weight: 700;">${reason}</div>
        </div>
      ` : `
        <div style="background: rgba(244, 63, 94, 0.15); border: 2px solid #f43f5e; padding: 20px; border-radius: 24px; margin: 14px 0; text-align: center; box-shadow: 0 0 24px rgba(244, 63, 94, 0.25);">
          <div style="font-size: 2.8rem; font-weight: 900; color: #f43f5e; letter-spacing: 2px; text-shadow: 0 0 20px rgba(244, 63, 94, 0.6);">
            LOSE 💀
          </div>
          <div style="font-size: 0.95rem; color: #fecdd3; margin-top: 6px; font-weight: 700;">${reason}</div>
        </div>
      `;

      resultBody.innerHTML = `
        ${bannerHtml}

        <div style="background: rgba(255,255,255,0.05); border: 1px solid var(--panel-border); padding: 16px; border-radius: 18px; text-align: left; display: flex; flex-direction: column; gap: 8px;">
          <p style="display: flex; justify-content: space-between;"><span>対戦ラリー回数:</span> <strong style="color: var(--accent-cyan);">${rallyCount} 回</strong></p>
          <p style="display: flex; justify-content: space-between;"><span>平均入力文字数:</span> <strong>${avgLenStr} 文字 / 単語</strong></p>
          <p style="display: flex; justify-content: space-between;"><span>最高コンボ:</span> <strong>${maxComboCount} 連打</strong></p>
        </div>
      `;
    } else {
      // --- シングル対戦時: スコア (pt) 判定結果表示 ---
      resultBody.innerHTML = `
        <div style="font-size: 1.15rem; color: #ff80bf; margin-bottom: 16px; font-weight: 800;">${reason}</div>
        
        <div style="background: rgba(255, 230, 0, 0.1); border: 1.5px solid var(--accent-yellow); padding: 18px; border-radius: 20px; margin: 12px 0;">
          <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 4px;">最終獲得スコア</div>
          <div style="font-size: 2.2rem; font-weight: 900; color: var(--accent-yellow); text-shadow: 0 0 20px var(--accent-yellow);">
            ${internalScore.toLocaleString()} pt
          </div>
        </div>

        <div style="background: rgba(255,255,255,0.05); border: 1px solid var(--panel-border); padding: 16px; border-radius: 18px; text-align: left; display: flex; flex-direction: column; gap: 8px;">
          <p style="display: flex; justify-content: space-between;"><span>試合ラリー回数:</span> <strong style="color: var(--accent-cyan);">${rallyCount} 回ラリー</strong></p>
          <p style="display: flex; justify-content: space-between;"><span>平均入力文字数:</span> <strong>${avgLenStr} 文字 / 単語 ${isHighAvg ? '✨ 高平均ボーナス達成' : ''}</strong></p>
          <p style="display: flex; justify-content: space-between;"><span>最高コンボ:</span> <strong>${maxComboCount} 連打</strong></p>
        </div>
      `;
    }

    openModal(resultModal);
  }


  /* =========================================================================
   * ONLINE MATCHMAKING HELPERS (オンライン1v1 ＆ ランダムマッチ同期)
   * ========================================================================= */
  const btnQuickMatch = document.getElementById('btn-quick-match');
  const matchmakingModal = document.getElementById('matchmaking-modal');
  const btnCancelMatchmaking = document.getElementById('btn-cancel-matchmaking');
  const matchmakingStatusText = document.getElementById('matchmaking-status-text');

  async function quickOnlineMatch() {
    // 過去の対戦ルームID・プレイヤーIDを完全初期化
    onlineRoomCode = null;
    onlineMyPlayerId = null;
    onlineRoomData = null;

    const name = onlinePlayerNameInput.value.trim() || 'プレイヤー';
    closeModal(onlineLobbyModal);
    openModal(matchmakingModal);

    if (matchmakingStatusText) {
      matchmakingStatusText.textContent = 'オンライン対戦相手を探しています (1/2名)';
    }

    try {
      const res = await fetch(`api/online_match.php?action=quick_match&name=${encodeURIComponent(name)}`);
      let data = null;
      try {
        data = await res.json();
      } catch (jsonErr) {
        closeModal(matchmakingModal);
        showMessage('対戦データの作成に失敗しました。しばらく経ってからお試しください', 'error');
        return;
      }

      if (data && data.success) {
        onlineRoomCode = data.roomCode;
        onlineMyPlayerId = data.playerId;
        onlineRoomData = data.room;

        if (roomCodeDisplay) roomCodeDisplay.textContent = `ランダム対戦部屋: ${data.roomCode}`;
        renderRoomPlayers(data.room.players);

        startOnlinePolling();

        if (data.matched && data.room.status === 'playing') {
          closeModal(matchmakingModal);
          startNewGame(true);
        }
      } else {
        closeModal(matchmakingModal);
        showMessage((data ? data.reason : '') || 'ランダムマッチングに失敗しました', 'error');
      }
    } catch (err) {
      closeModal(matchmakingModal);
      showMessage('オンライン対戦サーバーに接続できませんでした', 'error');
    }
  }

  if (btnCancelMatchmaking) {
    btnCancelMatchmaking.addEventListener('click', () => {
      if (onlineRoomCode && onlineMyPlayerId) {
        // 検索キャンセル時にサーバーへ即時解散を通知（部屋ファイル物理削除）
        fetch(`api/online_match.php?action=leave&roomCode=${onlineRoomCode}&playerId=${onlineMyPlayerId}`);
      }
      stopOnlinePolling();
      onlineRoomCode = null;
      onlineMyPlayerId = null;
      closeModal(matchmakingModal);
    });
  }

  async function createOnlineRoom() {
    const name = onlinePlayerNameInput.value.trim() || 'プレイヤー1';
    try {
      const res = await fetch(`api/online_match.php?action=create&name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data && data.success) {
        onlineRoomCode = data.roomCode;
        onlineMyPlayerId = data.playerId;
        onlineRoomData = data.room;

        if (roomCodeDisplay) roomCodeDisplay.textContent = `ルームコード: ${data.roomCode}`;
        if (roomStatusPanel) roomStatusPanel.classList.remove('hidden');
        renderRoomPlayers(data.room.players);

        startOnlinePolling();
      }
    } catch (err) {
      showMessage('ルームの作成に失敗しました', 'error');
    }
  }

  async function joinOnlineRoom() {
    const name = onlinePlayerNameInput.value.trim() || 'プレイヤー';
    const code = onlineRoomCodeInput ? onlineRoomCodeInput.value.trim().toUpperCase() : '';

    if (!code) {
      showMessage('ルームコードを入力してください', 'error');
      return;
    }

    try {
      const res = await fetch(`api/online_match.php?action=join&roomCode=${code}&name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data && data.success) {
        onlineRoomCode = data.roomCode;
        onlineMyPlayerId = data.playerId;
        onlineRoomData = data.room;

        if (roomCodeDisplay) roomCodeDisplay.textContent = `ルームコード: ${data.roomCode}`;
        if (roomStatusPanel) roomStatusPanel.classList.remove('hidden');
        renderRoomPlayers(data.room.players);

        startOnlinePolling();
      } else {
        showMessage(data.reason || 'ルームへの参加に失敗しました', 'error');
      }
    } catch (err) {
      showMessage('ルーム参加エラーが発生しました', 'error');
    }
  }

  function renderRoomPlayers(players) {
    if (!roomPlayersList) return;
    roomPlayersList.innerHTML = '';
    players.forEach((p, idx) => {
      const div = document.createElement('div');
      div.style.cssText = 'padding: 8px 12px; background: rgba(255,255,255,0.06); border-radius: 10px; display: flex; justify-content: space-between; font-size: 0.95rem;';
      div.innerHTML = `<span>P${idx+1}: <strong>${p.name}</strong> ${p.isHost ? '👑 (ホスト)' : ''}</span><span style="color: var(--accent-green);">接続済み</span>`;
      roomPlayersList.appendChild(div);
    });

    if (btnStartOnlineGame) {
      btnStartOnlineGame.disabled = (players.length < 2);
      if (players.length >= 2) {
        btnStartOnlineGame.textContent = '2名揃いました！対戦開始 (1v1) ⚡';
      } else {
        btnStartOnlineGame.textContent = `対戦相手待機中 (${players.length}/2名)`;
      }
    }
  }

  function triggerYourTurnCue() {
    turnStartTimestamp = Date.now();

    const arenaCard = document.querySelector('.arena-card');
    if (arenaCard) {
      arenaCard.classList.add('your-turn-aura');
      setTimeout(() => arenaCard.classList.remove('your-turn-aura'), 800);
    }

    if (wordInput) wordInput.focus();
  }

  function startOnlinePolling() {
    stopOnlinePolling();
    onlinePollInterval = setInterval(async () => {
      if (!onlineRoomCode) return;
      try {
        const res = await fetch(`api/online_match.php?action=get_state&roomCode=${onlineRoomCode}`);
        const data = await res.json();
        if (data && data.success) {
          onlineRoomData = data.room;
          renderRoomPlayers(data.room.players);

          // オンライン対戦時の時計ラベルを実際のプレイヤー名に更新
          if (data.room.players && Array.isArray(data.room.players)) {
            const myP = data.room.players.find(p => p.id === onlineMyPlayerId) || data.room.players[0];
            const oppP = data.room.players.find(p => p.id !== onlineMyPlayerId) || data.room.players[1];
            if (userClockLabel && myP) userClockLabel.textContent = myP.name;
            if (oppClockLabel && oppP) oppClockLabel.textContent = oppP.name;
          }

          // オンラインゲーム進行中のターン制御 ＆ サーバーサイド時間同期 ＆ 一律勝敗同期
          if (isOnlineMode) {
            // ① サーバーサイドから配信された正確な持ち時間を両クライアントに同期
            if (data.room.livePlayerTimes && Array.isArray(data.room.livePlayerTimes)) {
              const myIdx = (data.room.players[0] && data.room.players[0].id === onlineMyPlayerId) ? 0 : 1;
              const oppIdx = (myIdx === 0) ? 1 : 0;

              userTimeLeft = Math.max(0, data.room.livePlayerTimes[myIdx] || 0);
              oppTimeLeft = Math.max(0, data.room.livePlayerTimes[oppIdx] || 0);
              updateClockDisplay();
            }

            // ② サーバーサイド決着判定の受領 (両プレイヤー勝敗一律同期)
            if (data.room.status === 'finished' && !isGameOver) {
              stopOnlinePolling();
              const isWinner = (data.room.winnerId === onlineMyPlayerId);
              const reasonMsg = data.room.finishReason || '対戦終了';

              triggerGameOver(reasonMsg, isWinner);

              if (onlineRoomCode && onlineMyPlayerId) {
                fetch(`api/online_match.php?action=leave&roomCode=${onlineRoomCode}&playerId=${onlineMyPlayerId}`);
              }
              onlineRoomCode = null;
              onlineMyPlayerId = null;
              return;
            }

            const activeP = data.room.players[data.room.activePlayerIndex];
            const isMyTurn = (activeP && activeP.id === onlineMyPlayerId);

            if (isMyTurn) {
              const wasOppTurn = (activeTurn === 'opp');
              activeTurn = 'user';
              turnTextEl.textContent = '⚡ あなたのターン';
              if (userClockBox) userClockBox.classList.add('active');
              if (oppClockBox) oppClockBox.classList.remove('active');

              if (!isGameOver) {
                wordInput.disabled = false;
                btnSubmit.disabled = false;
                wordInput.placeholder = 'ひらがなで単語を入力...';
                if (wasOppTurn) {
                  turnStartTimestamp = Date.now(); // 自分のターン開始の正確な時刻を記録
                  triggerYourTurnCue();
                }
              }
            } else {
              activeTurn = 'opp';
              const oppName = activeP ? activeP.name : '相手';
              turnTextEl.textContent = `⌛ ${oppName}のターン`;
              if (oppClockBox) oppClockBox.classList.add('active');
              if (userClockBox) userClockBox.classList.remove('active');

              wordInput.disabled = true;
              wordInput.blur(); // Android仮想キーボードの誤表示を完全遮断
              btnSubmit.disabled = true;
              wordInput.placeholder = `${oppName} の入力待ち...`;
            }

            if (data.room.currentWord !== currentWord) {
              currentWord = data.room.currentWord;
              usedWordsSet = new Set(data.room.usedWords);
              fullHistory = data.room.history;

              renderCurrentWord();
              renderRecentWords();
            }
          }

          if (data.room.status === 'playing' && (onlineLobbyModal.classList.contains('active') || matchmakingModal.classList.contains('active'))) {
            closeModal(onlineLobbyModal);
            closeModal(matchmakingModal);
            startNewGame(true);
          }
        }
      } catch (err) {}
    }, 1500);
  }

  function stopOnlinePolling() {
    if (onlinePollInterval) {
      clearInterval(onlinePollInterval);
      onlinePollInterval = null;
    }
  }


  /* =========================================================================
   * SECTION 8: MODAL DIALOGS & EVENT LISTENERS (専用退出モーダル ＆ イベント登録)
   * ========================================================================= */
  function openModal(modal) {
    if (modal) modal.classList.add('active');
  }

  function closeModal(modal) {
    if (modal) modal.classList.remove('active');
  }

  function closeAllModals() {
    if (settingsModal) settingsModal.classList.remove('active');
    if (rulesModal) rulesModal.classList.remove('active');
    if (resultModal) resultModal.classList.remove('active');
    if (exitModal) exitModal.classList.remove('active');
    if (onlineLobbyModal) onlineLobbyModal.classList.remove('active');
    if (matchmakingModal) matchmakingModal.classList.remove('active');
  }

  btnStartGame.addEventListener('click', () => {
    startNewGame(false);
  });

  btnOnlineLobby.addEventListener('click', () => {
    if (onlinePlayerNameInput && !onlinePlayerNameInput.value.trim()) {
      onlinePlayerNameInput.value = generateRandomPlayerName();
    }
    openModal(onlineLobbyModal);
  });

  if (btnQuickMatch) {
    btnQuickMatch.addEventListener('click', () => {
      quickOnlineMatch();
    });
  }

  if (btnCreateRoom) {
    btnCreateRoom.addEventListener('click', () => {
      createOnlineRoom();
    });
  }

  if (btnJoinRoomAction) {
    btnJoinRoomAction.addEventListener('click', () => {
      joinOnlineRoom();
    });
  }

  btnStartOnlineGame.addEventListener('click', () => {
    closeModal(onlineLobbyModal);
    startNewGame(true);
  });

  btnCloseOnlineLobby.addEventListener('click', () => {
    closeModal(onlineLobbyModal);
  });

  btnTitleRules.addEventListener('click', () => {
    openModal(rulesModal);
  });

  btnNavSettings.addEventListener('click', () => {
    openModal(settingsModal);
  });

  // 退出ボタン ➔ 専用ポップアップモーダル表示 (対戦モード別の警告文章自動切替)
  btnNavExit.addEventListener('click', () => {
    const warningEl = document.getElementById('exit-modal-warning');
    if (warningEl) {
      if (isOnlineMode) {
        warningEl.textContent = '※対戦中に退出すると不戦敗となり、相手の勝利となります。';
      } else {
        warningEl.textContent = '※現在の対戦状況やスコアはリセットされます。';
      }
    }
    openModal(exitModal);
  });

  btnConfirmExit.addEventListener('click', () => {
    closeModal(exitModal);
    exitToTitle();
  });

  btnCancelExit.addEventListener('click', () => {
    closeModal(exitModal);
  });

  btnCloseSettings.addEventListener('click', () => {
    closeModal(settingsModal);
  });

  btnModalRules.addEventListener('click', () => {
    closeModal(settingsModal);
    openModal(rulesModal);
  });

  btnCloseRules.addEventListener('click', () => {
    closeModal(rulesModal);
  });

  // リザルト画面のボタン ➔ タイトル画面へ戻る
  btnResultRestart.addEventListener('click', () => {
    closeModal(resultModal);
    exitToTitle();
  });

  // タブ閉じ・ブラウザバック・リロード時の不戦勝/不戦敗連動 (sendBeacon)
  window.addEventListener('beforeunload', () => {
    if (isOnlineMode && onlineRoomCode && onlineMyPlayerId) {
      const url = `api/online_match.php?action=leave&roomCode=${onlineRoomCode}&playerId=${onlineMyPlayerId}`;
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url);
      } else {
        fetch(url, { keepalive: true });
      }
    }
  });

  window.addEventListener('pagehide', () => {
    if (isOnlineMode && onlineRoomCode && onlineMyPlayerId) {
      const url = `api/online_match.php?action=leave&roomCode=${onlineRoomCode}&playerId=${onlineMyPlayerId}`;
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url);
      } else {
        fetch(url, { keepalive: true });
      }
    }
  });

  wordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleWordSubmit();
  });
});
