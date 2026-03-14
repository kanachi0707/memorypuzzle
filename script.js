const board = document.getElementById('game-board');
const resetButton = document.getElementById('reset-button');
const timerDisplay = document.getElementById('timer');
const bestTimeDisplay = document.getElementById('best-time');
const bestTimeDateDisplay = document.getElementById('best-time-date');
const messageDisplay = document.getElementById('message');

const panelImages = [
    'jpg/mit_001.jpg',
    'jpg/mit_002.jpg',
    'jpg/mit_003.jpg',
    'jpg/mit_004.jpg',
    'jpg/mit_005.jpg',
    'jpg/mit_006.jpg',
    'jpg/mit_007.jpg',
    'jpg/mit_008.jpg',
];
const bestTimeStorageKey = 'memory-puzzle-best-time-ms';
const bestTimeDateStorageKey = 'memory-puzzle-best-time-achieved-at';
const legacyBestScoreStorageKey = 'memory-puzzle-best-score';

let firstTile = null;
let matchedPairs = 0;
let isResolvingTurn = false;
let isGameCleared = false;
let timerId = null;
let startTime = null;
let elapsedTime = 0;

resetButton.addEventListener('click', resetGame);

migrateLegacyBestScore();
resetGame();

function resetGame() {
    stopTimer();

    firstTile = null;
    matchedPairs = 0;
    isResolvingTurn = false;
    isGameCleared = false;
    startTime = null;
    elapsedTime = 0;

    timerDisplay.textContent = formatSeconds(elapsedTime);
    messageDisplay.textContent = '1枚めくるとタイマーが始まります。';
    renderBestScore();

    board.replaceChildren();

    const deck = shuffle([...panelImages, ...panelImages]);
    deck.forEach((imagePath, index) => {
        const tile = document.createElement('button');
        tile.className = 'tile';
        tile.type = 'button';
        tile.dataset.symbol = imagePath;
        tile.setAttribute('aria-label', '伏せられたタイル');
        tile.addEventListener('click', () => flipTile(tile));

        const tileImage = document.createElement('img');
        tileImage.className = 'tile-image';
        tileImage.src = imagePath;
        tileImage.alt = `パネル画像 ${index + 1}`;
        tile.appendChild(tileImage);

        const tileCover = document.createElement('span');
        tileCover.className = 'tile-cover';
        tileCover.textContent = '?';
        tile.appendChild(tileCover);

        board.appendChild(tile);
    });
}

function flipTile(tile) {
    if (
        isGameCleared ||
        isResolvingTurn ||
        tile.classList.contains('flipped') ||
        tile.classList.contains('matched')
    ) {
        return;
    }

    startTimerIfNeeded();
    revealTile(tile);

    if (!firstTile) {
        firstTile = tile;
        messageDisplay.textContent = '同じ画像のタイルを探してください。';
        return;
    }

    if (tile.dataset.symbol === firstTile.dataset.symbol) {
        tile.classList.add('matched');
        firstTile.classList.add('matched');
        matchedPairs += 1;
        firstTile = null;

        if (matchedPairs === panelImages.length) {
            finishGame();
        } else {
            messageDisplay.textContent = 'ナイス！ この調子です。';
        }

        return;
    }

    isResolvingTurn = true;
    const previousTile = firstTile;
    firstTile = null;
    messageDisplay.textContent = 'おしい！ もう一度覚えて挑戦。';

    window.setTimeout(() => {
        hideTile(previousTile);
        hideTile(tile);
        isResolvingTurn = false;
    }, 800);
}

function finishGame() {
    isGameCleared = true;
    elapsedTime = Date.now() - startTime;
    timerDisplay.textContent = formatSeconds(elapsedTime);
    stopTimer();

    const result = saveBestScore(elapsedTime);
    renderBestScore();

    if (result.isNewBest) {
        messageDisplay.textContent = `クリア！ ${formatBestTime(elapsedTime)}で新記録です。`;
        return;
    }

    messageDisplay.textContent = `クリア！ タイムは${formatBestTime(elapsedTime)}でした。`;
}

function revealTile(tile) {
    tile.classList.add('flipped');
    tile.setAttribute('aria-label', '画像タイル');
}

function hideTile(tile) {
    tile.classList.remove('flipped');
    tile.setAttribute('aria-label', '伏せられたタイル');
}

function startTimerIfNeeded() {
    if (timerId) {
        return;
    }

    startTime = Date.now() - elapsedTime;
    timerId = window.setInterval(() => {
        elapsedTime = Date.now() - startTime;
        timerDisplay.textContent = formatSeconds(elapsedTime);
    }, 100);
}

function stopTimer() {
    if (!timerId) {
        return;
    }

    window.clearInterval(timerId);
    timerId = null;
}

function migrateLegacyBestScore() {
    const currentBestTime = readBestTimeMs();
    const currentBestDate = readBestTimeDate();
    if (currentBestTime !== null) {
        if (currentBestDate) {
            window.localStorage.setItem(bestTimeDateStorageKey, currentBestDate);
        }
        return;
    }

    const legacyObject = window.localStorage.getItem(legacyBestScoreStorageKey);
    if (!legacyObject) {
        return;
    }

    const parsed = parseLegacyBestScore(legacyObject);
    if (parsed) {
        persistBestScore(parsed.timeMs, parsed.achievedAt);
    }
}

function parseLegacyBestScore(rawValue) {
    const numericValue = parseStoredTime(rawValue);
    if (numericValue !== null) {
        return {
            timeMs: numericValue,
            achievedAt: null,
        };
    }

    try {
        const parsed = JSON.parse(rawValue);
        const timeMs = parseStoredTime(parsed?.timeMs);
        if (timeMs === null) {
            return null;
        }

        return {
            timeMs,
            achievedAt: typeof parsed.achievedAt === 'string' ? parsed.achievedAt : null,
        };
    } catch {
        return null;
    }
}

function saveBestScore(timeMs) {
    const currentBestTime = readBestTimeMs();
    const currentBestDate = readBestTimeDate();
    const achievedAt = new Date().toISOString();
    const shouldUpdate =
        currentBestTime === null ||
        timeMs < currentBestTime ||
        (timeMs === currentBestTime && !currentBestDate);

    if (shouldUpdate) {
        persistBestScore(timeMs, achievedAt);
        return { isNewBest: true };
    }

    return { isNewBest: false };
}

function persistBestScore(timeMs, achievedAt) {
    window.localStorage.setItem(bestTimeStorageKey, String(timeMs));

    if (achievedAt) {
        window.localStorage.setItem(bestTimeDateStorageKey, achievedAt);
    } else {
        window.localStorage.removeItem(bestTimeDateStorageKey);
    }
}

function renderBestScore() {
    const bestTimeMs = readBestTimeMs();
    const achievedAt = readBestTimeDate();

    if (bestTimeMs === null) {
        bestTimeDisplay.textContent = '--';
        bestTimeDateDisplay.textContent = '--';
        return;
    }

    bestTimeDisplay.textContent = formatBestTime(bestTimeMs);
    bestTimeDateDisplay.textContent = achievedAt
        ? formatDateTime(achievedAt)
        : '日時不明';
}

function readBestTimeMs() {
    const timeMs = parseStoredTime(window.localStorage.getItem(bestTimeStorageKey));

    if (timeMs === null) {
        return null;
    }

    if (timeMs <= 0) {
        window.localStorage.removeItem(bestTimeStorageKey);
        window.localStorage.removeItem(bestTimeDateStorageKey);
        return null;
    }

    return timeMs;
}

function parseStoredTime(rawValue) {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
        return null;
    }

    const timeMs = Number(rawValue);
    return Number.isFinite(timeMs) ? timeMs : null;
}

function readBestTimeDate() {
    const rawValue = window.localStorage.getItem(bestTimeDateStorageKey);
    return rawValue && rawValue.trim() ? rawValue : null;
}

function formatSeconds(timeMs) {
    return (timeMs / 1000).toFixed(1).padStart(4, '0');
}

function formatBestTime(timeMs) {
    return `${formatSeconds(timeMs)}秒`;
}

function formatDateTime(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
        return '日時不明';
    }

    return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).format(date);
}

function shuffle(items) {
    for (let i = items.length - 1; i > 0; i -= 1) {
        const randomIndex = Math.floor(Math.random() * (i + 1));
        [items[i], items[randomIndex]] = [items[randomIndex], items[i]];
    }

    return items;
}
