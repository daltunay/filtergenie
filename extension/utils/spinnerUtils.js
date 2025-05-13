import { createSpinner } from "../popup/components/ui-components.js";

export function showItemSpinner(targets) {
  targets.forEach((el) => {
    if (!el) return;
    const prev = el.querySelector(".filtergenie-spinner-container");
    if (prev) prev.remove();
    const spinner = document.createElement("span");
    spinner.className =
      "filtergenie-spinner-container inline-flex items-center animate-fade-in";
    spinner.appendChild(createSpinner("sm"));
    el.appendChild(spinner);
  });
}

export function removeItemSpinner(targets) {
  targets.forEach((el) => {
    if (!el) return;
    const spinner = el.querySelector(".filtergenie-spinner-container");
    if (spinner) spinner.remove();
    const statusContent = el.querySelector(".filtergenie-status");
    if (statusContent) statusContent.style.display = "";
  });
}

let apiSpinnerInterval = null;
let apiSpinnerStart = null;

export function showApiSpinner(container, message = "Filtering...") {
  removeApiSpinner(container);
  apiSpinnerStart = Date.now();
  const spinnerWrap = document.createElement("span");
  spinnerWrap.className =
    "filtergenie-api-spinner inline-flex items-center space-x-2";
  spinnerWrap.appendChild(createSpinner("sm"));
  const msg = document.createElement("span");
  msg.className = "text-primary-300 text-xs";
  msg.textContent = message;
  spinnerWrap.appendChild(msg);
  const elapsed = document.createElement("span");
  elapsed.className = "text-primary-400 text-xs";
  spinnerWrap.appendChild(elapsed);
  container.appendChild(spinnerWrap);
  apiSpinnerInterval = setInterval(() => {
    const t = ((Date.now() - apiSpinnerStart) / 1000).toFixed(1);
    elapsed.textContent = `(${t}s)`;
  }, 100);
}

export function removeApiSpinner(container, doneTime = null) {
  if (apiSpinnerInterval) {
    clearInterval(apiSpinnerInterval);
    apiSpinnerInterval = null;
  }
  apiSpinnerStart = null;
  container.innerHTML = "";
  if (doneTime !== null) {
    const done = document.createElement("span");
    done.className = "text-green-400 text-xs";
    done.textContent = `Done (${doneTime.toFixed(1)}s)`;
    container.appendChild(done);
  }
}
