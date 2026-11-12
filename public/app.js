const queryEl = document.getElementById("query");
const searchBtn = document.getElementById("searchBtn");
const resultsEl = document.getElementById("results");
const statusEl = document.getElementById("status");
const debugEl = document.getElementById("debug");

let lastSearchResponse = null;

searchBtn.addEventListener("click", search);

for (const btn of document.querySelectorAll(".exampleBtn")) {
  btn.addEventListener("click", () => {
    queryEl.value = btn.dataset.query;
    search();
  });
}

async function search() {
  const text = queryEl.value.trim();

  if (!text) {
    statusEl.innerHTML = `<p class="error">Please enter a query.</p>`;
    return;
  }

  setBusy(true);
  statusEl.textContent = "Searching...";
  resultsEl.innerHTML = "";
  debugEl.innerHTML = "";

  try {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, limit: 3 })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || data.error || "Search failed");
    }

    lastSearchResponse = data;
    statusEl.textContent = statusText(data);
    renderDebug(data);
    renderSearchResults(data);
  } catch (error) {
    statusEl.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  } finally {
    setBusy(false);
  }
}

function renderDebug(data) {
  if (!data.debug) {
    debugEl.innerHTML = "";
    return;
  }

  debugEl.innerHTML = `
    <details class="debug-card" open>
      <summary>Debug</summary>
      <pre>${escapeHtml(JSON.stringify({ intent: data.intent, hints: data.hints, debug: data.debug }, null, 2))}</pre>
    </details>
  `;
}

function renderSearchResults(data) {
  if (Array.isArray(data.intent_groups) && data.intent_groups.length > 1) {
    renderIntentGroups(data.intent_groups, data.intent);
    return;
  }

  renderResults(data.results || []);
}

function renderIntentGroups(groups, intent) {
  const intro = intent?.mode === "ambiguous"
    ? "Ambiguous request: review each acceptable option."
    : "Multiple requested devices detected.";

  resultsEl.innerHTML = `
    <div class="intent-summary">${escapeHtml(intro)}</div>
    ${groups.map(group => `
      <section class="intent-group">
        <header class="intent-group-header">
          <span>${escapeHtml(group.label)}</span>
          <strong>${escapeHtml(group.query)}</strong>
          <small>${escapeHtml(group.relationship)}</small>
        </header>
        <div class="intent-group-results">
          ${renderResultCards(group.results || [])}
        </div>
      </section>
    `).join("")}
  `;

  bindConfirmButtons();
}

function renderResults(results) {
  if (!results.length) {
    resultsEl.innerHTML = `<p class="empty">No matching devices found.</p>`;
    return;
  }

  resultsEl.innerHTML = renderResultCards(results);
  bindConfirmButtons();
}

function renderResultCards(results) {
  if (!results.length) {
    return `<p class="empty">No matching devices found for this intent.</p>`;
  }

  return results.map((item, index) => `
    <article class="result-card">
      <div class="result-rank">${index + 1}</div>
      <div class="result-body">
        <h2>${escapeHtml(item.official_name)}</h2>
        <dl>
          <div>
            <dt>Device ID</dt>
            <dd>${escapeHtml(item.device_id)}</dd>
          </div>
          <div>
            <dt>Manufacturer/Owner</dt>
            <dd>${escapeHtml(item.manufacturer_or_owner || "Generic / varies")}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>${escapeHtml([item.category, item.sub_category].filter(Boolean).join(" / "))}</dd>
          </div>
          <div>
            <dt>Vietnamese aliases</dt>
            <dd>${escapeHtml(item.aliases_vi_text || "")}</dd>
          </div>
          <div>
            <dt>Functions</dt>
            <dd>${escapeHtml(item.functions_text || "")}</dd>
          </div>
        </dl>
        <p class="score">Vector score: ${item.vector_score} | Final score: ${item.final_score}</p>
        <p class="reason"><strong>Reason:</strong> ${escapeHtml((item.reason || []).join("; "))}</p>
        <button class="confirmBtn" type="button" data-device-id="${escapeHtml(item.device_id)}">Confirm this device</button>
      </div>
    </article>
  `).join("");
}

function bindConfirmButtons() {
  for (const btn of document.querySelectorAll(".confirmBtn")) {
    btn.addEventListener("click", () => confirmDevice(btn.dataset.deviceId));
  }
}

async function confirmDevice(deviceId) {
  if (!lastSearchResponse) return;

  const response = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: lastSearchResponse.query,
      selected_device_id: deviceId,
      results_snapshot: {
        intent: lastSearchResponse.intent,
        results: lastSearchResponse.results,
        intent_groups: lastSearchResponse.intent_groups
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    statusEl.innerHTML = `<p class="error">${escapeHtml(data.error || "Failed to save feedback")}</p>`;
    return;
  }

  statusEl.textContent = `Feedback saved for ${data.feedback.selected_device_id}.`;
}

function setBusy(isBusy) {
  searchBtn.disabled = isBusy;
  searchBtn.textContent = isBusy ? "Searching..." : "Search";
}

function statusText(data) {
  if (Array.isArray(data.intent_groups) && data.intent_groups.length > 1) {
    const topCount = data.intent_groups.filter(group => (group.results || []).length > 0).length;
    if (data.intent?.mode === "ambiguous") {
      return `Found ${topCount} option group(s).`;
    }

    return `Found ${topCount} requested device group(s).`;
  }

  return `Found ${(data.results || []).length} result(s).`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
