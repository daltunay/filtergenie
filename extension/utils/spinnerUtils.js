import { createSpinner } from "../popup/components/ui-components.js";

let spinnerState = {
  interval: null,
  startTime: null,
  elements: [],
};

export function showSpinner(targets, message = "filtering...") {
  if (spinnerState.interval) clearInterval(spinnerState.interval);

  spinnerState.startTime = Date.now();
  spinnerState.elements = [];

  targets.forEach((el) => {
    if (!el) return;

    const prevSpinner = el.querySelector(".filtergenie-spinner-container");
    if (prevSpinner) prevSpinner.remove();

    const statusContent = el.querySelector(".filtergenie-status");
    if (statusContent) {
      statusContent.style.display = "none";
    }

    const container = document.createElement("span");
    container.className =
      "filtergenie-spinner-container align-middle inline-flex items-center space-x-1 animate-fade-in";
    container.style.width = "auto";
    container.style.maxWidth = "none";
    container.appendChild(createSpinner("sm"));

    const messageEl = document.createElement("span");
    messageEl.className = "text-primary-300 text-xs";
    messageEl.textContent = `${message}`;
    container.appendChild(messageEl);

    const elapsedEl = document.createElement("span");
    elapsedEl.className = "text-primary-400 text-xs";
    container.appendChild(elapsedEl);

    spinnerState.elements.push({
      messageEl,
      elapsedEl,
    });

    el.appendChild(container);
  });

  spinnerState.interval = setInterval(() => {
    const elapsed = ((Date.now() - spinnerState.startTime) / 1000).toFixed(1);
    spinnerState.elements.forEach(({ elapsedEl }) => {
      elapsedEl.textContent = `(${elapsed}s)`;
    });
  }, 100);
}

export function removeSpinner(targets) {
  if (spinnerState.interval) {
    clearInterval(spinnerState.interval);
    spinnerState.interval = null;
  }

  spinnerState.startTime = null;
  spinnerState.elements = [];

  targets.forEach((el) => {
    if (!el) return;

    const spinnerContainer = el.querySelector(".filtergenie-spinner-container");
    if (spinnerContainer) {
      spinnerContainer.classList.add(
        "opacity-0",
        "transition-opacity",
        "duration-300",
      );
      setTimeout(() => {
        if (spinnerContainer.parentNode === el) spinnerContainer.remove();
        const statusContent = el.querySelector(".filtergenie-status");
        if (statusContent) {
          statusContent.style.display = "";
        }
      }, 300);
    } else {
      const statusContent = el.querySelector(".filtergenie-status");
      if (statusContent) {
        statusContent.style.display = "";
      }
    }
  });
}

export function updateSpinnerMessage(targets, message) {
  spinnerState.elements.forEach(({ messageEl }, index) => {
    if (messageEl && index < targets.length) {
      messageEl.textContent = message;
    }
  });
}
