const stage = document.querySelector("#stage");
const stateLabel = document.querySelector("#stateLabel");
const headline = document.querySelector("#headline");
const message = document.querySelector("#message");
const actionButton = document.querySelector("#actionButton");
const lastTimeEl = document.querySelector("#lastTime");
const bestTimeEl = document.querySelector("#bestTime");
const averageTimeEl = document.querySelector("#averageTime");
const attemptsEl = document.querySelector("#attempts");
const clearButton = document.querySelector("#clearButton");
const saveButton = document.querySelector("#saveButton");
const saveStatus = document.querySelector("#saveStatus");

const bestKey = "reaction-click-best-v2";
const historyKey = "reaction-click-history-v2";

let state = "idle";
let signalTimer = 0;
let signalAt = 0;
let suppressNextClick = false;
let attempts = JSON.parse(localStorage.getItem(historyKey) || "[]");
let best = Number(localStorage.getItem(bestKey) || 0);

function setStage(nextState) {
  state = nextState;
  stage.className = "reaction-stage is-" + nextState;
}

function formatTime(value) {
  return value ? Math.round(value) + " ms" : "--";
}

function saveStats() {
  localStorage.setItem(historyKey, JSON.stringify(attempts));
  if (best) localStorage.setItem(bestKey, String(best));
  else localStorage.removeItem(bestKey);
}

function updateStats() {
  const average = attempts.length
    ? attempts.reduce((total, value) => total + value, 0) / attempts.length
    : 0;

  lastTimeEl.textContent = formatTime(attempts[0]);
  bestTimeEl.textContent = formatTime(best);
  averageTimeEl.textContent = formatTime(average);
  attemptsEl.innerHTML = attempts
    .slice(0, 8)
    .map((value) => `<span class="attempt">${Math.round(value)} ms</span>`)
    .join("");
}

function clearHistory() {
  attempts = [];
  best = 0;
  saveStats();
  updateStats();
  saveStatus.textContent = "History cleared.";
}

function buildMarkdown() {
  const average = attempts.length
    ? attempts.reduce((total, value) => total + value, 0) / attempts.length
    : 0;
  const lines = [
    "# Reaction Click Test Records",
    "",
    "- Records: " + attempts.length,
    "- Best: " + formatTime(best),
    "- Average: " + formatTime(average),
    "- Saved: " + new Date().toLocaleString(),
    "",
    "| Attempt | Reaction Time |",
    "| --- | ---: |",
  ];

  attempts.forEach((value, index) => {
    lines.push("| " + (index + 1) + " | " + Math.round(value) + " ms |");
  });

  return lines.join("\n") + "\n";
}

function cleanFilename(name) {
  const cleaned = name.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").replace(/\.+$/g, "");
  if (!cleaned) return "";
  return cleaned.toLowerCase().endsWith(".md") ? cleaned : cleaned + ".md";
}

async function saveRecords() {
  if (!attempts.length) {
    saveStatus.textContent = "No records to save yet.";
    return;
  }

  const input = window.prompt("Name the markdown file:", "reaction-records.md");
  if (input === null) return;

  const filename = cleanFilename(input);
  if (!filename) {
    saveStatus.textContent = "Please enter a valid filename.";
    return;
  }

  const markdown = buildMarkdown();
  try {
    const response = await fetch("/save-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, markdown }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not save file.");
    saveStatus.textContent = "Saved " + result.filename + " in this folder.";
  } catch (error) {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    saveStatus.textContent = "Downloaded " + filename + ".";
  }
}

function startRound() {
  clearTimeout(signalTimer);
  setStage("waiting");
  stateLabel.textContent = "Get Ready";
  headline.textContent = "Wait";
  message.textContent = "The screen is green. Do not click until it turns red.";
  actionButton.textContent = "Waiting";

  const delay = Math.random() * 3500 + 1500;
  signalTimer = window.setTimeout(showSignal, delay);
}

function showSignal() {
  setStage("signal");
  signalAt = performance.now();
  stateLabel.textContent = "Click Now";
  headline.textContent = "STOP";
  message.textContent = "Click anywhere or press the button.";
  actionButton.textContent = "Stop";
}

function recordReaction() {
  const reactionTime = performance.now() - signalAt;
  attempts.unshift(reactionTime);
  attempts = attempts.slice(0, 20);
  best = best ? Math.min(best, reactionTime) : reactionTime;
  saveStats();
  updateStats();

  setStage("result");
  stateLabel.textContent = "Reaction Time";
  headline.textContent = Math.round(reactionTime) + " ms";
  message.textContent = reactionMessage(reactionTime);
  actionButton.textContent = "Try Again";
}

function handleEarlyClick() {
  clearTimeout(signalTimer);
  setStage("early");
  stateLabel.textContent = "Too Soon";
  headline.textContent = "False Start";
  message.textContent = "You clicked before red. Reset and wait for the signal.";
  actionButton.textContent = "Try Again";
}

function reactionMessage(ms) {
  if (ms < 180) return "Very sharp. That was a seriously quick click.";
  if (ms < 250) return "Nice reaction. You are comfortably faster than average.";
  if (ms < 330) return "Solid. A little anticipation and you can shave more off.";
  return "Logged. Take a breath and chase the next one.";
}

function handlePressAction() {
  if (state === "waiting") {
    suppressNextClick = true;
    handleEarlyClick();
    return;
  }

  if (state === "signal") {
    suppressNextClick = true;
    recordReaction();
  }
}

function handleClickAction() {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  if (state === "waiting" || state === "signal") return;
  startRound();
}

actionButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  handlePressAction();
});

actionButton.addEventListener("click", (event) => {
  event.stopPropagation();
  handleClickAction();
});

stage.addEventListener("pointerdown", handlePressAction);
stage.addEventListener("click", handleClickAction);
clearButton.addEventListener("click", clearHistory);
saveButton.addEventListener("click", saveRecords);

window.addEventListener("keydown", (event) => {
  if (event.code !== "Space" && event.code !== "Enter") return;
  event.preventDefault();
  if (state === "waiting" || state === "signal") {
    handlePressAction();
  } else {
    handleClickAction();
  }
});

updateStats();
