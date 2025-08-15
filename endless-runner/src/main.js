import Game from './game.js';

let game = null;

const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');

startBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  startGame();
});

restartBtn.addEventListener('click', () => {
  gameOverScreen.classList.add('hidden');
  startGame();
});

function startGame(){
  if(game) game.dispose();
  game = new Game({ container: document.body, onGameOver: showGameOver });
  game.start();
}

function showGameOver(score){
  const finalText = document.getElementById('final-text');
  finalText.textContent = `Game Over - Score: ${score}`;
  gameOverScreen.classList.remove('hidden');
}

window.addEventListener('resize', () => {
  if (game) game.onResize();
});
