const filtersForm = document.getElementById("filters-form");
const filterInput = document.getElementById("filter-input");
const filtersList = document.getElementById("filters-list");
const addBtn = document.getElementById("add-filter");
const applyBtn = document.getElementById("apply-filters");
const minMatchInput = document.getElementById("min-match");
const minMatchValue = document.getElementById("min-match-value");

const FilterManager = {
  filters: [],
  render() {
    filtersList.innerHTML = this.filters
      .map(
        (filter, idx) =>
          `<li>${filter} <button data-idx="${idx}" class="remove-btn">✖</button></li>`,
      )
      .join("");
    applyBtn.disabled = !this.filters.length;
    minMatchInput.max = this.filters.length;
    if (parseInt(minMatchInput.value, 10) > this.filters.length) {
      minMatchInput.value = this.filters.length;
    }
    minMatchValue.textContent = minMatchInput.value;
    minMatchInput.disabled = !this.filters.length;
  },
  add(filter) {
    if (filter && !this.filters.includes(filter)) {
      this.filters.push(filter);
      this.render();
    }
  },
  remove(idx) {
    this.filters.splice(idx, 1);
    this.render();
  },
  reset() {
    this.filters = [];
    this.render();
  },
  getAll() {
    return this.filters;
  },
};

filtersList.onclick = (e) => {
  if (e.target.classList.contains("remove-btn")) {
    FilterManager.remove(Number(e.target.dataset.idx));
  }
};

addBtn.onclick = () => {
  const value = filterInput.value.trim();
  FilterManager.add(value);
  filterInput.value = "";
};

filterInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addBtn.click();
  }
});

filtersForm.onsubmit = (e) => e.preventDefault();

const getMinMatch = () => {
  const v = parseInt(minMatchInput.value, 10);
  return v > 0 ? v : 0;
};

const sendFiltersToContent = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.tabs.sendMessage(tab.id, {
      type: "APPLY_FILTERS",
      activeFilters: FilterManager.getAll(),
      minMatch: getMinMatch(),
    });
  });
};

const sendMinMatchToContent = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.tabs.sendMessage(tab.id, {
      type: "UPDATE_MIN_MATCH",
      minMatch: getMinMatch(),
    });
  });
};

applyBtn.onclick = sendFiltersToContent;

minMatchInput.oninput = () => {
  minMatchValue.textContent = minMatchInput.value;
  sendMinMatchToContent();
};

function showMessage(msg) {
  let msgDiv = document.getElementById("filtergenie-message");
  if (!msgDiv) {
    msgDiv = document.createElement("div");
    msgDiv.id = "filtergenie-message";
    document.body.insertBefore(msgDiv, document.body.firstChild);
  }
  msgDiv.textContent = msg;
  const form = document.getElementById("filters-form");
  if (form) form.style.display = "none";
}

function setControlsEnabled(enabled) {
  filterInput.disabled = !enabled;
  addBtn.disabled = !enabled;
  applyBtn.disabled = !enabled;
  minMatchInput.disabled = !enabled;
}

document.addEventListener("DOMContentLoaded", () => {
  minMatchInput.value = 0;
  minMatchInput.max = 0;
  minMatchInput.disabled = true;
  minMatchValue.textContent = "0";
  FilterManager.reset();
  applyBtn.disabled = true;

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    const url = tab?.url || "";
    const registry = window.platformRegistry;
    const platform = registry.getCurrentPlatform(url);
    if (!platform) {
      showMessage("This website is not supported.");
      setControlsEnabled(false);
      return;
    }
    if (!registry.isCurrentPageSearchPage(url)) {
      showMessage("Filtering is only available on search pages.");
      setControlsEnabled(false);
      return;
    }
    setControlsEnabled(true);
  });
});
