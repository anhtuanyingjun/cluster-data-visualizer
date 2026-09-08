/* app.js — UI only. Data parsing lives in cluster.js */

const SAMPLE = `Cluster 1
Number of voxels: 1842
Peak MNI coordinate: -22 -4 10
Peak MNI coordinate region: Left Putamen // Putamen_L (aal3v1) // undefined
Peak intensity: 5.21
# voxels	structure
1240	Putamen_L (aal3v1)
380	Pallidum_L (aal3v1)
142	Caudate_L (aal3v1)
80	white matter
----------------------
Cluster 2
Number of voxels: 967
Peak MNI coordinate: 38 -62 -28
Peak MNI coordinate region: Right Cerebellum // Cerebellum_Crus1_R (aal3v1)
Peak intensity: 4.63
# voxels	structure
610	Cerebellum_Crus1_R (aal3v1)
210	Cerebellum_Crus2_R (aal3v1)
90	gray matter
----------------------
Cluster 3
Number of voxels: 156
Peak MNI coordinate: 12 -78 12
Peak MNI coordinate region: Right Calcarine // Calcarine_R (aal3v1)
Peak intensity: 3.41
# voxels	structure
110	Calcarine_R (aal3v1)
46	Cuneus_R (aal3v1)
`;

let parsedClusters = [];
let currentGeneralData = [];
let currentDetailData = [];

function applyTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("cluster-theme", theme);
  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
    btn.innerHTML = theme === "dark"
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M3 12h2M19 12h2M5.2 18.8l1.4-1.4M17.4 6.6l1.4-1.4"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M21 14.3A8.5 8.5 0 0 1 9.7 3 7 7 0 1 0 21 14.3z"/></svg>';
  }
}

function initTheme() {
  const stored = localStorage.getItem("cluster-theme");
  const theme = stored === "dark" || stored === "light"
    ? stored
    : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(theme);
}

function toggleTheme() {
  const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
  applyTheme(next);
}

function optionsFromUI() {
  const sort = document.getElementById("sortByFirstRegion").checked;
  const highlight = document.getElementById("highlightDuplicates").checked;
  if (sort) document.getElementById("firstRegion").checked = true;
  if (highlight) {
    document.getElementById("firstRegion").checked = true;
    document.getElementById("lastRegion").checked = true;
  }
  return {
    filterFirstRegion: document.getElementById("firstRegion").checked,
    filterLastRegion: document.getElementById("lastRegion").checked,
    ignoreUndefined: document.getElementById("ignoreUndefined").checked,
    ignoreWhiteMatter: document.getElementById("ignoreWhiteMatter").checked,
    ignoreGrayMatter: document.getElementById("ignoreGrayMatter").checked,
    sortByFirstRegion: sort,
    highlightDuplicates: highlight,
    voxelFilterType: document.getElementById("voxelFilterType").value,
    voxelFilterValue: document.getElementById("voxelFilterValue").value,
    removeAALSuffix: document.getElementById("removeAALSuffix").checked,
  };
}

function loadData() {
  const text = document.getElementById("dataInput").value.trim();
  if (!text) { showWarning("Paste a cluster report first."); return; }
  try {
    const clusters = parseClusterData(text);
    onDataLoaded(clusters);
  } catch {
    showWarning("Invalid data format. Please check the input.");
  }
}

function loadSample() {
  document.getElementById("dataInput").value = SAMPLE;
  document.getElementById("ignoreUndefined").checked = true;
  document.getElementById("ignoreWhiteMatter").checked = true;
  document.getElementById("removeAALSuffix").checked = true;
  document.getElementById("firstRegion").checked = true;
  loadData();
}

function clearAll() {
  document.getElementById("dataInput").value = "";
  parsedClusters = [];
  currentGeneralData = [];
  currentDetailData = [];
  document.getElementById("workspace").classList.remove("open");
  document.getElementById("generalOutput").innerHTML = "";
  document.getElementById("detailOutput").innerHTML = "";
}

function clearAndPaste() {
  document.getElementById("dataInput").value = "";
  navigator.clipboard.readText().then((text) => {
    document.getElementById("dataInput").value = text;
  }).catch(() => showWarning("Could not read the clipboard. Paste the report manually."));
}

function showWarning(message) {
  const el = document.getElementById("warningMessage");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3200);
}

function onDataLoaded(clusters) {
  if (!clusters.length) { showWarning("No clusters found."); return; }
  parsedClusters = clusters;
  document.getElementById("clusterSelect").innerHTML = clusters
    .map((c) => `<option value="${c.cluster}">Cluster ${c.cluster}</option>`)
    .join("");
  document.getElementById("workspace").classList.add("open");
  showSection("general");
  refresh();
  showDetail();
}

function showSection(section) {
  document.getElementById("generalSection").style.display = section === "general" ? "block" : "none";
  document.getElementById("detailSection").style.display = section === "detail" ? "block" : "none";
  document.getElementById("tab-general").setAttribute("aria-selected", section === "general" ? "true" : "false");
  document.getElementById("tab-detail").setAttribute("aria-selected", section === "detail" ? "true" : "false");
}

function refresh() {
  if (!parsedClusters.length) return;
  renderGeneral(getGeneralData(parsedClusters, optionsFromUI()));
}

function headerClass(key) {
  if (key === "cluster") return "col-id";
  if (key === "numberOfVoxels" || key === "peakIntensity") return "num";
  return "";
}

function cellClass(key) {
  if (key === "cluster") return "col-id";
  if (key === "numberOfVoxels" || key === "peakIntensity") return "num";
  if (key === "peakMNI") return "mni";
  if (key === "peakRegion" || key === "firstRegion" || key === "lastRegion") return "region";
  return "";
}

function displayCell(row, key) {
  const raw = cellValue(row, key);
  if (raw === "") return "—";
  if (key === "numberOfVoxels") return Number(raw).toLocaleString();
  return raw;
}

function escAttr(s) {
  return String(s).replace(/[&"<>]/g, (ch) => {
    if (ch === "&") return "&" + "amp;";
    if (ch === '"') return "&" + "quot;";
    if (ch === "<") return "&" + "lt;";
    return "&" + "gt;";
  });
}

function renderGeneral(data) {
  currentGeneralData = data;
  const options = optionsFromUI();
  const voxels = data.reduce((s, r) => s + (r.numberOfVoxels || 0), 0);
  document.getElementById("meta").innerHTML =
    `<span class="chip">${data.length} cluster${data.length === 1 ? "" : "s"}</span>` +
    `<span class="chip">${voxels.toLocaleString()} voxels</span>` +
    (parsedClusters.length > data.length
      ? `<span class="chip">${parsedClusters.length - data.length} hidden</span>`
      : "");

  if (!data.length) {
    document.getElementById("generalOutput").innerHTML = '<div class="table-scroll"><div class="empty">No clusters match these filters.</div></div>';
    document.getElementById("exportGeneralCSV").style.display = "none";
    return;
  }

  const headers = columnHeaders(options, data[0]);
  const sortByFirstRegion = options.sortByFirstRegion;
  let html = `<div class="table-scroll"><table class="data"><thead><tr>${
    headers.map((h) => `<th class="${headerClass(h)}">${HEADER_LABELS[h] ?? h}</th>`).join("")
  }</tr></thead><tbody>`;

  let currentFirst = "";
  data.forEach((item) => {
    if (sortByFirstRegion && item.firstRegion && item.firstRegion !== currentFirst) {
      currentFirst = item.firstRegion;
      html += `<tr class="group"><td colspan="${headers.length}">${currentFirst}</td></tr>`;
    }
    const cls = item.isDuplicate ? "is-dup" : "";
    html += `<tr class="${cls}" onclick="openDetail('${item.cluster}')">`;
    headers.forEach((h) => {
      const text = displayCell(item, h);
      html += `<td class="${cellClass(h)}" title="${escAttr(text)}">${text}</td>`;
    });
    html += "</tr>";
  });
  html += "</tbody></table></div>";
  document.getElementById("generalOutput").innerHTML = html;
  document.getElementById("exportGeneralCSV").style.display = "inline-flex";
}

function openDetail(id) {
  document.getElementById("clusterSelect").value = id;
  showSection("detail");
  showDetail();
}

function showDetail() {
  const clusterNum = document.getElementById("clusterSelect").value;
  renderDetail(getDetailData(parsedClusters, clusterNum));
}

function renderDetail(data) {
  currentDetailData = data;
  if (!data.length) {
    document.getElementById("detailOutput").innerHTML = '<div class="table-scroll"><div class="empty">No voxel rows for this cluster.</div></div>';
    document.getElementById("exportDetailCSV").style.display = "none";
    return;
  }
  const total = data.reduce((s, v) => s + v.voxelCount, 0);
  let html = '<div class="table-scroll"><table class="data"><thead><tr><th class="num"># Voxels</th><th>Structure</th><th class="num">Share</th></tr></thead><tbody>';
  data.forEach((item) => {
    const pct = total ? Math.round((item.voxelCount / total) * 100) : 0;
    html += `<tr><td class="num">${item.voxelCount.toLocaleString()}</td><td class="region" title="${escAttr(item.structure)}">${item.structure}</td><td class="num">${pct}%</td></tr>`;
  });
  html += "</tbody></table></div>";
  document.getElementById("detailOutput").innerHTML = html;
  document.getElementById("exportDetailCSV").style.display = "inline-flex";
}

function selectAllCheckboxes() {
  ["firstRegion", "lastRegion", "ignoreUndefined", "ignoreWhiteMatter", "ignoreGrayMatter", "sortByFirstRegion", "highlightDuplicates", "removeAALSuffix"]
    .forEach((id) => { document.getElementById(id).checked = true; });
  refresh();
}

function exportToCSV(type) {
  if (type === "general") {
    downloadFile(rowsToCsv(currentGeneralData, optionsFromUI()), "general_data.csv");
  } else {
    downloadFile(voxelsToCsv(currentDetailData), "detail_data.csv");
  }
}

function downloadFile(content, fileName) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", initTheme);
