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
const itemIntervals = new WeakMap();

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
    clearInterval(itemIntervals.get(statusDiv));
    let frame = 0,
      start = Date.now();
    const interval = setInterval(() => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      statusDiv.textContent = `${SPINNER_FRAMES[frame]} (${elapsed}s)`;
      frame = (frame + 1) % SPINNER_FRAMES.length;
    }, 120);
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
    elapsed.textContent = `(${((Date.now() - apiSpinnerStart) / 1000).toFixed(
      1,
    )}s)`;
  }, 100);
}

export function removeApiSpinner(container, doneTime = null) {
  if (apiSpinnerInterval) clearInterval(apiSpinnerInterval);
  apiSpinnerInterval = null;
  apiSpinnerStart = null;
  container.innerHTML = "";
  if (doneTime !== null) {
    const done = document.createElement("span");
    done.className = "text-green-400 text-xs";
    done.textContent = `Done (${doneTime.toFixed(1)}s)`;
    container.appendChild(done);
  }
}
