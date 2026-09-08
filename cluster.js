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
