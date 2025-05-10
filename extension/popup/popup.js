const filtersForm = document.getElementById("filters-form");
const filterInput = document.getElementById("filter-input");
const filtersList = document.getElementById("filters-list");
const addBtn = document.getElementById("add-filter");
const applyBtn = document.getElementById("apply-filters");
const minMatchInput = document.getElementById("min-match");

let activeFilters = [];

const sendFiltersToContent = () => {
  let minMatch = parseInt(minMatchInput.value, 10);
  if (isNaN(minMatch) || minMatch < 0) minMatch = 0;
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.tabs.sendMessage(tab.id, {
      type: "APPLY_FILTERS",
      activeFilters,
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

const renderFilters = () => {
  filtersList.innerHTML = activeFilters
    .map(
      (filter, idx) =>
        `<li>${filter} <button data-idx="${idx}" class="remove-btn">✖</button></li>`,
    )
    .join("");
  applyBtn.disabled = activeFilters.length === 0;
};

filtersList.onclick = (e) => {
  if (e.target.classList.contains("remove-btn")) {
    activeFilters.splice(Number(e.target.dataset.idx), 1);
    renderFilters();
  }
};

addBtn.onclick = () => {
  const value = filterInput.value.trim();
  if (value && !activeFilters.includes(value)) {
    activeFilters.push(value);
    filterInput.value = "";
    renderFilters();
  }
};

filtersForm.onsubmit = (e) => e.preventDefault();

applyBtn.onclick = sendFiltersToContent;

minMatchInput.oninput = () => {
  sendMinMatchToContent();
};

document.addEventListener("DOMContentLoaded", () => {
  activeFilters = [];
  renderFilters();
  applyBtn.disabled = true;
});
