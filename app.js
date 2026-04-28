const STORAGE_KEY = "wedding-quest-user";
const LEADERBOARD_KEY = "wedding-quest-leaderboard";
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz_e1YHpRILFKX9sgBvpgnt2a6rv5HoWhiH3bUiD_3djdYvSXKBnuvd95TEDChirYs/exec";

const defaultQuestions = [
  {
    id: "q1",
    order: 1,
    title: "運命の対局場所",
    type: "choice",
    options: ["A棟303", "B棟102", "C棟204", "D棟308"],
    correctAnswer: "C棟204",
    hintLocation: "会場内の『田代君』を探せ！",
  },
  {
    id: "q2",
    order: 2,
    title: "思い出の写真スポット",
    type: "choice",
    options: ["ガーデン", "ロビー", "テラス", "バルコニー"],
    correctAnswer: "ガーデン",
    hintLocation: "受付横の装花の近くを見てみよう",
  },
  {
    id: "q3",
    order: 3,
    title: "未来への羅針盤",
    type: "choice",
    options: ["北", "東", "南", "西"],
    correctAnswer: "南",
    hintLocation: "スクリーン脇の案内板を確認しよう",
  },
  {
    id: "q4",
    order: 4,
    title: "二人をつないだ言葉",
    type: "choice",
    options: ["ありがとう", "おめでとう", "よろしく", "だいすき"],
    correctAnswer: "ありがとう",
    hintLocation: "新郎新婦席の周辺を探そう",
  },
  {
    id: "q5",
    order: 5,
    title: "航海図の秘密",
    type: "choice",
    options: ["A", "B", "C", "D"],
    correctAnswer: "B",
    hintLocation: "テーブル中央の装飾を見よう",
  },
  {
    id: "q6",
    order: 6,
    title: "約束の場所",
    type: "choice",
    options: ["チャペル", "控室", "会場入口", "親族席"],
    correctAnswer: "チャペル",
    hintLocation: "会場入口から見えるサインを探そう",
  },
  {
    id: "q7",
    order: 7,
    title: "光る海図",
    type: "choice",
    options: ["右", "左", "上", "下"],
    correctAnswer: "右",
    hintLocation: "照明が当たっている掲示物を確認しよう",
  },
  {
    id: "q8",
    order: 8,
    title: "祝いの合図",
    type: "choice",
    options: ["拍手", "乾杯", "歓声", "笑顔"],
    correctAnswer: "拍手",
    hintLocation: "会場全体の雰囲気に注目しよう",
  },
  {
    id: "q9",
    order: 9,
    title: "最後の暗号",
    type: "choice",
    options: ["赤", "青", "金", "白"],
    correctAnswer: "金",
    hintLocation: "テーブルナンバーの近くを探そう",
  },
  {
    id: "q10",
    order: 10,
    title: "未来の航路",
    type: "choice",
    options: ["しあわせ", "希望", "絆", "航海"],
    correctAnswer: "しあわせ",
    hintLocation: "会場の中央で二人を祝福しよう",
  },
];

const state = {
  user: null,
  questions: defaultQuestions,
  activeIndex: 0,
  leaderboard: loadLeaderboard(),
  selectedAnswer: "",
  startedAt: null,
  elapsedTimer: null,
};

const elements = {
  welcomeScreen: document.getElementById("welcomeScreen"),
  gameScreen: document.getElementById("gameScreen"),
  resultScreen: document.getElementById("resultScreen"),
  adminScreen: document.getElementById("adminScreen"),
  userNameInput: document.getElementById("userNameInput"),
  startButton: document.getElementById("startButton"),
  adminButton: document.getElementById("adminButton"),
  closeAdminButton: document.getElementById("closeAdminButton"),
  resetButton: document.getElementById("resetButton"),
  playerName: document.getElementById("playerName"),
  progressText: document.getElementById("progressText"),
  elapsedText: document.getElementById("elapsedText"),
  questionTitle: document.getElementById("questionTitle"),
  hintText: document.getElementById("hintText"),
  choiceArea: document.getElementById("choiceArea"),
  nextButton: document.getElementById("nextButton"),
  resultNickname: document.getElementById("resultNickname"),
  finalScore: document.getElementById("finalScore"),
  adminLeaderboard: document.getElementById("adminLeaderboard"),
  heatmap: document.getElementById("heatmap"),
};

function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLeaderboard() {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(state.leaderboard));
}

function isRemoteStorageConfigured() {
  return Boolean(GAS_WEB_APP_URL.trim());
}

function normalizeLeaderboard(list) {
  return Array.isArray(list) ? list : [];
}

function upsertLeaderboardRecord(list, record) {
  const nextList = [...list];
  const index = nextList.findIndex((player) => player.userId === record.userId);
  if (index >= 0) {
    nextList[index] = record;
  } else {
    nextList.push(record);
  }
  return nextList;
}

function fetchRemoteLeaderboard() {
  if (!isRemoteStorageConfigured()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const callbackName = `leaderboardCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, 8000);

    function cleanup() {
      window.clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (payload) => {
      cleanup();
      resolve(normalizeLeaderboard(payload?.leaderboard));
    };

    const script = document.createElement("script");
    script.src = `${GAS_WEB_APP_URL}?action=leaderboard&callback=${callbackName}&_=${Date.now()}`;
    script.onerror = () => {
      cleanup();
      resolve(null);
    };
    document.body.appendChild(script);
  });
}

function syncLeaderboardFromRemote() {
  return fetchRemoteLeaderboard().then((remoteLeaderboard) => {
    if (!remoteLeaderboard) {
      return null;
    }

    state.leaderboard = sortLeaderboard(remoteLeaderboard);
    saveLeaderboard();
    return state.leaderboard;
  });
}

function submitResultToRemote(record) {
  if (!isRemoteStorageConfigured()) {
    return Promise.resolve(false);
  }

  return fetch(GAS_WEB_APP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
    },
    body: JSON.stringify({
      action: "saveResult",
      record,
    }),
  })
    .then(() => true)
    .catch(() => false);
}

function loadUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveUser() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.user));
}

function createUser(name) {
  const now = new Date().toISOString();
  return {
    userId: crypto.randomUUID(),
    userName: name,
    startTime: now,
    endTime: null,
    totalScore: 0,
    answers: {},
  };
}

function formatElapsed(startIso, endIso = Date.now()) {
  const start = new Date(startIso).getTime();
  const end = typeof endIso === "string" ? new Date(endIso).getTime() : endIso;
  const diff = Math.max(0, end - start);
  const totalSeconds = Math.floor(diff / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function isAnswerCorrect(question, answer) {
  return question.correctAnswer.toLowerCase() === answer.trim().toLowerCase();
}

function currentQuestion() {
  return state.questions[state.activeIndex];
}

function renderQuestionDetail() {
  const question = currentQuestion();
  elements.questionTitle.textContent = `Q${question.order}. ${question.title}`;
  elements.hintText.textContent = `ヒント: ${question.hintLocation}`;

  elements.choiceArea.innerHTML = "";

  if (question.type === "choice") {
    question.options.forEach((option) => {
      const button = document.createElement("button");
      button.className = `choice-option ${state.selectedAnswer === option ? "selected" : ""}`;
      button.textContent = option;
      button.addEventListener("click", () => {
        state.selectedAnswer = option;
        renderQuestionDetail();
      });
      elements.choiceArea.appendChild(button);
    });
  }

  elements.progressText.textContent = `Q${question.order} / Q${state.questions.length}`;
  elements.nextButton.textContent = question.order === state.questions.length ? "完了" : "次へ";
}

function renderLeaderboard(target, list) {
  target.innerHTML = "";
  list.slice(0, 10).forEach((player, index) => {
    const item = document.createElement("div");
    item.className = "leaderboard-item";
    item.innerHTML = `
      <strong>#${index + 1}</strong>
      <span>${player.userName}</span>
      <span>${player.totalScore}問正解</span>
      <span>${formatElapsed(player.startTime, player.endTime)}</span>
    `;
    target.appendChild(item);
  });
}

function renderHeatmap() {
  const counts = state.questions.map((question) => {
    return state.leaderboard.reduce((total, player) => {
      return total + (player.answers?.[question.id] ? 1 : 0);
    }, 0);
  });
  const max = Math.max(1, ...counts);
  elements.heatmap.innerHTML = "";
  state.questions.forEach((question, index) => {
    const cell = document.createElement("div");
    const rate = counts[index] / max;
    cell.className = `heat-cell ${rate > 0.65 ? "hot" : counts[index] > 0 ? "done" : ""}`;
    cell.innerHTML = `<strong>Q${question.order}</strong><span>${counts[index]}人</span>`;
    elements.heatmap.appendChild(cell);
  });
}

function sortLeaderboard(list = state.leaderboard) {
  return [...list].sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    const aEnd = new Date(a.endTime).getTime();
    const bEnd = new Date(b.endTime).getTime();
    return aEnd - bEnd;
  });
}

function render() {
  const hasUser = Boolean(state.user);
  elements.welcomeScreen.classList.toggle("hidden", hasUser);
  elements.gameScreen.classList.toggle("hidden", !hasUser);
  elements.resultScreen.classList.add("hidden");
  elements.adminScreen.classList.add("hidden");

  if (!hasUser) {
    return;
  }

  elements.playerName.textContent = state.user.userName;
  renderQuestionDetail();
  renderLeaderboard(elements.adminLeaderboard, sortLeaderboard());
  renderHeatmap();
}

function updateElapsed() {
  if (!state.user?.startTime || state.user?.endTime) {
    return;
  }
  elements.elapsedText.textContent = formatElapsed(state.user.startTime);
}

function commitAnswer(status) {
  const question = currentQuestion();
  if (!question || !state.user) {
    return;
  }

  const answerValue = state.selectedAnswer;
  if (answerValue && isAnswerCorrect(question, answerValue)) {
    state.user.answers[question.id] = {
      answer: answerValue,
      time: new Date().toISOString(),
      correct: true,
    };
    state.user.totalScore += 1;
  } else {
    state.user.answers[question.id] = {
      answer: answerValue,
      time: new Date().toISOString(),
      correct: false,
    };
  }

  state.user.endTime = question.order === state.questions.length ? new Date().toISOString() : state.user.endTime;
  saveUser();
  state.selectedAnswer = "";

  if (question.order === state.questions.length) {
    finishGame();
    return;
  }

  state.activeIndex += 1;
  render();
}

function finishGame() {
  const record = {
    ...state.user,
    endTime: new Date().toISOString(),
    savedAt: new Date().toISOString(),
  };

  state.leaderboard = sortLeaderboard(upsertLeaderboardRecord(state.leaderboard, record));
  saveLeaderboard();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  state.user = record;

  elements.resultNickname.textContent = record.userName;
  elements.finalScore.textContent = `${record.totalScore} / ${state.questions.length}`;

  elements.gameScreen.classList.add("hidden");
  elements.resultScreen.classList.remove("hidden");
  elements.elapsedText.textContent = formatElapsed(record.startTime, record.endTime);
  renderHeatmap();

  void submitResultToRemote(record).then(() => {
    return syncLeaderboardFromRemote().then(() => {
      if (!elements.adminScreen.classList.contains("hidden")) {
        renderLeaderboard(elements.adminLeaderboard, sortLeaderboard());
        renderHeatmap();
      }
    });
  });
}

function openAdmin() {
  elements.welcomeScreen.classList.add("hidden");
  elements.gameScreen.classList.add("hidden");
  elements.resultScreen.classList.add("hidden");
  elements.adminScreen.classList.remove("hidden");
  renderLeaderboard(elements.adminLeaderboard, sortLeaderboard());
  renderHeatmap();
  void syncLeaderboardFromRemote().then(() => {
    renderLeaderboard(elements.adminLeaderboard, sortLeaderboard());
    renderHeatmap();
  });
}

function startGame() {
  const name = elements.userNameInput.value.trim();
  if (!name) {
    alert("ニックネームを入力してください。");
    return;
  }

  state.user = loadUser();
  if (!state.user || state.user.userName !== name) {
    state.user = createUser(name);
  }
  state.user.userName = name;
  state.startedAt = state.user.startTime;
  saveUser();
  state.activeIndex = Math.min(state.activeIndex, state.questions.length - 1);
  render();
  updateElapsed();
}

function resetGame() {
  state.user = null;
  state.activeIndex = 0;
  state.selectedAnswer = "";
  localStorage.removeItem(STORAGE_KEY);
  render();
}

function init() {
  const savedUser = loadUser();
  if (savedUser?.userName) {
    elements.userNameInput.value = savedUser.userName;
    state.user = savedUser;
    state.activeIndex = Math.min(Object.keys(savedUser.answers || {}).length, state.questions.length - 1);
    if (savedUser.endTime) {
      state.leaderboard = sortLeaderboard();
    }
  }

  render();
  updateElapsed();
  state.elapsedTimer = window.setInterval(updateElapsed, 1000);
  void syncLeaderboardFromRemote().then(() => {
    if (!elements.adminScreen.classList.contains("hidden")) {
      renderLeaderboard(elements.adminLeaderboard, sortLeaderboard());
      renderHeatmap();
    }
  });
}

elements.startButton.addEventListener("click", startGame);
elements.adminButton.addEventListener("click", openAdmin);
elements.closeAdminButton.addEventListener("click", render);
elements.resetButton.addEventListener("click", resetGame);
elements.nextButton.addEventListener("click", () => {
  const question = currentQuestion();
  if (!question || !state.user) {
    return;
  }

  const answerValue = state.selectedAnswer;
  if (answerValue && isAnswerCorrect(question, answerValue)) {
    state.user.answers[question.id] = {
      answer: answerValue,
      time: new Date().toISOString(),
      correct: true,
    };
    state.user.totalScore += 1;
  } else {
    state.user.answers[question.id] = {
      answer: answerValue,
      time: new Date().toISOString(),
      correct: false,
    };
  }
  state.user.endTime = question.order === state.questions.length ? new Date().toISOString() : state.user.endTime;
  saveUser();
  state.selectedAnswer = "";

  if (question.order === state.questions.length) {
    finishGame();
    return;
  }

  state.activeIndex += 1;
  render();
});

elements.userNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    startGame();
  }
});

init();
