/**
 * main.js
 * 포즈 인식과 게임 로직을 초기화하고 서로 연결하는 진입점
 */

let poseEngine;
let gameEngine;
let stabilizer;
let webcamCtx;
let gameCtx;
let labelContainer;

/**
 * 애플리케이션 초기화 (카메라 시작)
 */
async function init() {
  const startBtn = document.getElementById("startBtn");
  const gameStartBtn = document.getElementById("gameStartBtn");
  
  startBtn.disabled = true;
  document.getElementById("max-prediction").innerText = "Loading Model...";

  try {
    // 1. PoseEngine 초기화
    poseEngine = new PoseEngine("./my_model/");
    const { maxPredictions, webcam } = await poseEngine.init({
      size: 200,
      flip: true
    });

    // 2. Stabilizer 초기화
    stabilizer = new PredictionStabilizer({
      threshold: 0.8, // 반응성 조절
      smoothingFrames: 5
    });

    // 3. Webcam Canvas 설정
    const webcamCanvas = document.getElementById("webcam-canvas");
    webcamCtx = webcamCanvas.getContext("2d");
    
    // 4. GameEngine 초기화
    const gameCanvas = document.getElementById("game-canvas");
    gameCtx = gameCanvas.getContext("2d");
    gameEngine = new GameEngine(gameCtx, gameCanvas.width, gameCanvas.height);
    
    // UI 업데이트 연결
    gameEngine.onScoreChange = updateHUD;
    gameEngine.onGameEnd = handleGameEnd;

    // 5. Label Container 설정
    labelContainer = document.getElementById("label-container");
    labelContainer.innerHTML = "";
    for (let i = 0; i < maxPredictions; i++) {
        const div = document.createElement("div");
        div.style.display = "flex";
        div.style.justifyContent = "space-between";
        labelContainer.appendChild(div);
    }

    // 6. PoseEngine 콜백 설정
    poseEngine.setPredictionCallback(handlePrediction);
    poseEngine.setDrawCallback(drawWebcam);

    // 7. PoseEngine 시작
    poseEngine.start();
    
    // 8. 게임 루프 시작 (렌더링용)
    requestAnimationFrame(gameLoop);

    document.getElementById("max-prediction").innerText = "Ready";
    document.getElementById("stopBtn").disabled = false;
    gameStartBtn.disabled = false;

  } catch (error) {
    console.error("초기화 오류:", error);
    alert("카메라나 모델을 로드할 수 없습니다.");
    startBtn.disabled = false;
  }
}

/**
 * 게임 시작 버튼 클릭 시
 */
function startGame() {
    if (!gameEngine) return;
    
    document.getElementById("gameStartBtn").disabled = true;
    document.getElementById("restartBtn").onclick = restartGame;
    document.getElementById("message-overlay").classList.add("hidden");
    
    // 게임 시작 (Fruit Catcher 모드)
    gameEngine.start();
}

/**
 * 게임 재시작
 */
function restartGame() {
    document.getElementById("message-overlay").classList.add("hidden");
    gameEngine.start();
}

/**
 * 애플리케이션 중지
 */
function stop() {
  if (poseEngine) poseEngine.stop();
  if (gameEngine) gameEngine.stop();
  
  document.getElementById("startBtn").disabled = false;
  document.getElementById("gameStartBtn").disabled = true;
  document.getElementById("stopBtn").disabled = true;
  document.getElementById("max-prediction").innerText = "Stopped";
}

/**
 * 게임 렌더링 루프
 */
function gameLoop() {
    if (gameEngine) {
        gameEngine.update();
        gameEngine.draw();
    }
    requestAnimationFrame(gameLoop);
}

/**
 * 예측 결과 처리 (PoseEngine -> Main -> GameEngine)
 */
function handlePrediction(predictions, pose) {
  // 1. 안정화
  const stabilized = stabilizer.stabilize(predictions);
  
  // 2. UI 업데이트
  for (let i = 0; i < predictions.length; i++) {
    const classPrediction = `<span>${predictions[i].className}</span> <span>${(predictions[i].probability * 100).toFixed(0)}%</span>`;
    labelContainer.childNodes[i].innerHTML = classPrediction;
  }
  
  const maxClass = stabilized.className || "";
  document.getElementById("max-prediction").innerText = maxClass;

  // 3. 게임 엔진에 전달
  if (gameEngine && maxClass) {
      gameEngine.setPlayerPose(maxClass);
  }
}

/**
 * 웹캠 그리기 (PoseEngine -> Main)
 */
function drawWebcam(pose) {
  if (poseEngine.webcam && poseEngine.webcam.canvas) {
    webcamCtx.drawImage(poseEngine.webcam.canvas, 0, 0, 200, 200);

    // 스켈레톤 그리기
    if (pose) {
      const minPartConfidence = 0.5;
      tmPose.drawKeypoints(pose.keypoints, minPartConfidence, webcamCtx);
      tmPose.drawSkeleton(pose.keypoints, minPartConfidence, webcamCtx);
    }
  }
}

/**
 * HUD 업데이트
 */
function updateHUD(score, level, time) {
    document.getElementById("score-display").innerText = score;
    document.getElementById("level-display").innerText = level;
    document.getElementById("time-display").innerText = time;
}

/**
 * 게임 종료 처리
 */
function handleGameEnd(score, level) {
    document.getElementById("message-title").innerText = "Game Over!";
    document.getElementById("message-score").innerText = `Final Score: ${score}`;
    document.getElementById("message-overlay").classList.remove("hidden");
    document.getElementById("gameStartBtn").disabled = false;
}

