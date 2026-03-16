const statusDisplay = document.querySelector(".display__memory");
const expressionDisplay = document.querySelector(".display__expression");
const valueDisplay = document.querySelector(".display__value");
const buttons = document.querySelectorAll(".key");

const operatorSymbols = {
  "+": "+",
  "-": "-",
  "*": "\u00D7",
  "/": "\u00F7",
};

const MAX_INPUT_LENGTH = 12;

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
    const normalizedOperator = button.dataset.value || button.textContent.trim();
    const isActive = state.pendingOperator === normalizedOperator && state.awaitingSecondOperand;

    button.classList.toggle("is-active", isActive);
  });
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

    expressionDisplay.textContent = `${firstDisplay} ${operatorSymbols[operator]} ${secondDisplay}`;
    valueDisplay.textContent = state.displayValue;
    statusDisplay.textContent = state.status;
    syncActiveOperator();
    return;
  }

  if (state.repeatOperator !== null && state.repeatOperand !== null) {
    const currentValue = Number(state.displayValue);
    const result = performCalculation(currentValue, state.repeatOperand, state.repeatOperator);

    if (result === null) {
      return;
    }

    expressionDisplay.textContent =
      `${formatNumber(currentValue)} ${operatorSymbols[state.repeatOperator]} ${formatNumber(state.repeatOperand)}`;
    state.displayValue = formatNumber(result);
    state.status = "RESULT";
    valueDisplay.textContent = state.displayValue;
    statusDisplay.textContent = state.status;
    syncActiveOperator();
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

  if (value === "+" || value === "-" || value === "*" || value === "/") {
    chooseOperator(value);
  }
}

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    handleButtonClick(button.dataset.value || button.textContent.trim());
  });
});

document.addEventListener("keydown", (event) => {
  const { key } = event;

  if (/^\d$/.test(key)) {
    event.preventDefault();
    inputDigit(key);
    return;
  }

  if (key === ".") {
    event.preventDefault();
    inputDecimal();
    return;
  }

  if (key === "+" || key === "-" || key === "*" || key === "/") {
    event.preventDefault();
    chooseOperator(key);
    return;
  }

  if (key === "Enter" || key === "=") {
    event.preventDefault();
    handleEquals();
    return;
  }

  if (key === "Escape" || key.toLowerCase() === "c") {
    event.preventDefault();
    clearAll();
    return;
  }

  if (key === "%") {
    event.preventDefault();
    convertToPercent();
    return;
  }

  if (key === "Backspace") {
    event.preventDefault();
    deleteLastDigit();
  }
});

updateDisplay();
