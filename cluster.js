/* cluster.js — port of Code.gs (parseClusterData / getGeneralData / getDetailData) */

const HEADER_LABELS = {
  cluster: "Cluster",
  numberOfVoxels: "Number of Voxels",
  peakMNI: "Peak MNI Coordinate",
  peakIntensity: "Peak Intensity",
  peakRegion: "Peak MNI Coordinate Region",
  firstRegion: "First Region",
  lastRegion: "Last Region",
  isDuplicate: "Is Duplicate",
};

function parseClusterData(text) {
  const clusters = [];
  const clusterBlocks = String(text)
    .replace(/\r\n/g, "\n")
    .split("----------------------")
    .filter((block) => block.trim().length > 0);

  clusterBlocks.forEach((block) => {
    const lines = block.trim().split("\n").map((line) => line.trim());
    const cluster = {};
    let currentClusterNum = null;
    let inVoxelTable = false;
    const voxels = [];

    lines.forEach((line) => {
      if (line.startsWith("Cluster ")) {
        const match = line.match(/Cluster (\d+)/);
        if (!match) return;
        currentClusterNum = match[1];
        cluster.cluster = currentClusterNum;
      } else if (line.startsWith("Number of voxels:")) {
        cluster.numberOfVoxels = parseInt(line.split(":")[1].trim(), 10);
      } else if (line.startsWith("Peak MNI coordinate:")) {
        cluster.peakMNI = line.split(":").slice(1).join(":").trim();
      } else if (line.startsWith("Peak MNI coordinate region:")) {
        cluster.peakRegion = line.split(":").slice(1).join(":").trim();
      } else if (line.startsWith("Peak intensity:")) {
        cluster.peakIntensity = parseFloat(line.split(":")[1].trim());
      } else if (line.startsWith("# voxels") && line.toLowerCase().includes("structure")) {
        inVoxelTable = true;
      } else if (inVoxelTable && line.length > 0 && !line.startsWith("--TOTAL # VOXELS--")) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const voxelCount = parseInt(parts[0], 10);
          if (!Number.isNaN(voxelCount)) {
            voxels.push({ voxelCount, structure: parts.slice(1).join(" ") });
          }
        }
      }
    });

    if (currentClusterNum) {
      cluster.voxels = voxels;
      clusters.push(cluster);
    }
  });

  return clusters;
}

function getGeneralData(clusters, options) {
  const {
    filterFirstRegion,
    filterLastRegion,
    ignoreUndefined,
    ignoreWhiteMatter,
    ignoreGrayMatter,
    sortByFirstRegion,
    voxelFilterType,
    voxelFilterValue,
    removeAALSuffix,
    highlightDuplicates,
  } = options;

  let data = clusters.map((cluster) => {
    let regionParts = (cluster.peakRegion || "")
      .split("//")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    if (ignoreUndefined) {
      regionParts = regionParts.filter((part) => part.toLowerCase() !== "undefined");
    }
    if (ignoreWhiteMatter) {
      regionParts = regionParts.filter((part) => part.toLowerCase() !== "white matter");
    }
    if (ignoreGrayMatter) {
      regionParts = regionParts.filter((part) => part.toLowerCase() !== "gray matter");
    }

    let first = regionParts[0] || "";
    let last = regionParts.length ? regionParts[regionParts.length - 1] : "";
    let full = regionParts.join(" // ");

    if (removeAALSuffix) {
      first = first.replace(/\s*\(aal3v1\)$/i, "");
      last = last.replace(/\s*\(aal3v1\)$/i, "");
      full = full.replace(/\s*\(aal3v1\)$/gi, "");
    }

    const result = {
      cluster: cluster.cluster,
      numberOfVoxels: cluster.numberOfVoxels,
      peakMNI: cluster.peakMNI,
      peakIntensity: cluster.peakIntensity,
    };

    if (!filterFirstRegion && !filterLastRegion) {
      result.peakRegion = full;
    } else {
      if (filterFirstRegion) result.firstRegion = first;
      if (filterLastRegion) result.lastRegion = last;
    }
    return result;
  });

  if (voxelFilterValue !== null && voxelFilterValue !== "") {
    const value = parseInt(String(voxelFilterValue), 10);
    if (!Number.isNaN(value)) {
      data = data.filter((item) => {
        const n = item.numberOfVoxels ?? 0;
        if (voxelFilterType === "greater") return n > value;
        if (voxelFilterType === "less") return n < value;
        return true;
      });
    }
  }

  if (sortByFirstRegion && filterFirstRegion) {
    data.sort((a, b) => {
      const firstA = a.firstRegion || "";
      const firstB = b.firstRegion || "";
      if (firstA < firstB) return -1;
      if (firstA > firstB) return 1;
      return (b.numberOfVoxels ?? 0) - (a.numberOfVoxels ?? 0);
    });
  }

  if (highlightDuplicates && filterFirstRegion && filterLastRegion) {
    let currentFirst = "";
    const seenLast = new Set();
    data = data.map((item) => {
      const first = item.firstRegion || "";
      const last = item.lastRegion || "";
      if (first !== currentFirst) {
        currentFirst = first;
        seenLast.clear();
      }
      const isDuplicate = seenLast.has(last);
      if (!isDuplicate) seenLast.add(last);
      return { ...item, isDuplicate };
    });
  }

  return data;
}

function getDetailData(clusters, clusterNum) {
  const cluster = clusters.find((c) => c.cluster === clusterNum);
  return cluster ? cluster.voxels : [];
}

function nextSort(current, key) {
  if (!current || current.key !== key) return { key: key, dir: "desc" };
  return { key: key, dir: current.dir === "desc" ? "asc" : "desc" };
}

function compareSortValues(a, b) {
  const empty = (v) => v === undefined || v === null || v === "";
  if (empty(a) && empty(b)) return 0;
  if (empty(a)) return 1;
  if (empty(b)) return -1;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  if (typeof a === "number" && typeof b === "number") return a - b;
  const sa = String(a).trim();
  const sb = String(b).trim();
  const na = Number(sa);
  const nb = Number(sb);
  if (sa !== "" && sb !== "" && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: "base" });
}

function sortByKey(rows, sort, valueOf) {
  if (!sort || !sort.key) return rows;
  const mul = sort.dir === "asc" ? 1 : -1;
  return rows.slice().sort(function (a, b) {
    return compareSortValues(valueOf(a, sort.key), valueOf(b, sort.key)) * mul;
  });
}

function generalSortValue(row, key) {
  if (key === "isDuplicate") return row.isDuplicate ? 1 : 0;
  return row[key];
}

function columnHeaders(options, row) {
  const headers = ["cluster", "numberOfVoxels", "peakMNI"];
  if (row && row.peakRegion !== undefined) {
    headers.push("peakRegion");
  } else {
    if (options.filterFirstRegion) headers.push("firstRegion");
    if (options.filterLastRegion) headers.push("lastRegion");
  }
  headers.push("peakIntensity");
  if (options.highlightDuplicates && options.filterFirstRegion && options.filterLastRegion) {
    headers.push("isDuplicate");
  }
  return headers;
}

function cellValue(row, header) {
  if (header === "isDuplicate") return row.isDuplicate ? "Yes" : "No";
  const value = row[header];
  if (value === undefined || value === null || value === "") return "";
  return String(value);
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows, options) {
  if (!rows.length) return "";
  const headers = columnHeaders(options, rows[0]);
  const lines = [headers.map((h) => HEADER_LABELS[h] ?? h).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(cellValue(row, h))).join(","));
  }
  return lines.join("\n");
}

function voxelsToCsv(voxels) {
  const lines = ["# Voxels,Structure"];
  for (const v of voxels) lines.push(`${v.voxelCount},${csvEscape(v.structure)}`);
  return lines.join("\n");
}

function wrapTableText(ctx, text, maxWidth) {
  const value = String(text || "").trim() || "—";
  if (ctx.measureText(value).width <= maxWidth) return [value];
  const words = value.split(/\s+/);
  const lines = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const next = line ? line + " " + word : word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    if (ctx.measureText(word).width <= maxWidth) {
      line = word;
    } else {
      let chunk = "";
      for (let c = 0; c < word.length; c++) {
        const trial = chunk + word[c];
        if (ctx.measureText(trial).width <= maxWidth) chunk = trial;
        else {
          if (chunk) lines.push(chunk);
          chunk = word[c];
        }
      }
      line = chunk;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["—"];
}

function drawTableCanvas(headers, rows, numeric) {
  const SCALE = 2;
  const PAD_X = 12;
  const LINE = 18;
  const HEADER_H = 34;
  const FONT = '13px Inter, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", ui-sans-serif, sans-serif';
  const FONT_HEAD = '600 11px Inter, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", ui-sans-serif, sans-serif';
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = FONT;
  const mins = headers.map((h, i) => {
    const base = numeric[i] ? 88 : 140;
    return Math.max(base, ctx.measureText(h).width + PAD_X * 2);
  });
  const preferred = mins.map((min, i) => {
    let widest = min;
    for (let r = 0; r < rows.length; r++) {
      const w = ctx.measureText(String(rows[r][i] || "")).width + PAD_X * 2;
      if (w > widest) widest = Math.min(w, numeric[i] ? 140 : 280);
    }
    return widest;
  });
  const totalPref = preferred.reduce((s, w) => s + w, 0) || 640;
  const target = Math.min(Math.max(totalPref, 640), 1280);
  const widths = preferred.map((w) => (w / totalPref) * target);
  const wrapped = rows.map((row) =>
    row.map((cell, i) => wrapTableText(ctx, cell, Math.max(24, widths[i] - PAD_X * 2))),
  );
  const rowHeights = wrapped.map((cells) => {
    let n = 1;
    for (let i = 0; i < cells.length; i++) n = Math.max(n, cells[i].length);
    return Math.max(HEADER_H - 4, n * LINE + 14);
  });
  const width = widths.reduce((s, w) => s + w, 0);
  const height = HEADER_H + rowHeights.reduce((s, h) => s + h, 0);
  canvas.width = Math.ceil(width * SCALE);
  canvas.height = Math.ceil(height * SCALE);
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#eef2f6";
  ctx.fillRect(0, 0, width, HEADER_H);
  ctx.strokeStyle = "#c5d0db";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
  ctx.font = FONT_HEAD;
  ctx.fillStyle = "#1a2a3a";
  ctx.textBaseline = "middle";
  let x = 0;
  headers.forEach((h, i) => {
    ctx.textAlign = numeric[i] ? "right" : "left";
    ctx.fillText(String(h).toUpperCase(), numeric[i] ? x + widths[i] - PAD_X : x + PAD_X, HEADER_H / 2, widths[i] - PAD_X * 2);
    x += widths[i];
  });
  ctx.font = FONT;
  ctx.textBaseline = "top";
  let y = HEADER_H;
  wrapped.forEach((cells, r) => {
    const h = rowHeights[r];
    if (r % 2 === 1) {
      ctx.fillStyle = "#f7f9fb";
      ctx.fillRect(0, y, width, h);
    }
    ctx.strokeStyle = "#e2e8ee";
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
    ctx.stroke();
    x = 0;
    cells.forEach((lines, i) => {
      ctx.fillStyle = "#1a2a3a";
      ctx.textAlign = numeric[i] ? "right" : "left";
      const textX = numeric[i] ? x + widths[i] - PAD_X : x + PAD_X;
      let ty = y + (h - lines.length * LINE) / 2;
      lines.forEach((line) => {
        ctx.fillText(line, textX, ty, widths[i] - PAD_X * 2);
        ty += LINE;
      });
      x += widths[i];
    });
    y += h;
  });
  return canvas;
}

function tableToPngBlob(headers, rows, numeric) {
  const canvas = drawTableCanvas(headers, rows, numeric);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("png"))), "image/png");
  });
}

const CAT12_PEAK = /^\s*([0-9]*\.?[0-9]+(?:[eE][+-]?\d+)?)\s+(\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(\d+(?:\.\d+)?)\s*%\s+(.+?)\s*$/;
const CAT12_CONT = /^\s*(\d+(?:\.\d+)?)\s*%\s+(.+?)\s*$/;
const CAT12_LABELS = ["p-value", "Cluster-Size", "xyz [mm]", "%", "Atlas region"];

function parseCat12Report(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const clusters = [];
  let title = "";
  let atlas = "";
  let current = null;
  let seenHeader = false;
  lines.forEach((raw) => {
    const line = raw.replace(/\t/g, " ").replace(/\u00a0/g, " ");
    const trimmed = line.trim();
    if (!trimmed || /^_+$/.test(trimmed)) return;
    if (/^p-value\b/i.test(trimmed)) {
      seenHeader = true;
      return;
    }
    const peak = line.match(CAT12_PEAK);
    if (peak) {
      current = {
        id: String(clusters.length + 1),
        pValue: peak[1],
        pValueNum: Number(peak[1]),
        clusterSize: parseInt(peak[2], 10),
        xyz: peak[3] + " " + peak[4] + " " + peak[5],
        overlaps: [{ percent: peak[6] + "%", region: peak[7].trim() }],
      };
      clusters.push(current);
      return;
    }
    const cont = line.match(CAT12_CONT);
    if (cont && current) {
      current.overlaps.push({ percent: cont[1] + "%", region: cont[2].trim() });
      return;
    }
    if (!seenHeader && clusters.length === 0) {
      if (!title && /[\\/]|\.nii/i.test(trimmed)) title = trimmed;
      else if (!atlas && /^[A-Za-z0-9_ -]+$/.test(trimmed)) atlas = trimmed;
    }
  });
  return { title: title, atlas: atlas, clusters: clusters };
}

function cat12Rows(report, filterType, filterValue) {
  let clusters = report.clusters.slice();
  if (filterValue !== null && filterValue !== "") {
    const value = parseInt(String(filterValue), 10);
    if (!isNaN(value)) {
      clusters = clusters.filter((c) =>
        filterType === "less" ? c.clusterSize < value : c.clusterSize > value,
      );
    }
  }
  const rows = [];
  clusters.forEach((cluster) => {
    cluster.overlaps.forEach((overlap, index) => {
      rows.push({
        clusterId: cluster.id,
        isFirst: index === 0,
        pValue: cluster.pValue,
        pValueNum: cluster.pValueNum,
        clusterSize: cluster.clusterSize,
        xyz: cluster.xyz,
        percent: overlap.percent,
        percentNum: parseFloat(overlap.percent),
        region: overlap.region,
      });
    });
  });
  return rows;
}

function sortCat12Rows(rows, sort) {
  if (!sort || !sort.key || !rows.length) return rows;
  const mul = sort.dir === "asc" ? 1 : -1;
  const groups = new Map();
  const order = [];
  rows.forEach((row) => {
    if (!groups.has(row.clusterId)) {
      groups.set(row.clusterId, []);
      order.push(row.clusterId);
    }
    groups.get(row.clusterId).push(row);
  });
  if (sort.key === "percent" || sort.key === "region") {
    return rows.slice().sort(function (a, b) {
      var va = sort.key === "percent" ? a.percentNum : a.region;
      var vb = sort.key === "percent" ? b.percentNum : b.region;
      return compareSortValues(va, vb) * mul;
    });
  }
  order.sort((a, b) => {
    const ra = groups.get(a)[0];
    const rb = groups.get(b)[0];
    const va = sort.key === "clusterSize" ? ra.clusterSize : sort.key === "xyz" ? ra.xyz : ra.pValueNum;
    const vb = sort.key === "clusterSize" ? rb.clusterSize : sort.key === "xyz" ? rb.xyz : rb.pValueNum;
    return compareSortValues(va, vb) * mul;
  });
  const out = [];
  order.forEach((id) => groups.get(id).forEach((row) => out.push(row)));
  return out;
}

function cat12Cell(row, key) {
  if (key === "percent") return row.percent;
  if (key === "region") return row.region;
  if (!row.isFirst) return "";
  if (key === "pValue") return row.pValue;
  if (key === "clusterSize") return row.clusterSize.toLocaleString();
  if (key === "xyz") return row.xyz;
  return "";
}

function cat12ToCsv(rows) {
  const keys = ["pValue", "clusterSize", "xyz", "percent", "region"];
  const lines = [CAT12_LABELS.join(",")];
  rows.forEach((row) => {
    lines.push(keys.map((h) => csvEscape(cat12Cell(row, h))).join(","));
  });
  return lines.join("\n");
}

function xyzKey(value) {
  if (!value) return "";
  const parts = String(value).trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3) return "";
  const nums = parts.slice(0, 3).map((part) => parseInt(part, 10));
  if (nums.some((n) => isNaN(n))) return "";
  return nums.join(",");
}

function sharedXyzKeys(xjRows, catRows) {
  const xj = new Set();
  xjRows.forEach((row) => {
    const key = xyzKey(row.peakMNI);
    if (key) xj.add(key);
  });
  const shared = new Set();
  catRows.forEach((row) => {
    const key = xyzKey(row.xyz);
    if (key && xj.has(key)) shared.add(key);
  });
  return shared;
}

function sheetCell(raw, key) {
  if (raw === "" || raw === null || raw === undefined) return "";
  const text = String(raw);
  if (key === "peakMNI" || key === "peakRegion" || key === "firstRegion" || key === "lastRegion") return text;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  return text;
}

function generalSheet(rows, options, labels) {
  const headers = columnHeaders(options, rows[0] || {});
  const sheet = [headers.map((h) => (labels && labels[h]) || HEADER_LABELS[h] || h)];
  rows.forEach((row) => {
    sheet.push(headers.map((h) => sheetCell(cellValue(row, h), h)));
  });
  return sheet;
}

function cat12Sheet(rows) {
  const sheet = [CAT12_LABELS.slice()];
  rows.forEach((row) => {
    sheet.push([
      row.isFirst ? row.pValue : "",
      row.isFirst ? row.clusterSize : "",
      row.isFirst ? row.xyz : "",
      row.percent,
      row.region,
    ]);
  });
  return sheet;
}

function detailSheet(voxels) {
  const sheet = [["# Voxels", "Structure"]];
  voxels.forEach((voxel) => sheet.push([voxel.voxelCount, voxel.structure]));
  return sheet;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function xmlEscape(value) {
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

function colName(index) {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function sheetXml(rows) {
  const body = rows.map((row, r) => {
    const cells = row.map((value, c) => {
      if (value === "" || value === null || value === undefined) return "";
      const ref = colName(c) + (r + 1);
      if (typeof value === "number" && isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
    }).join("");
    return `<row r="${r + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function zipStore(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  files.forEach((file) => {
    const name = new TextEncoder().encode(file.name);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + name.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, file.data.length, true);
    view.setUint32(22, file.data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    locals.push(local, file.data);
    const central = new Uint8Array(46 + name.length);
    const cview = new DataView(central.buffer);
    cview.setUint32(0, 0x02014b50, true);
    cview.setUint16(4, 20, true);
    cview.setUint16(6, 20, true);
    cview.setUint32(16, crc, true);
    cview.setUint32(20, file.data.length, true);
    cview.setUint32(24, file.data.length, true);
    cview.setUint16(28, name.length, true);
    cview.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length + file.data.length;
  });
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const eview = new DataView(end.buffer);
  eview.setUint32(0, 0x06054b50, true);
  eview.setUint16(8, files.length, true);
  eview.setUint16(10, files.length, true);
  eview.setUint32(12, centralSize, true);
  eview.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  locals.concat(centrals, [end]).forEach((part) => {
    out.set(part, cursor);
    cursor += part.length;
  });
  return out;
}

function tableToXlsxBlob(rows, sheetName) {
  return tablesToXlsxBlob([{ name: sheetName || "Clusters", rows: rows }]);
}

function tablesToXlsxBlob(sheets) {
  const used = sheets && sheets.length ? sheets : [{ name: "Clusters", rows: [] }];
  const names = used.map((sheet, index) => {
    const base = String(sheet.name || "Sheet").replace(/[\\/*?:\[\]]/g, " ").trim().slice(0, 31);
    return base || ("Sheet" + (index + 1));
  });
  const utf8 = (text) => new TextEncoder().encode(text);
  const files = [
    { name: "[Content_Types].xml", data: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${names.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
</Types>`) },
    { name: "_rels/.rels", data: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`) },
    { name: "xl/workbook.xml", data: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${names.map((name, index) => `<sheet name="${xmlEscape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets>
</workbook>`) },
    { name: "xl/_rels/workbook.xml.rels", data: utf8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${names.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}
</Relationships>`) },
  ];
  used.forEach((sheet, index) => {
    files.push({ name: "xl/worksheets/sheet" + (index + 1) + ".xml", data: utf8(sheetXml(sheet.rows)) });
  });
  const bytes = zipStore(files);
  return new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

