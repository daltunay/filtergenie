/**
 * FilterGenie UI Components
 * A minimal component library for the FilterGenie extension
 */

export function createSpinner(size = "sm") {
  const spinnerSizes = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  const spinner = document.createElement("span");
  spinner.className = `inline-block align-middle ${spinnerSizes[size] || spinnerSizes.sm} animate-spin`;
  spinner.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-full h-full">
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>`;
  return spinner;
}

export function createFilterBadge(text, onRemove) {
  const badge = document.createElement("li");
  badge.className =
    "inline-flex items-center rounded-full bg-primary-600/30 px-3 py-1 text-sm font-medium text-primary-200 ring-1 ring-inset ring-primary-700/30 mr-2 mb-2 animate-fade-in";

  const span = document.createElement("span");
  span.textContent = text;
  badge.appendChild(span);

  if (onRemove) {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "ml-1 inline-flex items-center justify-center rounded-full h-5 w-5 transition ease-in-out duration-150 hover:bg-primary-500/40 focus:outline-none";
    button.innerHTML = `<svg class="h-3 w-3" stroke="currentColor" fill="none" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
    </svg>`;
    button.addEventListener("click", onRemove);
    badge.appendChild(button);
  }

  return badge;
}

export function createTooltip(element, text, position = "top") {
  const tooltip = document.createElement("div");
  tooltip.className = `hidden absolute z-10 px-3 py-2 text-sm font-medium text-white bg-dark-900/90 rounded-lg shadow-lg
                      ${
                        position === "top"
                          ? "bottom-full mb-2"
                          : position === "bottom"
                            ? "top-full mt-2"
                            : position === "left"
                              ? "right-full mr-2"
                              : "left-full ml-2"
                      }`;
  tooltip.textContent = text;

  element.classList.add("relative");
  element.appendChild(tooltip);

  element.addEventListener("mouseenter", () => {
    tooltip.classList.remove("hidden");
    tooltip.classList.add("block", "animate-fade-in");
  });

  element.addEventListener("mouseleave", () => {
    tooltip.classList.add("hidden");
    tooltip.classList.remove("block", "animate-fade-in");
  });
}

export function createModal(
  title,
  content,
  { onClose, onConfirm, confirmText, cancelText } = {},
) {
  const backdrop = document.createElement("div");
  backdrop.className =
    "fixed inset-0 bg-black/50 z-40 flex items-center justify-center backdrop-blur-sm animate-fade-in";

  const modal = document.createElement("div");
  modal.className =
    "bg-dark-800 border border-primary-700/30 rounded-xl shadow-xl max-w-md w-full mx-4 animate-slide-up";
  backdrop.appendChild(modal);

  const header = document.createElement("div");
  header.className =
    "flex items-center justify-between px-4 py-3 border-b border-primary-800/30";

  const titleEl = document.createElement("h3");
  titleEl.className = "text-lg font-medium text-primary-100";
  titleEl.textContent = title;
  header.appendChild(titleEl);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className =
    "text-primary-400 hover:text-primary-300 focus:outline-none focus:text-primary-300";
  closeButton.innerHTML = `<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
  </svg>`;
  closeButton.addEventListener("click", () => {
    closeModal();
    if (onClose) onClose();
  });
  header.appendChild(closeButton);

  modal.appendChild(header);

  const contentEl = document.createElement("div");
  contentEl.className = "p-4";

  if (typeof content === "string") {
    contentEl.innerHTML = content;
  } else if (content instanceof Element) {
    contentEl.appendChild(content);
  }

  modal.appendChild(contentEl);

  if (onConfirm || cancelText) {
    const footer = document.createElement("div");
    footer.className =
      "flex items-center justify-end gap-3 px-4 py-3 border-t border-primary-800/30";

    if (cancelText) {
      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "btn btn-outline";
      cancelButton.textContent = cancelText;
      cancelButton.addEventListener("click", () => {
        closeModal();
        if (onClose) onClose();
      });
      footer.appendChild(cancelButton);
    }

    if (onConfirm && confirmText) {
      const confirmButton = document.createElement("button");
      confirmButton.type = "button";
      confirmButton.className = "btn btn-primary";
      confirmButton.textContent = confirmText;
      confirmButton.addEventListener("click", () => {
        onConfirm();
        closeModal();
      });
      footer.appendChild(confirmButton);
    }

    modal.appendChild(footer);
  }

  document.body.appendChild(backdrop);

  function closeModal() {
    backdrop.classList.add("opacity-0", "transition-opacity", "duration-300");
    setTimeout(() => backdrop.remove(), 300);
  }

  document.addEventListener("keydown", function escHandler(e) {
    if (e.key === "Escape") {
      closeModal();
      if (onClose) onClose();
      document.removeEventListener("keydown", escHandler);
    }
  });

  return {
    modal,
    close: closeModal,
  };
}

export function createLabeledInput(
  label,
  {
    id,
    type = "text",
    placeholder = "",
    value = "",
    onChange,
    error = "",
    className = "",
  } = {},
) {
  const container = document.createElement("div");
  container.className = `mb-4 ${className}`;

  const labelEl = document.createElement("label");
  labelEl.htmlFor = id;
  labelEl.className = "block text-sm font-medium text-primary-200 mb-1";
  labelEl.textContent = label;
  container.appendChild(labelEl);

  const input = document.createElement("input");
  input.type = type;
  input.id = id;
  input.placeholder = placeholder;
  input.value = value;
  input.className = `input ${error ? "border-red-500 focus:border-red-500" : ""}`;

  if (onChange) {
    input.addEventListener("input", (e) => onChange(e.target.value, e));
  }

  container.appendChild(input);

  if (error) {
    const errorEl = document.createElement("p");
    errorEl.className = "mt-1 text-xs text-red-400";
    errorEl.textContent = error;
    container.appendChild(errorEl);
  }

  return container;
}
