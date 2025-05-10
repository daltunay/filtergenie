const filtersForm = document.getElementById("filters-form");
const filterInput = document.getElementById("filter-input");
const filtersList = document.getElementById("filters-list");
const addBtn = document.getElementById("add-filter");
const applyBtn = document.getElementById("apply-filters");
const minMatchInput = document.getElementById("min-match");

const FilterManager = {
  filters: [],
  render() {
    filtersList.innerHTML = this.filters
      .map(
        (filter, idx) =>
          `<li>${filter} <button data-idx="${idx}" class="remove-btn">✖</button></li>`,
      )
      .join("");
    applyBtn.disabled = this.filters.length === 0;
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

filtersForm.onsubmit = (e) => e.preventDefault();

const sendFiltersToContent = () => {
  let minMatch = parseInt(minMatchInput.value, 10);
  if (isNaN(minMatch) || minMatch < 0) minMatch = 0;
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.tabs.sendMessage(tab.id, {
      type: "APPLY_FILTERS",
      activeFilters: FilterManager.getAll(),
      minMatch,
    });
  });
};

const sendMinMatchToContent = () => {
  let minMatch = parseInt(minMatchInput.value, 10);
  if (isNaN(minMatch) || minMatch < 0) minMatch = 0;
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.tabs.sendMessage(tab.id, {
      type: "UPDATE_MIN_MATCH",
      minMatch,
    });
  });
};

applyBtn.onclick = sendFiltersToContent;
minMatchInput.oninput = sendMinMatchToContent;

function showMessage(msg) {
  let msgDiv = document.getElementById("filtergenie-message");
  if (!msgDiv) {
    msgDiv = document.createElement("div");
    msgDiv.id = "filtergenie-message";
    document.body.insertBefore(msgDiv, document.body.firstChild);
  }
  msgDiv.textContent = msg;
}

function setControlsEnabled(enabled) {
  filterInput.disabled = !enabled;
  addBtn.disabled = !enabled;
  applyBtn.disabled = !enabled;
  minMatchInput.disabled = !enabled;
}

document.addEventListener("DOMContentLoaded", () => {
  FilterManager.reset();
  applyBtn.disabled = true;

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    const url = tab?.url || "";
    const platform = window.getCurrentPlatform(url);
    if (!platform) {
      showMessage("This website is not supported.");
      setControlsEnabled(false);
      return;
    }
    if (!window.isCurrentPageSearchPage(url)) {
      showMessage("Filtering is only available on search pages.");
      setControlsEnabled(false);
      return;
    }
    setControlsEnabled(true);
  });
});
