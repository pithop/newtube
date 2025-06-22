import React, { useRef, useEffect, useCallback } from 'react';

// --- Tetris Game Logic and Component ---
const TetrisGame = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const COLS = 10;
    const ROWS = 20;
    const BLOCK_SIZE = Math.floor((canvas.parentElement.clientHeight * 0.8) / ROWS);
    
    canvas.width = COLS * BLOCK_SIZE;
    canvas.height = ROWS * BLOCK_SIZE;
    ctx.scale(1, 1);

    const COLORS = ['#1a1a1a', '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF'];
    const SHAPES = [
      [],
      [[1,1,1,1]], // I
      [[2,2],[2,2]], // O
      [[0,3,3],[3,3,0]], // S
      [[4,4,0],[0,4,4]], // Z
      [[0,5,0],[5,5,5]], // T
      [[6,0,0],[6,6,6]], // L
      [[0,0,7],[7,7,7]]  // J
    ];

    let board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    let currentPiece = null;
    let score = 0;
    let gameOver = false;
    let dropCounter = 0;
    let lastTime = 0;
    let animationFrameId;
    
    function drawBlock(x, y, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        board.forEach((row, y) => row.forEach((value, x) => drawBlock(x, y, COLORS[value])));
        if (currentPiece) {
            currentPiece.shape.forEach((row, dy) => {
                row.forEach((value, dx) => {
                    if (value > 0) drawBlock(currentPiece.x + dx, currentPiece.y + dy, COLORS[value]);
                });
            });
        }
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px "Press Start 2P"';
        ctx.textAlign = 'left';
        ctx.fillText(`Score: ${score}`, 10, 20);

        if (gameOver) {
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(0, canvas.height / 3, canvas.width, canvas.height / 3);
            ctx.fillStyle = 'red';
            ctx.textAlign = 'center';
            ctx.font = 'bold 24px "Press Start 2P"';
            ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
        }
    }

    function newPiece() {
        const typeId = Math.floor(Math.random() * (SHAPES.length - 1)) + 1;
        const shape = SHAPES[typeId];
        currentPiece = {
            shape,
            x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
            y: 0,
        };
        if (collides()) gameOver = true;
    }

    function collides() {
        for (let y = 0; y < currentPiece.shape.length; y++) {
            for (let x = 0; x < currentPiece.shape[y].length; x++) {
                if (currentPiece.shape[y][x] !== 0 &&
                   (board[currentPiece.y + y] &&
                    board[currentPiece.y + y][currentPiece.x + x]) !== 0) {
                    return true;
                }
            }
        }
        return false;
    }

    function merge() {
        currentPiece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value > 0) board[currentPiece.y + y][currentPiece.x + x] = value;
            });
        });
    }

    function rotate() {
        const shape = currentPiece.shape;
        const newShape = shape[0].map((_, colIndex) => shape.map(row => row[colIndex]).reverse());
        const originalX = currentPiece.x;
        currentPiece.shape = newShape;
        let offset = 1;
        while (collides()) {
            currentPiece.x += offset;
            offset = -(offset + (offset > 0 ? 1 : -1));
            if (offset > newShape[0].length) {
                currentPiece.shape = shape;
                currentPiece.x = originalX;
                return;
            }
        }
    }
    
    function move(dir) {
        currentPiece.x += dir;
        if (collides()) currentPiece.x -= dir;
    }
    
    function drop() {
        currentPiece.y++;
        if (collides()) {
            currentPiece.y--;
            merge();
            sweepLines();
            newPiece();
        }
        dropCounter = 0;
    }

    function sweepLines() {
        let linesCleared = 0;
        outer: for (let y = board.length - 1; y > 0; y--) {
            for (let x = 0; x < board[y].length; x++) {
                if (board[y][x] === 0) continue outer;
            }
            board.splice(y, 1);
            board.unshift(Array(COLS).fill(0));
            y++;
            linesCleared++;
        }
        if (linesCleared > 0) score += linesCleared * 10 * linesCleared;
    }
    
    const handleKeyDown = (event) => {
        if (gameOver) return;
        if (event.key === 'ArrowLeft') move(-1);
        else if (event.key === 'ArrowRight') move(1);
        else if (event.key === 'ArrowDown') drop();
        else if (event.key === 'ArrowUp') rotate();
    };
    document.addEventListener('keydown', handleKeyDown);

    function gameLoop(time = 0) {
        if (gameOver) {
            draw();
            return;
        }
        const deltaTime = time - lastTime;
        lastTime = time;
        dropCounter += deltaTime;
        if (dropCounter > 1000) drop();
        draw();
        animationFrameId = requestAnimationFrame(gameLoop);
    }
    
    newPiece();
    gameLoop();

    return () => {
        document.removeEventListener('keydown', handleKeyDown);
        cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black p-4 font-mono">
        <canvas ref={canvasRef}></canvas>
        <div className="mt-4 text-center text-gray-400 text-xs">
            <p>Use Arrow Keys to Play</p>
            <p>Up: Rotate | Down: Drop</p>
        </div>
    </div>
  );
};

export default TetrisGame;
