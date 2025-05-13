const SPINNER_FRAMES = [
  "⠋",
  "⠙",
  "⠚",
  "⠞",
  "⠖",
  "⠦",
  "⠴",
  "⠲",
  "⠳",
  "⠓",
  "⠋",
  "⠙",
  "⠚",
  "⠞",
  "⠖",
  "⠦",
  "⠴",
  "⠲",
  "⠳",
  "⠓",
];
let itemIntervals = new WeakMap();

export function showItemSpinner(targets) {
  targets.forEach((el) => {
    if (!el) return;
    let statusDiv = el.querySelector(".filtergenie-status");
    if (!statusDiv) {
      statusDiv = document.createElement("div");
      statusDiv.className = "filtergenie-status";
      el.insertBefore(statusDiv, el.firstChild);
    }
    statusDiv.style.display = "";
    statusDiv.textContent = "";
    if (itemIntervals.has(statusDiv)) {
      clearInterval(itemIntervals.get(statusDiv));
    }
    let frame = 0;
    const start = Date.now();
    let lastFrameUpdate = 0;
    let lastElapsedUpdate = 0;
    const frameInterval = 350;
    const elapsedInterval = 100;
    const update = () => {
      const now = Date.now();
      if (now - lastFrameUpdate >= frameInterval) {
        frame = (frame + 1) % SPINNER_FRAMES.length;
        lastFrameUpdate = now;
      }
      if (now - lastElapsedUpdate >= elapsedInterval) {
        const elapsed = (now - start) / 1000;
        statusDiv.textContent = `${SPINNER_FRAMES[frame]} (${elapsed.toFixed(1)}s)`;
        lastElapsedUpdate = now;
      }
    };
    update();
    const interval = setInterval(update, 30);
    itemIntervals.set(statusDiv, interval);
  });
}

export function removeItemSpinner(targets) {
  targets.forEach((el) => {
    if (!el) return;
    const statusDiv = el.querySelector(".filtergenie-status");
    if (statusDiv && itemIntervals.has(statusDiv)) {
      clearInterval(itemIntervals.get(statusDiv));
      itemIntervals.delete(statusDiv);
    }
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
