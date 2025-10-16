const canvas = document.getElementById("board");
const context = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const linesEl = document.getElementById("lines");
const restartBtn = document.getElementById("restart");

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
canvas.width = COLS * BLOCK_SIZE;
canvas.height = ROWS * BLOCK_SIZE;
context.scale(BLOCK_SIZE, BLOCK_SIZE);

const COLORS = {
  I: "#22d3ee",
  O: "#facc15",
  T: "#a855f7",
  S: "#4ade80",
  Z: "#f87171",
  J: "#60a5fa",
  L: "#f97316",
};

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

const LEVEL_SPEED = [1000, 850, 700, 550, 430, 320, 230, 160, 100, 60];

let board;
let currentPiece;
let nextDropTime = 0;
let dropInterval = LEVEL_SPEED[0];
let score = 0;
let level = 1;
let lines = 0;
let requestId;
let gameOver = false;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  const keys = Object.keys(SHAPES);
  const type = keys[Math.floor(Math.random() * keys.length)];
  const matrix = SHAPES[type].map((row) => [...row]);
  return {
    type,
    matrix,
    x: Math.floor(COLS / 2) - Math.ceil(matrix[0].length / 2),
    y: 0,
  };
}

function rotate(matrix) {
  const size = matrix.length;
  const result = matrix.map((row) => [...row]);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      result[x][size - 1 - y] = matrix[y][x];
    }
  }
  return result;
}

function collide(board, piece) {
  for (let y = 0; y < piece.matrix.length; y++) {
    for (let x = 0; x < piece.matrix[y].length; x++) {
      if (!piece.matrix[y][x]) continue;
      const newX = piece.x + x;
      const newY = piece.y + y;
      if (newX < 0 || newX >= COLS || newY >= ROWS) {
        return true;
      }
      if (newY >= 0 && board[newY][newX]) {
        return true;
      }
    }
  }
  return false;
}

function merge(board, piece) {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value && piece.y + y >= 0) {
        board[piece.y + y][piece.x + x] = piece.type;
      }
    });
  });
}

function clearLines() {
  let cleared = 0;
  outer: for (let y = ROWS - 1; y >= 0; y--) {
    for (let x = 0; x < COLS; x++) {
      if (!board[y][x]) {
        continue outer;
      }
    }
    board.splice(y, 1);
    board.unshift(Array(COLS).fill(null));
    cleared++;
    y++;
  }

  if (cleared > 0) {
    lines += cleared;
    score += [0, 100, 300, 500, 800][cleared];
    const newLevel = Math.min(10, 1 + Math.floor(lines / 10));
    if (newLevel !== level) {
      level = newLevel;
      dropInterval = LEVEL_SPEED[level - 1] || LEVEL_SPEED[LEVEL_SPEED.length - 1];
    }
    updateScoreboard();
  }
}

function drawCell(x, y, color) {
  context.fillStyle = color;
  context.fillRect(x, y, 1, 1);
  context.strokeStyle = "rgba(15, 23, 42, 0.35)";
  context.lineWidth = 0.05;
  context.strokeRect(x + 0.02, y + 0.02, 0.96, 0.96);
}

function drawBoard() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  board.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) {
        drawCell(x, y, COLORS[cell]);
      } else {
        context.fillStyle = "rgba(15, 23, 42, 0.45)";
        context.fillRect(x, y, 1, 1);
      }
    });
  });
}

function drawPiece(piece) {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawCell(piece.x + x, piece.y + y, COLORS[piece.type]);
      }
    });
  });
}

function update(time = 0) {
  if (gameOver) return;

  const delta = time - nextDropTime;
  if (delta > dropInterval) {
    nextDropTime = time;
    dropPiece();
  }

  drawBoard();
  drawPiece(currentPiece);
  requestId = requestAnimationFrame(update);
}

function dropPiece() {
  currentPiece.y += 1;
  if (collide(board, currentPiece)) {
    currentPiece.y -= 1;
    merge(board, currentPiece);
    clearLines();
    spawnPiece();
  }
}

function hardDrop() {
  do {
    currentPiece.y += 1;
  } while (!collide(board, currentPiece));
  currentPiece.y -= 1;
  merge(board, currentPiece);
  clearLines();
  spawnPiece();
}

function movePiece(offsetX) {
  currentPiece.x += offsetX;
  if (collide(board, currentPiece)) {
    currentPiece.x -= offsetX;
  }
}

function rotatePiece() {
  const rotated = rotate(currentPiece.matrix);
  const previous = currentPiece.matrix;
  currentPiece.matrix = rotated;
  if (collide(board, currentPiece)) {
    // Simple wall kick: try shifting left/right before reverting
    currentPiece.x += 1;
    if (collide(board, currentPiece)) {
      currentPiece.x -= 2;
      if (collide(board, currentPiece)) {
        currentPiece.x += 1;
        currentPiece.matrix = previous;
      }
    }
  }
}

function spawnPiece() {
  currentPiece = randomPiece();
  if (collide(board, currentPiece)) {
    gameOver = true;
    cancelAnimationFrame(requestId);
    drawBoard();
    drawGameOver();
  }
}

function drawGameOver() {
  context.fillStyle = "rgba(15, 23, 42, 0.85)";
  context.fillRect(0, 0, COLS, ROWS);
  context.fillStyle = "#f8fafc";
  context.font = "1.2px 'Pretendard', sans-serif";
  context.textAlign = "center";
  context.fillText("게임 종료", COLS / 2, ROWS / 2 - 1);
  context.font = "0.8px 'Pretendard', sans-serif";
  context.fillText(`점수: ${score}`, COLS / 2, ROWS / 2 + 0.2);
  context.fillText("다시 시작 버튼을 눌러주세요", COLS / 2, ROWS / 2 + 1.5);
}

function updateScoreboard() {
  scoreEl.textContent = score.toLocaleString();
  levelEl.textContent = level.toString();
  linesEl.textContent = lines.toString();
}

function resetGame() {
  board = createBoard();
  score = 0;
  level = 1;
  lines = 0;
  dropInterval = LEVEL_SPEED[0];
  gameOver = false;
  nextDropTime = 0;
  updateScoreboard();
  spawnPiece();
  cancelAnimationFrame(requestId);
  requestId = requestAnimationFrame(update);
}

function setupControls() {
  document.addEventListener("keydown", (event) => {
    if (gameOver) return;
    switch (event.key) {
      case "ArrowLeft":
        movePiece(-1);
        break;
      case "ArrowRight":
        movePiece(1);
        break;
      case "ArrowDown":
        dropPiece();
        break;
      case "ArrowUp":
        rotatePiece();
        break;
      case " ":
      case "Spacebar":
        hardDrop();
        break;
    }
  });

  restartBtn.addEventListener("click", resetGame);
}

function init() {
  board = createBoard();
  setupControls();
  resetGame();
}

init();
