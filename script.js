const statusDisplay = document.querySelector(".display__memory");
const expressionDisplay = document.querySelector(".display__expression");
const valueDisplay = document.querySelector(".display__value");
const buttons = document.querySelectorAll(".key");
const historyList = document.querySelector(".history-list");
const historyEmpty = document.querySelector(".history-panel__empty");
const clearHistoryButton = document.querySelector(".history-panel__clear");
const themeToggleButton = document.querySelector(".theme-toggle");
const themeToggleText = document.querySelector(".theme-toggle__text");

const operatorSymbols = {
  "+": "+",
  "-": "-",
  "*": "\u00D7",
  "/": "\u00F7",
};

const MAX_INPUT_LENGTH = 12;
const MAX_HISTORY_ITEMS = 12;
const HISTORY_STORAGE_KEY = "calculator-history";
const THEME_STORAGE_KEY = "calculator-theme";
const keyButtonMap = new Map();

const keyboardAliases = {
  Enter: "=",
  "=": "=",
  Escape: "C",
  Delete: "C",
  c: "C",
  C: "C",
  Backspace: "Backspace",
  "%": "%",
  ".": ".",
  ",": ".",
  "+": "+",
  "-": "-",
  "*": "*",
  x: "*",
  X: "*",
  "/": "/",
};

let historyEntries = loadHistory();

const state = {
  displayValue: "0",
  firstOperand: null,
  pendingOperator: null,
  awaitingSecondOperand: false,
  repeatOperator: null,
  repeatOperand: null,
  status: "READY",
};

function clearAll(shouldRender = true) {
  state.displayValue = "0";
  state.firstOperand = null;
  state.pendingOperator = null;
  state.awaitingSecondOperand = false;
  state.repeatOperator = null;
  state.repeatOperand = null;
  state.status = "READY";

  if (shouldRender) {
    updateDisplay();
  }
}

function loadTheme() {
  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }
  } catch {
    // Ignore storage failures and use the fallback theme.
  }

  return "dark";
}

function saveTheme(theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures so the toggle still works for the current session.
  }
}

function applyTheme(theme) {
  const normalizedTheme = theme === "dark" ? "dark" : "light";
  const isDark = normalizedTheme === "dark";

  document.body.dataset.theme = normalizedTheme;
  themeToggleButton.setAttribute("aria-pressed", String(isDark));
  themeToggleText.textContent = isDark ? "Dark" : "Light";
}

function toggleTheme() {
  const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";

  applyTheme(nextTheme);
  saveTheme(nextTheme);
}

function normalizeButtonValue(button) {
  return button.dataset.value || button.textContent.trim();
}

function buildKeyButtonMap() {
  buttons.forEach((button) => {
    keyButtonMap.set(normalizeButtonValue(button), button);
  });

  keyButtonMap.set("Backspace", keyButtonMap.get("C"));
}

function loadHistory() {
  try {
    const savedHistory = window.localStorage.getItem(HISTORY_STORAGE_KEY);

    if (!savedHistory) {
      return [];
    }

    const parsedHistory = JSON.parse(savedHistory);

    if (!Array.isArray(parsedHistory)) {
      return [];
    }

    return parsedHistory
      .filter((entry) => entry && typeof entry.expression === "string" && typeof entry.result === "string")
      .slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyEntries));
  } catch {
    // Ignore storage failures so the calculator remains usable.
  }
}

function renderHistory() {
  historyList.textContent = "";

  if (historyEntries.length === 0) {
    historyEmpty.hidden = false;
    clearHistoryButton.disabled = true;
    return;
  }

  historyEmpty.hidden = true;
  clearHistoryButton.disabled = false;

  historyEntries.forEach((entry) => {
    const item = document.createElement("li");
    const expression = document.createElement("p");
    const result = document.createElement("p");

    item.className = "history-item";
    expression.className = "history-item__expression";
    result.className = "history-item__result";

    expression.textContent = entry.expression;
    result.textContent = `= ${entry.result}`;

    item.append(expression, result);
    historyList.append(item);
  });
}

function addHistoryEntry(expression, result) {
  historyEntries.unshift({ expression, result });
  historyEntries = historyEntries.slice(0, MAX_HISTORY_ITEMS);
  saveHistory();
  renderHistory();
}

function clearHistory() {
  historyEntries = [];
  saveHistory();
  renderHistory();
}

function roundResult(value) {
  return Math.round((value + Number.EPSILON) * 10000000000) / 10000000000;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "Error";
  }

  const rounded = roundResult(value);

  if (Object.is(rounded, -0)) {
    return "0";
  }

  const absoluteValue = Math.abs(rounded);

  if (absoluteValue >= 1000000000000 || (absoluteValue > 0 && absoluteValue < 0.000000001)) {
    return rounded.toExponential(6).replace(/\.?0+e/, "e");
  }

  return String(rounded);
}

function getExpressionText() {
  if (state.pendingOperator !== null && state.firstOperand !== null) {
    const firstValue = formatNumber(state.firstOperand);
    const operator = operatorSymbols[state.pendingOperator];

    if (state.awaitingSecondOperand) {
      return `${firstValue} ${operator}`;
    }

    return `${firstValue} ${operator} ${state.displayValue}`;
  }

  return state.displayValue;
}

function setError(message) {
  state.displayValue = "Error";
  state.firstOperand = null;
  state.pendingOperator = null;
  state.awaitingSecondOperand = false;
  state.repeatOperator = null;
  state.repeatOperand = null;
  state.status = "ERROR";

  expressionDisplay.textContent = message;
  valueDisplay.textContent = state.displayValue;
  statusDisplay.textContent = state.status;
  syncActiveOperator();
}

function updateDisplay() {
  statusDisplay.textContent = state.status;
  expressionDisplay.textContent = getExpressionText();
  valueDisplay.textContent = state.displayValue;
  syncActiveOperator();
}

function syncActiveOperator() {
  buttons.forEach((button) => {
    const normalizedOperator = normalizeButtonValue(button);
    const isActive = state.pendingOperator === normalizedOperator && state.awaitingSecondOperand;

    button.classList.toggle("is-active", isActive);
  });
}

function setPressedKeyVisual(value, isPressed) {
  const button = keyButtonMap.get(value);

  if (!button) {
    return;
  }

  button.classList.toggle("is-pressed", isPressed);
}

function normalizeKeyboardValue(event) {
  if (/^Digit\d$/.test(event.code) || /^Numpad\d$/.test(event.code)) {
    return event.key;
  }

  if (event.code === "NumpadDecimal") {
    return ".";
  }

  return keyboardAliases[event.key] || null;
}

function beginNewEntryIfNeeded() {
  if (state.status === "RESULT" && state.pendingOperator === null) {
    clearAll(false);
  }

  if (state.status === "ERROR") {
    clearAll(false);
  }
}

function inputDigit(digit) {
  beginNewEntryIfNeeded();

  if (state.awaitingSecondOperand) {
    state.displayValue = digit;
    state.awaitingSecondOperand = false;
  } else if (state.displayValue === "0") {
    state.displayValue = digit;
  } else if (state.displayValue.replace("-", "").replace(".", "").length < MAX_INPUT_LENGTH) {
    state.displayValue += digit;
  }

  state.status = "INPUT";
  updateDisplay();
}

function inputDecimal() {
  beginNewEntryIfNeeded();

  if (state.awaitingSecondOperand) {
    state.displayValue = "0.";
    state.awaitingSecondOperand = false;
  } else if (!state.displayValue.includes(".")) {
    state.displayValue += ".";
  }

  state.status = "INPUT";
  updateDisplay();
}

function performCalculation(leftOperand, rightOperand, operator) {
  if (operator === "/" && rightOperand === 0) {
    setError("Cannot divide by zero");
    return null;
  }

  switch (operator) {
    case "+":
      return roundResult(leftOperand + rightOperand);
    case "-":
      return roundResult(leftOperand - rightOperand);
    case "*":
      return roundResult(leftOperand * rightOperand);
    case "/":
      return roundResult(leftOperand / rightOperand);
    default:
      return rightOperand;
  }
}

function chooseOperator(nextOperator) {
  if (state.status === "ERROR") {
    return;
  }

  const inputValue = Number(state.displayValue);

  if (state.pendingOperator !== null && state.awaitingSecondOperand) {
    state.pendingOperator = nextOperator;
    updateDisplay();
    return;
  }

  if (state.firstOperand === null) {
    state.firstOperand = inputValue;
  } else if (state.pendingOperator !== null) {
    const result = performCalculation(state.firstOperand, inputValue, state.pendingOperator);

    if (result === null) {
      return;
    }

    state.displayValue = formatNumber(result);
    state.firstOperand = result;
  } else {
    state.firstOperand = inputValue;
  }

  state.pendingOperator = nextOperator;
  state.awaitingSecondOperand = true;
  state.repeatOperator = null;
  state.repeatOperand = null;
  state.status = "OPERATOR";
  updateDisplay();
}

function handleEquals() {
  if (state.status === "ERROR") {
    clearAll();
    return;
  }

  if (state.pendingOperator !== null) {
    const secondOperand = state.awaitingSecondOperand ? state.firstOperand : Number(state.displayValue);
    const firstDisplay = formatNumber(state.firstOperand);
    const secondDisplay = formatNumber(secondOperand);
    const operator = state.pendingOperator;
    const historyExpression = `${firstDisplay} ${operatorSymbols[operator]} ${secondDisplay}`;
    const result = performCalculation(state.firstOperand, secondOperand, operator);

    if (result === null) {
      return;
    }

    state.displayValue = formatNumber(result);
    state.firstOperand = null;
    state.pendingOperator = null;
    state.awaitingSecondOperand = false;
    state.repeatOperator = operator;
    state.repeatOperand = secondOperand;
    state.status = "RESULT";

    expressionDisplay.textContent = historyExpression;
    valueDisplay.textContent = state.displayValue;
    statusDisplay.textContent = state.status;
    syncActiveOperator();
    addHistoryEntry(historyExpression, state.displayValue);
    return;
  }

  if (state.repeatOperator !== null && state.repeatOperand !== null) {
    const currentValue = Number(state.displayValue);
    const historyExpression =
      `${formatNumber(currentValue)} ${operatorSymbols[state.repeatOperator]} ${formatNumber(state.repeatOperand)}`;
    const result = performCalculation(currentValue, state.repeatOperand, state.repeatOperator);

    if (result === null) {
      return;
    }

    expressionDisplay.textContent = historyExpression;
    state.displayValue = formatNumber(result);
    state.status = "RESULT";
    valueDisplay.textContent = state.displayValue;
    statusDisplay.textContent = state.status;
    syncActiveOperator();
    addHistoryEntry(historyExpression, state.displayValue);
    return;
  }

  state.status = "RESULT";
  updateDisplay();
}

function toggleSign() {
  if (state.status === "ERROR" || state.awaitingSecondOperand) {
    return;
  }

  const currentValue = Number(state.displayValue);

  if (currentValue === 0) {
    return;
  }

  state.displayValue = formatNumber(currentValue * -1);
  state.repeatOperator = null;
  state.repeatOperand = null;
  state.status = "INPUT";
  updateDisplay();
}

function convertToPercent() {
  if (state.status === "ERROR" || state.awaitingSecondOperand) {
    return;
  }

  state.displayValue = formatNumber(Number(state.displayValue) / 100);
  state.repeatOperator = null;
  state.repeatOperand = null;
  state.status = "INPUT";
  updateDisplay();
}

function deleteLastDigit() {
  if (state.status === "ERROR") {
    clearAll();
    return;
  }

  if (state.awaitingSecondOperand || state.status === "RESULT") {
    return;
  }

  if (state.displayValue.length === 1 || (state.displayValue.startsWith("-") && state.displayValue.length === 2)) {
    state.displayValue = "0";
  } else {
    state.displayValue = state.displayValue.slice(0, -1);
  }

  state.status = "INPUT";
  updateDisplay();
}

function handleButtonClick(value) {
  if (/^\d$/.test(value)) {
    inputDigit(value);
    return;
  }

  if (value === ".") {
    inputDecimal();
    return;
  }

  if (value === "C") {
    clearAll();
    return;
  }

  if (value === "=") {
    handleEquals();
    return;
  }

  if (value === "+/-") {
    toggleSign();
    return;
  }

  if (value === "%") {
    convertToPercent();
    return;
  }

  if (value === "Backspace") {
    deleteLastDigit();
    return;
  }

  if (value === "+" || value === "-" || value === "*" || value === "/") {
    chooseOperator(value);
  }
}

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    handleButtonClick(normalizeButtonValue(button));
  });
});

buildKeyButtonMap();
clearHistoryButton.addEventListener("click", clearHistory);
themeToggleButton.addEventListener("click", toggleTheme);

document.addEventListener("keydown", (event) => {
  const normalizedValue = normalizeKeyboardValue(event);

  if (normalizedValue === null) {
    return;
  }

  event.preventDefault();
  setPressedKeyVisual(normalizedValue, true);

  if (event.repeat && normalizedValue === "=") {
    return;
  }

  handleButtonClick(normalizedValue);
});

document.addEventListener("keyup", (event) => {
  const normalizedValue = normalizeKeyboardValue(event);

  if (normalizedValue === null) {
    return;
  }

  setPressedKeyVisual(normalizedValue, false);
});

window.addEventListener("blur", () => {
  buttons.forEach((button) => {
    button.classList.remove("is-pressed");
  });
});

applyTheme(loadTheme());
renderHistory();
updateDisplay();
