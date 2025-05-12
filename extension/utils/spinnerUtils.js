const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let spinnerInterval = null;
let spinnerStart = null;

export function showSpinner(targets, message = "filtering...") {
  if (spinnerInterval) clearInterval(spinnerInterval);
  let frame = 0;
  spinnerStart = Date.now();
  spinnerInterval = setInterval(() => {
    const elapsed = ((Date.now() - spinnerStart) / 1000).toFixed(1);
    targets.forEach((el) => {
      if (el)
        el.textContent = ` ${SPINNER_FRAMES[frame % SPINNER_FRAMES.length].padEnd(2, " ")} ${message} (${elapsed}s)`;
    });
    frame++;
  }, 120);
}

export function removeSpinner(targets) {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
  }
  spinnerStart = null;
  targets.forEach((el) => {
    if (el) el.textContent = "";
  });
}
