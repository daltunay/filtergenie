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

export function createFilterBadge(text, onRemove, onEdit) {
  const badge = document.createElement("li");
  badge.style.display = "inline-flex";
  badge.style.alignItems = "center";
  badge.style.background = "rgba(250, 204, 21, 0.13)";
  badge.style.color = "#fde68a";
  badge.style.borderRadius = "999px";
  badge.style.padding = "2px 10px";
  badge.style.margin = "2px 6px 2px 0";
  badge.style.fontSize = "13px";
  badge.style.transition = "background 0.15s, color 0.15s";
  badge.style.cursor = onEdit ? "pointer" : "default";

  badge.onmouseenter = () => {
    badge.style.background = "rgba(250, 204, 21, 0.22)";
    badge.style.color = "#fffbe8";
  };
  badge.onmouseleave = () => {
    badge.style.background = "rgba(250, 204, 21, 0.13)";
    badge.style.color = "#fde68a";
  };

  const span = document.createElement("span");
  span.textContent = text;
  if (onEdit) {
    span.style.cursor = "pointer";
    span.title = "Click to edit";
    span.onclick = (e) => {
      e.stopPropagation();
      const input = document.createElement("input");
      input.type = "text";
      input.value = text;
      input.style.fontSize = "13px";
      input.style.borderRadius = "6px";
      input.style.padding = "1px 6px";
      input.style.width = Math.max(60, text.length * 8) + "px";
      if (span.parentNode === badge) {
        badge.replaceChild(input, span);
      }
      input.focus();
      input.select();
      input.onkeydown = (ev) => {
        if (ev.key === "Enter") finishEdit(true);
        else if (ev.key === "Escape") finishEdit(false);
      };
      input.onblur = () => finishEdit(true);
      function finishEdit(apply) {
        if (apply) {
          const newValue = input.value.trim();
          if (newValue && newValue !== text) onEdit(newValue);
        }
        if (input.parentNode === badge) {
          badge.replaceChild(span, input);
        }
      }
    };
  }
  badge.appendChild(span);

  if (onRemove) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 22 22" fill="none" style="display:block" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="11" r="9" fill="rgba(250,204,21,0.18)" />
      <path d="M8 8l6 6M14 8l-6 6" stroke="#fde68a" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
    btn.style.marginLeft = "8px";
    btn.style.background = "none";
    btn.style.border = "none";
    btn.style.padding = "3px";
    btn.style.borderRadius = "50%";
    btn.style.cursor = "pointer";
    btn.style.display = "flex";
    btn.style.alignItems = "center";
    btn.style.transition = "background 0.15s, box-shadow 0.15s";
    btn.onmouseenter = () => {
      btn.style.background = "rgba(250,204,21,0.32)";
      btn.firstChild
        .querySelector("circle")
        .setAttribute("fill", "rgba(250,204,21,0.32)");
      btn.firstChild.querySelector("path").setAttribute("stroke", "#fffbe8");
    };
    btn.onmouseleave = () => {
      btn.style.background = "none";
      btn.firstChild
        .querySelector("circle")
        .setAttribute("fill", "rgba(250,204,21,0.18)");
      btn.firstChild.querySelector("path").setAttribute("stroke", "#fde68a");
    };
    btn.onclick = onRemove;
    badge.appendChild(btn);
  }
  return badge;
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
    "text-primary-400 focus:outline-none focus:text-primary-300";
  closeButton.innerHTML = `<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>`;
  closeButton.onclick = close;
  header.appendChild(closeButton);
  modal.appendChild(header);

  const contentEl = document.createElement("div");
  contentEl.className = "p-4";
  if (typeof content === "string") contentEl.innerHTML = content;
  else if (content instanceof Element) contentEl.appendChild(content);
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
      cancelButton.onclick = close;
      footer.appendChild(cancelButton);
    }
    if (onConfirm && confirmText) {
      const confirmButton = document.createElement("button");
      confirmButton.type = "button";
      confirmButton.className = "btn btn-primary";
      confirmButton.textContent = confirmText;
      confirmButton.onclick = () => {
        onConfirm();
        close();
      };
      footer.appendChild(confirmButton);
    }
    modal.appendChild(footer);
  }

  document.body.appendChild(backdrop);

  function close() {
    backdrop.classList.add("opacity-0", "transition-opacity", "duration-300");
    setTimeout(() => backdrop.remove(), 300);
    if (onClose) onClose();
    document.removeEventListener("keydown", escHandler);
  }

  function escHandler(e) {
    if (e.key === "Escape") close();
  }
  document.addEventListener("keydown", escHandler);

  return { modal, close };
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
  input.className = `input${error ? " border-red-500 focus:border-red-500" : ""}`;
  if (onChange)
    input.addEventListener("input", (e) => onChange(e.target.value, e));
  container.appendChild(input);
  if (error) {
    const errorEl = document.createElement("p");
    errorEl.className = "mt-1 text-xs text-red-400";
    errorEl.textContent = error;
    container.appendChild(errorEl);
  }
  return container;
}

export const setDisclaimer = (container, message) => {
  container.innerHTML = message
    ? `<div class="bg-amber-500/20 text-amber-300 rounded-md px-4 py-3 text-sm animate-fade-in">${message}</div>`
    : "";
};
