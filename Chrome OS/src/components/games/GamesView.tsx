import { Gamepad, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type GameKey = "trex" | "snake" | "tictactoe" | "memory" | "rps";

const games: Array<{ key: GameKey; title: string; description: string }> = [
  { key: "trex", title: "T-Rex Runner", description: "Play the Chrome offline dinosaur game in an embedded frame." },
  { key: "snake", title: "Snake", description: "Collect food and grow your snake without crashing." },
  { key: "tictactoe", title: "Tic Tac Toe", description: "Classic 3x3 X vs O strategy game." },
  { key: "memory", title: "Memory Match", description: "Flip cards to find matching pairs." },
  { key: "rps", title: "Rock Paper Scissors", description: "Play the classic hand game against the computer." }
];

const shuffleArray = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);

function useKeyboardShortcuts(onArrow: (direction: "up" | "down" | "left" | "right") => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp" || event.key === "w") onArrow("up");
      if (event.key === "ArrowDown" || event.key === "s") onArrow("down");
      if (event.key === "ArrowLeft" || event.key === "a") onArrow("left");
      if (event.key === "ArrowRight" || event.key === "d") onArrow("right");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onArrow]);
}

// DinoRunner removed — using the T-Rex Runner iframe instead.

function TrexRunnerGame() {
  const [reloadKey, setReloadKey] = useState(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const toggleFullscreen = async () => {
    if (!wrapperRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await wrapperRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      return;
    }
  };

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  return (
    <div className="game-stage">
      <div className="game-header">
        <div>
          <h2>T-Rex Runner</h2>
          <p>Play the classic Chrome offline dinosaur game in an embedded browser frame.</p>
        </div>
        <div className="game-header-actions">
          <button className="game-action" onClick={() => setReloadKey((value) => value + 1)}>
            <RefreshCw size={16} /> Reload
          </button>
          <button className="game-action" onClick={toggleFullscreen}>
            {fullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
        </div>
      </div>
      <div className="trex-frame-wrapper" ref={wrapperRef}>
        <iframe
          key={reloadKey}
          title="T-Rex Runner"
          src="/t-rex-runner/index.html"
          className="trex-frame"
          allowFullScreen
        />
      </div>
      <div className="game-footer">
        <span>Click inside the frame and press Space to start.</span>
        <span>Focus must remain on the embedded game to control it.</span>
      </div>
    </div>
  );
}

function SnakeGame() {
  const width = 14;
  const height = 12;
  const initialSnake = useMemo(() => [{ x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }], []);
  const [snake, setSnake] = useState(initialSnake);
  const [direction, setDirection] = useState<"up" | "down" | "left" | "right">("right");
  const [food, setFood] = useState({ x: 10, y: 4 });
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [running, setRunning] = useState(false);

  const reset = () => {
    setSnake(initialSnake);
    setDirection("right");
    setFood({ x: 10, y: 4 });
    setScore(0);
    setGameOver(false);
    setRunning(true);
  };

  useKeyboardShortcuts(
    (newDirection) => {
      if (newDirection === "up" && direction !== "down") setDirection("up");
      if (newDirection === "down" && direction !== "up") setDirection("down");
      if (newDirection === "left" && direction !== "right") setDirection("left");
      if (newDirection === "right" && direction !== "left") setDirection("right");
    },
    true
  );

  useEffect(() => {
    if (!running || gameOver) return;
    const interval = window.setInterval(() => {
      setSnake((currentSnake) => {
        const head = currentSnake[0];
        const nextHead = {
          x: (head.x + (direction === "right" ? 1 : direction === "left" ? -1 : 0) + width) % width,
          y: (head.y + (direction === "down" ? 1 : direction === "up" ? -1 : 0) + height) % height
        };
        const collided = currentSnake.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y);
        if (collided) {
          setGameOver(true);
          setRunning(false);
          return currentSnake;
        }
        const ateFood = nextHead.x === food.x && nextHead.y === food.y;
        const nextSnake = [nextHead, ...currentSnake];
        if (!ateFood) nextSnake.pop();
        if (ateFood) {
          setScore((value) => value + 1);
          const nextFood = { x: Math.floor(Math.random() * width), y: Math.floor(Math.random() * height) };
          setFood(nextFood);
        }
        return nextSnake;
      });
    }, 140);
    return () => window.clearInterval(interval);
  }, [direction, running, gameOver, food, height, width]);

  return (
    <div className="game-stage">
      <div className="game-header">
        <div>
          <h2>Snake</h2>
          <p>Use arrow keys or WASD to steer. Eat food and avoid hitting yourself.</p>
        </div>
        <button className="game-action" onClick={reset}>
          <RefreshCw size={16} /> Restart
        </button>
      </div>
      <div className="snake-board" tabIndex={0}>
        {Array.from({ length: height }).map((_, row) => (
          <div className="snake-row" key={row}>
            {Array.from({ length: width }).map((_, column) => {
              const isSnake = snake.some((segment) => segment.x === column && segment.y === row);
              const isFood = food.x === column && food.y === row;
              return <div className={`snake-cell ${isSnake ? "snake-body" : ""} ${isFood ? "snake-food" : ""}`} key={column} />;
            })}
          </div>
        ))}
      </div>
      <div className="game-footer">
        <span>Score: {score}</span>
        <span>{gameOver ? "Game Over" : running ? "Playing" : "Press restart to start"}</span>
      </div>
    </div>
  );
}

function TicTacToeGame() {
  const winningLines = useMemo(
    () => [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6]
    ],
    []
  );

  const [board, setBoard] = useState<("X" | "O" | "")[]>(Array(9).fill(""));
  const [turn, setTurn] = useState<"X" | "O">("X");
  const [winner, setWinner] = useState<"X" | "O" | "Draw" | "" | null>(null);

  const reset = () => {
    setBoard(Array(9).fill(""));
    setTurn("X");
    setWinner(null);
  };

  const handleClick = (index: number) => {
    if (board[index] || winner) return;
    setBoard((current) => {
      const next = [...current];
      next[index] = turn;
      return next;
    });
    setTurn((current) => (current === "X" ? "O" : "X"));
  };

  useEffect(() => {
    const currentWinner = winningLines.find((line) => {
      const [a, b, c] = line;
      return board[a] && board[a] === board[b] && board[a] === board[c];
    });
    if (currentWinner) {
      setWinner(board[currentWinner[0]] as "X" | "O");
      return;
    }
    if (board.every((cell) => cell !== "")) {
      setWinner("Draw");
    }
  }, [board, winningLines]);

  return (
    <div className="game-stage">
      <div className="game-header">
        <div>
          <h2>Tic Tac Toe</h2>
          <p>Take turns placing X and O. Get three in a row to win.</p>
        </div>
        <button className="game-action" onClick={reset}>
          <RefreshCw size={16} /> Reset
        </button>
      </div>
      <div className="tictactoe-grid">
        {board.map((cell, index) => (
          <button key={index} className="tictactoe-cell" onClick={() => handleClick(index)}>
            {cell}
          </button>
        ))}
      </div>
      <div className="game-footer">
        <span>{winner ? (winner === "Draw" ? "Draw" : `${winner} wins!`) : `${turn}'s turn`}</span>
        <span>{board.filter(Boolean).length} moves</span>
      </div>
    </div>
  );
}

function MemoryGame() {
  const initialCards = useMemo(() => shuffleArray([...Array(8).flatMap((_, index) => [index + 1, index + 1])]), []);
  const [cards, setCards] = useState<number[]>(initialCards);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);

  const reset = () => {
    setCards(shuffleArray([...Array(8).flatMap((_, index) => [index + 1, index + 1])]));
    setFlipped([]);
    setMatched([]);
    setMoves(0);
  };

  const handleFlip = (index: number) => {
    if (flipped.includes(index) || matched.includes(index) || flipped.length === 2) return;
    setFlipped((current) => [...current, index]);
  };

  useEffect(() => {
    if (flipped.length !== 2) return;
    const [first, second] = flipped;
    if (cards[first] === cards[second]) {
      setMatched((current) => [...current, first, second]);
      setFlipped([]);
    } else {
      const timeout = window.setTimeout(() => setFlipped([]), 800);
      return () => window.clearTimeout(timeout);
    }
    setMoves((current) => current + 1);
  }, [flipped, cards]);

  return (
    <div className="game-stage">
      <div className="game-header">
        <div>
          <h2>Memory Match</h2>
          <p>Flip cards and remember where the pairs are hidden.</p>
        </div>
        <button className="game-action" onClick={reset}>
          <RefreshCw size={16} /> Restart
        </button>
      </div>
      <div className="memory-grid">
        {cards.map((value, index) => {
          const isFlipped = flipped.includes(index) || matched.includes(index);
          return (
            <button key={index} className={`memory-card ${isFlipped ? "flipped" : ""}`} onClick={() => handleFlip(index)}>
              <span>{isFlipped ? value : "?"}</span>
            </button>
          );
        })}
      </div>
      <div className="game-footer">
        <span>Pairs matched: {matched.length / 2}</span>
        <span>Moves: {moves}</span>
      </div>
    </div>
  );
}

function RockPaperScissorsGame() {
  const choices: Array<"Rock" | "Paper" | "Scissors"> = ["Rock", "Paper", "Scissors"];
  const [player, setPlayer] = useState<"Rock" | "Paper" | "Scissors" | null>(null);
  const [computer, setComputer] = useState<"Rock" | "Paper" | "Scissors" | null>(null);
  const [result, setResult] = useState<string>("");
  const [score, setScore] = useState({ player: 0, computer: 0, draws: 0 });

  const play = (choice: "Rock" | "Paper" | "Scissors") => {
    const computerChoice = choices[Math.floor(Math.random() * choices.length)];
    setPlayer(choice);
    setComputer(computerChoice);
    if (choice === computerChoice) {
      setResult("Draw");
      setScore((current) => ({ ...current, draws: current.draws + 1 }));
      return;
    }
    const playerWins =
      (choice === "Rock" && computerChoice === "Scissors") ||
      (choice === "Paper" && computerChoice === "Rock") ||
      (choice === "Scissors" && computerChoice === "Paper");
    if (playerWins) {
      setResult("You win!");
      setScore((current) => ({ ...current, player: current.player + 1 }));
    } else {
      setResult("Computer wins");
      setScore((current) => ({ ...current, computer: current.computer + 1 }));
    }
  };

  return (
    <div className="game-stage">
      <div className="game-header">
        <div>
          <h2>Rock Paper Scissors</h2>
          <p>Choose your move and try to beat the computer.</p>
        </div>
        <button className="game-action" onClick={() => { setPlayer(null); setComputer(null); setResult(""); setScore({ player: 0, computer: 0, draws: 0 }); }}>
          <RefreshCw size={16} /> Reset
        </button>
      </div>
      <div className="rps-row">
        {choices.map((choice) => (
          <button key={choice} className="rps-button" onClick={() => play(choice)}>
            {choice}
          </button>
        ))}
      </div>
      <div className="rps-results">
        <div>
          <strong>You</strong>
          <p>{player ?? "–"}</p>
        </div>
        <div>
          <strong>Computer</strong>
          <p>{computer ?? "–"}</p>
        </div>
        <div>
          <strong>Result</strong>
          <p>{result || "Pick a move"}</p>
        </div>
      </div>
      <div className="game-footer">
        <span>Player: {score.player}</span>
        <span>Computer: {score.computer}</span>
        <span>Draws: {score.draws}</span>
      </div>
    </div>
  );
}

export function GamesView() {
  const [selectedGame, setSelectedGame] = useState<GameKey>("trex");

  const currentGame = useMemo(() => {
    switch (selectedGame) {
      case "trex":
        return <TrexRunnerGame />;
      case "snake":
        return <SnakeGame />;
      case "tictactoe":
        return <TicTacToeGame />;
      case "memory":
        return <MemoryGame />;
      case "rps":
        return <RockPaperScissorsGame />;
      default:
        return <TrexRunnerGame />;
    }
  }, [selectedGame]);

  return (
    <section className="module-panel games-panel">
      <div className="module-header">
        <div>
          <h1>Offline Games</h1>
          <p>Play offline games directly inside Halo OS. Use keyboard controls for running, snake, and more.</p>
        </div>
        <button className="widget-command" onClick={() => setSelectedGame("trex")}>
          <Gamepad size={16} /> Start T-Rex Runner
        </button>
      </div>
      <div className="games-grid">
        {games.map((game) => (
          <button
            key={game.key}
            className={`game-card ${selectedGame === game.key ? "active" : ""}`}
            onClick={() => setSelectedGame(game.key)}
          >
            <strong>{game.title}</strong>
            <span>{game.description}</span>
          </button>
        ))}
      </div>
      <div className="game-area">{currentGame}</div>
    </section>
  );
}
