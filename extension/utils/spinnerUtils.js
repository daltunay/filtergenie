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
let itemSpinnerIntervals = new WeakMap();
let itemElapsedIntervals = new WeakMap();

export function showItemSpinner(targets) {
  targets.forEach((el) => {
    if (!el) return;
    let statusDiv = el.querySelector(".filtergenie-status");
    if (!statusDiv) {
      statusDiv = document.createElement("div");
      statusDiv.className = "filtergenie-status";
      // Insert as first child for consistent placement
      el.insertBefore(statusDiv, el.firstChild);
    }
    statusDiv.style.display = "";
    statusDiv.textContent = "";
    if (itemSpinnerIntervals.has(statusDiv)) {
      clearInterval(itemSpinnerIntervals.get(statusDiv));
    }
    if (itemElapsedIntervals.has(statusDiv)) {
      clearInterval(itemElapsedIntervals.get(statusDiv));
    }
    let frame = 0;
    const start = Date.now();
    let elapsed = 0;
    function updateFrame() {
      statusDiv.textContent = `${SPINNER_FRAMES[frame]} (${elapsed.toFixed(1)}s)`;
      frame = (frame + 1) % SPINNER_FRAMES.length;
    }
    function updateElapsed() {
      elapsed = (Date.now() - start) / 1000;
    }
    updateElapsed();
    updateFrame();
    const interval = setInterval(updateFrame, 350);
    const elapsedInterval = setInterval(updateElapsed, 30); // much faster refresh for elapsed time
    itemSpinnerIntervals.set(statusDiv, interval);
    itemElapsedIntervals.set(statusDiv, elapsedInterval);
  });
}

export function removeItemSpinner(targets) {
  targets.forEach((el) => {
    if (!el) return;
    const statusDiv = el.querySelector(".filtergenie-status");
    if (statusDiv && itemSpinnerIntervals.has(statusDiv)) {
      clearInterval(itemSpinnerIntervals.get(statusDiv));
      itemSpinnerIntervals.delete(statusDiv);
    }
    if (statusDiv && itemElapsedIntervals.has(statusDiv)) {
      clearInterval(itemElapsedIntervals.get(statusDiv));
      itemElapsedIntervals.delete(statusDiv);
    }
    // Do not clear statusDiv here, let the API response update it
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
