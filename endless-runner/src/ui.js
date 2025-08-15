export default class UI {
  constructor({ game }){
    this.game = game;
    this.powerEl = document.getElementById('power-val');
    this.scoreEl = document.getElementById('score-val');
    this.updatePower(1);
    this.updateScore(0);
  }

  updatePower(val){
    // Always format number for consistency
    function formatNumberShort(n) {
      if (n >= 1e9) return (n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1) + 'B';
      if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + 'M';
      if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1) + 'K';
      return n.toString();
    }
    this.powerEl.textContent = formatNumberShort(val);
  }
  updateScore(val){ this.scoreEl.textContent = val; }
}
