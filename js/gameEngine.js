/**
 * gameEngine.js
 * Fruit Catcher 게임의 핵심 로직 (과일 받기 게임)
 */

// 간단한 효과음 관리자 (Web Audio API)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const SoundManager = {
  playCoin: () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  },
  playBomb: () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  }
};

class GameEngine {
  constructor(ctx, width, height) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;

    // 게임 상태
    this.score = 0;
    this.level = 1;
    this.time = 60;
    this.isGameActive = false;

    // 레인 설정 (3개 레인)
    this.laneCount = 3;
    this.laneWidth = this.width / this.laneCount;
    this.lanecenters = [
      this.laneWidth * 0.5,
      this.laneWidth * 1.5,
      this.laneWidth * 2.5
    ];

    // 플레이어 설정
    this.player = {
      lane: 1, // 0: Left, 1: Center, 2: Right
      x: this.lanecenters[1],
      y: this.height - 100,
      width: 80,
      height: 60,
      sprite: "🛒"
    };
    // 아이템 관리
    this.items = [];
    this.particles = []; // 플로팅 텍스트 효과
    this.lastSpawnTime = 0;
    this.spawnInterval = 1500; // ms
    this.baseSpeed = 3;

    // 게임 루프 변수
    this.lastTime = 0;
    this.timerInterval = null;

    // 콜백
    this.onScoreChange = null;
    this.onGameEnd = null;
  }

  start() {
    this.isGameActive = true;
    this.score = 0;
    this.level = 1;
    this.time = 60;
    this.items = [];
    this.particles = [];
    this.player.lane = 1;
    this.player.x = this.lanecenters[1];

    // 타이머 시작 (1초마다 감소)
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (!this.isGameActive) return;
      this.time--;

      // UI 업데이트
      if (this.onScoreChange) {
        this.onScoreChange(this.score, this.level, this.time);
      }

      if (this.time <= 0) {
        this.gameOver();
      }
    }, 1000);

    // 첫 UI 업데이트
    if (this.onScoreChange) this.onScoreChange(this.score, this.level, this.time);
  }

  stop() {
    this.isGameActive = false;
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  // 포즈 입력 처리
  setPlayerPose(poseClass) {
    if (!this.isGameActive) return;

    if (poseClass === "Left") this.player.lane = 0;
    else if (poseClass === "Center" || poseClass === "Neutral") this.player.lane = 1;
    else if (poseClass === "Right") this.player.lane = 2;
  }

  // 게임 루프 업데이트 (main.js에서 호출)
  update() {
    if (!this.isGameActive) return;

    // 1. 플레이어 이동 (부드럽게)
    const targetX = this.lanecenters[this.player.lane];
    const lerpSpeed = 0.2;
    this.player.x += (targetX - this.player.x) * lerpSpeed;

    // 2. 아이템 생성
    const now = Date.now();
    if (now - this.lastSpawnTime > this.spawnInterval) {
      this.spawnItem();
      this.lastSpawnTime = now;
    }

    // 3. 아이템 이동 및 충돌 검사
    for (let i = this.items.length - 1; i >= 0; i--) {
      let item = this.items[i];
      item.y += item.speed;

      // 바닥에 닿음 (놓침)
      if (item.y > this.height) {
        this.items.splice(i, 1);
        continue;
      }

      // 플레이어와 충돌 검사 (간단한 거리 기반 or 박스)
      if (
        item.y + 30 > this.player.y &&
        item.y < this.player.y + this.player.height &&
        Math.abs(item.x - this.player.x) < 50
      ) {
        this.handleCollision(item);
        this.items.splice(i, 1);
      }
    }

    // 4. 파티클(점수 효과) 업데이트
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.y -= 2; // 위로 떠오름
      p.life -= 0.02; // 투명도 감소

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  spawnItem() {
    const lane = Math.floor(Math.random() * 3);
    const typeRand = Math.random();

    let type = "apple";
    let sprite = "🍎";
    let score = 100;
    let speed = this.baseSpeed + (this.level * 0.5);

    if (typeRand < 0.2) { // 20% Bomb
      type = "bomb";
      sprite = "💣";
      score = 0;
      speed += 2; // 빠름
    } else if (typeRand < 0.5) { // 30% Banana
      type = "banana";
      sprite = "🍌";
      score = 200;
    } else if (typeRand < 0.7) { // 20% Orange
      type = "orange";
      sprite = "🍊";
      score = 300;
      speed += 1;
    }

    this.items.push({
      x: this.lanecenters[lane],
      y: -50,
      type: type,
      sprite: sprite,
      score: score,
      speed: speed
    });

    // 난이도 조절: 스폰 간격 감소
    this.spawnInterval = Math.max(500, 1500 - (this.level * 100));
  }

  handleCollision(item) {
    if (item.type === "bomb") {
      SoundManager.playBomb();
      this.gameOver();
    } else {
      this.score += item.score;
      SoundManager.playCoin();

      // 점수 효과 생성
      this.particles.push({
        x: this.player.x,
        y: this.player.y,
        text: `+${item.score}`,
        color: "#FFD700",
        life: 1.0
      });

      // 레벨업 (1000점 단위)
      if (Math.floor(this.score / 1000) + 1 > this.level) {
        this.level++;
        // 레벨업 효과?
      }

      if (this.onScoreChange) {
        this.onScoreChange(this.score, this.level, this.time);
      }
    }
  }

  gameOver() {
    this.isGameActive = false;
    clearInterval(this.timerInterval);

    if (this.onGameEnd) {
      this.onGameEnd(this.score, this.level);
    }
  }

  // 렌더링
  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. 배경 (간단한 하늘색 그라데이션)
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, "#87CEEB");
    gradient.addColorStop(1, "#E0F7FA");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. 레인 구분선
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 1; i < this.laneCount; i++) {
      const x = i * this.laneWidth;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    ctx.stroke();

    // 3. 플레이어 (바구니)
    ctx.font = "60px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.player.sprite, this.player.x, this.player.y + 30);

    // 히트박스 디버깅용 (주석 처리)
    // ctx.strokeStyle = "red";
    // ctx.strokeRect(this.player.x - 40, this.player.y, 80, 60);

    // 4. 아이템
    for (const item of this.items) {
      ctx.font = "50px Arial";
      ctx.fillText(item.sprite, item.x, item.y);
    }

    // 5. 파티클 (점수 효과)
    for (const p of this.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.font = "bold 30px Arial";
      ctx.strokeStyle = "black";
      ctx.lineWidth = 1;
      ctx.fillText(p.text, p.x, p.y);
      ctx.strokeText(p.text, p.x, p.y);
      ctx.globalAlpha = 1.0;
    }
  }
}
