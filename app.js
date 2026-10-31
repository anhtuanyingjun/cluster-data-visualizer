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

const SAMPLE_CAT12 = `______________________________________________________
D:\\NormalizationVBM\\PD_Copy_Test\\ARM\\kq_6mm\\TFCE_log_pFWE_0005.nii: Positive effects
cat12_neuromorphometrics
______________________________________________________
p-value	Cluster-Size	    xyz [mm]   	Overlap of atlas region
2.4e-06	       26520	 -45    4  -12	  5%	Right MSFG superior frontal gyrus medial segment
       	            	               	  4%	Left AIns anterior insula
       	            	               	  4%	Right AIns anterior insula
       	            	               	  2%	Right Cerebral White Matter
 0.0055	         215	 -21   14    0	 73%	Left Putamen
       	            	               	 26%	Left Cerebral White Matter
 0.0081	         157	 -64  -34  -26	 75%	Left ITG inferior temporal gyrus
       	            	               	 25%	Left MTG middle temporal gyrus
 0.0082	          78	 -54  -75   16	 76%	Left MOG middle occipital gyrus
       	            	               	 23%	Left AnG angular gyrus
 0.0086	          41	   4  -20   27	 83%	Right MCgG middle cingulate gyrus
       	            	               	 12%	Right Cerebral White Matter
 0.0091	           1	 -64   -8   38	100%	Left PoG postcentral gyrus
 0.0098	           6	 -18  -27  -16	 83%	Left PHG parahippocampal gyrus
       	            	               	 17%	Left Ventral DC
`;

let parsedClusters = [];
let currentGeneralData = [];
let currentDetailData = [];
let currentLang = "en";
let reportFormat = "xjview";
let activeShared = null;
let catReport = null;
let catSort = null;
let generalSort = null;
let detailSort = null;

const I18N = {
  en: {
    title: "Cluster Data Visualizer",
    lede: "Paste a cluster report, shape the table, and export. Nothing leaves the browser.",
    report: "Report",
    loadData: "Load data",
    clearPaste: "Clear & paste",
    sample: "Sample",
    clear: "Clear",
    columns: "Columns",
    firstRegion: "First region",
    lastRegion: "Last region",
    sortFirst: "Sort by first region",
    highlightDup: "Highlight duplicates",
    ignore: "Ignore",
    ignoreUndefined: "Undefined",
    ignoreWm: "White matter",
    ignoreGm: "Gray matter",
    aalSuffix: "(aal3v1) suffix",
    filterVoxels: "Voxels",
    greater: "Greater than",
    less: "Less than",
    selectAll: "Select all",
    general: "General",
    detail: "Detail",
    exportCsv: "Export CSV",
    format: "Format",
    reportHintCat: "CAT12 table: p-value, cluster size, xyz, atlas overlap.",
    placeholderCat: "p-value  Cluster-Size  xyz [mm]  Overlap of atlas region",
    filterSize: "Cluster size",
    placeholder: "Cluster 1\nNumber of voxels: 1842\nPeak MNI coordinate: -22 -4 10\n…",
    pasteFirst: "Paste a cluster report first.",
    invalid: "Invalid data format. Please check the input.",
    noClusters: "No clusters found.",
    clipFail: "Could not read the clipboard. Paste the report manually.",
    emptyFilter: "No clusters match these filters.",
    emptyDetail: "No voxel rows for this cluster.",
    clusters: (n) => n === 1 ? "1 cluster" : n + " clusters",
    voxels: (n) => n.toLocaleString() + " voxels",
    hidden: (n) => n + " hidden",
    clusterOpt: (id) => "Cluster " + id,
    themeDark: "Switch to dark theme",
    themeLight: "Switch to light theme",
    accent: "Interface color",
    accentCode: "Color code",
    resetColor: "Default",
    sharedXyz: "Matching xyz",
    sharedNone: "No shared xyz between the two reports.",
    formatBoth: "Both",
    voxelsCol: "# Voxels",
    structure: "Structure",
    share: "Share",
    tableImage: "Table image for report",
    savePng: "Save PNG",
    copyImage: "Copy image",
    toastImageSaved: "PNG downloaded — drop it into your report.",
    toastImageCopied: "Image copied. Paste into Word, PowerPoint, or a figure.",
    toastImageFail: "Could not create the table image.",
    headers: {
      cluster: "Cluster",
      numberOfVoxels: "Number of Voxels",
      peakMNI: "Peak MNI Coordinate",
      peakIntensity: "Peak Intensity",
      peakRegion: "Peak MNI Coordinate Region",
      firstRegion: "First Region",
      lastRegion: "Last Region",
      isDuplicate: "Is Duplicate",
    },
  },
  "zh-Hant": {
    title: "叢集資料視覺化",
    lede: "貼上叢集報告、篩選表格並匯出。資料全程留在瀏覽器，不會上傳。",
    report: "報告",
    loadData: "載入資料",
    clearPaste: "清除並貼上",
    sample: "範例",
    clear: "清除",
    columns: "欄位",
    firstRegion: "第一區",
    lastRegion: "最後一區",
    sortFirst: "依第一區排序",
    highlightDup: "標示重複",
    ignore: "忽略",
    ignoreUndefined: "未定義",
    ignoreWm: "白質",
    ignoreGm: "灰質",
    aalSuffix: "(aal3v1) 後綴",
    filterVoxels: "體素",
    greater: "大於",
    less: "小於",
    selectAll: "全選",
    general: "總覽",
    detail: "明細",
    exportCsv: "匯出 CSV",
    format: "格式",
    reportHintCat: "CAT12 表格：p 值、叢集大小、xyz、圖譜重疊。",
    placeholderCat: "p-value  Cluster-Size  xyz [mm]  Overlap of atlas region",
    filterSize: "叢集大小",
    placeholder: "Cluster 1\nNumber of voxels: 1842\nPeak MNI coordinate: -22 -4 10\n…",
    pasteFirst: "請先貼上叢集報告。",
    invalid: "資料格式不正確，請檢查內容。",
    noClusters: "找不到叢集。",
    clipFail: "無法讀取剪貼簿，請手動貼上。",
    emptyFilter: "沒有符合篩選的叢集。",
    emptyDetail: "此叢集沒有體素列。",
    clusters: (n) => n + " 個叢集",
    voxels: (n) => n.toLocaleString("zh-Hant") + " 個體素",
    hidden: (n) => n + " 筆已隱藏",
    clusterOpt: (id) => "叢集 " + id,
    themeDark: "切換深色模式",
    themeLight: "切換淺色模式",
    accent: "介面顏色",
    accentCode: "色碼",
    resetColor: "預設",
    sharedXyz: "相同 xyz",
    sharedNone: "兩份報告沒有相同的 xyz。",
    formatBoth: "同時",
    voxelsCol: "體素數",
    structure: "結構",
    share: "佔比",
    tableImage: "表格圖片（報告用）",
    savePng: "下載 PNG",
    copyImage: "複製圖片",
    toastImageSaved: "已下載 PNG，可插入報告。",
    toastImageCopied: "已複製圖片，可貼到 Word、PowerPoint 或圖檔。",
    toastImageFail: "無法建立表格圖片。",
    headers: {
      cluster: "叢集",
      numberOfVoxels: "體素數量",
      peakMNI: "峰值 MNI 座標",
      peakIntensity: "峰值強度",
      peakRegion: "峰值 MNI 座標區",
      firstRegion: "第一區",
      lastRegion: "最後一區",
      isDuplicate: "是否重複",
    },
  },
};

function t() {
  return I18N[currentLang] || I18N.en;
}

function applyI18n() {
  const dict = t();
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const value = dict[key];
    if (typeof value === "string") el.textContent = value;
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (dict[key]) el.setAttribute("placeholder", dict[key]);
  });
  document.title = dict.title;
  document.documentElement.lang = currentLang === "zh-Hant" ? "zh-Hant" : "en";
  const enBtn = document.getElementById("lang-en");
  const zhBtn = document.getElementById("lang-zh");
  if (enBtn) enBtn.setAttribute("aria-pressed", currentLang === "en" ? "true" : "false");
  if (zhBtn) zhBtn.setAttribute("aria-pressed", currentLang === "zh-Hant" ? "true" : "false");
  const accentBtn = document.getElementById("accentBtn");
  if (accentBtn) accentBtn.setAttribute("aria-label", dict.accent);
  const accentColor = document.getElementById("accentColor");
  const accentHex = document.getElementById("accentHex");
  if (accentColor) accentColor.setAttribute("aria-label", dict.accentCode);
  if (accentHex) accentHex.setAttribute("aria-label", dict.accentCode);
  const themeBtn = document.getElementById("themeToggle");
  if (themeBtn) {
    const dark = document.documentElement.classList.contains("dark");
    themeBtn.setAttribute("aria-label", dark ? dict.themeLight : dict.themeDark);
  }
  if (reportFormat === "cat12") {
    const input = document.getElementById("dataInput");
    const legend = document.getElementById("voxelLegend");
    if (input) input.placeholder = dict.placeholderCat;
    if (legend) legend.textContent = dict.filterSize;
  }
  if (reportFormat === "both") {
    if (parsedClusters.length || (catReport && catReport.clusters.length)) renderBoth();
  } else if (reportFormat === "cat12" && catReport) {
    renderCat12();
  } else if (parsedClusters.length) {
    const select = document.getElementById("clusterSelect");
    const selected = select.value;
    select.innerHTML = parsedClusters
      .map((c) => `<option value="${c.cluster}">${dict.clusterOpt(c.cluster)}</option>`)
      .join("");
    if (selected) select.value = selected;
    refresh();
    showDetail();
  }
}

function setLang(lang) {
  currentLang = lang === "zh-Hant" ? "zh-Hant" : "en";
  localStorage.setItem("cluster-lang", currentLang);
  applyI18n();
}

function applyTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("cluster-theme", theme);
  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.setAttribute("aria-label", theme === "dark" ? t().themeLight : t().themeDark);
    btn.innerHTML = theme === "dark"
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M3 12h2M19 12h2M5.2 18.8l1.4-1.4M17.4 6.6l1.4-1.4"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M21 14.3A8.5 8.5 0 0 1 9.7 3 7 7 0 1 0 21 14.3z"/></svg>';
  }
  paintAccent(normalizeHex(localStorage.getItem("cluster-accent") || ""));
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

const ACCENT_PRESETS = ["#1a4f7a", "#0e7490", "#0f766e", "#15803d", "#3730a3", "#6d28d9", "#9f1239", "#b45309", "#334155"];

function normalizeHex(value) {
  let hex = String(value || "").trim();
  if (!hex.startsWith("#")) hex = "#" + hex;
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : null;
}

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: h, s: s * 100, l: l * 100 };
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return "#" + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}

function luma(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
}

function themeFromAccent(hex, dark) {
  const src = hexToHsl(hex);
  const soft = Math.min(src.s, 36);
  const inkOn = (color) => (luma(color) > 158 ? "#1c1916" : "#f7f5f2");
  if (!dark) {
    const primary = src.s < 8
      ? hslToHex(src.h, 0, 30)
      : hslToHex(src.h, Math.min(Math.max(src.s, 38), 74), src.l < 24 ? 32 : src.l > 50 ? 38 : src.l);
    return {
      bg: hslToHex(src.h, soft * 0.75, 92),
      surface: hslToHex(src.h, soft * 0.4, 97.5),
      wash: hslToHex(src.h, soft * 0.85, 86.5),
      ink: hslToHex(src.h, Math.min(soft, 20), 15),
      muted: hslToHex(src.h, Math.min(soft * 0.4, 14), 35),
      subtle: hslToHex(src.h, Math.min(soft * 0.28, 10), 47),
      line: hslToHex(src.h, soft * 0.5, 76),
      primary: primary,
      primaryFg: inkOn(primary),
      hover: hslToHex(src.h, soft * 0.7, 89.5),
      active: hslToHex(src.h, soft * 0.8, 83),
      dup: hslToHex((src.h + 52) % 360, 26, 88),
    };
  }
  const primary = src.s < 8
    ? hslToHex(src.h, 0, 74)
    : hslToHex(src.h, Math.min(Math.max(src.s * 0.8, 28), 58), src.l > 80 ? 70 : src.l < 58 ? 68 : src.l);
  return {
    bg: hslToHex(src.h, Math.min(soft, 20), 8),
    surface: hslToHex(src.h, Math.min(soft, 16), 12),
    wash: hslToHex(src.h, Math.min(soft, 14), 17),
    ink: hslToHex(src.h, Math.min(soft * 0.3, 12), 93),
    muted: hslToHex(src.h, Math.min(soft * 0.22, 10), 74),
    subtle: hslToHex(src.h, Math.min(soft * 0.16, 8), 62),
    line: hslToHex(src.h, Math.min(soft, 12), 27),
    primary: primary,
    primaryFg: inkOn(primary),
    hover: hslToHex(src.h, Math.min(soft, 16), 18),
    active: hslToHex(src.h, Math.min(soft, 18), 22),
    dup: hslToHex((src.h + 52) % 360, 16, 22),
  };
}

const PAGE_THEME_VARS = ["--bg", "--surface", "--wash", "--ink", "--muted", "--subtle", "--line", "--primary", "--primary-fg", "--hover", "--active", "--dup"];

function paintAccent(hex) {
  const root = document.documentElement.style;
  const swatch = document.getElementById("accentSwatch");
  const color = document.getElementById("accentColor");
  const text = document.getElementById("accentHex");
  if (!hex) {
    PAGE_THEME_VARS.forEach((name) => root.removeProperty(name));
    if (swatch) swatch.style.background = "";
    if (color) color.value = "#1a4f7a";
    if (text) text.value = "#1A4F7A";
    document.querySelectorAll("#accentSwatches button").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.color === "#1a4f7a" ? "true" : "false");
    });
    return;
  }
  const dark = document.documentElement.classList.contains("dark");
  const p = themeFromAccent(hex, dark);
  root.setProperty("--bg", p.bg);
  root.setProperty("--surface", p.surface);
  root.setProperty("--wash", p.wash);
  root.setProperty("--ink", p.ink);
  root.setProperty("--muted", p.muted);
  root.setProperty("--subtle", p.subtle);
  root.setProperty("--line", p.line);
  root.setProperty("--primary", p.primary);
  root.setProperty("--primary-fg", p.primaryFg);
  root.setProperty("--hover", p.hover);
  root.setProperty("--active", p.active);
  root.setProperty("--dup", p.dup);
  if (swatch) swatch.style.background = hex;
  if (color) color.value = hex;
  if (text && document.activeElement !== text) text.value = hex.toUpperCase();
  document.querySelectorAll("#accentSwatches button").forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.dataset.color === hex ? "true" : "false");
  });
}

function setAccent(value) {
  const hex = normalizeHex(value);
  if (!hex) return;
  if (hex === "#1a4f7a") {
    localStorage.removeItem("cluster-accent");
    paintAccent(null);
    return;
  }
  localStorage.setItem("cluster-accent", hex);
  paintAccent(hex);
}

function typeAccent(value) {
  const hex = normalizeHex(value);
  if (hex) setAccent(hex);
}

function resetAccent() {
  localStorage.removeItem("cluster-accent");
  paintAccent(null);
}

function toggleAccent(event) {
  event.stopPropagation();
  document.getElementById("accentPicker").classList.toggle("open");
}

function initAccent() {
  const box = document.getElementById("accentSwatches");
  if (!box) return;
  box.innerHTML = ACCENT_PRESETS.map((color) =>
    `<button type="button" data-color="${color}" style="background:${color}" aria-label="${color}" onclick="setAccent('${color}')"></button>`,
  ).join("");
  paintAccent(normalizeHex(localStorage.getItem("cluster-accent") || ""));
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
  try {
    if (reportFormat === "both") {
      const xjText = document.getElementById("xjInput").value.trim();
      const catText = document.getElementById("catInput").value.trim();
      if (!xjText && !catText) { showWarning(t().pasteFirst); return; }
      parsedClusters = xjText ? parseClusterData(xjText) : [];
      catReport = catText ? parseCat12Report(catText) : { title: "", atlas: "", clusters: [] };
      generalSort = null;
      catSort = null;
      if (!parsedClusters.length && !catReport.clusters.length) { showWarning(t().noClusters); return; }
      document.getElementById("workspace").classList.add("open");
      renderBoth();
      return;
    }
    const text = document.getElementById("dataInput").value.trim();
    if (!text) { showWarning(t().pasteFirst); return; }
    if (reportFormat === "cat12") {
      catReport = parseCat12Report(text);
      catSort = null;
      if (!catReport.clusters.length) { showWarning(t().noClusters); return; }
      document.getElementById("workspace").classList.add("open");
      showSection("general");
      renderCat12();
      return;
    }
    const clusters = parseClusterData(text);
    onDataLoaded(clusters);
  } catch {
    showWarning(t().invalid);
  }
}

function setFormat(fmt) {
  const next = fmt === "cat12" || fmt === "both" ? fmt : "xjview";
  const prev = reportFormat;
  const data = document.getElementById("dataInput");
  const xj = document.getElementById("xjInput");
  const cat = document.getElementById("catInput");
  if (prev !== "both" && next === "both") {
    if (prev === "cat12" && cat && data && !cat.value) cat.value = data.value;
    if (prev !== "cat12" && xj && data && !xj.value) xj.value = data.value;
  }
  if (prev === "both" && next === "xjview" && data && xj) data.value = xj.value;
  if (prev === "both" && next === "cat12" && data && cat) data.value = cat.value;
  reportFormat = next;
  document.body.classList.toggle("format-cat12", next === "cat12");
  document.body.classList.toggle("format-both", next === "both");
  const xjBtn = document.getElementById("fmt-xj");
  const catBtn = document.getElementById("fmt-cat");
  const bothBtn = document.getElementById("fmt-both");
  if (xjBtn) xjBtn.setAttribute("aria-pressed", next === "xjview" ? "true" : "false");
  if (catBtn) catBtn.setAttribute("aria-pressed", next === "cat12" ? "true" : "false");
  if (bothBtn) bothBtn.setAttribute("aria-pressed", next === "both" ? "true" : "false");
  const legend = document.getElementById("voxelLegend");
  if (data) data.placeholder = next === "cat12" ? t().placeholderCat : t().placeholder;
  if (legend) legend.textContent = next === "cat12" ? t().filterSize : t().filterVoxels;
  if (next === "both" && (parsedClusters.length || (catReport && catReport.clusters.length))) {
    document.getElementById("workspace").classList.add("open");
    renderBoth();
  }
}

function loadSample() {
  if (reportFormat === "both") {
    document.getElementById("xjInput").value = SAMPLE;
    document.getElementById("catInput").value = SAMPLE_CAT12;
    document.getElementById("ignoreUndefined").checked = true;
    document.getElementById("ignoreWhiteMatter").checked = true;
    document.getElementById("removeAALSuffix").checked = true;
    document.getElementById("firstRegion").checked = true;
    loadData();
    return;
  }
  if (reportFormat === "cat12") {
    document.getElementById("dataInput").value = SAMPLE_CAT12;
    loadData();
    return;
  }
  document.getElementById("dataInput").value = SAMPLE;
  document.getElementById("ignoreUndefined").checked = true;
  document.getElementById("ignoreWhiteMatter").checked = true;
  document.getElementById("removeAALSuffix").checked = true;
  document.getElementById("firstRegion").checked = true;
  loadData();
}

function clearAll() {
  document.getElementById("dataInput").value = "";
  const xj = document.getElementById("xjInput");
  const cat = document.getElementById("catInput");
  if (xj) xj.value = "";
  if (cat) cat.value = "";
  parsedClusters = [];
  catReport = null;
  catSort = null;
  currentGeneralData = [];
  currentDetailData = [];
  generalSort = null;
  detailSort = null;
  document.getElementById("workspace").classList.remove("open");
  document.getElementById("generalOutput").innerHTML = "";
  document.getElementById("detailOutput").innerHTML = "";
}

function clearAndPaste() {
  document.getElementById("dataInput").value = "";
  navigator.clipboard.readText().then((text) => {
    document.getElementById("dataInput").value = text;
  }).catch(() => showWarning(t().clipFail));
}

function showWarning(message) {
  const el = document.getElementById("warningMessage");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3200);
}

function onDataLoaded(clusters) {
  if (!clusters.length) { showWarning(t().noClusters); return; }
  parsedClusters = clusters;
  generalSort = null;
  detailSort = null;
  document.getElementById("clusterSelect").innerHTML = clusters
    .map((c) => `<option value="${c.cluster}">${t().clusterOpt(c.cluster)}</option>`)
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
  if (reportFormat === "both") {
    if (parsedClusters.length || (catReport && catReport.clusters.length)) renderBoth();
    return;
  }
  if (reportFormat === "cat12") {
    if (catReport) renderCat12();
    return;
  }
  if (!parsedClusters.length) return;
  renderGeneral(getGeneralData(parsedClusters, optionsFromUI()));
}

function headerClass(key) {
  if (key === "cluster") return "col-id";
  if (key === "numberOfVoxels" || key === "peakIntensity") return "num";
  if (key === "peakMNI") return "mni";
  if (key === "isDuplicate") return "dup";
  return "region";
}

function cellClass(key) {
  if (key === "cluster") return "col-id";
  if (key === "numberOfVoxels" || key === "peakIntensity") return "num";
  if (key === "peakMNI") return "mni";
  if (key === "isDuplicate") return "dup";
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

function sortGeneralBy(key) {
  generalSort = nextSort(generalSort, key);
  refresh();
}

function sortDetailBy(key) {
  detailSort = nextSort(detailSort, key);
  showDetail();
}

function sortMark(key, sort) {
  if (!sort || sort.key !== key) return '<span class="caret" aria-hidden="true"></span>';
  return `<span class="caret on ${sort.dir}" aria-hidden="true"></span>`;
}

function sortCatBy(key) {
  catSort = nextSort(catSort, key);
  refresh();
}

function renderCat12(mount) {
  if (!catReport) return;
  const options = optionsFromUI();
  const dict = t();
  let rows = cat12Rows(catReport, options.voxelFilterType, options.voxelFilterValue);
  rows = sortCat12Rows(rows, catSort);
  currentGeneralData = rows;
  const ids = {};
  let voxels = 0;
  rows.forEach((row) => {
    if (ids[row.clusterId]) return;
    ids[row.clusterId] = true;
    voxels += row.clusterSize;
  });
  const count = Object.keys(ids).length;
  const hidden = catReport.clusters.length - count;
  document.getElementById("meta").innerHTML =
    `<span class="chip">${dict.clusters(count)}</span>` +
    `<span class="chip">${dict.voxels(voxels)}</span>` +
    (hidden > 0 ? `<span class="chip">${dict.hidden(hidden)}</span>` : "") +
    (catReport.atlas || catReport.title
      ? `<span class="chip">${escAttr(catReport.atlas || catReport.title)}</span>`
      : "");
  if (!rows.length) {
    const empty = `<div class="table-scroll"><div class="empty">${dict.emptyFilter}</div></div>`;
    if (mount) { mount.innerHTML = empty; return; }
    document.getElementById("generalOutput").innerHTML = empty;
    document.getElementById("exportGeneralCSV").style.display = "none";
    return;
  }
  const keys = ["pValue", "clusterSize", "xyz", "percent", "region"];
  const classes = { pValue: "num", clusterSize: "num", xyz: "mni", percent: "num", region: "wrap" };
  let html = wrapTableShell("cat12", `<div class="table-scroll"><table class="data"><thead><tr>${
    keys.map((key, i) => {
      const aria = catSort && catSort.key === key ? (catSort.dir === "desc" ? "descending" : "ascending") : "none";
      return `<th class="sortable ${classes[key]}" aria-sort="${aria}" onclick="sortCatBy('${key}')">${CAT12_LABELS[i]}${sortMark(key, catSort)}</th>`;
    }).join("")
  }</tr></thead><tbody>`);
  rows.forEach((row) => {
    const cls = activeShared && activeShared.has(xyzKey(row.xyz)) ? "is-match" : "";
    html += `<tr class="${cls}">`;
    keys.forEach((key) => {
      const text = cat12Cell(row, key);
      html += `<td class="${classes[key]}" title="${escAttr(text)}">${text}</td>`;
    });
    html += "</tr>";
  });
  html += "</tbody></table></div></div>";
  if (mount) { mount.innerHTML = html; return; }
  document.getElementById("generalOutput").innerHTML = html;
  document.getElementById("exportGeneralCSV").style.display = "inline-flex";
  document.getElementById("detailSection").style.display = "none";
  document.getElementById("generalSection").style.display = "";
}

function renderGeneral(data, mount) {
  currentGeneralData = data;
  const options = optionsFromUI();
  const dict = t();
  const voxels = data.reduce((s, r) => s + (r.numberOfVoxels || 0), 0);
  document.getElementById("meta").innerHTML =
    `<span class="chip">${dict.clusters(data.length)}</span>` +
    `<span class="chip">${dict.voxels(voxels)}</span>` +
    (parsedClusters.length > data.length
      ? `<span class="chip">${dict.hidden(parsedClusters.length - data.length)}</span>`
      : "");

  if (!data.length) {
    document.getElementById("generalOutput").innerHTML = `<div class="table-scroll"><div class="empty">${dict.emptyFilter}</div></div>`;
    document.getElementById("exportGeneralCSV").style.display = "none";
    return;
  }

  const headers = columnHeaders(options, data[0]);
  const activeSort = generalSort && headers.indexOf(generalSort.key) !== -1 ? generalSort : null;
  data = sortByKey(data, activeSort, generalSortValue);
  currentGeneralData = data;
  const sortByFirstRegion = options.sortByFirstRegion && (!activeSort || activeSort.key === "firstRegion");
  let html = wrapTableShell("general", `<div class="table-scroll"><table class="data"><thead><tr>${
    headers.map((h) => {
      const aria = activeSort && activeSort.key === h ? (activeSort.dir === "desc" ? "descending" : "ascending") : "none";
      return `<th class="sortable ${headerClass(h)}" aria-sort="${aria}" tabindex="0" onclick="sortGeneralBy('${h}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();sortGeneralBy('${h}')}">${dict.headers[h] ?? h}${sortMark(h, activeSort)}</th>`;
    }).join("")
  }</tr></thead><tbody>`);

  let currentFirst = "";
  data.forEach((item) => {
    if (sortByFirstRegion && item.firstRegion && item.firstRegion !== currentFirst) {
      currentFirst = item.firstRegion;
      html += `<tr class="group"><td colspan="${headers.length}">${currentFirst}</td></tr>`;
    }
    const cls = [item.isDuplicate ? "is-dup" : "", activeShared && activeShared.has(xyzKey(item.peakMNI)) ? "is-match" : ""].filter(Boolean).join(" ");
    html += `<tr class="${cls}" onclick="openDetail('${item.cluster}')">`;
    headers.forEach((h) => {
      const text = displayCell(item, h);
      html += `<td class="${cellClass(h)}" title="${escAttr(text)}">${text}</td>`;
    });
    html += "</tr>";
  });
  html += "</tbody></table></div>";
  html += "</div>";
  if (mount) { mount.innerHTML = html; return; }
  document.getElementById("generalOutput").innerHTML = html;
  document.getElementById("exportGeneralCSV").style.display = "inline-flex";
}

function renderBoth() {
  const options = optionsFromUI();
  const dict = t();
  const xjRows = parsedClusters.length ? getGeneralData(parsedClusters, options) : [];
  const catRows = catReport
    ? cat12Rows(catReport, options.voxelFilterType, options.voxelFilterValue)
    : [];
  const box = document.getElementById("matchXyz");
  activeShared = box && box.checked ? sharedXyzKeys(xjRows, catRows) : new Set();
  const left = document.createElement("div");
  const right = document.createElement("div");
  if (xjRows.length) renderGeneral(xjRows, left);
  else left.innerHTML = `<div class="table-scroll"><div class="empty">${dict.emptyFilter}</div></div>`;
  const savedGeneral = currentGeneralData;
  if (catRows.length) renderCat12(right);
  else right.innerHTML = `<div class="table-scroll"><div class="empty">${dict.emptyFilter}</div></div>`;
  currentGeneralData = savedGeneral;
  let chips = "";
  if (!activeShared.size) chips = `<span class="chip">${escAttr(dict.sharedNone)}</span>`;
  else activeShared.forEach((key) => { chips += `<span class="chip">${escAttr(key.replace(/,/g, " "))}</span>`; });
  document.getElementById("meta").innerHTML =
    `<span class="chip">${escAttr(dict.sharedXyz)}</span>` + chips;
  document.getElementById("generalOutput").innerHTML =
    `<div class="split-view"><section class="split-pane"><h2>xjView</h2>${left.innerHTML}</section><section class="split-pane"><h2>CAT12</h2>${right.innerHTML}</section></div>`;
  document.getElementById("exportGeneralCSV").style.display = xjRows.length ? "inline-flex" : "none";
  document.getElementById("generalSection").style.display = "";
  document.getElementById("detailSection").style.display = "none";
  activeShared = null;
}

function openDetail(id) {
  if (reportFormat === "both") return;
  document.getElementById("clusterSelect").value = id;
  showSection("detail");
  showDetail();
}

function showDetail() {
  const clusterNum = document.getElementById("clusterSelect").value;
  renderDetail(getDetailData(parsedClusters, clusterNum));
}

function renderDetail(data) {
  const total = data.reduce((s, v) => s + v.voxelCount, 0);
  data = sortByKey(data, detailSort, (v, key) => {
    if (key === "structure") return v.structure;
    if (key === "share") return total > 0 ? v.voxelCount / total : 0;
    return v.voxelCount;
  });
  currentDetailData = data;
  if (!data.length) {
    document.getElementById("detailOutput").innerHTML = `<div class="table-scroll"><div class="empty">${t().emptyDetail}</div></div>`;
    document.getElementById("exportDetailCSV").style.display = "none";
    return;
  }
  let html = wrapTableShell("detail", `<div class="table-scroll"><table class="data"><thead><tr>
    <th class="sortable num" aria-sort="${detailSort && detailSort.key === "voxelCount" ? (detailSort.dir === "desc" ? "descending" : "ascending") : "none"}" onclick="sortDetailBy('voxelCount')">${t().voxelsCol}${sortMark("voxelCount", detailSort)}</th>
    <th class="sortable" aria-sort="${detailSort && detailSort.key === "structure" ? (detailSort.dir === "desc" ? "descending" : "ascending") : "none"}" onclick="sortDetailBy('structure')">${t().structure}${sortMark("structure", detailSort)}</th>
    <th class="sortable num" aria-sort="${detailSort && detailSort.key === "share" ? (detailSort.dir === "desc" ? "descending" : "ascending") : "none"}" onclick="sortDetailBy('share')">${t().share}${sortMark("share", detailSort)}</th>
  </tr></thead><tbody>`);
  data.forEach((item) => {
    const pct = total ? Math.round((item.voxelCount / total) * 100) : 0;
    html += `<tr><td class="num">${item.voxelCount.toLocaleString()}</td><td class="region" title="${escAttr(item.structure)}">${item.structure}</td><td class="num">${pct}%</td></tr>`;
  });
  html += "</tbody></table></div>";
  html += "</div>";
  document.getElementById("detailOutput").innerHTML = html;
  document.getElementById("exportDetailCSV").style.display = "inline-flex";
}

function selectAllCheckboxes() {
  ["firstRegion", "lastRegion", "ignoreUndefined", "ignoreWhiteMatter", "ignoreGrayMatter", "sortByFirstRegion", "highlightDuplicates", "removeAALSuffix"]
    .forEach((id) => { document.getElementById(id).checked = true; });
  refresh();
}

function exportToCSV(type) {
  if (reportFormat === "cat12") {
    downloadFile(cat12ToCsv(currentGeneralData), "cat12_data.csv");
    return;
  }
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

function wrapTableShell(kind, inner) {
  const dict = t();
  return `<div class="table-shell">
    <button type="button" class="table-corner" aria-label="${escAttr(dict.tableImage)}" title="${escAttr(dict.tableImage)}" onclick="toggleTableMenu(event)"></button>
    <div class="table-menu">
      <button type="button" onclick="exportTableImage('${kind}','save')">${dict.savePng}</button>
      <button type="button" onclick="exportTableImage('${kind}','copy')">${dict.copyImage}</button>
    </div>
    ${inner}`;
}

function toggleTableMenu(event) {
  event.stopPropagation();
  const shell = event.currentTarget.closest(".table-shell");
  document.querySelectorAll(".table-shell.open").forEach((el) => {
    if (el !== shell) el.classList.remove("open");
  });
  shell.classList.toggle("open");
}

function tableImagePayload(kind) {
  const dict = t();
  if (kind === "cat12") {
    const keys = ["pValue", "clusterSize", "xyz", "percent", "region"];
    return {
      headers: CAT12_LABELS.slice(),
      rows: currentGeneralData.map((row) => keys.map((key) => cat12Cell(row, key))),
      numeric: [true, true, false, true, false],
      fileName: "cat12_table.png",
    };
  }
  if (kind === "detail") {
    const total = currentDetailData.reduce((s, v) => s + v.voxelCount, 0);
    return {
      headers: [dict.voxelsCol, dict.structure, dict.share],
      rows: currentDetailData.map((v) => [
        v.voxelCount.toLocaleString(),
        v.structure,
        (total ? Math.round((v.voxelCount / total) * 100) : 0) + "%",
      ]),
      numeric: [true, false, true],
      fileName: "detail_table.png",
    };
  }
  const options = optionsFromUI();
  const headers = columnHeaders(options, currentGeneralData[0]);
  return {
    headers: headers.map((h) => dict.headers[h] || h),
    rows: currentGeneralData.map((row) => headers.map((h) => displayCell(row, h))),
    numeric: headers.map((h) => h === "cluster" || h === "numberOfVoxels" || h === "peakIntensity"),
    fileName: "general_table.png",
  };
}

function exportTableImage(kind, mode) {
  const payload = tableImagePayload(kind);
  if (!payload.rows.length) {
    showWarning(t().toastImageFail);
    return;
  }
  tableToPngBlob(payload.headers, payload.rows, payload.numeric)
    .then((blob) => {
      if (mode === "save") {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = payload.fileName;
        a.click();
        URL.revokeObjectURL(url);
        showWarning(t().toastImageSaved);
      } else {
        return navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).then(() => {
          showWarning(t().toastImageCopied);
        });
      }
    })
    .catch(() => showWarning(t().toastImageFail));
}

document.addEventListener("mousedown", (event) => {
  if (!event.target.closest(".table-shell")) {
    document.querySelectorAll(".table-shell.open").forEach((el) => el.classList.remove("open"));
  }
  if (!event.target.closest("#accentPicker")) {
    const picker = document.getElementById("accentPicker");
    if (picker) picker.classList.remove("open");
  }
});

document.addEventListener("DOMContentLoaded", () => {
  currentLang = localStorage.getItem("cluster-lang") === "zh-Hant" ? "zh-Hant" : "en";
  initTheme();
  initAccent();
  applyI18n();
});
