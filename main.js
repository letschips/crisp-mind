/* ==========================================================================
   Crisp Mind — Obsidian-Native Thought Graphs Engine
   Crafted for the Crisp Plugin Suite
   ========================================================================== */

const obsidian = require("obsidian");
const { Plugin, TextFileView, MarkdownView, Setting, PluginSettingTab, Notice, TFile, Modal, FuzzySuggestModal, setIcon, Menu, requestUrl } = obsidian;
const addIcon = obsidian.addIcon || (() => {});

const VIEW_TYPE_CRISP_MIND = "crisp-mind-view";
const CRISP_MIND_ICON_ID = "crisp-mind";

const CRISP_MIND_SVG = `<svg class="crisp-mind-brand-icon" viewBox="0 0 75 75" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="crisp-mind-chrome-flow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#cbd5e1" />
      <stop offset="18%" stop-color="#ffffff" />
      <stop offset="36%" stop-color="#181a24" />
      <stop offset="54%" stop-color="#f8fafc" />
      <stop offset="72%" stop-color="#334155" />
      <stop offset="90%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#cbd5e1" />
      <animateTransform 
        attributeName="gradientTransform" 
        type="rotate" 
        from="0 37.5 37.5" 
        to="360 37.5 37.5" 
        dur="6s" 
        repeatCount="indefinite" 
      />
    </linearGradient>
    <filter id="crisp-mind-flare-glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="1.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <path fill="url(#crisp-mind-chrome-flow)" stroke="currentColor" stroke-width="0.8" stroke-opacity="0.3" fill-rule="evenodd" d="M37.964 37.212s2.384-17.2 9.323-27.643a15.7 15.7 0 0 1 2.971-4.283c5.6-5.751 14.42-6.246 19.7-1.105 5.28 5.14 5.02 13.97-.58 19.721a16 16 0 0 1-2.45 2.057c-9.954 8.098-28.964 11.253-28.964 11.253m-1.517 1.362s-17.13 2.844-27.383 10.059a15.7 15.7 0 0 0-4.202 3.085c-5.6 5.751-5.86 14.58-.58 19.721s14.1 4.646 19.7-1.105a16 16 0 0 0 1.991-2.506c7.828-10.167 10.474-29.254 10.474-29.254M8.943 27.818c10.442 6.939 27.642 9.323 27.642 9.323S33.43 18.131 25.332 8.178a16 16 0 0 0-2.057-2.452C17.524.126 8.695-.132 3.554 5.148s-4.646 14.099 1.105 19.699a15.7 15.7 0 0 0 4.284 2.971M37.78 38.59s17.2 2.385 27.642 9.323a15.7 15.7 0 0 1 4.284 2.972c5.751 5.6 6.246 14.42 1.105 19.699-5.14 5.28-13.97 5.02-19.721-.579a16 16 0 0 1-2.057-2.451C40.937 57.6 37.78 38.59 37.78 38.59" clip-rule="evenodd"/>
  <g filter="url(#crisp-mind-flare-glow)">
    <animate attributeName="opacity" values="0.75;1;0.75" dur="3s" repeatCount="indefinite" />
    <ellipse cx="37.134" cy="37.88" fill="#ffffff" rx=".834" ry="21.087"/>
    <ellipse cx="37.015" cy="37.879" fill="#ffffff" rx=".834" ry="21.087" transform="rotate(-90 37.015 37.88)"/>
    <circle cx="37.08" cy="37.88" r="2.2" fill="#ffffff" />
  </g>
</svg>`;

const CRISP_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAiz41HIDpD59SH3DjKnovUO+EEhTJXjvmiug/ev9t4ZQ=
-----END PUBLIC KEY-----`;

const CRISP_LICENSE_PRODUCTS = [
  "Crisp Suite",
  "Crisp Mind",
  "Crisp Pulse",
  "Crisp Organize",
  "Crisp ASR",
  "Crisp Annotations",
  "Crisp File Explorer",
  "Crisp Focus",
  "Crisp Reading Rail",
  "Crisp Base",
  "Crisp Visual"
];

const DEFAULT_SETTINGS = {
  defaultLayout: "logicalStructure", // logicalStructure | mindMap | organizationStructure | catalogOrganization | timeline | fishbone
  defaultTheme: "crisp-obsidian",     // crisp-obsidian | crisp-cupertino | crisp-nord | crisp-mono | crisp-amber | crisp-paper
  toolbarPosition: "bottom",         // bottom | top
  enablePulseSync: true,
  enableFocusZen: true,
  autoBackup: true,
  licenseCode: "",
  licenseLastOnlineAt: 0
};

/* ==========================================================================
   Cryptography & Vault License Discovery
   ========================================================================== */

function base64UrlToUint8Array(base64url) {
  const base64 = (base64url || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const decodeFn = typeof atob === "function" ? atob : (b64) => (typeof Buffer !== "undefined" ? Buffer.from(b64, "base64").toString("binary") : "");
  const raw = decodeFn(padded);
  const buffer = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    buffer[i] = raw.charCodeAt(i);
  }
  return buffer;
}

function getCryptoSubtle(windowObj = (typeof window !== "undefined" ? window : null)) {
  if (windowObj && windowObj.crypto && windowObj.crypto.subtle) {
    return windowObj.crypto.subtle;
  }
  if (typeof globalThis !== "undefined" && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  try {
    const nodeCrypto = require("crypto");
    if (nodeCrypto && nodeCrypto.webcrypto && nodeCrypto.webcrypto.subtle) {
      return nodeCrypto.webcrypto.subtle;
    }
  } catch (e) {}
  return null;
}

async function verifyLicenseCode(licenseCode, targetPluginId = "crisp-mind", app = null, windowObj = null, options = {}) {
  if (typeof targetPluginId === "object" && targetPluginId !== null && !app) {
    windowObj = targetPluginId;
    targetPluginId = "crisp-mind";
  }
  const trimmed = (licenseCode || "").trim();
  if (!trimmed || !trimmed.includes(".")) {
    return { valid: false, reason: "授权码格式无效（须包含 payload 与签名）" };
  }
  const parts = trimmed.split(".");
  if (parts.length !== 2) {
    return { valid: false, reason: "授权码分段无效" };
  }
  const [payloadB64, sigB64] = parts;
  try {
    let payloadJson;
    try {
      payloadJson = new TextDecoder().decode(base64UrlToUint8Array(payloadB64));
    } catch (e) {
      return { valid: false, reason: "无法解码授权载荷" };
    }
    const payload = JSON.parse(payloadJson);
    if (!payload || typeof payload !== "object") {
      return { valid: false, reason: "授权载荷数据结构无效" };
    }
    if (!CRISP_LICENSE_PRODUCTS.includes(payload.product)) {
      return { valid: false, reason: "授权码不属于 Crisp 系列插件" };
    }
    const features = Array.isArray(payload.features) ? payload.features : [];
    if (!features.includes("all") && !features.includes(targetPluginId)) {
      return { valid: false, reason: `该授权码未包含 ${targetPluginId} 权限` };
    }
    if (payload.expiresAt) {
      const expiresAt = new Date(payload.expiresAt).getTime();
      if (!Number.isFinite(expiresAt)) {
        return { valid: false, reason: "授权到期时间无效" };
      }
      if (expiresAt < Date.now()) {
        return { valid: false, reason: `授权已于 ${String(payload.expiresAt).split("T")[0]} 到期` };
      }
    }

    const subtle = getCryptoSubtle(windowObj);
    if (!subtle) {
      return { valid: false, reason: "当前环境无法验证签名" };
    }
    const pemContents = CRISP_PUBLIC_KEY_PEM
      .replace("-----BEGIN PUBLIC KEY-----", "")
      .replace("-----END PUBLIC KEY-----", "")
      .replace(/\s/g, "");
    const der = base64UrlToUint8Array(pemContents);
    const key = await subtle.importKey("spki", der.buffer, { name: "Ed25519" }, false, ["verify"]);
    const payloadBytes = new TextEncoder().encode(payloadB64);
    const sigBytes = base64UrlToUint8Array(sigB64);
    const verified = await subtle.verify({ name: "Ed25519" }, key, sigBytes, payloadBytes);
    if (!verified) return { valid: false, reason: "授权签名无效或伪造" };

    // Inheritance scans several candidate codes, so it must not trigger one device check per
    // candidate. Local-only mode stops after the cryptographic checks; the license finally
    // adopted still goes through the online device check via validateCurrentLicense().
    if (options.online === false) {
      return { valid: true, payload, message: "本地签名校验通过", source: "local" };
    }

    try {
      const deviceId = app?.appId || (app?.vault?.getName ? "vault-" + encodeURIComponent(app.vault.getName()) : "device-default");
      const requestFn = obsidian.requestUrl || (typeof requestUrl === "function" ? requestUrl : null);
      if (requestFn) {
        const res = await Promise.race([
          requestFn({
            url: "https://license.letschips.xyz/api/verify-device",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              licenseCode: trimmed,
              deviceId: deviceId,
              action: "activate",
              pluginId: targetPluginId
            }),
            throw: false
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Crisp license check timeout")), 2500))
        ]);

        let cloudResult = null;
        try { cloudResult = res.json; } catch { cloudResult = null; }

        const isAuthDenial =
          (res.status === 200 || res.status === 400 || res.status === 401 || res.status === 403) &&
          cloudResult !== null &&
          cloudResult.valid === false;

        if (isAuthDenial) {
          return {
            valid: false,
            reason: cloudResult?.reason || "授权已被服务端拒绝或设备数已达上限"
          };
        }

        if (res.status === 200 && cloudResult && cloudResult.valid === true) {
          return { valid: true, payload, message: cloudResult.message, source: "online" };
        }
      }
    } catch (netErr) {
      // Offline fallback
      return { valid: true, payload, message: "离线验证成功", source: "offline" };
    }

    return { valid: true, payload, message: "离线验证成功", source: "offline" };
  } catch (e) {
    return { valid: false, reason: e.message || "验证异常" };
  }
}

class CrispMindLicenseManager {
  constructor(app, settings, options = {}) {
    this.app = app;
    this.settings = settings;
    this.pluginId = "crisp-mind";
    this.status = { valid: false, reason: "尚未激活" };
  }

  getStatus() {
    return this.status;
  }

  isLicensed() {
    return !!this.status.valid;
  }

  async validateCurrentLicense() {
    const code = (this.settings.licenseCode || "").trim();
    if (!code) {
      this.status = { valid: false, reason: "未输入授权码" };
      return this.status;
    }
    const result = await verifyLicenseCode(code, this.pluginId, this.app);
    if (result.valid) {
      this.status = { valid: true, payload: result.payload, source: result.source || "offline" };
      this.settings.licenseLastOnlineAt = Date.now();
    } else {
      this.status = { valid: false, reason: result.reason || "授权码无效" };
    }
    return this.status;
  }

  async activate(code) {
    const trimmed = (code || "").trim();
    if (!trimmed) {
      this.status = { valid: false, reason: "授权码为空" };
      return this.status;
    }
    const result = await verifyLicenseCode(trimmed, this.pluginId, this.app);
    if (result.valid) {
      this.settings.licenseCode = trimmed;
      this.settings.licenseLastOnlineAt = Date.now();
      this.status = { valid: true, payload: result.payload, source: result.source || "offline" };
      return this.status;
    }
    this.status = { valid: false, reason: result.reason || "激活失败" };
    return this.status;
  }

  clear() {
    this.settings.licenseCode = "";
    this.status = { valid: false, reason: "已清除授权" };
  }
}

// Sibling plugins that may hold an inherited Crisp license. Order only affects preference.
const CRISP_SIBLING_PLUGIN_IDS = [
  "crisp-mind",
  "crisp-pulse",
  "crisp-focus",
  "crisp-file-explorer",
  "crisp-base",
  "crisp-recall",
  "crisp-annotations",
  "crisp-reading-rail",
  "crisp-asr",
  "crisp-visual"
];

let lastInheritNote = "";

function collectVaultCrispLicenseCandidates(app) {
  if (!app) return [];
  const seen = new Set();
  const candidates = [];
  const add = (code) => {
    if (typeof code !== "string") return;
    const trimmed = code.trim();
    if (!trimmed.includes(".") || seen.has(trimmed)) return;
    seen.add(trimmed);
    candidates.push(trimmed);
  };

  // Loaded plugins first: their settings are already parsed in memory.
  for (const pid of CRISP_SIBLING_PLUGIN_IDS) {
    if (pid === "crisp-mind") continue;
    add(app.plugins?.plugins?.[pid]?.settings?.licenseCode);
  }

  // Then on-disk data.json, which also covers plugins that are installed but not loaded.
  try {
    const pathMod = typeof require === "function" ? require("path") : null;
    const fsMod = typeof require === "function" ? require("fs") : null;
    if (pathMod && fsMod) {
      const basePath = app.vault?.adapter?.basePath || (app.vault?.adapter?.getBasePath ? app.vault.adapter.getBasePath() : "");
      const pluginsDir = basePath ? pathMod.join(basePath, ".obsidian", "plugins") : "";
      if (pluginsDir && fsMod.existsSync(pluginsDir)) {
        for (const d of fsMod.readdirSync(pluginsDir)) {
          if (!d.startsWith("crisp-") || d === "crisp-mind") continue;
          const dataPath = pathMod.join(pluginsDir, d, "data.json");
          if (!fsMod.existsSync(dataPath)) continue;
          try {
            const data = JSON.parse(fsMod.readFileSync(dataPath, "utf8"));
            add(data?.licenseCode || data?.settings?.licenseCode);
          } catch (e) {}
        }
      }
    }
  } catch (e) {}
  return candidates;
}

// Returns a license code that is actually usable here, or null. Candidates are checked locally
// (no extra network round trips) so a stale or differently-scoped code can no longer shadow a
// valid one. The adopted code still goes through the online device check afterwards.
async function discoverVaultCrispLicense(app) {
  lastInheritNote = "";
  const candidates = collectVaultCrispLicenseCandidates(app);
  if (!candidates.length) return null;
  const reasons = [];
  for (const code of candidates) {
    const local = await verifyLicenseCode(code, "crisp-mind", app, null, { online: false });
    if (local.valid) return code;
    reasons.push(local.reason);
  }
  lastInheritNote = `库内找到 ${candidates.length} 个 Crisp 授权，但均不可用于 Crisp Mind：${reasons[0]}。可在下方手动填写授权码。`;
  return null;
}

/* ==========================================================================
   Data Model & Markdown Converter
   ========================================================================== */

function generateUid() {
  return "node-" + Math.random().toString(36).slice(2, 10);
}

function markdownOutlineToTree(markdown) {
  if (!markdown || typeof markdown !== "string") {
    return { id: generateUid(), data: { text: "Central Topic" }, children: [] };
  }

  const lines = markdown.split(/\r?\n/);
  let rootText = "Central Topic";
  const items = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("---")) continue;
    if (/^[a-zA-Z0-9_-]+:\s*.*/.test(trimmed) && items.length === 0 && !trimmed.startsWith("- ")) continue;

    const headingMatch = line.match(/^#{1,6}\s+(.*)/);
    if (headingMatch && items.length === 0) {
      rootText = headingMatch[1].trim();
      continue;
    }

    const listMatch = line.match(/^(\s*)(?:[-*+]|\d+\.)\s+(.*)/);
    if (listMatch) {
      const indent = listMatch[1].length;
      const text = listMatch[2].trim();
      items.push({ indent, text });
    }
  }

  const root = { id: generateUid(), data: { text: rootText }, children: [] };
  if (items.length === 0) {
    return root;
  }

  const stack = [{ node: root, indent: -1 }];

  for (const item of items) {
    const newNode = { id: generateUid(), data: { text: item.text }, children: [] };
    while (stack.length > 1 && stack[stack.length - 1].indent >= item.indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].node;
    parent.children.push(newNode);
    parent.data.collapsed = false;
    stack.push({ node: newNode, indent: item.indent });
  }

  return root;
}

// The outline is a one-line-per-node projection; embedded JSON preserves hard breaks.
function outlineNodeText(text) {
  return (text || "").replace(/\r\n?|\n/g, " ");
}

function treeToMarkdownOutline(rootNode, level = 0) {
  if (!rootNode || !rootNode.data) return "";
  let out = "";
  if (level === 0) {
    out += `# ${outlineNodeText(rootNode.data.text) || "Central Topic"}\n`;
    if (Array.isArray(rootNode.children)) {
      for (const child of rootNode.children) {
        out += treeToMarkdownOutline(child, 1);
      }
    }
    return out;
  }

  const indent = "  ".repeat(level - 1);
  out += `${indent}- ${outlineNodeText(rootNode.data.text)}\n`;
  if (Array.isArray(rootNode.children)) {
    for (const child of rootNode.children) {
      out += treeToMarkdownOutline(child, level + 1);
    }
  }
  return out;
}

function validateAndRepairTree(docData) {
  if (!docData || typeof docData !== "object") {
    docData = {};
  }
  if (!docData.root || typeof docData.root !== "object") {
    docData.root = { id: generateUid(), data: { text: "Central Topic" }, children: [] };
  }

  function repairNode(node, isRoot = false) {
    if (!node || typeof node !== "object") {
      return { id: generateUid(), data: { text: isRoot ? "Central Topic" : "Topic" }, children: [] };
    }
    if (!node.id) node.id = generateUid();
    if (!node.data || typeof node.data !== "object") {
      node.data = { text: isRoot ? "Central Topic" : "Topic" };
    }
    if (typeof node.data.text !== "string" || !node.data.text.trim()) {
      node.data.text = isRoot ? "Central Topic" : "Topic";
    }
    if (typeof node.data.note === "string") {
      node.data.note = node.data.note.slice(0, 5000);
      if (!node.data.note.trim()) delete node.data.note;
    } else if (node.data.note != null) {
      delete node.data.note;
    }
    const normalizedStyle = normalizeNodeStyle(node.data.style);
    if (normalizedStyle) node.data.style = normalizedStyle;
    else delete node.data.style;
    if (!Array.isArray(node.children)) {
      node.children = [];
    } else {
      node.children = node.children
        .filter((c) => c !== null && typeof c === "object")
        .map((child) => repairNode(child, false));
    }
    return node;
  }

  docData.root = repairNode(docData.root, true);
  if (!docData.version || docData.version === "1.0") docData.version = "1.1";
  if (!docData.layout) docData.layout = "logicalStructure";
  if (!docData.theme) docData.theme = "crisp-obsidian";
  const presentationSteps = normalizePresentationSteps(docData.presentation?.steps, docData.root);
  if (presentationSteps.length) docData.presentation = { steps: presentationSteps };
  else delete docData.presentation;
  normalizeMindAnnotations(docData);
  return docData;
}

function searchMindNodes(rootNode, query, vaultName) {
  const needle = String(query || "").normalize("NFKC").trim().toLocaleLowerCase();
  if (!needle || !rootNode) return [];
  const results = [];
  const walk = (node, path) => {
    if (!node || results.length >= 100) return;
    const raw = String(node.data?.text || "");
    const display = mindNodeLink(raw, vaultName)?.display || raw;
    const nextPath = [...path, display];
    const haystack = `${raw}\n${display}`.normalize("NFKC").toLocaleLowerCase();
    if (haystack.includes(needle)) {
      results.push({
        id: node.id,
        text: display,
        rawText: raw,
        path: nextPath,
        depth: nextPath.length - 1,
        startsWith: display.normalize("NFKC").toLocaleLowerCase().startsWith(needle)
      });
    }
    (node.children || []).forEach(child => walk(child, nextPath));
  };
  walk(rootNode, []);
  return results;
}

function normalizePresentationSteps(steps, rootNode) {
  if (!Array.isArray(steps) || !rootNode) return [];
  const validIds = new Set();
  const collect = node => {
    if (!node || typeof node.id !== "string" || !node.id) return;
    validIds.add(node.id);
    (node.children || []).forEach(collect);
  };
  collect(rootNode);

  const normalized = [];
  const seen = new Set();
  for (const rawStep of steps.slice(0, 500)) {
    if (!rawStep || typeof rawStep !== "object") continue;
    const nodeId = typeof rawStep.nodeId === "string" ? rawStep.nodeId.trim() : "";
    if (!nodeId || seen.has(nodeId) || !validIds.has(nodeId)) continue;
    const note = typeof rawStep.note === "string" ? rawStep.note.slice(0, 5000) : "";
    normalized.push({ nodeId, note });
    seen.add(nodeId);
  }
  return normalized;
}

const MIND_NODE_SHAPES = new Set(["rounded", "rectangle", "pill", "ellipse"]);
const MIND_TEXT_ALIGNS = new Set(["left", "center", "right"]);

function normalizeMindColor(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim().toLowerCase()
    : "";
}

function normalizeNodeStyle(style) {
  if (!style || typeof style !== "object" || Array.isArray(style)) return null;
  const normalized = {};
  if (MIND_NODE_SHAPES.has(style.shape)) normalized.shape = style.shape;
  for (const key of ["fill", "textColor", "borderColor"]) {
    const color = normalizeMindColor(style[key]);
    if (color) normalized[key] = color;
  }
  if (Number.isFinite(style.borderWidth)) {
    normalized.borderWidth = Math.max(0, Math.min(8, Math.round(style.borderWidth)));
  }
  if (Number.isFinite(style.fontSize)) {
    normalized.fontSize = Math.max(10, Math.min(28, Math.round(style.fontSize)));
  }
  if ([400, 500, 600, 700].includes(style.fontWeight)) normalized.fontWeight = style.fontWeight;
  if (MIND_TEXT_ALIGNS.has(style.align)) normalized.align = style.align;
  return Object.keys(normalized).length ? normalized : null;
}

function normalizeMindAnnotations(docData) {
  const validIds = new Set();
  const collect = node => {
    if (!node || typeof node.id !== "string" || !node.id) return;
    validIds.add(node.id);
    (node.children || []).forEach(collect);
  };
  collect(docData.root);

  const relationKeys = new Set();
  const relationIds = new Set();
  const relations = [];
  for (const raw of Array.isArray(docData.relations) ? docData.relations.slice(0, 1000) : []) {
    if (!raw || typeof raw !== "object") continue;
    const from = typeof raw.from === "string" ? raw.from : "";
    const to = typeof raw.to === "string" ? raw.to : "";
    const pair = [from, to].sort().join("\u0000");
    if (!validIds.has(from) || !validIds.has(to) || from === to || relationKeys.has(pair)) continue;
    const id = typeof raw.id === "string" && raw.id ? raw.id : `relation-${generateUid()}`;
    if (relationIds.has(id)) continue;
    relations.push({
      id,
      from,
      to,
      label: typeof raw.label === "string" ? raw.label.slice(0, 200) : "",
      color: normalizeMindColor(raw.color)
    });
    relationIds.add(id);
    relationKeys.add(pair);
  }
  if (relations.length) docData.relations = relations;
  else delete docData.relations;

  for (const kind of ["boundaries", "summaries"]) {
    const seenNodes = new Set();
    const seenIds = new Set();
    const normalized = [];
    for (const raw of Array.isArray(docData[kind]) ? docData[kind].slice(0, 500) : []) {
      if (!raw || typeof raw !== "object") continue;
      const nodeId = typeof raw.nodeId === "string" ? raw.nodeId : "";
      if (!validIds.has(nodeId) || seenNodes.has(nodeId)) continue;
      const id = typeof raw.id === "string" && raw.id ? raw.id : `${kind.slice(0, -1)}-${generateUid()}`;
      if (seenIds.has(id)) continue;
      normalized.push({
        id,
        nodeId,
        label: typeof raw.label === "string" ? raw.label.slice(0, 200) : "",
        color: normalizeMindColor(raw.color)
      });
      seenNodes.add(nodeId);
      seenIds.add(id);
    }
    if (normalized.length) docData[kind] = normalized;
    else delete docData[kind];
  }
}

function parseMindMarkdown(rawText) {
  if (!rawText || typeof rawText !== "string") {
    const defaultRoot = { id: generateUid(), data: { text: "Central Topic" }, children: [] };
    return {
      title: "Central Topic",
      frontmatter: "crisp-mind: true\n",
      data: { version: "1.1", layout: "logicalStructure", theme: "crisp-obsidian", root: defaultRoot }
    };
  }

  let frontmatter = "";
  let title = "Central Topic";
  let content = rawText;

  if (rawText.startsWith("---")) {
    const endIdx = rawText.indexOf("\n---", 3);
    if (endIdx !== -1) {
      frontmatter = rawText.slice(4, endIdx).trim() + "\n";
      content = rawText.slice(endIdx + 4).trim();
    }
  }

  const blockStart = content.indexOf("<!-- CRISP-MIND-DATA-START -->");
  const blockEnd = content.indexOf("<!-- CRISP-MIND-DATA-END -->");

  if (blockStart !== -1 && blockEnd !== -1) {
    const jsonBlock = content.slice(blockStart, blockEnd);
    const match = jsonBlock.match(/```crisp-mind\s*\n([\s\S]*?)\n```/);
    if (match) {
      try {
        const parsedData = JSON.parse(match[1]);
        const repaired = validateAndRepairTree(parsedData);
        title = repaired.root?.data?.text || title;
        return { title, frontmatter, data: repaired };
      } catch (e) {
        console.warn("Crisp Mind: Failed to parse embedded JSON block, falling back to outline", e);
      }
    }
  }

  const tree = markdownOutlineToTree(content);
  return {
    title: tree.data.text,
    frontmatter: frontmatter || "crisp-mind: true\n",
    data: {
      version: "1.1",
      layout: "logicalStructure",
      theme: "crisp-obsidian",
      root: tree
    }
  };
}

function normalizeMindLinkText(text, vaultName) {
  const source = text.trim();
  const prefix = source.match(/^\[[ xX]\]\s+/)?.[0] || "";
  const trimmed = source.slice(prefix.length);
  if (!/^obsidian:/i.test(trimmed)) return text;
  let url; try { url = new URL(trimmed); } catch (_) { throw Error("Obsidian 地址格式不正确"); }
  if (url.protocol !== "obsidian:" || url.hostname !== "open" || url.pathname && url.pathname !== "/") throw Error("仅支持 obsidian://open 笔记地址");
  const vault = url.searchParams.get("vault"), file = url.searchParams.get("file");
  if (!file?.trim()) throw Error("地址中缺少 file 笔记路径");
  if (vault && vaultName && vault !== vaultName) throw Error("此地址属于其他仓库，请使用当前仓库的笔记链接");
  const target = file.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\.md(?=#|$)/i, "");
  if (!target || /[\[\]|\r\n]/.test(target) || /(^|\/)\.\.(\/|$)/.test(target)) throw Error("笔记路径包含不支持的字符");
  const label = target.split("/").pop();
  return `${prefix}[[${target}|${label}]]`;
}

function mindNodeLink(text, vaultName) {
  let normalized;
  try { normalized = normalizeMindLinkText(text, vaultName); } catch (_) { normalized = text; }
  const match = normalized.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  if (!match) return null;
  return { target: match[1], display: normalized.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => alias || target) };
}

// Layout-computed, transient geometry. Never written to disk and never kept in history.
// The fishbone keys matter: calculateLayout only overwrites _x/_y when the layout changes,
// so unstripped bone/spine coordinates from a previous fishbone pass would stay in .mind.md forever.
const MIND_GEOMETRY_KEYS = new Set([
  "_x", "_y", "_w", "_h", "_treeHeight", "_treeWidth", "_lines",
  "_isUpper", "_spineConnectX", "_spineConnectY",
  "_boneTipX", "_boneTipY", "_boneConnectX", "_boneConnectY"
]);
const FISHBONE_GEOMETRY_KEYS = [
  "_isUpper", "_spineConnectX", "_spineConnectY",
  "_boneTipX", "_boneTipY", "_boneConnectX", "_boneConnectY"
];
// Per-file snapshot retention. Matches the number of rows the recovery dialog can list.
const MIND_SNAPSHOT_LIMIT = 30;
function snapshotSourceKey(sourcePath) {
  let hash = 0x811c9dc5;
  for (const char of String(sourcePath || "")) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
function cleanMindData(data) {
  return JSON.parse(JSON.stringify(data, (key, value) => MIND_GEOMETRY_KEYS.has(key) ? undefined : value));
}

// Managed files may be displayed after an error, but never silently repaired on disk.
function inspectMindSource(raw) {
  const start = "<!-- CRISP-MIND-DATA-START -->", end = "<!-- CRISP-MIND-DATA-END -->";
  if (!raw.includes(start) || !raw.includes(end)) return "缺少导图数据块，已只读打开";
  const block = raw.slice(raw.indexOf(start) + start.length, raw.lastIndexOf(end));
  const match = block.match(/^\s*```crisp-mind\s*\n([\s\S]*?)\n```\s*$/);
  if (!match) return "导图数据块损坏，已只读打开";
  try {
    const data = JSON.parse(match[1]);
    const ids = new Set(); let count = 0;
    const visit = (n, depth = 0) => {
      if (!n || typeof n !== "object" || Array.isArray(n) || !n.data || typeof n.data.text !== "string" || !n.data.text.trim() || typeof n.id !== "string" || !n.id || (n.children != null && !Array.isArray(n.children))) throw Error("节点数据损坏");
      if (ids.has(n.id)) throw Error("节点 ID 重复");
      if (++count > 10000 || depth > 200) throw Error("导图超过安全读取范围");
      ids.add(n.id); (n.children || []).forEach(c => visit(c, depth + 1));
    };
    visit(data.root);
    const body = raw.slice(0, raw.indexOf(start)).replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "");
    const flattenTexts = (node) => {
      const result = [];
      const walk = (n, depth) => {
        result.push(`${depth}:${outlineNodeText(n.data?.text).trim()}`);
        (n.children || []).forEach(c => walk(c, depth + 1));
      };
      if (node) walk(node, 0);
      return result.join("\n");
    };
    if (flattenTexts(markdownOutlineToTree(body)) !== flattenTexts(data.root)) return "大纲与导图数据不一致，请保留原文并解决冲突";
    if (raw.slice(raw.lastIndexOf(end) + end.length).trim()) return "导图末尾有附加正文，已只读保护";
    return null;
  } catch (error) { return `导图数据损坏：${error.message}`; }
}

function assembleMindMarkdown(mindDoc) {
  const frontmatter = mindDoc.frontmatter ? mindDoc.frontmatter.trim() : "crisp-mind: true";
  const outline = treeToMarkdownOutline(mindDoc.data.root);
  const jsonStr = JSON.stringify(cleanMindData(mindDoc.data), null, 2).replace(/`/g, "\\u0060");

  return `---
${frontmatter}
---

${outline.trim()}

<!-- CRISP-MIND-DATA-START -->
\`\`\`crisp-mind
${jsonStr}
\`\`\`
<!-- CRISP-MIND-DATA-END -->
`;
}

function extractNodeToTopicContent(node) {
  let raw = node?.data?.text || "Untitled Topic";
  raw = raw.replace(/^\[[ xX]\]\s*/, "");
  const linkMatch = raw.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  let title = raw;
  if (linkMatch) {
    const target = linkMatch[1];
    const alias = linkMatch[2] || target.split("/").pop();
    title = raw.replace(/\[\[[^\]]+\]\]/g, alias).trim();
  }
  title = title.replace(/[\\/:*?"<>|#^\[\]\r\n]/g, " ").trim().replace(/\s+/g, " ") || "Untitled Topic";
  const outline = treeToMarkdownOutline(node);
  const content = `---
crisp-type: topic-note
title: ${JSON.stringify(title)}
created: "${new Date().toISOString().slice(0, 10)}"
tags: [topic, crisp/mind]
---

${outline.trim()}
`;
  return { title, content };
}

/* ==========================================================================
   Theme Palettes & Obsidian Integration
   ========================================================================== */

const CRISP_BRANCH_PALETTES = {
  "crisp-obsidian": {
    light: ["#006a9e", "#a04f00", "#007a59", "#9e3d74", "#b53d1d", "#786a00", "#1f5d9b", "#61439a"],
    dark: ["#56b4e9", "#e69f00", "#009e73", "#cc79a7", "#d55e00", "#f0e442", "#0072b2", "#b09ef5"]
  },
  "crisp-cupertino": {
    light: ["#0759ad", "#a95300", "#26723a", "#8f3fa6", "#b52f60", "#137d8b", "#77521f", "#2376a0"],
    dark: ["#65aaff", "#ffad5c", "#68c887", "#d49be7", "#ff7d9e", "#67cbd5", "#d1ad77", "#73c2ee"]
  },
  "crisp-nord": {
    light: ["#456b91", "#9a653d", "#4f796b", "#92627e", "#a45445", "#74702e", "#426e83", "#6c5e99"],
    dark: ["#88c0d0", "#d08770", "#a3be8c", "#b48ead", "#bf616a", "#ebcb8b", "#81a1c1", "#8fbcbb"]
  },
  "crisp-mono": {
    light: ["#b3261e", "#292929", "#5c5c5c", "#858585", "#484848", "#a04f45", "#707070", "#383838"],
    dark: ["#ff766e", "#ededed", "#bababa", "#929292", "#d2d2d2", "#e3948d", "#a5a5a5", "#f5f5f5"]
  },
  "crisp-amber": {
    light: ["#a64b00", "#146b5a", "#51408f", "#a12e43", "#245f94", "#6b6900", "#8e4b73", "#42736e"],
    dark: ["#ffad55", "#62c2ae", "#b3a0ff", "#ff8196", "#7fb8ed", "#dfd270", "#d18ab4", "#84c0b6"]
  },
  "crisp-paper": {
    light: ["#a65437", "#4c725e", "#476a80", "#8d6280", "#827034", "#4b7773", "#9b5a4a", "#6e608d"],
    dark: ["#d58a61", "#86b08f", "#84acc3", "#c09ab7", "#c0aa64", "#82b5ad", "#e28c75", "#aa9acb"]
  }
};

function branchPaletteFor(themeName, isDark) {
  const palette = CRISP_BRANCH_PALETTES[themeName] || CRISP_BRANCH_PALETTES["crisp-obsidian"];
  return (isDark ? palette.dark : palette.light).slice();
}

function parseColorChannels(color) {
  const value = String(color || "").trim();
  let match = value.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (match) {
    const hex = match[1].length === 3 ? [...match[1]].map(ch => ch + ch).join("") : match[1];
    return [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
  }
  match = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (match) return match.slice(1, 4).map(channel => Math.max(0, Math.min(255, Number(channel))));
  return null;
}

function channelsToHex(channels) {
  return `#${channels.map(channel => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

function createBranchColorMap(root, palette, backgroundColor) {
  const result = new Map();
  if (!root || !Array.isArray(root.children) || !Array.isArray(palette) || !palette.length) return result;
  const background = parseColorChannels(backgroundColor) || [255, 255, 255];
  const walk = (node, branchIndex, depth) => {
    const baseColor = palette[branchIndex % palette.length];
    const base = parseColorChannels(baseColor);
    if (node?.id != null) {
      const tint = Math.min(0.4, Math.max(0, depth - 1) * 0.08);
      const color = !base || tint === 0
        ? baseColor
        : channelsToHex(base.map((channel, index) => channel * (1 - tint) + background[index] * tint));
      result.set(node.id, { color, branchIndex, depth });
    }
    (node?.children || []).forEach(child => walk(child, branchIndex, depth + 1));
  };
  root.children.forEach((child, index) => walk(child, index, 1));
  return result;
}

function sampleCubicBezierPoints(start, control1, control2, end, segments = 20) {
  const count = Math.max(2, Math.min(64, Math.floor(Number(segments)) || 20));
  const points = [];
  for (let index = 0; index <= count; index++) {
    const t = index / count, inverse = 1 - t;
    const a = inverse * inverse * inverse;
    const b = 3 * inverse * inverse * t;
    const c = 3 * inverse * t * t;
    const d = t * t * t;
    points.push({
      x: a * start.x + b * control1.x + c * control2.x + d * end.x,
      y: a * start.y + b * control1.y + c * control2.y + d * end.y
    });
  }
  return points;
}

function taperedPathFromPoints(points, startWidth = 4.2, endWidth = 1.4) {
  if (!Array.isArray(points) || points.length < 2) return "";
  const compact = [];
  for (const point of points) {
    const x = Number(point?.x), y = Number(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return "";
    if (!compact.length || Math.hypot(x - compact[compact.length - 1].x, y - compact[compact.length - 1].y) > 0.001) {
      compact.push({ x, y });
    }
  }
  if (compact.length < 2) return "";
  const segmentLengths = compact.slice(1).map((point, index) => Math.hypot(point.x - compact[index].x, point.y - compact[index].y));
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  if (!Number.isFinite(totalLength) || totalLength <= 0) return "";
  const left = [], right = [];
  let distance = 0;
  compact.forEach((point, index) => {
    if (index > 0) distance += segmentLengths[index - 1];
    const before = compact[Math.max(0, index - 1)];
    const after = compact[Math.min(compact.length - 1, index + 1)];
    let dx = after.x - before.x, dy = after.y - before.y;
    let length = Math.hypot(dx, dy);
    if (length <= 0.001) {
      dx = index < compact.length - 1 ? after.x - point.x : point.x - before.x;
      dy = index < compact.length - 1 ? after.y - point.y : point.y - before.y;
      length = Math.hypot(dx, dy);
    }
    if (length <= 0.001) return;
    const progress = distance / totalLength;
    const width = Math.max(0.8, Number(startWidth) + (Number(endWidth) - Number(startWidth)) * progress);
    const nx = -dy / length, ny = dx / length, offset = width / 2;
    left.push({ x: point.x + nx * offset, y: point.y + ny * offset });
    right.push({ x: point.x - nx * offset, y: point.y - ny * offset });
  });
  if (left.length < 2 || right.length !== left.length) return "";
  const format = point => `${Number(point.x.toFixed(2))} ${Number(point.y.toFixed(2))}`;
  return `M ${format(left[0])} L ${left.slice(1).map(format).join(" L ")} L ${right.reverse().map(format).join(" L ")} Z`;
}

function relationNodeRects(nodes, excludedIds = new Set(), clearance = 0) {
  const gap = Math.max(0, Number(clearance) || 0);
  return (Array.isArray(nodes) ? nodes : []).filter(node => !excludedIds.has(node?.id)).map(node => {
    const x = Number(node?._x ?? node?.x);
    const y = Number(node?._y ?? node?.y);
    const width = Number(node?._w ?? node?.width);
    const height = Number(node?._h ?? node?.height);
    if (![x, y, width, height].every(Number.isFinite)) return null;
    return {left: x - gap, top: y - gap, right: x + width + gap, bottom: y + height + gap};
  }).filter(Boolean);
}

function relationPointInsideRect(point, rect) {
  return point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom;
}

function relationSegmentBlocked(start, end, rect) {
  if (Math.abs(start.y - end.y) < 0.001) {
    const y = start.y;
    return y > rect.top && y < rect.bottom &&
      Math.max(Math.min(start.x, end.x), rect.left) < Math.min(Math.max(start.x, end.x), rect.right);
  }
  if (Math.abs(start.x - end.x) < 0.001) {
    const x = start.x;
    return x > rect.left && x < rect.right &&
      Math.max(Math.min(start.y, end.y), rect.top) < Math.min(Math.max(start.y, end.y), rect.bottom);
  }
  return true;
}

function relationLineSegmentIntersectsRect(start, end, rect) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const p = [-dx, dx, -dy, dy];
  const q = [start.x - rect.left, rect.right - start.x, start.y - rect.top, rect.bottom - start.y];
  let low = 0, high = 1;
  for (let index = 0; index < 4; index++) {
    if (Math.abs(p[index]) < 0.000001) {
      if (q[index] < 0) return false;
      continue;
    }
    const ratio = q[index] / p[index];
    if (p[index] < 0) low = Math.max(low, ratio);
    else high = Math.min(high, ratio);
    if (low > high) return false;
  }
  return true;
}

function relationRouteIntersectsNodes(points, nodes, excludedIds = new Set(), clearance = 1) {
  if (!Array.isArray(points) || points.length < 2) return false;
  const obstacles = relationNodeRects(nodes, excludedIds, clearance);
  for (let index = 1; index < points.length; index++) {
    if (obstacles.some(rect => relationLineSegmentIntersectsRect(points[index - 1], points[index], rect))) return true;
  }
  return false;
}

function findOrthogonalRelationRoute(start, end, nodes, excludedIds = new Set(), clearance = 8) {
  if (![start?.x, start?.y, end?.x, end?.y].every(value => Number.isFinite(Number(value)))) return null;
  const source = {x: Number(start.x), y: Number(start.y)};
  const target = {x: Number(end.x), y: Number(end.y)};
  const excluded = excludedIds instanceof Set ? excludedIds : new Set(excludedIds || []);
  const requestedGap = Math.max(0, Number(clearance) || 0);

  for (const gap of [...new Set([requestedGap, Math.round(requestedGap / 2), 0])]) {
    const obstacles = relationNodeRects(nodes, excluded, gap);
    if (obstacles.some(rect => relationPointInsideRect(source, rect) || relationPointInsideRect(target, rect))) continue;
    const xs = [source.x, target.x], ys = [source.y, target.y];
    for (const rect of obstacles) {
      xs.push(rect.left, rect.right);
      ys.push(rect.top, rect.bottom);
    }
    const outerGap = Math.max(28, gap * 4);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    xs.push(minX - outerGap, maxX + outerGap);
    ys.push(minY - outerGap, maxY + outerGap);
    const normalize = values => [...new Set(values.map(value => Math.round(value * 1000) / 1000))].sort((a, b) => a - b);
    const xValues = normalize(xs), yValues = normalize(ys);
    if (xValues.length * yValues.length > 40000) continue;
    const xIndex = new Map(xValues.map((value, index) => [value, index]));
    const yIndex = new Map(yValues.map((value, index) => [value, index]));
    const startX = xIndex.get(Math.round(source.x * 1000) / 1000);
    const startY = yIndex.get(Math.round(source.y * 1000) / 1000);
    const endX = xIndex.get(Math.round(target.x * 1000) / 1000);
    const endY = yIndex.get(Math.round(target.y * 1000) / 1000);
    const blockedPoint = (x, y) => obstacles.some(rect => relationPointInsideRect({x, y}, rect));
    if (blockedPoint(source.x, source.y) || blockedPoint(target.x, target.y)) continue;

    const open = [];
    const push = item => {
      open.push(item);
      let index = open.length - 1;
      while (index > 0) {
        const parent = Math.floor((index - 1) / 2);
        if (open[parent].f <= item.f) break;
        open[index] = open[parent];
        index = parent;
      }
      open[index] = item;
    };
    const pop = () => {
      if (!open.length) return null;
      const first = open[0], last = open.pop();
      if (open.length && last) {
        let index = 0;
        while (true) {
          const left = index * 2 + 1, right = left + 1;
          if (left >= open.length) break;
          const child = right < open.length && open[right].f < open[left].f ? right : left;
          if (open[child].f >= last.f) break;
          open[index] = open[child];
          index = child;
        }
        open[index] = last;
      }
      return first;
    };
    const stateKey = (x, y, direction) => `${x}:${y}:${direction}`;
    const startKey = stateKey(startX, startY, 0);
    const distances = new Map([[startKey, 0]]);
    const parents = new Map();
    const states = new Map([[startKey, {x: startX, y: startY, direction: 0}]]);
    const heuristic = (x, y) => Math.abs(xValues[x] - target.x) + Math.abs(yValues[y] - target.y);
    push({x: startX, y: startY, direction: 0, g: 0, f: heuristic(startX, startY), key: startKey});
    let destinationKey = null;
    const turnPenalty = 18;

    while (open.length) {
      const current = pop();
      if (!current || current.g !== distances.get(current.key)) continue;
      if (current.x === endX && current.y === endY) {
        destinationKey = current.key;
        break;
      }
      const neighbors = [
        [current.x - 1, current.y, 1], [current.x + 1, current.y, 1],
        [current.x, current.y - 1, 2], [current.x, current.y + 1, 2]
      ];
      const here = {x: xValues[current.x], y: yValues[current.y]};
      for (const [nextX, nextY, direction] of neighbors) {
        if (nextX < 0 || nextX >= xValues.length || nextY < 0 || nextY >= yValues.length) continue;
        const next = {x: xValues[nextX], y: yValues[nextY]};
        if (blockedPoint(next.x, next.y) || obstacles.some(rect => relationSegmentBlocked(here, next, rect))) continue;
        const cost = Math.abs(next.x - here.x) + Math.abs(next.y - here.y) +
          (current.direction && current.direction !== direction ? turnPenalty : 0);
        const nextG = current.g + cost;
        const nextKey = stateKey(nextX, nextY, direction);
        if (nextG >= (distances.get(nextKey) ?? Infinity)) continue;
        distances.set(nextKey, nextG);
        parents.set(nextKey, current.key);
        states.set(nextKey, {x: nextX, y: nextY, direction});
        push({x: nextX, y: nextY, direction, g: nextG, f: nextG + heuristic(nextX, nextY), key: nextKey});
      }
    }
    if (!destinationKey) continue;
    const route = [];
    for (let key = destinationKey; key; key = parents.get(key)) {
      const state = states.get(key);
      route.push({x: xValues[state.x], y: yValues[state.y]});
    }
    route.reverse();
    route[0] = source;
    route[route.length - 1] = target;
    const compact = [];
    for (const point of route) {
      const previous = compact[compact.length - 1];
      if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.001) continue;
      while (compact.length >= 2) {
        const before = compact[compact.length - 2], last = compact[compact.length - 1];
        if ((Math.abs(before.x - last.x) < 0.001 && Math.abs(last.x - point.x) < 0.001) ||
            (Math.abs(before.y - last.y) < 0.001 && Math.abs(last.y - point.y) < 0.001)) compact.pop();
        else break;
      }
      compact.push(point);
    }
    return compact;
  }
  return null;
}

function roundedOrthogonalPath(points, radius = 10) {
  if (!Array.isArray(points) || points.length < 2) return "";
  const compact = [];
  for (const point of points) {
    if (!Number.isFinite(Number(point?.x)) || !Number.isFinite(Number(point?.y))) return "";
    const normalized = {x: Number(point.x), y: Number(point.y)};
    const previous = compact[compact.length - 1];
    if (previous && Math.hypot(normalized.x - previous.x, normalized.y - previous.y) < 0.001) continue;
    while (compact.length >= 2) {
      const before = compact[compact.length - 2], last = compact[compact.length - 1];
      if ((Math.abs(before.x - last.x) < 0.001 && Math.abs(last.x - normalized.x) < 0.001) ||
          (Math.abs(before.y - last.y) < 0.001 && Math.abs(last.y - normalized.y) < 0.001)) compact.pop();
      else break;
    }
    compact.push(normalized);
  }
  if (compact.length < 2) return "";
  const fmt = point => `${Number(point.x.toFixed(2))} ${Number(point.y.toFixed(2))}`;
  let path = `M ${fmt(compact[0])}`;
  for (let index = 1; index < compact.length - 1; index++) {
    const previous = compact[index - 1], corner = compact[index], next = compact[index + 1];
    const incomingLength = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const outgoingLength = Math.hypot(next.x - corner.x, next.y - corner.y);
    const bend = Math.min(Math.max(0, Number(radius) || 0), incomingLength / 2, outgoingLength / 2);
    if (bend <= 0.001) {
      path += ` L ${fmt(corner)}`;
      continue;
    }
    const before = {x: corner.x + (previous.x - corner.x) / incomingLength * bend, y: corner.y + (previous.y - corner.y) / incomingLength * bend};
    const after = {x: corner.x + (next.x - corner.x) / outgoingLength * bend, y: corner.y + (next.y - corner.y) / outgoingLength * bend};
    path += ` L ${fmt(before)} Q ${fmt(corner)} ${fmt(after)}`;
  }
  return `${path} L ${fmt(compact[compact.length - 1])}`;
}

function findRelationLabelPosition(route, width, height, nodes, clearance = 6) {
  if (!Array.isArray(route) || route.length < 2) return null;
  const labelWidth = Math.max(1, Number(width) || 1), labelHeight = Math.max(1, Number(height) || 1);
  const obstacles = relationNodeRects(nodes, new Set(), Math.max(0, Number(clearance) || 0));
  const candidates = [];
  for (let index = 1; index < route.length; index++) {
    const start = route[index - 1], end = route[index];
    const horizontal = Math.abs(start.y - end.y) < 0.001;
    const length = horizontal ? Math.abs(end.x - start.x) : Math.abs(end.y - start.y);
    const needed = (horizontal ? labelWidth : labelHeight) + 20;
    if (length < needed) continue;
    for (const ratio of [0.5, 0.35, 0.65, 0.2, 0.8]) {
      const centerX = horizontal ? start.x + (end.x - start.x) * ratio : start.x;
      const centerY = horizontal ? start.y : start.y + (end.y - start.y) * ratio;
      for (const side of [-1, 1]) {
        const candidate = horizontal
          ? {x: centerX - labelWidth / 2, y: side < 0 ? centerY - labelHeight - 8 : centerY + 8, width: labelWidth, height: labelHeight}
          : {x: side < 0 ? centerX - labelWidth - 8 : centerX + 8, y: centerY - labelHeight / 2, width: labelWidth, height: labelHeight};
        const overlaps = obstacles.some(rect => candidate.x < rect.right && candidate.x + candidate.width > rect.left &&
          candidate.y < rect.bottom && candidate.y + candidate.height > rect.top);
        if (!overlaps) candidates.push({...candidate, score: -length + Math.abs(ratio - 0.5)});
      }
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  if (!candidates.length) return null;
  const {score, ...position} = candidates[0];
  return position;
}

function taskStateFromText(text) {
  const match = String(text || "").match(/^\[([ xX])\](?=\s|$)/);
  if (!match) return null;
  return match[1].toLowerCase() === "x";
}

function getDescendantTaskProgress(node) {
  let completed = 0, total = 0;
  const visit = current => {
    const taskState = taskStateFromText(current?.data?.text);
    if (taskState !== null) {
      total++;
      if (taskState) completed++;
    }
    (current?.children || []).forEach(visit);
  };
  (node?.children || []).forEach(visit);
  return { total, completed, ratio: total ? completed / total : 0 };
}

function createTaskProgressMap(root) {
  const result = new Map();
  const visit = node => {
    let total = 0, completed = 0;
    (node?.children || []).forEach(child => {
      const aggregate = visit(child);
      total += aggregate.total;
      completed += aggregate.completed;
    });
    const progress = { total, completed, ratio: total ? completed / total : 0 };
    if (node?.id != null) result.set(node.id, progress);
    const ownTask = taskStateFromText(node?.data?.text);
    return {
      total: total + (ownTask === null ? 0 : 1),
      completed: completed + (ownTask === true ? 1 : 0)
    };
  };
  if (root) visit(root);
  return result;
}

function getComputedThemeConfig(themeName = "crisp-obsidian") {
  const isDark = typeof document !== "undefined" && document.body?.classList?.contains
    ? document.body.classList.contains("theme-dark")
    : false;

  if (themeName === "crisp-cupertino") {
    return {
      name: "crisp-cupertino",
      backgroundColor: isDark ? "#1c1c1e" : "#f2f2f7",
      nodeBackground: isDark ? "#2c2c2e" : "#ffffff",
      accentColor: "#007aff",
      textColor: isDark ? "#f2f2f7" : "#1c1c1e",
      textMuted: isDark ? "#8e8e93" : "#6c6c70",
      borderColor: isDark ? "#3a3a3c" : "#d1d1d6",
      lineColor: "#007aff",
      branchColors: branchPaletteFor("crisp-cupertino", isDark),
      activeBorderColor: "#5856d6",
      borderRadius: 8
    };
  }

  if (themeName === "crisp-nord") {
    return {
      name: "crisp-nord",
      backgroundColor: "#2e3440",
      nodeBackground: "#3b4252",
      accentColor: "#88c0d0",
      textColor: "#eceff4",
      textMuted: "#d8dee9",
      borderColor: "#4c566a",
      lineColor: "#81a1c1",
      branchColors: branchPaletteFor("crisp-nord", isDark),
      activeBorderColor: "#8fbcbb",
      borderRadius: 6
    };
  }

  if (themeName === "crisp-mono") {
    return {
      name: "crisp-mono",
      backgroundColor: isDark ? "#121212" : "#f7f7f5",
      nodeBackground: isDark ? "#1e1e1e" : "#ffffff",
      accentColor: isDark ? "#e63946" : "#111111",
      textColor: isDark ? "#e0e0e0" : "#111111",
      textMuted: isDark ? "#757575" : "#666666",
      borderColor: isDark ? "#333333" : "#cccccc",
      lineColor: isDark ? "#e63946" : "#222222",
      branchColors: branchPaletteFor("crisp-mono", isDark),
      activeBorderColor: "#e63946",
      borderRadius: 4
    };
  }

  if (themeName === "crisp-amber") {
    return {
      name: "crisp-amber",
      backgroundColor: isDark ? "#1a1612" : "#fffbeb",
      nodeBackground: isDark ? "#29231d" : "#fef3c7",
      accentColor: "#d97706",
      textColor: isDark ? "#fde68a" : "#78350f",
      textMuted: isDark ? "#b45309" : "#92400e",
      borderColor: isDark ? "#451a03" : "#fcd34d",
      lineColor: "#d97706",
      branchColors: branchPaletteFor("crisp-amber", isDark),
      activeBorderColor: "#f59e0b",
      borderRadius: 10
    };
  }

  if (themeName === "crisp-paper") {
    return {
      name: "crisp-paper",
      backgroundColor: isDark ? "#20211f" : "#f6f1e8",
      nodeBackground: isDark ? "#2a2b28" : "#fffdf8",
      accentColor: isDark ? "#d58a61" : "#a65437",
      textColor: isDark ? "#ece7de" : "#302b25",
      textMuted: isDark ? "#aaa095" : "#756a5f",
      borderColor: isDark ? "#474640" : "#ded3c3",
      lineColor: isDark ? "#8e7868" : "#b5a58f",
      branchColors: branchPaletteFor("crisp-paper", isDark),
      activeBorderColor: isDark ? "#e8a47f" : "#8f4a31",
      borderRadius: 5,
      fontFamily: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
      paperPattern: true,
      patternColor: isDark ? "rgba(255,255,255,0.055)" : "rgba(83,68,49,0.10)",
      nodeShadow: isDark
        ? "drop-shadow(0 2px 5px rgba(0, 0, 0, 0.24))"
        : "drop-shadow(0 2px 4px rgba(74, 57, 37, 0.10))",
      rootShadow: isDark
        ? "drop-shadow(0 4px 10px rgba(0, 0, 0, 0.28))"
        : "drop-shadow(0 4px 10px rgba(142, 74, 49, 0.18))"
    };
  }

  // Default: crisp-obsidian (Dynamic CSS variable extraction)
  let accent = "#7c3aed";
  let bgPrimary = isDark ? "#1e1e2e" : "#ffffff";
  let bgSecondary = isDark ? "#181825" : "#f8f9fa";
  let textNormal = isDark ? "#cdd6f4" : "#1e1e2e";
  let textMuted = isDark ? "#a6adc8" : "#6c757d";
  let border = isDark ? "#313244" : "#dee2e6";

  if (typeof window !== "undefined" && window.getComputedStyle) {
    const style = window.getComputedStyle(document.body);
    accent = style.getPropertyValue("--color-accent")?.trim() || accent;
    bgPrimary = style.getPropertyValue("--background-primary")?.trim() || bgPrimary;
    bgSecondary = style.getPropertyValue("--background-secondary")?.trim() || bgSecondary;
    textNormal = style.getPropertyValue("--text-normal")?.trim() || textNormal;
    textMuted = style.getPropertyValue("--text-muted")?.trim() || textMuted;
    border = style.getPropertyValue("--background-modifier-border")?.trim() || border;
  }

  const isTranslucent = typeof document !== "undefined" && document.body?.classList?.contains
    ? document.body.classList.contains("is-translucent")
    : false;

  return {
    name: "crisp-obsidian",
    backgroundColor: isTranslucent ? "transparent" : bgPrimary,
    // Exports need an opaque fill even when the window itself is translucent.
    solidBackground: bgPrimary,
    nodeBackground: bgSecondary,
    accentColor: accent,
    textColor: textNormal,
    textMuted: textMuted,
    borderColor: border,
    lineColor: accent,
    branchColors: branchPaletteFor("crisp-obsidian", isDark),
    activeBorderColor: accent,
    borderRadius: 8
  };
}

/* ==========================================================================
   Crisp Mind SVG Canvas Controller
   ========================================================================== */

function inlineEditorFrame(node, scale, translateX, translateY, viewportWidth, viewportHeight) {
  const w = viewportWidth || 800, h = viewportHeight || 600;
  const fittedScale = Math.min(scale, Math.max(0.05, (w - 16) / node._w), Math.max(0.05, (h - 16) / node._h));
  const width = node._w * fittedScale, height = node._h * fittedScale;
  const x = node._x * fittedScale + translateX, y = node._y * fittedScale + translateY;
  const dx = x < 8 ? 8 - x : x + width > w - 8 ? w - 8 - x - width : 0;
  const dy = y < 8 ? 8 - y : y + height > h - 8 ? h - 8 - y - height : 0;
  return {left: x + dx, top: y + dy, width, height, scale: fittedScale, translateX: translateX + dx, translateY: translateY + dy};
}

class CrispMindCanvas {
  constructor(containerEl, docData, options = {}) {
    this.container = containerEl;
    this.document = containerEl.ownerDocument || document;
    this.window = this.document.defaultView || window;
    this.disposers = [];
    this.docData = docData;
    this.options = options;
    this.theme = getComputedThemeConfig(docData.theme || "crisp-obsidian");
    this.layout = docData.layout || "logicalStructure";

    this.scale = 1;
    this.translateX = 120;
    this.translateY = 220;
    this.isPanning = false;
    this.startX = 0;
    this.startY = 0;

    this.selectedNodeId = null;
    this.selectedNodeIds = new Set();
    this.selectionAnchorId = null;
    this.history = [];
    this.historyIndex = -1;
    this.branchFocusId = null;
    this.revealedAncestorIds = new Set();
    this.presentationAncestorIds = new Set();
    this.presentationActive = false;
    this.presentationIndex = 0;

    this.saveState(false);
    this.initCanvas();
  }

  layoutRoot() {
    return (this.branchFocusId && this.findNode(this.branchFocusId)) || this.docData.root;
  }

  ancestorIds(id) {
    const ids = new Set();
    for (let parent = this.findParent(id); parent; parent = this.findParent(parent.id)) ids.add(parent.id);
    return ids;
  }

  isNodeExpanded(node) {
    return !node.data?.collapsed || node.id === this.branchFocusId ||
      this.revealedAncestorIds.has(node.id) || this.presentationAncestorIds.has(node.id);
  }

  getPresentationSteps() {
    return normalizePresentationSteps(this.docData.presentation?.steps, this.docData.root);
  }

  nodePath(id) {
    const path = [];
    const walk = (node, chain) => {
      if (!node) return false;
      const display = mindNodeLink(node.data?.text || "", this.options.vaultName)?.display || node.data?.text || "Topic";
      const next = [...chain, display];
      if (node.id === id) {
        path.push(...next);
        return true;
      }
      return (node.children || []).some(child => walk(child, next));
    };
    walk(this.docData.root, []);
    return path;
  }

  selectedNodes() {
    const result = [];
    const walk = node => {
      if (!node) return;
      if (this.selectedNodeIds.has(node.id)) result.push(node);
      (node.children || []).forEach(walk);
    };
    walk(this.docData.root);
    return result;
  }

  setSelectionState(ids, primaryId = null) {
    const valid = new Set();
    for (const id of ids || []) {
      if (this.findNode(id)) valid.add(id);
    }
    this.selectedNodeIds = valid;
    this.selectedNodeId = valid.has(primaryId) ? primaryId : [...valid][0] || null;
    this.selectionAnchorId = this.selectedNodeId;
  }

  setNodeSelection(ids, primaryId = null, notify = true) {
    this.setSelectionState(ids, primaryId);
    this.render();
    if (notify) this.options.onSelectionChange?.(this.selectedNodes());
  }

  selectNode(id, reveal = false, options = {}) {
    const node = this.findNode(id); if (!node) return;
    if (reveal) {
      const ancestors = this.ancestorIds(id);
      if (this.branchFocusId && this.branchFocusId !== id && !ancestors.has(this.branchFocusId)) this.clearBranchFocus();
      this.revealedAncestorIds = ancestors;
    }
    if (options.additive) {
      if (this.selectedNodeIds.has(id)) this.selectedNodeIds.delete(id);
      else this.selectedNodeIds.add(id);
      this.selectedNodeId = this.selectedNodeIds.has(id)
        ? id
        : [...this.selectedNodeIds][0] || null;
      this.selectionAnchorId = id;
    } else {
      this.selectedNodeIds = new Set([id]);
      this.selectedNodeId = id;
      this.selectionAnchorId = id;
    }
    this.render();
    if (reveal) {
      const x = (node._x + node._w / 2) * this.scale + this.translateX;
      const y = (node._y + node._h / 2) * this.scale + this.translateY;
      if (x < 40 || x > this.container.clientWidth - 40 || y < 60 || y > this.container.clientHeight - 100) {
        this.translateX += this.container.clientWidth / 2 - x;
        this.translateY += this.container.clientHeight / 2 - y; this.updateTransform();
      }
    }
    this.options.onSelectionChange?.(this.selectedNodes());
    this.options.onSelectNode?.(node, {x: (node._x + node._w / 2) * this.scale + this.translateX, y: node._y * this.scale + this.translateY});
  }

  selectVisibleRange(fromId, toId) {
    const nodes = this.visibleNodes();
    const from = nodes.findIndex(node => node.id === fromId);
    const to = nodes.findIndex(node => node.id === toId);
    if (from < 0 || to < 0) return false;
    const slice = from <= to ? nodes.slice(from, to + 1) : nodes.slice(to, from + 1);
    this.setNodeSelection(slice.map(node => node.id), toId);
    return true;
  }

  handleNodeClick(node, event) {
    if (event.shiftKey && this.selectionAnchorId) {
      this.selectVisibleRange(this.selectionAnchorId, node.id);
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      this.selectNode(node.id, false, { additive: true });
      return;
    }
    this.selectNode(node.id);
  }

  updateSelectedNodeStyles(patch = {}) {
    const nodes = this.selectedNodes();
    if (!nodes.length) return false;
    return this.transact(() => {
      for (const node of nodes) {
        const current = normalizeNodeStyle(node.data.style) || {};
        for (const [key, value] of Object.entries(patch)) {
          if (value == null || value === "") delete current[key];
          else current[key] = value;
        }
        const normalized = normalizeNodeStyle(current);
        if (normalized) node.data.style = normalized;
        else delete node.data.style;
      }
    });
  }

  updateSelectedNodeNote(note) {
    const node = this.selectedNodes()[0];
    if (!node) return false;
    const normalized = typeof note === "string" ? note.slice(0, 5000) : "";
    return this.transact(() => {
      if (normalized.trim()) node.data.note = normalized;
      else delete node.data.note;
    });
  }

  addRelation(fromId, toId, label = "", color = "") {
    if (fromId === toId || !this.findNode(fromId) || !this.findNode(toId)) return null;
    const existing = (this.docData.relations || []).find(relation =>
      (relation.from === fromId && relation.to === toId) || (relation.from === toId && relation.to === fromId)
    );
    if (existing) {
      this.transact(() => {
        existing.label = String(label || "").slice(0, 200);
        const normalizedColor = normalizeMindColor(color);
        if (normalizedColor) existing.color = normalizedColor;
        else delete existing.color;
      });
      return existing;
    }
    const relation = {
      id: `relation-${generateUid()}`,
      from: fromId,
      to: toId,
      label: String(label || "").slice(0, 200),
      ...(normalizeMindColor(color) ? { color: normalizeMindColor(color) } : {})
    };
    const changed = this.transact(() => {
      if (!Array.isArray(this.docData.relations)) this.docData.relations = [];
      this.docData.relations.push(relation);
    });
    return changed ? relation : null;
  }

  removeRelation(id) {
    return this.transact(() => {
      if (!Array.isArray(this.docData.relations)) return false;
      const next = this.docData.relations.filter(relation => relation.id !== id);
      if (next.length === this.docData.relations.length) return false;
      if (next.length) this.docData.relations = next;
      else delete this.docData.relations;
    });
  }

  setBoundary(nodeId, label = "", color = "") {
    if (!this.findNode(nodeId)) return false;
    return this.transact(() => {
      if (!Array.isArray(this.docData.boundaries)) this.docData.boundaries = [];
      const existing = this.docData.boundaries.find(boundary => boundary.nodeId === nodeId);
      if (existing) {
        existing.label = String(label || "").slice(0, 200);
        existing.color = normalizeMindColor(color) || existing.color || "";
        return;
      }
      this.docData.boundaries.push({
        id: `boundary-${generateUid()}`,
        nodeId,
        label: String(label || "").slice(0, 200),
        color: normalizeMindColor(color)
      });
    });
  }

  removeBoundary(nodeId) {
    return this.transact(() => {
      if (!Array.isArray(this.docData.boundaries)) return false;
      const next = this.docData.boundaries.filter(boundary => boundary.nodeId !== nodeId);
      if (next.length === this.docData.boundaries.length) return false;
      if (next.length) this.docData.boundaries = next;
      else delete this.docData.boundaries;
    });
  }

  setSummary(nodeId, label = "", color = "") {
    if (!this.findNode(nodeId)) return false;
    return this.transact(() => {
      if (!Array.isArray(this.docData.summaries)) this.docData.summaries = [];
      const existing = this.docData.summaries.find(summary => summary.nodeId === nodeId);
      if (existing) {
        existing.label = String(label || "").slice(0, 200);
        existing.color = normalizeMindColor(color) || existing.color || "";
        return;
      }
      this.docData.summaries.push({
        id: `summary-${generateUid()}`,
        nodeId,
        label: String(label || "").slice(0, 200),
        color: normalizeMindColor(color)
      });
    });
  }

  removeSummary(nodeId) {
    return this.transact(() => {
      if (!Array.isArray(this.docData.summaries)) return false;
      const next = this.docData.summaries.filter(summary => summary.nodeId !== nodeId);
      if (next.length === this.docData.summaries.length) return false;
      if (next.length) this.docData.summaries = next;
      else delete this.docData.summaries;
    });
  }

  setBranchFocus(id = this.selectedNodeId) {
    const node = this.findNode(id);
    if (!node) return false;
    this.stopPresentation();
    this.revealedAncestorIds.clear();
    this.branchFocusId = node.id;
    this.setSelectionState([node.id], node.id);
    this.render();
    this.resetZoom();
    this.container.focus?.({ preventScroll: true });
    this.options.onBranchFocus?.(node, this.nodePath(node.id));
    this.options.onSelectionChange?.(this.selectedNodes());
    return true;
  }

  clearBranchFocus() {
    if (!this.branchFocusId) return;
    this.branchFocusId = null;
    this.render();
    this.resetZoom();
    this.options.onBranchFocus?.(null, []);
  }

  centerOnNode(id, targetScale) {
    const node = this.findNode(id);
    if (!node) return false;
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;
    if (Number.isFinite(targetScale)) this.scale = Math.max(0.05, Math.min(2.5, targetScale));
    this.translateX = width / 2 - (node._x + node._w / 2) * this.scale;
    this.translateY = height / 2 - (node._y + node._h / 2) * this.scale;
    this.updateTransform();
    this.options.onZoom?.(this.scale);
    return true;
  }

  setPresentationSteps(steps) {
    if (this.options.readOnly) return false;
    const normalized = normalizePresentationSteps(steps, this.docData.root);
    if (normalized.length) this.docData.presentation = { steps: normalized };
    else delete this.docData.presentation;
    const changed = this.saveState();
    if (this.presentationIndex >= normalized.length) this.presentationIndex = Math.max(0, normalized.length - 1);
    if (this.presentationActive && !normalized.length) this.stopPresentation(false);
    this.render();
    return changed;
  }

  startPresentation(startIndex = 0) {
    const steps = this.getPresentationSteps();
    if (!steps.length) return false;
    this.clearBranchFocus();
    this.presentationActive = true;
    this.presentationIndex = Math.max(0, Math.min(steps.length - 1, startIndex));
    this.render();
    this.goToPresentationStep(this.presentationIndex);
    this.container.focus?.({ preventScroll: true });
    return true;
  }

  goToPresentationStep(index) {
    const steps = this.getPresentationSteps();
    if (!steps.length) {
      this.stopPresentation();
      return false;
    }
    this.presentationIndex = Math.max(0, Math.min(steps.length - 1, Number(index) || 0));
    const node = this.findNode(steps[this.presentationIndex].nodeId);
    if (!node) return false;
    this.presentationActive = true;
    this.presentationAncestorIds = this.ancestorIds(node.id);
    this.setSelectionState([node.id], node.id);
    this.render();
    this.centerOnNode(node.id, Math.max(0.72, Math.min(1.2, this.scale)));
    this.options.onPresentationChange?.({ active: true, index: this.presentationIndex, total: steps.length });
    return true;
  }

  stopPresentation(notify = true) {
    if (!this.presentationActive) return;
    this.presentationActive = false;
    this.presentationAncestorIds.clear();
    this.render();
    if (notify) this.options.onPresentationChange?.({ active: false, index: this.presentationIndex, total: this.getPresentationSteps().length });
  }

  initCanvas() {
    this.container.classList.add("crisp-mind-view");
    this.container.tabIndex = 0;
    // Obsidian treats aria-label as a hover tooltip; name the canvas by a label
    // reference instead so it cannot compete with individual button tooltips.
    const canvasLabel = this.document.createElement("span");
    canvasLabel.id = generateUid();
    canvasLabel.className = "crisp-mind-accessible-label";
    canvasLabel.textContent = "思维导图画布";
    this.container.appendChild(canvasLabel);
    this.container.setAttribute("role", "group");
    this.container.setAttribute("aria-labelledby", canvasLabel.id);

    // Remove old svg if re-initializing
    const oldSvg = this.container.querySelector("svg.crisp-mind-canvas");
    if (oldSvg) oldSvg.remove();

    this.svg = this.document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("class", "crisp-mind-canvas");
    this.container.insertBefore(this.svg, this.container.firstChild);

    this.viewportGroup = this.document.createElementNS("http://www.w3.org/2000/svg", "g");
    this.svg.appendChild(this.viewportGroup);

    this.boundaryGroup = this.document.createElementNS("http://www.w3.org/2000/svg", "g");
    this.linesGroup = this.document.createElementNS("http://www.w3.org/2000/svg", "g");
    this.relationsGroup = this.document.createElementNS("http://www.w3.org/2000/svg", "g");
    this.nodesGroup = this.document.createElementNS("http://www.w3.org/2000/svg", "g");
    this.annotationsGroup = this.document.createElementNS("http://www.w3.org/2000/svg", "g");
    this.viewportGroup.appendChild(this.boundaryGroup);
    this.viewportGroup.appendChild(this.linesGroup);
    this.viewportGroup.appendChild(this.relationsGroup);
    this.viewportGroup.appendChild(this.nodesGroup);
    this.viewportGroup.appendChild(this.annotationsGroup);

    this.bindEvents();
    this.render();
    if (this.window.ResizeObserver) {
      const observer = new this.window.ResizeObserver(() => {
        const width = this.container.clientWidth, height = this.container.clientHeight;
        if (!width || !height) return;
        if (!this.viewportSize) this.resetZoom();
        else {
          this.commitEditor?.();
          this.translateX += (width - this.viewportSize.width) / 2;
          this.translateY += (height - this.viewportSize.height) / 2;
          this.updateTransform();
        }
        this.viewportSize = {width, height};
      });
      observer.observe(this.container); this.disposers.push(() => observer.disconnect());
    }
  }

  saveState(notify = true) {
    const state = cleanMindData(this.docData);
    if (this.historyIndex >= 0 && JSON.stringify(this.history[this.historyIndex]) === JSON.stringify(state)) return false;
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push(state);
    this.historyIndex++;
    if (this.history.length > 50) {
      this.history.shift();
      this.historyIndex--;
    }
    if (notify && typeof this.options.onChange === "function") {
      this.options.onChange(this.docData);
    }
    return true;
  }

  undo() {
    if (this.options.readOnly) return;
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.restoreMindData(this.history[this.historyIndex]);
      const restoredSelection = this.selectedNodes();
      const restoredPrimary = restoredSelection.some(node => node.id === this.selectedNodeId)
        ? this.selectedNodeId
        : restoredSelection[0]?.id || this.docData.root.id;
      this.setSelectionState(
        restoredSelection.length ? restoredSelection.map(node => node.id) : [this.docData.root.id],
        restoredPrimary
      );
      this.layout = this.docData.layout;
      this.theme = getComputedThemeConfig(this.docData.theme);
      this.render();
      this.options.onSelectionChange?.(this.selectedNodes());
      if (typeof this.options.onChange === "function") {
        this.options.onChange(this.docData);
      }
    }
  }

  redo() {
    if (this.options.readOnly) return;
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.restoreMindData(this.history[this.historyIndex]);
      const restoredSelection = this.selectedNodes();
      const restoredPrimary = restoredSelection.some(node => node.id === this.selectedNodeId)
        ? this.selectedNodeId
        : restoredSelection[0]?.id || this.docData.root.id;
      this.setSelectionState(
        restoredSelection.length ? restoredSelection.map(node => node.id) : [this.docData.root.id],
        restoredPrimary
      );
      this.layout = this.docData.layout;
      this.theme = getComputedThemeConfig(this.docData.theme);
      this.render();
      this.options.onSelectionChange?.(this.selectedNodes());
      if (typeof this.options.onChange === "function") {
        this.options.onChange(this.docData);
      }
    }
  }

  restoreMindData(state) {
    for (const key of Object.keys(this.docData)) delete this.docData[key];
    Object.assign(this.docData, JSON.parse(JSON.stringify(state)));
  }

  setTheme(themeName) {
    this.docData.theme = themeName;
    this.theme = getComputedThemeConfig(themeName);
    this.render();
    if (!this.options.readOnly) this.saveState();
  }

  setLayout(layoutName) {
    this.docData.layout = layoutName;
    this.layout = layoutName;
    this.render();
    if (!this.options.readOnly) this.saveState();
  }

  findNode(id, node = this.docData.root) {
    if (!node) return null;
    if (node.id === id) return node;
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        const found = this.findNode(id, child);
        if (found) return found;
      }
    }
    return null;
  }

  findParent(id, node = this.docData.root, parent = null) {
    if (!node) return null;
    if (node.id === id) return parent;
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        const found = this.findParent(id, child, node);
        if (found) return found;
      }
    }
    return null;
  }

  addChildNode(parentId = this.selectedNodeId, edit = false) {
    if (this.options.readOnly) return;
    const parent = parentId ? this.findNode(parentId) : this.docData.root;
    if (!parent) return;
    const newNode = {
      id: generateUid(),
      data: { text: "新节点" },
      children: []
    };
    if (!Array.isArray(parent.children)) parent.children = [];
    parent.children.push(newNode);
    parent.data.collapsed = false;
    this.setSelectionState([newNode.id], newNode.id);
    this.saveState();
    this.render();
    this.selectNode(newNode.id, true);
    if (edit && !this.options.readOnly) {
      const created = this.findNode(newNode.id);
      if (created) this.editNodeText(created);
    }
  }

  addSiblingNode(nodeId = this.selectedNodeId, edit = false) {
    if (this.options.readOnly) return;
    if (!nodeId || nodeId === this.docData.root.id) {
      this.addChildNode(this.docData.root.id, edit);
      return;
    }
    const parent = this.findParent(nodeId);
    if (!parent) return;
    const idx = parent.children.findIndex((c) => c.id === nodeId);
    const newNode = {
      id: generateUid(),
      data: { text: "同级节点" },
      children: []
    };
    parent.children.splice(idx + 1, 0, newNode);
    parent.data.collapsed = false;
    this.setSelectionState([newNode.id], newNode.id);
    this.saveState();
    this.render();
    this.selectNode(newNode.id, true);
    if (edit && !this.options.readOnly) {
      const created = this.findNode(newNode.id);
      if (created) this.editNodeText(created);
    }
  }

  deleteNode(nodeId = this.selectedNodeId) {
    if (this.options.readOnly) return;
    if (!nodeId || nodeId === this.docData.root.id) return;
    const parent = this.findParent(nodeId);
    if (!parent) return;
    const removedIds = new Set();
    const collect = node => {
      if (!node) return;
      removedIds.add(node.id);
      (node.children || []).forEach(collect);
    };
    collect(this.findNode(nodeId));
    this.pruneAnnotations(removedIds);
    parent.children = parent.children.filter((c) => c.id !== nodeId);
    this.setSelectionState([parent.id], parent.id);
    this.saveState();
    this.render();
    this.options.onSelectionChange?.(this.selectedNodes());
  }

  pruneAnnotations(removedIds) {
    if (!removedIds?.size) return;
    for (const key of ["relations", "boundaries", "summaries"]) {
      if (!Array.isArray(this.docData[key])) continue;
      const next = this.docData[key].filter(item => {
        if (key === "relations") return !removedIds.has(item.from) && !removedIds.has(item.to);
        return !removedIds.has(item.nodeId);
      });
      if (next.length) this.docData[key] = next;
      else delete this.docData[key];
    }
  }

  deleteSelectedNodes() {
    if (this.options.readOnly) return false;
    const selected = this.selectedNodes().filter(node => node.id !== this.docData.root.id);
    if (!selected.length) return false;
    const selectedIds = new Set(selected.map(node => node.id));
    const topLevel = selected.filter(node => {
      let parent = this.findParent(node.id);
      while (parent) {
        if (selectedIds.has(parent.id)) return false;
        parent = this.findParent(parent.id);
      }
      return true;
    });
    const changed = this.transact(() => {
      const removedIds = new Set();
      let primaryParent = this.findParent(this.selectedNodeId) || this.docData.root;
      const collect = node => {
        if (!node) return;
        removedIds.add(node.id);
        (node.children || []).forEach(collect);
      };
      topLevel.forEach(collect);
      while (removedIds.has(primaryParent.id)) {
        primaryParent = this.findParent(primaryParent.id) || this.docData.root;
      }
      for (const node of topLevel) {
        const parent = this.findParent(node.id);
        if (parent) parent.children = parent.children.filter(child => child.id !== node.id);
      }
      this.pruneAnnotations(removedIds);
      this.setSelectionState([primaryParent.id], primaryParent.id);
    });
    if (changed) this.options.onSelectionChange?.(this.selectedNodes());
    return changed;
  }

  // All structural edits finish through one history boundary.
  transact(change) {
    if (this.options.readOnly || this.editor) return false;
    const before = cleanMindData(this.docData);
    try { if (change() === false) return false; }
    catch (error) { this.restoreMindData(before); throw error; }
    const changed = this.saveState();
    if (changed) this.render();
    return !!changed;
  }

  visibleNodes(root = this.layoutRoot()) {
    const list = [];
    const walk = n => {
      list.push(n);
      if (this.isNodeExpanded(n)) (n.children || []).forEach(walk);
    };
    if (root) walk(root); return list;
  }

  toggleCollapse(id = this.selectedNodeId) {
    if (this.editor || this.presentationActive) return false;
    const revealed = this.findNode(id);
    if (revealed?.data.collapsed && this.revealedAncestorIds.has(id)) {
      this.revealedAncestorIds.delete(id);
      this.setSelectionState([id], id);
      this.render();
      this.options.onSelectionChange?.(this.selectedNodes());
      return true;
    }
    if (this.options.readOnly) {
      const node = this.findNode(id);
      if (!node?.children?.length) return false;
      node.data.collapsed = !node.data.collapsed;
      this.setSelectionState([node.id], node.id);
      this.render();
      this.options.onSelectionChange?.(this.selectedNodes());
      return true;
    }
    return this.transact(() => {
      const n = this.findNode(id); if (!n?.children?.length) return false;
      n.data.collapsed = !n.data.collapsed; this.setSelectionState([n.id], n.id);
    });
  }

  collapseAllBranches() {
    return this.setAllBranchesCollapsed(true);
  }

  expandAllBranches() {
    return this.setAllBranchesCollapsed(false);
  }

  setAllBranchesCollapsed(collapse) {
    if (this.editor || this.presentationActive) return false;
    const root = this.docData.root;
    if (!root) return false;
    const branches = [];
    const collect = node => {
      if (!node) return;
      if (node.children?.length) branches.push(node);
      (node.children || []).forEach(collect);
    };
    collect(root);
    const desiredState = node => node !== root && !!collapse;
    const dataChanged = branches.some(node => !!node.data.collapsed !== desiredState(node));
    const viewChanged = !!this.branchFocusId || this.revealedAncestorIds.size > 0;
    if (!dataChanged && !viewChanged) return false;

    const apply = () => {
      for (const node of branches) {
        if (desiredState(node)) node.data.collapsed = true;
        else if (node.data.collapsed) delete node.data.collapsed;
      }
      this.branchFocusId = null;
      this.revealedAncestorIds.clear();
      if (collapse) this.setSelectionState([root.id], root.id);
    };

    if (this.options.readOnly) {
      apply();
      this.render();
      this.options.onSelectionChange?.(this.selectedNodes());
      return true;
    }
    const changed = this.transact(apply);
    if (!changed && viewChanged) this.render();
    if (changed || viewChanged) {
      this.options.onSelectionChange?.(this.selectedNodes());
      return true;
    }
    return false;
  }

  moveNode(id, targetId, placement = "inside") {
    return this.transact(() => {
      const node = this.findNode(id), target = this.findNode(targetId), oldParent = this.findParent(id);
      if (!node || !target || !oldParent || node === target || this.findNode(targetId, node)) return false;
      const parent = placement === "inside" ? target : this.findParent(targetId);
      if (!parent || !["inside", "before", "after"].includes(placement)) return false;
      oldParent.children.splice(oldParent.children.indexOf(node), 1);
      const index = placement === "inside" ? parent.children.length : parent.children.indexOf(target) + (placement === "after" ? 1 : 0);
      parent.children.splice(index, 0, node); parent.data.collapsed = false;
      this.setSelectionState([node.id], node.id);
    });
  }

  copyBranchText(id = this.selectedNodeId) {
    const node = this.findNode(id); if (!node) return "";
    // A readable outline is the clipboard interchange format, not executable HTML.
    const lines = [];
    const walk = (n, depth) => { lines.push("  ".repeat(depth) + "- " + n.data.text.replace(/\r?\n/g, " ")); (n.children || []).forEach(c => walk(c, depth + 1)); };
    walk(node, 0);
    const text = lines.join("\n");
    this.clipboardBranchSnapshot = {
      text,
      node: JSON.parse(JSON.stringify(node, (key, value) => MIND_GEOMETRY_KEYS.has(key) ? undefined : value))
    };
    return text;
  }

  cloneBranchWithFreshIds(node) {
    const clone = JSON.parse(JSON.stringify(node, (key, value) => MIND_GEOMETRY_KEYS.has(key) ? undefined : value));
    const walk = current => {
      current.id = generateUid();
      (current.children || []).forEach(walk);
    };
    walk(clone);
    return clone;
  }

  pasteBranchText(text, parentId = this.selectedNodeId || this.docData.root.id) {
    if (typeof text !== "string" || !text.trim() || text.length > 100000) return false;
    const root = {children: []};
    const snapshot = this.options.clipboardStore?.snapshot || this.clipboardBranchSnapshot;
    if (snapshot?.text === text) {
      root.children.push(this.cloneBranchWithFreshIds(snapshot.node));
    } else {
      const stack = [{node: root, indent: -1}]; let count = 0;
      for (const line of text.replace(/\r/g, "").split("\n")) {
        if (!line.trim()) continue;
        if (++count > 1000) return false;
        const indent = line.match(/^\s*/)[0].replace(/\t/g, "  ").length;
        const label = line.trim().replace(/^(?:[-*+] |\d+[.)] |#{1,6} )/, "").trim(); if (!label) continue;
        const node = {id: generateUid(), data: {text: normalizeMindLinkText(label, this.options.vaultName)}, children: []};
        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
        if (stack.length > 100) return false;
        stack[stack.length - 1].node.children.push(node); stack.push({node, indent});
      }
    }
    const changed = this.transact(() => {
      const parent = this.findNode(parentId); if (!parent || !root.children.length) return false;
      parent.children.push(...root.children); parent.data.collapsed = false;
      this.setSelectionState([root.children[0].id], root.children[0].id);
    });
    if (changed) this.options.onSelectionChange?.(this.selectedNodes());
    return changed;
  }

  navigate(key) {
    const node = this.findNode(this.selectedNodeId) || this.docData.root;
    const current = {x: node._x + node._w / 2, y: node._y + node._h / 2};
    let best = null, score = Infinity;
    for (const n of this.visibleNodes()) {
      if (n === node) continue;
      const dx = n._x + n._w / 2 - current.x, dy = n._y + n._h / 2 - current.y;
      const along = key === "ArrowRight" ? dx : key === "ArrowLeft" ? -dx : key === "ArrowDown" ? dy : -dy;
      const across = key === "ArrowRight" || key === "ArrowLeft" ? Math.abs(dy) : Math.abs(dx);
      if (along > 1 && along + across * 2 < score) { best = n; score = along + across * 2; }
    }
    this.selectNode((best || node).id, true);
  }

  /* --- Tree Layout Calculation --- */
  calculateLayout() {
    const H_GAP = 54;
    const V_GAP = 20;

    const root = this.layoutRoot();
    const children = n => this.isNodeExpanded(n) ? (n.children || []) : [];
    // Fishbone anchors are only written for bones and their direct children. A node moved
    // deeper would otherwise keep its old spine anchor and draw a line across the map.
    const clearFishboneAnchors = n => {
      for (const key of FISHBONE_GEOMETRY_KEYS) delete n[key];
      (n.children || []).forEach(clearFishboneAnchors);
    };
    if (this.docData.root) clearFishboneAnchors(this.docData.root);
    const font =this.window?.getComputedStyle && this.container?.ownerDocument ? this.window.getComputedStyle(this.container).fontFamily : "sans-serif";
    if (this.document?.createElement && !this.measureContext) {
      try { this.measureContext = this.document.createElement("canvas").getContext("2d"); } catch (_) {}
    }
    const widthOf = (text, root) => {
      if (this.measureContext) {
        const fontSpec = `${root ? 600 : 450} ${root ? 14 : 13}px ${font}`, key = fontSpec + "\u0000" + text;
        this.textMetrics = this.textMetrics || new Map();
        if (this.textMetrics.has(key)) return this.textMetrics.get(key);
        this.measureContext.font = fontSpec; const width = this.measureContext.measureText(text).width;
        if (this.textMetrics.size >= 8192) this.textMetrics.clear();
        this.textMetrics.set(key, width); return width;
      }
      return [...text].reduce((n,c) => n + (/[^\x00-\xff]/.test(c) ? 14 : 8), 0);
    };
    const measure = (node, isRoot = false) => {
      const text = mindNodeLink(node.data?.text || "", this.options.vaultName)?.display || node.data?.text || "";
      const nodeStyle = normalizeNodeStyle(node.data?.style) || {};
      const fontSize = nodeStyle.fontSize || (isRoot ? 14 : 13);
      const fontWeight = nodeStyle.fontWeight || (isRoot ? 600 : 450);
      const lineHeight = Math.max(18, Math.round(fontSize * 1.42));
      const lines = [""];
      let width = 0;
      for (const char of text) {
        const metricKey = `style:${fontSize}:${fontWeight}:${char}`;
        let w;
        if (this.measureContext) {
          const fontSpec = `${fontWeight} ${fontSize}px ${font}`;
          this.textMetrics = this.textMetrics || new Map();
          if (this.textMetrics.has(metricKey)) w = this.textMetrics.get(metricKey);
          else {
            this.measureContext.font = fontSpec;
            w = this.measureContext.measureText(char).width;
            this.textMetrics.set(metricKey, w);
          }
        } else {
          w = /[^\x00-\xff]/.test(char) ? fontSize : fontSize * 0.58;
        }
        if (width + w > 252 || char === "\n") { lines.push(""); width = 0; }
        if (char !== "\n") { lines[lines.length - 1] += char; width += w; }
      }
      node._lines = lines;
      const measuredWidth = this.measureContext
        ? Math.max(...lines.map(line => {
          this.measureContext.font = `${fontWeight} ${fontSize}px ${font}`;
          return this.measureContext.measureText(line).width;
        }))
        : Math.max(...lines.map(line => [...line].reduce((sum, char) => sum + (/[^\x00-\xff]/.test(char) ? fontSize : fontSize * 0.58), 0)));
      node._w = Math.max(isRoot ? 140 : 100, Math.min(284, measuredWidth + 32));
      node._h = Math.max(isRoot ? 48 : 38, lines.length * lineHeight + 18);
      children(node).forEach(c => measure(c));
      node._treeHeight = Math.max(node._h, children(node).reduce((n,c) => n + c._treeHeight, 0) + Math.max(0, children(node).length - 1) * V_GAP);
      node._treeWidth = Math.max(node._w, children(node).reduce((n,c) => n + c._treeWidth, 0) + Math.max(0, children(node).length - 1) * H_GAP);
    };
    measure(root, true);
    const horizontal = (node, x, top, direction = 1) => {
      node._x = x;
      node._y = top + (node._treeHeight - node._h) / 2;
      let y = top;
      for (const child of children(node)) {
        horizontal(child, direction === 1 ? x + node._w + H_GAP : x - child._w - H_GAP, y, direction);
        y += child._treeHeight + V_GAP;
      }
    };
    if (this.layout === "organizationStructure") {
      const levelHeights = [];
      const heights = (n, depth) => { levelHeights[depth] = Math.max(levelHeights[depth] || 0, n._h); children(n).forEach(c => heights(c, depth + 1)); };
      heights(root, 0);
      const vertical = (n, left, y, depth) => {
        n._x = left + (n._treeWidth - n._w) / 2; n._y = y;
        const total = children(n).reduce((sum,c) => sum + c._treeWidth, 0) + Math.max(0, children(n).length - 1) * H_GAP;
        let x = left + (n._treeWidth - total) / 2;
        children(n).forEach(c => { vertical(c, x, y + levelHeights[depth] + 60, depth + 1); x += c._treeWidth + H_GAP; });
      };
      vertical(root, 0, 0, 0);
    } else if (this.layout === "catalogOrganization") {
      let y = 0;
      const outline = (n, depth) => { n._x = depth * 48; n._y = y; y += n._h + V_GAP; children(n).forEach(c => outline(c, depth + 1)); };
      outline(root, 0);
    } else if (this.layout === "mindMap") {
      root._x = 0; root._y = 0;
      for (const direction of [1, -1]) {
        const branch = children(root).filter((_, i) => i % 2 === (direction === 1 ? 0 : 1));
        let y = root._h / 2 - (branch.reduce((sum,c) => sum + c._treeHeight, 0) + Math.max(0, branch.length - 1) * V_GAP) / 2;
        branch.forEach(c => { horizontal(c, direction === 1 ? root._w + H_GAP : -c._w - H_GAP, y, direction); y += c._treeHeight + V_GAP; });
      }
    } else if (this.layout === "timeline") {
      root._x = 0; root._y = 0;
      const axisY = root._h / 2;
      let currX = root._w + 60;
      const rootChildren = children(root);
      rootChildren.forEach((milestone, idx) => {
        const isAbove = idx % 2 === 0;
        const top = isAbove ? (axisY - 60 - milestone._treeHeight) : (axisY + 60);
        horizontal(milestone, currX, top, 1);
        currX += milestone._treeWidth + 60;
      });
      this._timelineAxis = {
        startX: root._x + root._w,
        endX: Math.max(currX - 20, root._w + 120),
        y: axisY
      };
    } else if (this.layout === "fishbone") {
      const rootChildren = children(root);
      const axisY = 320; // Stable horizontal spine elevation

      // Helper to compute width required by a bone's subtree
      const calcBoneWidth = (bone) => {
        const subs = children(bone);
        if (subs.length === 0) return bone._w + 60;
        const maxSubTreeW = Math.max(...subs.map(s => s._treeWidth));
        const totalSubsH = subs.reduce((sum, s) => sum + s._treeHeight, 0) + Math.max(0, subs.length - 1) * V_GAP;
        const boneSpanY = Math.max(140, totalSubsH + V_GAP * 2 + bone._h / 2);
        const boneDx = Math.max(80, Math.round(boneSpanY * 0.55));
        return Math.max(boneDx + bone._w + 40, boneDx + maxSubTreeW + 50);
      };

      // Pair up bones: stations along spine from left to right
      const pairCount = Math.ceil(rootChildren.length / 2);
      const stationWidths = [];
      for (let p = 0; p < pairCount; p++) {
        const upper = rootChildren[p * 2];
        const lower = rootChildren[p * 2 + 1];
        const wUpper = upper ? calcBoneWidth(upper) : 120;
        const wLower = lower ? calcBoneWidth(lower) : 120;
        stationWidths.push(Math.max(wUpper, wLower, 220));
      }

      // Calculate spine connection X for each station (from left to right)
      const stationSpineX = [];
      let accumX = 80;
      for (let p = 0; p < pairCount; p++) {
        accumX += stationWidths[p];
        stationSpineX.push(accumX);
        accumX += 100; // Comfortable spacing gap between stations
      }

      // Position Root (Fish Head) at far right
      const lastSpineX = stationSpineX.length > 0 ? stationSpineX[stationSpineX.length - 1] : 240;
      root._x = lastSpineX + 90;
      root._y = axisY - root._h / 2;

      // Position each bone and its subtrees
      rootChildren.forEach((bone, idx) => {
        const isUpper = idx % 2 === 0;
        const pairIdx = Math.floor(idx / 2);
        const spineX = stationSpineX[pairIdx] || (220 * (pairIdx + 1));

        const subs = children(bone);
        const totalSubsH = subs.reduce((sum, s) => sum + s._treeHeight, 0) + Math.max(0, subs.length - 1) * V_GAP;
        // Reserve room for the bone label as well as its child stack. The old
        // fixed 40px allowance let the last lower child (and first upper
        // child) intrude into the bone box when a branch contained several
        // nodes or a taller wrapped label.
        const boneSpanY = Math.max(140, totalSubsH + V_GAP * 2 + bone._h / 2);
        const boneDx = Math.max(80, Math.round(boneSpanY * 0.55));

        const boneTipX = spineX - boneDx;
        const boneTipY = isUpper ? (axisY - boneSpanY) : (axisY + boneSpanY);

        bone._x = boneTipX - bone._w - 10;
        bone._y = isUpper ? (boneTipY - bone._h / 2) : (boneTipY - bone._h / 2);
        bone._isUpper = isUpper;
        bone._spineConnectX = spineX;
        bone._spineConnectY = axisY;
        bone._boneTipX = boneTipX;
        bone._boneTipY = boneTipY;

        // Position level 2 children and their subtrees
        if (subs.length > 0) {
          let currY = isUpper
            ? (boneTipY + bone._h / 2 + V_GAP)
            : (axisY + V_GAP);
          subs.forEach((sub) => {
            const nodeY = currY + (sub._treeHeight - sub._h) / 2;
            const centerY = nodeY + sub._h / 2;
            const t = Math.max(0.1, Math.min(0.92, Math.abs(axisY - centerY) / boneSpanY));
            const onBoneX = spineX - t * boneDx;

            sub._x = onBoneX - 24 - sub._w;
            sub._y = nodeY;
            sub._boneConnectX = onBoneX;
            sub._boneConnectY = centerY;

            // Recursively layout level 3+ children to the left
            let subTop = currY;
            for (const deep of children(sub)) {
              horizontal(deep, sub._x - deep._w - H_GAP, subTop, -1);
              subTop += deep._treeHeight + V_GAP;
            }

            currY += sub._treeHeight + V_GAP;
          });
        }
      });

      this._fishboneAxis = {
        startX: 40,
        endX: root._x,
        y: axisY
      };
    } else horizontal(root, 0, 0);
  }

  render() {
    this.calculateLayout();
    const branchBackground = this.theme.backgroundColor === "transparent"
      ? this.theme.nodeBackground
      : this.theme.backgroundColor;
    this.branchColorMap = createBranchColorMap(
      this.docData.root,
      this.theme.branchColors || [],
      branchBackground
    );
    this.taskProgressMap = createTaskProgressMap(this.docData.root);
    this.container.style.backgroundColor = this.theme.backgroundColor;
    if (this.theme.paperPattern) {
      this.container.style.setProperty("--crisp-mind-paper-bg", this.theme.backgroundColor);
    } else {
      this.container.style.removeProperty("--crisp-mind-paper-bg");
    }
    this.container.classList.toggle("crisp-mind-theme-paper", !!this.theme.paperPattern);
    this.container.classList.toggle("crisp-mind-presentation-active", this.presentationActive);
    this.updateTransform();

    const root = this.layoutRoot();
    this._layoutRootNode = root || null;
    this.linesGroup.innerHTML = "";
    this.boundaryGroup.innerHTML = "";
    this.relationsGroup.innerHTML = "";
    this.annotationsGroup.innerHTML = "";
    if (this.layout === "timeline" && this._timelineAxis) {
      const axisPath = this.document.createElementNS("http://www.w3.org/2000/svg", "path");
      axisPath.setAttribute("d", `M ${this._timelineAxis.startX} ${this._timelineAxis.y} H ${this._timelineAxis.endX}`);
      axisPath.setAttribute("stroke", this.theme.accentColor || "#7c3aed");
      axisPath.setAttribute("stroke-width", "3");
      axisPath.setAttribute("stroke-linecap", "round");
      this.linesGroup.appendChild(axisPath);

      // A collapsed root hides its milestones; their stale coordinates must not leave dots behind.
      for (const milestone of (root && this.isNodeExpanded(root) ? root.children || [] : [])) {
        if (milestone._x == null) continue;
        const dot = this.document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", milestone._x + milestone._w / 2);
        dot.setAttribute("cy", this._timelineAxis.y);
        dot.setAttribute("r", "5");
        dot.setAttribute("fill", this.theme.accentColor || "#7c3aed");
        dot.setAttribute("stroke", this.theme.backgroundColor || "#ffffff");
        dot.setAttribute("stroke-width", "2");
        this.linesGroup.appendChild(dot);
      }
    } else if (this.layout === "fishbone" && this._fishboneAxis) {
      const spinePath = this.document.createElementNS("http://www.w3.org/2000/svg", "path");
      spinePath.setAttribute("d", `M ${this._fishboneAxis.startX} ${this._fishboneAxis.y} H ${this._fishboneAxis.endX}`);
      spinePath.setAttribute("stroke", this.theme.lineColor || "#7c3aed");
      spinePath.setAttribute("stroke-width", "3.5");
      spinePath.setAttribute("stroke-linecap", "round");
      this.linesGroup.appendChild(spinePath);

      // Fish Head Arrow
      const arrow = this.document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      const ay = this._fishboneAxis.y;
      const ax = this._fishboneAxis.endX;
      arrow.setAttribute("points", `${ax},${ay} ${ax - 10},${ay - 5} ${ax - 10},${ay + 5}`);
      arrow.setAttribute("fill", this.theme.lineColor || "#7c3aed");
      this.linesGroup.appendChild(arrow);
    }

    this.nodeElements = this.nodeElements || new Map();
    this.seenNodes = new Set();
    this._currentPresentationNodeId = this.presentationActive
      ? this.getPresentationSteps()[this.presentationIndex]?.nodeId || null
      : null;
    this.renderBranch(root);
    this.renderBoundaries();
    this.renderRelations();
    this.renderSummaries();
    for (const [id, element] of this.nodeElements) {
      if (!this.seenNodes.has(id)) { element.remove(); this.nodeElements.delete(id); }
    }
    this.options.onRender?.();
  }

  renderBranch(node) {
    if (!node) return;
    const currentPresentationNodeId = this._currentPresentationNodeId;
    // Branch focus lays the focused node out as the root, so compare against the layout root.
    const layoutRootNode = this._layoutRootNode || this.docData.root;
    const layoutRootId = layoutRootNode.id;

    // Connecting lines
    if (this.isNodeExpanded(node) && node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        const line = this.document.createElementNS("http://www.w3.org/2000/svg", "path");
        const leftward = child._x < node._x;
        const startX = leftward ? node._x : node._x + node._w;
        const startY = node._y + node._h / 2;
        const endX = leftward ? child._x + child._w : child._x;
        const endY = child._y + child._h / 2;
        const midX = (startX + endX) / 2;

        let points = sampleCubicBezierPoints(
          { x: startX, y: startY },
          { x: midX, y: startY },
          { x: midX, y: endY },
          { x: endX, y: endY }
        );
        if (this.layout === "organizationStructure") {
          const sx = node._x + node._w / 2, sy = node._y + node._h;
          const ex = child._x + child._w / 2, ey = child._y, my = (sy + ey) / 2;
          points = sampleCubicBezierPoints(
            { x: sx, y: sy }, { x: sx, y: my }, { x: ex, y: my }, { x: ex, y: ey }
          );
        } else if (this.layout === "catalogOrganization") {
          const sx = node._x + 20, sy = node._y + node._h;
          points = [{ x: sx, y: sy }, { x: sx, y: endY }, { x: child._x, y: endY }];
        } else if (this.layout === "timeline") {
          if (node.id === layoutRootId) {
            const axisY = this._timelineAxis ? this._timelineAxis.y : (node._y + node._h / 2);
            const midNodeX = child._x + child._w / 2;
            const childEdgeY = child._y > axisY ? child._y : (child._y + child._h);
            points = [{ x: midNodeX, y: axisY }, { x: midNodeX, y: childEdgeY }];
          } else {
            const sx = node._x + node._w, sy = node._y + node._h / 2;
            const ex = child._x, ey = child._y + child._h / 2;
            const mx = (sx + ex) / 2;
            points = sampleCubicBezierPoints(
              { x: sx, y: sy }, { x: mx, y: sy }, { x: mx, y: ey }, { x: ex, y: ey }
            );
          }
        } else if (this.layout === "fishbone") {
          if (node.id === layoutRootId) {
            const boneEndX = child._x + child._w;
            const boneEndY = child._y + child._h / 2;
            const spineConnectX = child._spineConnectX || (boneEndX + 80);
            const spineConnectY = child._spineConnectY || (this._fishboneAxis ? this._fishboneAxis.y : (node._y + node._h / 2));
            points = [{ x: spineConnectX, y: spineConnectY }, { x: boneEndX, y: boneEndY }];
          } else if (child._boneConnectX != null) {
            points = [
              { x: child._boneConnectX, y: child._boneConnectY },
              { x: child._x + child._w, y: child._boneConnectY }
            ];
          } else {
            const sx = node._x;
            const sy = node._y + node._h / 2;
            const ex = child._x + child._w;
            const ey = child._y + child._h / 2;
            const mx = (sx + ex) / 2;
            points = sampleCubicBezierPoints(
              { x: sx, y: sy }, { x: mx, y: sy }, { x: mx, y: ey }, { x: ex, y: ey }
            );
          }
        }
        const branchInfo = this.branchColorMap?.get(child.id);
        line.setAttribute("d", taperedPathFromPoints(points));
        line.setAttribute("fill", branchInfo?.color || this.theme.lineColor || "#7c3aed");
        line.setAttribute("stroke", "none");
        line.setAttribute("stroke-linejoin", "round");
        line.setAttribute("pointer-events", "none");
        if (branchInfo) {
          line.setAttribute("data-branch-index", String(branchInfo.branchIndex));
          line.setAttribute("data-branch-depth", String(branchInfo.depth));
        }
        if (currentPresentationNodeId && node.id !== currentPresentationNodeId && child.id !== currentPresentationNodeId) {
          line.setAttribute("opacity", "0.16");
        }
        this.linesGroup.appendChild(line);

        this.renderBranch(child);
      });
    }

    // Node Box
    const isSelected = this.selectedNodeIds.has(node.id);
    const isPrimarySelected = this.selectedNodeId === node.id;
    const isRoot = node.id === this.docData.root.id;
    const rawText = node.data?.text || "Topic";
    const isCompleted = /^\[[xX]\]\s/.test(rawText);
    const nodeStyle = normalizeNodeStyle(node.data?.style) || {};
    const descendantTaskProgress = this.taskProgressMap?.get(node.id) || getDescendantTaskProgress(node);
    const branchColor = this.branchColorMap?.get(node.id)?.color || "";

    const signature = JSON.stringify([
      node.data, node._w, node._h, node._lines, isSelected, isPrimarySelected, isRoot, this.theme,
      node.children?.length, isCompleted, this.isNodeExpanded(node), branchColor,
      descendantTaskProgress.completed, descendantTaskProgress.total
    ]);
    this.seenNodes = this.seenNodes || new Set();
    this.seenNodes.add(node.id);
    const cached = this.nodeElements ? this.nodeElements.get(node.id) : null;
    if (cached && cached._signature === signature) {
      cached._mindNode = node;
      cached.style.visibility = this.editorNodeId === node.id ? "hidden" : "";
      cached.setAttribute("transform", `translate(${node._x}, ${node._y})`);
      cached.classList.toggle("is-presentation-current", currentPresentationNodeId === node.id);
      cached.classList.toggle("is-presentation-dimmed", !!currentPresentationNodeId && currentPresentationNodeId !== node.id);
      cached.classList.toggle("is-selected", isSelected);
      cached.classList.toggle("is-primary-selected", isPrimarySelected);
      return;
    }
    cached?.remove();
    const g = this.document.createElementNS("http://www.w3.org/2000/svg", "g");
    g._mindNode = node; g._signature = signature;
    g.style.visibility = this.editorNodeId === node.id ? "hidden" : "";
    g.classList.add("crisp-mind-node");
    if (isSelected) g.classList.add("is-selected");
    if (isPrimarySelected) g.classList.add("is-primary-selected");
    if (currentPresentationNodeId === node.id) g.classList.add("is-presentation-current");
    if (currentPresentationNodeId && currentPresentationNodeId !== node.id) g.classList.add("is-presentation-dimmed");
    if (isCompleted && g.classList?.add) g.classList.add("is-task-completed");
    if (this.nodeElements) this.nodeElements.set(node.id, g);
    g.setAttribute("transform", `translate(${node._x}, ${node._y})`);
    g.style.cursor = "pointer";
    g.setAttribute("data-node-id", node.id);
    const titleEl = this.document.createElementNS("http://www.w3.org/2000/svg", "title");
    titleEl.textContent = node.data.text;
    g.appendChild(titleEl);

    const shape = nodeStyle.shape || "rounded";
    let shapeEl;
    if (shape === "ellipse") {
      shapeEl = this.document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      shapeEl.setAttribute("cx", node._w / 2);
      shapeEl.setAttribute("cy", node._h / 2);
      shapeEl.setAttribute("rx", node._w / 2);
      shapeEl.setAttribute("ry", node._h / 2);
    } else {
      shapeEl = this.document.createElementNS("http://www.w3.org/2000/svg", "rect");
      shapeEl.setAttribute("x", "0");
      shapeEl.setAttribute("y", "0");
      shapeEl.setAttribute("width", node._w);
      shapeEl.setAttribute("height", node._h);
      const radius = shape === "rectangle"
        ? 0
        : shape === "pill"
          ? node._h / 2
          : this.theme.borderRadius || 8;
      shapeEl.setAttribute("rx", radius);
      shapeEl.setAttribute("ry", radius);
    }
    shapeEl.setAttribute("data-node-shape", "true");

    const fill = nodeStyle.fill || (isRoot ? (this.theme.accentColor || "#7c3aed") : (this.theme.nodeBackground || "#262626"));
    const defaultBorder = isRoot ? "transparent" : (this.theme.borderColor || "#3e3e3e");
    const selectedBorder = this.theme.activeBorderColor || this.theme.accentColor || "#7c3aed";
    const borderColor = nodeStyle.borderColor || (isSelected ? selectedBorder : defaultBorder);
    const configuredBorderWidth = Number.isFinite(nodeStyle.borderWidth) ? nodeStyle.borderWidth : (isRoot ? 0 : 1);
    shapeEl.setAttribute("fill", fill);
    shapeEl.setAttribute("stroke", borderColor);
    shapeEl.setAttribute("stroke-width", String(isSelected ? Math.max(2.5, configuredBorderWidth) : configuredBorderWidth));
    if (isCompleted && !isSelected && shape !== "ellipse") shapeEl.setAttribute("stroke-dasharray", "4 2");
    shapeEl.style.filter = isRoot
      ? (this.theme.rootShadow || "drop-shadow(0 4px 12px rgba(124, 58, 237, 0.25))")
      : (this.theme.nodeShadow || "drop-shadow(0 2px 6px rgba(0, 0, 0, 0.05))");
    g.appendChild(shapeEl);

    // Text element
    const textEl = this.document.createElementNS("http://www.w3.org/2000/svg", "text");
    const align = nodeStyle.align || "center";
    const textX = align === "left" ? 14 : align === "right" ? node._w - 14 : node._w / 2;
    const textAnchor = align === "left" ? "start" : align === "right" ? "end" : "middle";
    const fontSize = nodeStyle.fontSize || (isRoot ? 14 : 13);
    const lineHeight = Math.max(18, Math.round(fontSize * 1.42));
    const textColor = nodeStyle.textColor || (isRoot ? "#ffffff" : this.theme.textColor);
    textEl.setAttribute("x", textX);
    textEl.setAttribute("y", node._h / 2);
    textEl.setAttribute("text-anchor", textAnchor);
    textEl.setAttribute("dominant-baseline", "central");
    textEl.setAttribute("fill", textColor);
    textEl.setAttribute("font-size", `${fontSize}px`);
    textEl.setAttribute("font-weight", String(nodeStyle.fontWeight || (isRoot ? 600 : 450)));
    textEl.setAttribute("font-family", this.theme.fontFamily || "var(--font-interface)");
    textEl.style.fontFamily = this.theme.fontFamily || "var(--font-interface)";

    const link = mindNodeLink(rawText, this.options.vaultName);
    textEl.setAttribute("class", "crisp-mind-node-label");
    if (this.editorNodeId === node.id) textEl.style.visibility = "hidden";
    if (isCompleted) {
      textEl.setAttribute("text-decoration", "line-through");
      textEl.style.opacity = "0.55";
    }
    if (link) {
      textEl.setAttribute("text-decoration", "underline");
      textEl.style.fill = nodeStyle.textColor || (isRoot ? "#ffffff" : this.theme.accentColor);
      textEl.style.cursor = "pointer";
      textEl.setAttribute("role", "link");
      textEl.addEventListener("click", e => {
        e.stopPropagation();
        if (this.suppressClickUntil > Date.now() || this.editor) return;
        this.options.onOpenLink?.(link.target);
      });
      g.addEventListener("click", e => {
        if ((e.metaKey || e.ctrlKey) && !(this.suppressClickUntil > Date.now())) this.options.onOpenLink?.(link.target);
      });
      g.addEventListener("mouseover", e => this.options.onHoverLink?.(e, link.target));
    }
    textEl.textContent = "";
    (node._lines || [rawText]).forEach((line, index, lines) => {
      const span = this.document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      span.setAttribute("x", textX);
      span.setAttribute("y", node._h / 2 + (index - (lines.length - 1) / 2) * lineHeight);
      span.textContent = line;
      textEl.appendChild(span);
    });
    g.appendChild(textEl);

    if (node.data?.note) {
      const note = this.document.createElementNS("http://www.w3.org/2000/svg", "g");
      note.setAttribute("class", "crisp-mind-note-indicator");
      const circle = this.document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", node._w - 9);
      circle.setAttribute("cy", 9);
      circle.setAttribute("r", 5);
      circle.setAttribute("fill", this.theme.accentColor || "#7c3aed");
      const mark = this.document.createElementNS("http://www.w3.org/2000/svg", "text");
      mark.setAttribute("x", node._w - 9);
      mark.setAttribute("y", 9.5);
      mark.setAttribute("text-anchor", "middle");
      mark.setAttribute("dominant-baseline", "central");
      mark.setAttribute("font-size", "8");
      mark.setAttribute("font-weight", "700");
      mark.setAttribute("fill", "#ffffff");
      mark.textContent = "N";
      note.append(circle, mark);
      g.appendChild(note);
    }

    // Click handler
    g.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.presentationActive) return;
      if (this.suppressClickUntil > Date.now()) return;
      const node = g._mindNode;
      this.container.focus({ preventScroll: true });
      this.handleNodeClick(node, e);
    });

    // Double click to edit
    g.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      if (this.presentationActive) return;
      this.editNodeText(g._mindNode);
    });
    g.addEventListener("contextmenu", e => {
      e.preventDefault(); e.stopPropagation();
      if (this.presentationActive) return;
      if (!this.selectedNodeIds.has(g._mindNode.id)) this.setSelectionState([g._mindNode.id], g._mindNode.id);
      this.options.onContextMenu?.(g._mindNode, e);
    });
    if (node.children?.length) {
      const fold = this.document.createElementNS("http://www.w3.org/2000/svg", "g");
      fold.setAttribute("data-collapse", node.id); fold.setAttribute("class", "crisp-mind-collapse");
      const progress = descendantTaskProgress;
      const progressLabel = progress.total ? `，待办完成 ${progress.completed}/${progress.total}` : "";
      fold.setAttribute("role", "button");
      fold.setAttribute("aria-label", `${!this.isNodeExpanded(node) ? `展开 ${node.children.length} 个子主题` : "折叠分支"}${progressLabel}`);

      let foldX = node._w + 13, foldY = node._h / 2;
      if (this.layout === "organizationStructure") {
        foldX = node._w / 2;
        foldY = node._h + 13;
      } else if (this.layout === "mindMap" && node.id !== layoutRootId) {
        const isLeftward = (node._x + node._w / 2) < (layoutRootNode._x + layoutRootNode._w / 2);
        if (isLeftward) foldX = -13;
      } else if (this.layout === "fishbone") {
        foldX = -13;
      }

      if (progress.total) {
        const radius = 12.25;
        const circumference = 2 * Math.PI * radius;
        const track = this.document.createElementNS("http://www.w3.org/2000/svg", "circle");
        track.setAttribute("class", "crisp-mind-task-progress-track");
        track.setAttribute("cx", foldX); track.setAttribute("cy", foldY); track.setAttribute("r", radius);
        track.setAttribute("fill", "none"); track.setAttribute("stroke", this.theme.borderColor || "#808080");
        track.setAttribute("stroke-width", "2.25"); track.setAttribute("pointer-events", "none");
        track.setAttribute("data-task-progress", `${progress.completed}/${progress.total}`);
        fold.appendChild(track);

        const indicator = this.document.createElementNS("http://www.w3.org/2000/svg", "circle");
        indicator.setAttribute("class", "crisp-mind-task-progress-value");
        indicator.setAttribute("cx", foldX); indicator.setAttribute("cy", foldY); indicator.setAttribute("r", radius);
        indicator.setAttribute("fill", "none");
        indicator.setAttribute("stroke", this.branchColorMap?.get(node.id)?.color || this.theme.accentColor || "#7c3aed");
        indicator.setAttribute("stroke-width", "2.75"); indicator.setAttribute("stroke-linecap", "round");
        indicator.setAttribute("stroke-dasharray", `${circumference * progress.ratio} ${circumference * (1 - progress.ratio)}`);
        indicator.setAttribute("transform", `rotate(-90 ${foldX} ${foldY})`);
        indicator.setAttribute("pointer-events", "none"); indicator.setAttribute("aria-hidden", "true");
        fold.appendChild(indicator);

        const progressTitle = this.document.createElementNS("http://www.w3.org/2000/svg", "title");
        progressTitle.textContent = `待办完成 ${progress.completed}/${progress.total}`;
        fold.appendChild(progressTitle);
      }

      const circle = this.document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", foldX); circle.setAttribute("cy", foldY); circle.setAttribute("r", 10);
      circle.setAttribute("fill", this.theme.nodeBackground); circle.setAttribute("stroke", this.theme.borderColor); fold.appendChild(circle);
      const label = this.document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", foldX); label.setAttribute("y", foldY); label.setAttribute("text-anchor", "middle"); label.setAttribute("dominant-baseline", "central"); label.setAttribute("font-size", "11"); label.setAttribute("fill", this.theme.textColor);
      label.textContent = !this.isNodeExpanded(node) ? String(node.children.length) : "−"; fold.appendChild(label);
      fold.addEventListener("click", e => { e.stopPropagation(); this.toggleCollapse(g._mindNode.id); });
      g.appendChild(fold);
    }
    this.nodesGroup.appendChild(g);
  }

  subtreeBounds(node) {
    const visible = new Set(this.visibleNodes().map(item => item.id));
    const nodes = [];
    const walk = current => {
      if (!current || !visible.has(current.id)) return;
      nodes.push(current);
      (current.children || []).forEach(walk);
    };
    walk(node);
    if (!nodes.length) {
      return {x: node._x, y: node._y, width: node._w, height: node._h};
    }
    const x = Math.min(...nodes.map(item => item._x));
    const y = Math.min(...nodes.map(item => item._y));
    return {
      x,
      y,
      width: Math.max(...nodes.map(item => item._x + item._w)) - x,
      height: Math.max(...nodes.map(item => item._y + item._h)) - y
    };
  }

  summaryBounds(node) {
    const visible = new Set(this.visibleNodes().map(item => item.id));
    const visibleChildren = (node?.children || []).filter(child => visible.has(child.id));
    if (node?.children?.length && !visibleChildren.length) return null;
    const summaryNodes = visibleChildren.length ? visibleChildren : [node];
    const childBounds = summaryNodes.map(item => this.subtreeBounds(item));
    return childBounds.reduce((acc, box) => {
      const minX = Math.min(acc.x, box.x);
      const minY = Math.min(acc.y, box.y);
      const maxX = Math.max(acc.x + acc.width, box.x + box.width);
      const maxY = Math.max(acc.y + acc.height, box.y + box.height);
      return {x: minX, y: minY, width: maxX - minX, height: maxY - minY};
    }, {...childBounds[0]});
  }

  annotationFill(color) {
    const hex = normalizeMindColor(color);
    return hex ? `${hex}18` : "rgba(124, 58, 237, 0.10)";
  }

  annotationLabelWidth(text) {
    return Math.max(34, Math.min(220, [...text].reduce((sum, char) => sum + (/[^\x00-\xff]/.test(char) ? 11 : 6.5), 0) + 16));
  }

  annotationLabelLabel(text, x, y, color) {
    if (!text) return null;
    const group = this.document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", "crisp-mind-annotation-label");
    const width = this.annotationLabelWidth(text);
    const rect = this.document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", x);
    rect.setAttribute("y", y);
    rect.setAttribute("width", width);
    rect.setAttribute("height", 22);
    rect.setAttribute("rx", 7);
    rect.setAttribute("fill", this.theme.nodeBackground || "#ffffff");
    rect.setAttribute("stroke", color);
    rect.setAttribute("stroke-width", "1");
    const label = this.document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", x + 8);
    label.setAttribute("y", y + 15);
    label.setAttribute("fill", this.theme.textColor || "#222222");
    label.setAttribute("font-size", "11");
    label.textContent = text;
    group.append(rect, label);
    return group;
  }

  relationEdge(node, towardX, towardY) {
    const cx = node._x + node._w / 2;
    const cy = node._y + node._h / 2;
    const dx = towardX - cx;
    const dy = towardY - cy;
    if (!dx && !dy) return {x: cx, y: cy};
    const halfW = node._w / 2 + 2;
    const halfH = node._h / 2 + 2;
    const scaleX = dx ? halfW / Math.abs(dx) : Infinity;
    const scaleY = dy ? halfH / Math.abs(dy) : Infinity;
    const scale = Math.min(scaleX, scaleY);
    return {x: cx + dx * scale, y: cy + dy * scale};
  }

  renderBoundaries() {
    if (!this.boundaryGroup || !Array.isArray(this.docData.boundaries)) return;
    const visible = new Set(this.visibleNodes().map(node => node.id));
    for (const boundary of this.docData.boundaries) {
      const node = this.findNode(boundary.nodeId);
      if (!node || !visible.has(node.id)) continue;
      const bounds = this.subtreeBounds(node);
      const color = boundary.color || this.theme.accentColor || "#7c3aed";
      const padding = 18;
      const rect = this.document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", bounds.x - padding);
      rect.setAttribute("y", bounds.y - padding);
      rect.setAttribute("width", bounds.width + padding * 2);
      rect.setAttribute("height", bounds.height + padding * 2);
      rect.setAttribute("rx", 18);
      rect.setAttribute("fill", this.annotationFill(color));
      rect.setAttribute("stroke", color);
      rect.setAttribute("stroke-width", "1.5");
      rect.setAttribute("stroke-dasharray", "7 5");
      rect.setAttribute("pointer-events", "none");
      this.boundaryGroup.appendChild(rect);
      if (!boundary.label) continue;
      const labelWidth = this.annotationLabelWidth(boundary.label);
      const labelHeight = 22;
      const labelGap = 8;
      const left = bounds.x - padding;
      const right = bounds.x + bounds.width + padding;
      const top = bounds.y - padding;
      const bottom = bounds.y + bounds.height + padding;
      const centerY = bounds.y + bounds.height / 2 - labelHeight / 2;
      const candidates = [
        {side: "top", x: left, y: top - labelHeight - labelGap},
        {side: "top", x: right - labelWidth, y: top - labelHeight - labelGap},
        {side: "bottom", x: left, y: bottom + labelGap},
        {side: "bottom", x: right - labelWidth, y: bottom + labelGap},
        {side: "left", x: left - labelWidth - labelGap, y: centerY},
        {side: "right", x: right + labelGap, y: centerY}
      ];
      const obstacles = this.visibleNodes().map(item => ({
        x: item._x,
        y: item._y,
        width: item._w,
        height: item._h
      }));
      const overlapArea = (a, b) => {
        const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
        const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
        return width * height;
      };
      const labelPosition = candidates
        .map(candidate => ({
          ...candidate,
          overlap: obstacles.reduce((sum, obstacle) => sum + overlapArea(
            {x: candidate.x, y: candidate.y, width: labelWidth, height: labelHeight},
            obstacle
          ), 0)
        }))
        .sort((a, b) => a.overlap - b.overlap)[0];
      const connector = this.document.createElementNS("http://www.w3.org/2000/svg", "path");
      const labelCenterX = labelPosition.x + labelWidth / 2;
      const labelCenterY = labelPosition.y + labelHeight / 2;
      let connectorPath = "";
      if (labelPosition.side === "top") {
        connectorPath = `M ${labelCenterX} ${labelPosition.y + labelHeight} V ${top}`;
      } else if (labelPosition.side === "bottom") {
        connectorPath = `M ${labelCenterX} ${labelPosition.y} V ${bottom}`;
      } else if (labelPosition.side === "left") {
        connectorPath = `M ${labelPosition.x + labelWidth} ${labelCenterY} H ${left}`;
      } else {
        connectorPath = `M ${labelPosition.x} ${labelCenterY} H ${right}`;
      }
      connector.setAttribute("d", connectorPath);
      connector.setAttribute("fill", "none");
      connector.setAttribute("stroke", color);
      connector.setAttribute("stroke-width", "1");
      connector.setAttribute("stroke-linecap", "round");
      connector.setAttribute("pointer-events", "none");
      this.annotationsGroup.appendChild(connector);
      const label = this.annotationLabelLabel(boundary.label, labelPosition.x, labelPosition.y, color);
      if (label) this.annotationsGroup.appendChild(label);
    }
  }

  renderRelations() {
    if (!this.relationsGroup || !Array.isArray(this.docData.relations)) return;
    const visibleNodes = this.visibleNodes();
    const visible = new Set(visibleNodes.map(node => node.id));
    for (const relation of this.docData.relations) {
      const from = this.findNode(relation.from);
      const to = this.findNode(relation.to);
      if (!from || !to || !visible.has(from.id) || !visible.has(to.id)) continue;
      const centerFrom = {x: from._x + from._w / 2, y: from._y + from._h / 2};
      const centerTo = {x: to._x + to._w / 2, y: to._y + to._h / 2};
      const start = this.relationEdge(from, centerTo.x, centerTo.y);
      const end = this.relationEdge(to, centerFrom.x, centerFrom.y);
      const color = relation.color || this.theme.accentColor || "#7c3aed";
      const markerId = `crisp-mind-arrow-${relation.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
      const defs = this.document.createElementNS("http://www.w3.org/2000/svg", "defs");
      const marker = this.document.createElementNS("http://www.w3.org/2000/svg", "marker");
      marker.setAttribute("id", markerId);
      marker.setAttribute("viewBox", "0 0 10 10");
      marker.setAttribute("refX", "9");
      marker.setAttribute("refY", "5");
      marker.setAttribute("markerWidth", "6");
      marker.setAttribute("markerHeight", "6");
      marker.setAttribute("orient", "auto-start-reverse");
      const arrow = this.document.createElementNS("http://www.w3.org/2000/svg", "path");
      arrow.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
      arrow.setAttribute("fill", color);
      marker.appendChild(arrow);
      defs.appendChild(marker);
      this.relationsGroup.appendChild(defs);

      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const bend = Math.min(90, Math.max(34, distance * 0.18));
      const mx = (start.x + end.x) / 2 - (dy / distance) * bend;
      const my = (start.y + end.y) / 2 + (dx / distance) * bend;
      let pathData = `M ${start.x} ${start.y} Q ${mx} ${my} ${end.x} ${end.y}`;
      let labelPosition = relation.label
        ? {x: mx - 18, y: my - 20, width: this.annotationLabelWidth(relation.label), height: 22}
        : null;
      if (this.layout === "fishbone") {
        const endpointIds = new Set([from.id, to.id]);
        const curveSteps = Math.max(24, Math.min(128, Math.ceil(distance / 8)));
        const curvePoints = Array.from({length: curveSteps + 1}, (_, index) => {
          const t = index / curveSteps, inverse = 1 - t;
          return {
            x: inverse * inverse * start.x + 2 * inverse * t * mx + t * t * end.x,
            y: inverse * inverse * start.y + 2 * inverse * t * my + t * t * end.y
          };
        });
        const lineBlocked = relationRouteIntersectsNodes(curvePoints, visibleNodes, endpointIds, 2);
        const labelBlocked = labelPosition && relationNodeRects(visibleNodes, new Set(), 5).some(rect =>
          labelPosition.x < rect.right && labelPosition.x + labelPosition.width > rect.left &&
          labelPosition.y < rect.bottom && labelPosition.y + labelPosition.height > rect.top
        );
        if (lineBlocked || labelBlocked) {
          const route = findOrthogonalRelationRoute(start, end, visibleNodes, endpointIds, 8);
          if (route?.length >= 2) {
            pathData = roundedOrthogonalPath(route, 10);
            labelPosition = relation.label
              ? findRelationLabelPosition(route, this.annotationLabelWidth(relation.label), 22, visibleNodes, 6)
              : null;
          } else if (lineBlocked) {
            labelPosition = null;
          }
        }
      }
      const path = this.document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathData);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", color);
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("marker-end", `url(#${markerId})`);
      path.setAttribute("class", "crisp-mind-relation");
      path.addEventListener("contextmenu", event => {
        event.preventDefault(); event.stopPropagation();
        this.options.onRelationContextMenu?.(relation, event);
      });
      this.relationsGroup.appendChild(path);
      for (const point of [start, end]) {
        const dot = this.document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", point.x);
        dot.setAttribute("cy", point.y);
        dot.setAttribute("r", "3");
        dot.setAttribute("fill", color);
        dot.setAttribute("pointer-events", "none");
        this.relationsGroup.appendChild(dot);
      }
      if (relation.label) {
        if (!labelPosition) {
          const title = this.document.createElementNS("http://www.w3.org/2000/svg", "title");
          title.textContent = relation.label;
          path.appendChild(title);
          continue;
        }
        const label = this.annotationLabelLabel(relation.label, labelPosition.x, labelPosition.y, color);
        label?.setAttribute("class", "crisp-mind-annotation-label crisp-mind-relation-label");
        if (label) this.relationsGroup.appendChild(label);
      }
    }
  }

  renderSummaries() {
    if (!this.annotationsGroup || !Array.isArray(this.docData.summaries)) return;
    const visible = new Set(this.visibleNodes().map(node => node.id));
    const centerRoot = this._layoutRootNode || this.docData.root;
    const rootCenter = centerRoot._x + centerRoot._w / 2;
    for (const summary of this.docData.summaries) {
      const node = this.findNode(summary.nodeId);
      if (!node || !visible.has(node.id)) continue;
      const bounds = this.summaryBounds(node);
      if (!bounds) continue;
      const color = summary.color || this.theme.accentColor || "#7c3aed";
      const side = (bounds.x + bounds.width / 2) < rootCenter ? "left" : "right";
      const labelText = summary.label || `概要 · ${mindNodeLink(node.data?.text || "", this.options.vaultName)?.display || node.data?.text || "分支"}`;
      const width = Math.max(112, Math.min(250, [...labelText].reduce((sum, char) => sum + (/[^\x00-\xff]/.test(char) ? 12 : 7), 0) + 34));
      const height = 32;
      const centerY = bounds.y + bounds.height / 2;
      const braceGap = 24;
      const braceX = side === "left" ? bounds.x - braceGap : bounds.x + bounds.width + braceGap;
      const edgeX = side === "left" ? bounds.x - 6 : bounds.x + bounds.width + 6;
      const top = bounds.y - 4;
      const bottom = bounds.y + bounds.height + 4;
      const corner = Math.min(10, Math.max(5, bounds.height / 3));
      const direction = side === "left" ? -1 : 1;
      const path = this.document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute(
        "d",
        `M ${edgeX} ${top} H ${braceX - direction * corner} ` +
        `Q ${braceX} ${top} ${braceX} ${top + corner} ` +
        `V ${bottom - corner} ` +
        `Q ${braceX} ${bottom} ${braceX - direction * corner} ${bottom} ` +
        `H ${edgeX} ` +
        `M ${braceX} ${centerY} H ${side === "left" ? braceX - 20 : braceX + 20}`
      );
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", color);
      path.setAttribute("stroke-width", "1.6");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("stroke-dasharray", "6 4");
      path.setAttribute("pointer-events", "none");
      this.annotationsGroup.appendChild(path);

      const group = this.document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("class", "crisp-mind-summary");
      group.setAttribute("data-summary-id", summary.id);
      const x = side === "left" ? braceX - 20 - width : braceX + 20;
      const y = centerY - height / 2;
      const box = this.document.createElementNS("http://www.w3.org/2000/svg", "rect");
      box.setAttribute("x", x);
      box.setAttribute("y", y);
      box.setAttribute("width", width);
      box.setAttribute("height", height);
      box.setAttribute("rx", height / 2);
      box.setAttribute("fill", this.annotationFill(color));
      box.setAttribute("stroke", color);
      box.setAttribute("stroke-width", "1.2");
      const marker = this.document.createElementNS("http://www.w3.org/2000/svg", "circle");
      marker.setAttribute("cx", side === "left" ? x + width - 13 : x + 13);
      marker.setAttribute("cy", centerY);
      marker.setAttribute("r", "3.2");
      marker.setAttribute("fill", color);
      const text = this.document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", side === "left" ? x + 12 : x + 22);
      text.setAttribute("y", centerY);
      text.setAttribute("text-anchor", "start");
      text.setAttribute("dominant-baseline", "central");
      text.setAttribute("fill", color);
      text.setAttribute("font-size", "11.5");
      text.setAttribute("font-weight", "600");
      text.textContent = labelText.length > 24 ? `${labelText.slice(0, 23)}…` : labelText;
      group.append(box, marker, text);
      group.addEventListener("contextmenu", event => {
        event.preventDefault(); event.stopPropagation();
        this.options.onSummaryContextMenu?.(summary, event);
      });
      this.annotationsGroup.appendChild(group);
    }
  }

  editNodeText(node) {
    if (!node || this.options.readOnly || this.editor) return;
    const currentText = node.data?.text || "";
    const input = this.document.createElement("textarea");
    input.rows = 1;
    input.value = currentText;
    input.className = "crisp-mind-inline-editor";

    // Edit the node itself: reserve exactly its existing bounds and move the
    // canvas into view, instead of widening/clamping an unrelated overlay.
    if (!Number.isFinite(node._w)) this.calculateLayout();
    const frame = inlineEditorFrame(node, this.scale, this.translateX, this.translateY, this.container.clientWidth, this.container.clientHeight);
    this.scale = frame.scale;
    this.translateX = frame.translateX; this.translateY = frame.translateY;
    if (this.viewportGroup) this.updateTransform();
    this.options.onZoom?.(this.scale);
    Object.assign(input.style, {
      left: `${frame.left}px`, top: `${frame.top}px`, width: `${frame.width}px`, height: `${frame.height}px`,
      fontSize: `${(node.id === this.docData.root.id ? 14 : 13) * this.scale}px`,
      borderRadius: `${(this.theme.borderRadius || 8) * this.scale}px`,
      padding: `0 ${Math.max(4, 14 * this.scale)}px`
    });
    const nodeEl = this.nodeElements?.get(node.id);
    if (nodeEl) nodeEl.style.visibility = "hidden";
    const labelEl = this.nodeElements?.get(node.id)?.querySelector(".crisp-mind-node-label");
    if (labelEl) labelEl.style.visibility = "hidden";
    this.editorNodeId = node.id;
    const restoreLabel = () => {
      this.editorNodeId = null;
      if (nodeEl) nodeEl.style.visibility = "";
      const currentNode = this.nodeElements?.get(node.id);
      if (currentNode) currentNode.style.visibility = "";
      if (labelEl) labelEl.style.visibility = "";
      const currentLabel = this.nodeElements?.get(node.id)?.querySelector(".crisp-mind-node-label");
      if (currentLabel) currentLabel.style.visibility = "";
    };
    this.restoreEditorLabel = restoreLabel;
    this.options.onDeselect?.();
    input.setAttribute("aria-label", "节点文本，⌘Enter 或 Ctrl+Enter 换行，Enter 确认");
    input.title = "⌘Enter / Ctrl+Enter 换行 · Enter 确认 · Esc 取消";
    this.editor = input;
    this.container.appendChild(input);
    this.resizeInlineEditor();
    input.addEventListener("input", () => this.resizeInlineEditor());
    input.focus();
    input.select();

    let committed = false;
    const cleanup = () => {
      committed = true;
      restoreLabel();
      this.restoreEditorLabel = null;
      this.editor = null;
      this.commitEditor = null;
      disposeHotkeys?.();
      if (input.parentNode) input.parentNode.removeChild(input);
      this.container.focus({ preventScroll: true });
    };

    const commit = (isExplicit = false) => {
      if (committed) return;
      let newText;
      try {
        newText = normalizeMindLinkText(input.value.trim() || "Topic", this.options.vaultName);
      } catch (error) {
        new Notice(error.message);
        if (isExplicit) {
          input.focus();
          return;
        }
        cleanup();
        this.render();
        return;
      }
      cleanup();
      node.data.text = newText;
      if (newText !== currentText) this.saveState();
      this.render();
    };

    const insertBreak = () => {
      if (committed) return;
      input.focus();
      // Native editing preserves the textarea undo history.
      const inserted = this.document.execCommand?.("insertText", false, "\n");
      if (!inserted) input.setRangeText("\n", input.selectionStart, input.selectionEnd, "end");
      this.resizeInlineEditor();
    };
    const disposeHotkeys = this.options.registerEditorHotkeys?.(insertBreak);
    this.commitEditor = () => commit(false);
    input.addEventListener("blur", () => commit(false));
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.metaKey || e.ctrlKey) {
          insertBreak();
        } else commit(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        cleanup();
      }
    });
  }

  resizeInlineEditor() {
    const input = this.editor;
    const node = this.editorNodeId && this.findNode(this.editorNodeId);
    if (!input || !node) return;
    const fontSize = (normalizeNodeStyle(node.data?.style)?.fontSize || (node.id === this.docData.root.id ? 14 : 13)) * this.scale;
    input.style.fontSize = `${fontSize}px`;
    input.style.padding = `${Math.max(3, 8 * this.scale)}px ${Math.max(4, 14 * this.scale)}px`;
    const top = node._y * this.scale + this.translateY;
    const available = Math.max(node._h * this.scale, (this.container.clientHeight || 600) - top - 16);
    input.style.height = "auto";
    const wanted = Math.max(node._h * this.scale, (input.scrollHeight || 0) + 4);
    input.style.height = `${Math.min(available, wanted)}px`;
    input.style.overflowY = wanted > available ? "auto" : "hidden";
  }

  updateTransform() {
    this.options.onDeselect?.();
    if (!this.viewportGroup) return;
    this.viewportGroup.setAttribute(
      "transform",
      `translate(${this.translateX}, ${this.translateY}) scale(${this.scale})`
    );
    // Deferred initial fit and any later viewport change must move the editor too.
    const node = this.editorNodeId && this.findNode(this.editorNodeId);
    if (this.editor && node) {
      Object.assign(this.editor.style, {
        left: `${node._x * this.scale + this.translateX}px`,
        top: `${node._y * this.scale + this.translateY}px`,
        width: `${node._w * this.scale}px`, height: `${node._h * this.scale}px`,
        fontSize: `${(node.id === this.docData.root.id ? 14 : 13) * this.scale}px`,
        borderRadius: `${(this.theme.borderRadius || 8) * this.scale}px`,
        padding: `0 ${Math.max(4, 14 * this.scale)}px`
      });
      this.resizeInlineEditor();
    }
  }

  listen(target, type, callback, options) {
    target.addEventListener(type, callback, options);
    this.disposers.push(() => target.removeEventListener(type, callback, options));
  }

  destroy() {
    this.destroyed = true;
    // Finish editing before detaching the input; blur cleanup owns its removal.
    this.commitEditor?.();
    this.disposers.forEach(dispose => dispose());
    this.disposers = [];
    this.isPanning = false;
    this.restoreEditorLabel?.();
    this.editor?.remove();
    this.dragHint?.remove();
    this.cancelDrag();
    this.nodeElements?.clear();
  }

  cancelDrag() {
    this.drag = null;
    this.nodesGroup?.querySelectorAll("[data-drop]").forEach(el => el.removeAttribute("data-drop"));
    if (this.dragHint) this.dragHint.style.display = "none";
  }

  async clipboardAction(action) {
    if (this.destroyed || this.editor || (this.options.readOnly && action !== "copy")) return;
    const id = this.selectedNodeId;
    try {
      if (action === "paste") {
        const text = await this.window.navigator.clipboard.readText();
        if (this.destroyed || this.editor) return;
        if (!this.pasteBranchText(text, id || this.docData.root.id)) new Notice("没有可粘贴的节点，或内容超过限制");
      } else {
        const text = this.copyBranchText(id); if (!text) return;
        const snapshot = this.clipboardBranchSnapshot;
        await this.window.navigator.clipboard.writeText(text);
        // Share only successful copies, within this plugin instance (never settings/disk).
        if (this.options.clipboardStore) this.options.clipboardStore.snapshot = snapshot;
        if (this.destroyed) return;
        let removed = false;
        if (action === "cut" && !this.editor && !this.options.readOnly) {
          const current = this.findNode(id);
          // Comparing flattened text misses changed notes, styles, folds and hard breaks.
          if (current && JSON.stringify(cleanMindData(current)) === JSON.stringify(snapshot.node)) {
            this.deleteNode(id);
            removed = !this.findNode(id);
          }
        }
        new Notice(removed ? "分支已剪切，可撤销" : action === "cut" ? "分支已复制；原节点状态已变化或不可删除，未剪切" : "分支已复制，粘贴到其他导图可保留换行、样式与备注");
      }
    } catch (error) { new Notice(`剪贴板操作失败：${error.message}`); }
  }

  bindEvents() {
    this.listen(this.nodesGroup, "pointerdown", e => {
      if (this.presentationActive || this.options.readOnly || this.editor || e.button !== 0 || e.target.closest("[data-collapse]")) return;
      const element = e.target.closest("[data-node-id]");
      if (!element || element.dataset.nodeId === this.docData.root.id) return;
      this.drag = {id: element.dataset.nodeId, x: e.clientX, y: e.clientY, active: false};
    });
    this.listen(this.window, "pointermove", e => {
      const drag = this.drag; if (!drag) return;
      if (!drag.active && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
      drag.active = true; e.preventDefault(); this.options.onDeselect?.();
      const pane = this.container.getBoundingClientRect();
      const edge = 28;
      this.translateX += e.clientX < pane.left + edge ? 8 : e.clientX > pane.right - edge ? -8 : 0;
      this.translateY += e.clientY < pane.top + edge ? 8 : e.clientY > pane.bottom - edge ? -8 : 0;
      this.updateTransform();
      const targetEl = this.document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-node-id]");
      this.nodesGroup.querySelectorAll("[data-drop]").forEach(el => el.removeAttribute("data-drop"));
      drag.target = null;
      if (targetEl && this.nodesGroup.contains(targetEl)) {
        const target = this.findNode(targetEl.dataset.nodeId), moving = this.findNode(drag.id);
        if (target && moving && !this.findNode(target.id, moving)) {
          const box = targetEl.querySelector("[data-node-shape]").getBoundingClientRect();
          const ratio = (e.clientY - box.top) / box.height;
          drag.placement = target.id === this.docData.root.id ? "inside" : ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside";
          drag.target = target.id; targetEl.setAttribute("data-drop", drag.placement);
        }
      }
      if (!this.dragHint) { this.dragHint = this.document.createElement("div"); this.dragHint.className = "crisp-mind-drag-hint"; this.container.appendChild(this.dragHint); }
      this.dragHint.textContent = drag.target ? ({inside:"放入子主题",before:"插入前面",after:"插入后面"}[drag.placement]) + " · Esc 取消" : "拖到目标节点 · Esc 取消";
      this.dragHint.style.display = "block";
      this.dragHint.style.left = `${Math.max(8, Math.min(this.container.clientWidth - 200, e.clientX - pane.left + 18))}px`;
      this.dragHint.style.top = `${Math.max(8, Math.min(this.container.clientHeight - 40, e.clientY - pane.top + 18))}px`;
    });
    this.listen(this.window, "pointerup", () => {
      const drag = this.drag;
      if (drag?.active) {
        this.suppressClickUntil = Date.now() + 300;
        if (drag.target) this.moveNode(drag.id, drag.target, drag.placement);
      }
      this.cancelDrag();
    });
    this.listen(this.window, "pointercancel", () => this.cancelDrag());
    this.listen(this.window, "blur", () => { this.isPanning = false; this.cancelDrag(); });
    this.listen(this.window, "keydown", e => { if (e.key === "Escape" && this.drag) { e.preventDefault(); this.cancelDrag(); } });
    this.listen(this.container, "mousedown", (e) => {
      if (e.button === 0 && (e.target === this.svg || e.target === this.container)) {
        this.container.focus({ preventScroll: true });
        this.isPanning = true;
        this.startX = e.clientX - this.translateX;
        this.startY = e.clientY - this.translateY;
        this.setSelectionState([], null);
        this.render();
        this.options.onSelectionChange?.([]);
        if (this.options.onDeselect) this.options.onDeselect();
      }
    });

    this.listen(this.window, "mousemove", (e) => {
      if (!this.isPanning) return;
      this.translateX = e.clientX - this.startX;
      this.translateY = e.clientY - this.startY;
      this.updateTransform();
    });

    this.listen(this.window, "mouseup", () => {
      this.isPanning = false;
    });

    this.listen(this.container, "wheel", (e) => {
      // Floating panels scroll their own content; only the bare canvas pans or zooms.
      if (this.editor || e.target.closest?.("button, input, textarea, select, .crisp-mind-node-island, .crisp-mind-floating-toolbar, .crisp-mind-outline-panel, .crisp-mind-inspector, .crisp-mind-branch-bar, .crisp-mind-presentation-bar, .crisp-mind-license-banner")) return;
      e.preventDefault(); e.stopPropagation();
      if (!e.ctrlKey && !e.metaKey) {
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.container.clientHeight : 1;
        this.translateX -= e.deltaX * unit; this.translateY -= e.deltaY * unit;
        this.updateTransform(); return;
      }
      const zoomFactor = Math.exp(-e.deltaY * 0.01);
      const newScale = Math.min(2.5, Math.max(0.05, this.scale * zoomFactor));

      const rect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      this.translateX = mouseX - (mouseX - this.translateX) * (newScale / this.scale);
      this.translateY = mouseY - (mouseY - this.translateY) * (newScale / this.scale);
      this.scale = newScale;

      this.updateTransform();
      if (this.options.onZoom) this.options.onZoom(this.scale);
    }, { passive: false });

    this.listen(this.container, "keydown", (e) => {
      if (this.presentationActive && !e.target.closest?.("input, textarea, [contenteditable=true]")) {
        if (e.key === "Escape") {
          e.preventDefault(); e.stopPropagation(); this.stopPresentation(); return;
        }
        if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " " || e.key === "PageDown") {
          e.preventDefault(); e.stopPropagation();
          this.goToPresentationStep(Math.min(this.getPresentationSteps().length - 1, this.presentationIndex + 1));
          return;
        }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
          e.preventDefault(); e.stopPropagation();
          this.goToPresentationStep(Math.max(0, this.presentationIndex - 1));
          return;
        }
        return;
      }
      if (e.isComposing || e.target.closest?.("input, textarea, select, button, [contenteditable=true]")) return;
      if (e.key === "Escape" && !this.drag) {
        // With nothing selected, Esc steps back out of a focused branch to the whole map.
        if (!this.selectedNodeIds.size && this.branchFocusId) {
          this.clearBranchFocus();
          return;
        }
        this.setNodeSelection([], null);
        this.options.onDeselect?.();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")) {
        e.preventDefault();
        e.stopPropagation();
        (e.key.toLowerCase() === "y" || e.shiftKey) ? this.redo() : this.undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && ["c", "x", "v"].includes(e.key.toLowerCase())) {
        e.preventDefault(); e.stopPropagation(); void this.clipboardAction({c:"copy",x:"cut",v:"paste"}[e.key.toLowerCase()]); return;
      }
      if (e.key.startsWith("Arrow")) { e.preventDefault(); e.stopPropagation(); this.navigate(e.key); return; }
      // Folding is a view operation and stays available in read-only preview.
      if (this.selectedNodeId && e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault(); this.toggleCollapse(); return;
      }
      if (!this.selectedNodeId || this.options.readOnly) return;
      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) { const parent = this.findParent(this.selectedNodeId); if (parent) this.selectNode(parent.id, true); }
        else this.addChildNode(this.selectedNodeId, true);
      } else if (e.key === "Enter") {
        e.preventDefault();
        this.addSiblingNode(this.selectedNodeId, true);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (this.selectedNodeIds.size > 1) this.deleteSelectedNodes();
        else this.deleteNode(this.selectedNodeId);
      } else if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        const node = this.findNode(this.selectedNodeId);
        if (node) this.editNodeText(node);
      }
    });
  }

  resetZoom() {
    const bounds = this.getBounds();
    const width = this.container.clientWidth || 800, height = this.container.clientHeight || 600;
    this.scale = Math.max(0.05, Math.min(1.25, (width - 80) / bounds.width, (height - 160) / bounds.height));
    this.translateX = (width - bounds.width * this.scale) / 2 - bounds.x * this.scale;
    this.translateY = (height - bounds.height * this.scale) / 2 - bounds.y * this.scale;
    this.updateTransform();
    if (this.options.onZoom) this.options.onZoom(this.scale);
  }

  getBounds() {
    const nodes = [];
    const walk = n => { nodes.push(n); (n.children || []).forEach(walk); };
    this.visibleNodes().forEach(n => nodes.push(n));
    let x = Math.min(...nodes.map(n => n._x)), y = Math.min(...nodes.map(n => n._y));
    let maxX = Math.max(...nodes.map(n => n._x + n._w));
    let maxY = Math.max(...nodes.map(n => n._y + n._h));
    for (const group of [this.boundaryGroup, this.relationsGroup, this.annotationsGroup]) {
      if (typeof group?.getBBox !== "function") continue;
      try {
        const box = group.getBBox();
        if (Number.isFinite(box.x) && box.width > 0 && box.height > 0) {
          x = Math.min(x, box.x);
          y = Math.min(y, box.y);
          maxX = Math.max(maxX, box.x + box.width);
          maxY = Math.max(maxY, box.y + box.height);
        }
      } catch (_) {}
    }
    return {x, y, width: maxX - x, height: maxY - y};
  }

  exportSVG() {
    const svg = this.svg.cloneNode(true), bounds = this.getBounds();
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("width", bounds.width + 64);
    svg.setAttribute("height", bounds.height + 64);
    svg.setAttribute("viewBox", `${bounds.x - 32} ${bounds.y - 32} ${bounds.width + 64} ${bounds.height + 64}`);
    svg.removeAttribute("class");
    svg.firstElementChild.removeAttribute("transform");

    const bgRect = this.document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("x", bounds.x - 32);
    bgRect.setAttribute("y", bounds.y - 32);
    bgRect.setAttribute("width", bounds.width + 64);
    bgRect.setAttribute("height", bounds.height + 64);
    const isDark = typeof document !== "undefined" && document.body?.classList?.contains
      ? document.body.classList.contains("theme-dark")
      : false;
    const bg = (this.theme.backgroundColor && this.theme.backgroundColor !== "transparent")
      ? this.theme.backgroundColor
      : (isDark ? "#1e1e2e" : "#ffffff");
    bgRect.setAttribute("fill", bg);
    svg.firstElementChild.insertBefore(bgRect, svg.firstElementChild.firstChild);

    svg.querySelectorAll("text").forEach(el => el.setAttribute("font-family", "Arial, sans-serif"));
    return svg.outerHTML;
  }
}

/* ==========================================================================
   Crisp Mind Edit View (TextFileView)
   ========================================================================== */

class CrispMindEditView extends TextFileView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.mindDoc = null;
    this.canvasController = null;
    this.baseReadOnly = false;
  }

  getViewType() {
    return VIEW_TYPE_CRISP_MIND;
  }

  getDisplayText() {
    return this.file ? this.file.basename : "Crisp Mind";
  }

  getIcon() {
    return CRISP_MIND_ICON_ID;
  }

  isLicensed() {
    return typeof this.plugin?.isLicensed === "function" ? this.plugin.isLicensed() : true;
  }

  getViewData() {
    if (!this.mindDoc) return "";
    if (this.readOnly || !this.dirty) return this.originalData || "";
    return assembleMindMarkdown(this.mindDoc);
  }

  setViewData(data, clear) {
    if (this.pendingWrite === data) return;
    if (!clear && this.dirty && data !== this.originalData) {
      this.setSaveState("外部修改冲突：本地草稿已保留，请另存副本", true);
      return;
    }
    if (!clear && this.dirty && data === this.originalData) return;
    this.originalData = data;
    this.dirty = false;
    this.baseReadOnly = !this.file?.path?.endsWith(".mind.md") && !this.file?.path?.endsWith(".mind");
    this.sourceWarning = this.baseReadOnly ? null : inspectMindSource(data);
    this.readOnly = this.baseReadOnly || !this.isLicensed() || !!this.sourceWarning;
    this.saveError = null;
    // Only drop content to empty document if JSON itself is corrupt/unsafe.
    // For non-destructive warnings (like outline mismatch or extra body), keep parsed mindDoc visible in read-only mode.
    const isFatalCorrupt = this.sourceWarning && /损坏|超过安全/.test(this.sourceWarning);
    try {
      this.mindDoc = isFatalCorrupt ? parseMindMarkdown("") : parseMindMarkdown(data);
    } catch (_) {
      this.mindDoc = parseMindMarkdown("");
    }
    if (!this.canvasController) {
      this.initViewUI();
    } else {
      this.canvasController.destroy();
      this.canvasController = null;
      this.initViewUI();
    }
  }

  setSaveState(message, error = false) {
    this.saveError = error ? message : null;
    if (this.saveStatusEl) {
      this.saveStatusEl.textContent = message;
      this.saveStatusEl.classList.toggle("is-error", error);
      this.saveStatusEl.setAttribute("aria-live", error ? "assertive" : "polite");
    }
  }

  async writeSnapshot(content, reason, file = this.file) {
    const adapter = this.app.vault.adapter;
    const folder = `${this.app.vault.configDir || ".obsidian"}/plugins/crisp-mind/backups`;
    if (!(await adapter.exists(folder))) {
      try { await adapter.mkdir(folder); } catch (error) { if (!(await adapter.exists(folder))) throw error; }
    }
    const createdAt = new Date().toISOString();
    const sourceKey = snapshotSourceKey(file.path);
    const path = `${folder}/${Date.now()}-${sourceKey}-${generateUid()}.json`;
    await adapter.write(path, JSON.stringify({version:1, sourcePath:file.path, createdAt, reason, content}));
    await this.pruneSnapshots(folder, sourceKey);
    return path;
  }

  // Keep only the newest snapshots of this file (the recovery list shows at most that many).
  // Best effort: pruning never fails a save. Snapshots written before 1.5.2 carry no source key
  // in their name and are left untouched.
  async pruneSnapshots(folder, sourceKey) {
    try {
      const adapter = this.app.vault.adapter;
      const pattern = new RegExp(`/\\d+-${sourceKey}-[^/]+\\.json$`);
      const own = (await adapter.list(folder)).files.filter(path => pattern.test(path)).sort();
      for (const path of own.slice(0, Math.max(0, own.length - MIND_SNAPSHOT_LIMIT))) {
        try { await adapter.remove(path); } catch (_) {}
      }
    } catch (_) {}
  }

  save() {
    // Serialise saves for this view; vault.process compares source atomically across views.
    this.saveQueue = (this.saveQueue || Promise.resolve()).then(async () => {
      if (!this.file || !this.dirty || this.readOnly || !this.mindDoc) return;
      const file = this.file, doc = this.mindDoc;
      const output = assembleMindMarkdown(doc), expected = this.originalData;
      if (output === expected) { this.dirty = false; this.setSaveState("已保存"); return; }
      this.setSaveState("保存中…");
      try {
        if (this.plugin.settings.autoBackup && this.lastSnapshotContent !== expected) {
          await this.writeSnapshot(expected, "before-save", file); this.lastSnapshotContent = expected;
        }
        this.pendingWrite = output;
        await this.app.vault.process(file, current => {
          if (current !== expected && current !== output) throw new Error("文件已被其他编辑器修改；请另存副本");
          return output;
        });
        if (this.file !== file || this.mindDoc !== doc) return;
        this.originalData = output;
        this.data = output;
        this.dirty = assembleMindMarkdown(this.mindDoc) !== output;
        this.setSaveState(this.dirty ? "待保存" : "已保存");
        if (this.dirty) this.requestSave();
      } catch (error) {
        let recovery = "";
        try { await this.writeSnapshot(output, "unsaved-draft", file); recovery = "；草稿已备份"; } catch (_) { recovery = "；备份失败，请立即另存副本"; }
        if (this.file !== file || this.mindDoc !== doc) { new Notice(`原导图保存失败${recovery}`, 8000); return; }
        this.setSaveState(`保存失败：${error.message}${recovery}`, true);
        new Notice(this.saveError, 8000);
      } finally { this.pendingWrite = null; }
    });
    return this.saveQueue;
  }

  async saveCopy(content = assembleMindMarkdown(this.mindDoc)) {
    const prefix = this.file?.parent?.path && this.file.parent.path !== "/" ? this.file.parent.path + "/" : "";
    const name = (this.file?.basename || "导图").replace(/\.mind$/, "") + " 恢复副本";
    let path = `${prefix}${name}.mind.md`, i = 2;
    while (this.app.vault.getAbstractFileByPath(path)) path = `${prefix}${name} ${i++}.mind.md`;
    try {
      const file = await this.app.vault.create(path, content);
      await this.plugin.openActiveFileAsMindMap(file);
      new Notice(`已保存副本：${path}`);
    } catch (error) { new Notice(`另存失败：${error.message}`, 8000); }
  }

  async showRecovery() {
    const folder = `${this.app.vault.configDir || ".obsidian"}/plugins/crisp-mind/backups`;
    const modal = new Modal(this.app); modal.titleEl.setText("恢复导图副本");
    modal.contentEl.createEl("p", {text:"选择快照创建独立副本。原文件保持不变。"});
    try {
      const adapter = this.app.vault.adapter;
      const entries = await adapter.exists(folder) ? (await adapter.list(folder)).files.sort().reverse() : [];
      let count = 0;
      for (const path of entries) {
        if (!path.endsWith(".json")) continue;
        let snapshot; try { snapshot = JSON.parse(await adapter.read(path)); } catch (_) { continue; }
        if (snapshot.sourcePath !== this.file?.path || typeof snapshot.content !== "string") continue;
        if (inspectMindSource(snapshot.content)) continue;
        const row = modal.contentEl.createDiv({cls:"crisp-mind-recovery-row"});
        row.createSpan({text: `${new Date(snapshot.createdAt).toLocaleString()} · ${snapshot.reason === "unsaved-draft" ? "未保存草稿" : "保存前快照"}`});
        row.createEl("button", {text:"恢复副本"}).addEventListener("click", () => { void this.saveCopy(snapshot.content); modal.close(); });
        if (++count >= 30) break;
      }
      if (!count) modal.contentEl.createEl("p", {text:"此文件暂无可恢复快照。"});
    } catch (error) { modal.contentEl.createEl("p", {text:`读取快照失败：${error.message}`}); }
    modal.open();
  }

  clear() {
    this.mindDoc = null;
    this.dirty = false;
    this.sourceWarning = null;
    if (this.canvasController) {
      this.canvasController.destroy();
      this.contentEl.innerHTML = "";
      this.canvasController = null;
    }
  }

  async onClose() {
    this.canvasController?.commitEditor?.();
    await this.save();
    this.canvasController?.destroy();
    await super.onClose();
  }

  openLicenseSettings() {
    this.plugin.openLicenseSettings();
  }

  requireLicense(feature) {
    return this.plugin.requireLicense(feature);
  }

  refreshLicenseAccess() {
    const nextReadOnly = this.baseReadOnly || !!this.sourceWarning || !this.isLicensed();
    if (nextReadOnly === this.readOnly) {
      this.renderToolbar?.();
      return;
    }
    const wasDirty = this.dirty;
    this.readOnly = nextReadOnly;
    if (this.canvasController) {
      this.canvasController.destroy();
      this.canvasController = null;
    }
    this.initViewUI();
    if (this.readOnly && wasDirty) this.setSaveState("未激活 · 有未保存修改", true);
    else if (!this.readOnly && wasDirty) {
      this.setSaveState("待保存");
      this.requestSave();
    }
    new Notice(this.readOnly ? "Crisp Mind 未激活，已切换为只读预览。" : "Crisp Mind 授权已生效，编辑功能已解锁。");
  }

  initViewUI() {
    this.contentEl.innerHTML = "";
    this.contentEl.style.padding = "0";

    const container = this.contentEl.createDiv({ cls: "crisp-mind-view" });
    this.viewContainer = container;

    // Canvas Engine instance first
    this.canvasController = new CrispMindCanvas(container, this.mindDoc.data, {
      readOnly: this.readOnly,
      vaultName: this.app.vault.getName(),
      clipboardStore: this.plugin.mindClipboardStore ||= {},
      registerEditorHotkeys: insertBreak => {
        // Obsidian handles Mod+Enter before DOM keydown reaches the editor.
        const scope = new obsidian.Scope(this.app.scope);
        scope.register(["Mod"], "Enter", event => {
          if (event.isComposing || event.keyCode === 229) return true;
          insertBreak();
          return false;
        });
        this.app.keymap.pushScope(scope);
        return () => this.app.keymap.popScope(scope);
      },
      onChange: () => {
        if (this.readOnly) return;
        this.dirty = true;
        this.setSaveState("待保存");
        this.requestSave();
        this.notifyPulseContribution();
      },
      onContextMenu: (node, event) => this.showNodeMenu(node, event),
      onSelectNode: (node, screenCoord) => {
        if (this.inspectorOpen) {
          if (this.islandEl) this.islandEl.style.display = "none";
          return;
        }
        this.renderNodeIsland(node, screenCoord);
      },
      onDeselect: () => {
        if (this.islandEl) this.islandEl.style.display = "none";
      },
      onZoom: (scale) => {
        if (this.zoomBadge) {
          this.zoomBadge.textContent = `${Math.round(scale * 100)}%`;
        }
      },
      onBranchFocus: (node, path) => this.updateBranchBar(node, path),
      onPresentationChange: (state) => this.updatePresentationBar(state),
      onSelectionChange: () => this.handleSelectionChange(),
      onRender: () => this.renderOutline(),
      onRelationContextMenu: (relation, event) => this.showRelationMenu(relation, event),
      onSummaryContextMenu: (summary, event) => this.showSummaryMenu(summary, event),
      onOpenLink: (linkTarget) => {
        void this.openLinkedNote(linkTarget);
      },
      onHoverLink: (e, linkTarget) => {
        this.app.workspace.trigger("hover-link", {
          event: e,
          source: VIEW_TYPE_CRISP_MIND,
          hoverParent: this.contentEl,
          targetEl: e.target,
          linktext: linkTarget
        });
      }
    });

    // Floating Pill Toolbar (mounted after canvas)
    this.toolbarEl = container.createDiv({
      cls: `crisp-mind-floating-toolbar ${this.plugin.settings.toolbarPosition === "top" ? "toolbar-top" : ""}`
    });

    this.branchBarEl = container.createDiv({ cls: "crisp-mind-branch-bar" });
    this.branchBarEl.style.display = "none";
    const branchBack = this.branchBarEl.createEl("button", { cls: "crisp-mind-branch-back", attr: { "aria-label": "返回完整导图" } });
    setIcon(branchBack, "arrow-left");
    branchBack.createSpan({ text: "全图" });
    branchBack.addEventListener("click", () => this.canvasController.clearBranchFocus());
    this.branchPathEl = this.branchBarEl.createDiv({ cls: "crisp-mind-branch-path" });

    this.presentationBarEl = container.createDiv({ cls: "crisp-mind-presentation-bar" });
    this.presentationBarEl.style.display = "none";
    const presentationPrev = this.presentationBarEl.createEl("button", { cls: "crisp-mind-presentation-nav", attr: { "aria-label": "上一步" } });
    setIcon(presentationPrev, "chevron-left");
    presentationPrev.addEventListener("click", () => this.canvasController.goToPresentationStep(this.canvasController.presentationIndex - 1));
    this.presentationProgressEl = this.presentationBarEl.createSpan({ cls: "crisp-mind-presentation-progress" });
    const presentationNext = this.presentationBarEl.createEl("button", { cls: "crisp-mind-presentation-nav", attr: { "aria-label": "下一步" } });
    setIcon(presentationNext, "chevron-right");
    presentationNext.addEventListener("click", () => this.canvasController.goToPresentationStep(this.canvasController.presentationIndex + 1));
    const presentationExit = this.presentationBarEl.createEl("button", { cls: "crisp-mind-presentation-exit", text: "退出演示" });
    presentationExit.addEventListener("click", () => this.canvasController.stopPresentation());

    this.outlinePanelEl = container.createDiv({ cls: "crisp-mind-outline-panel" });
    this.outlinePanelEl.style.display = "none";
    const outlineHeader = this.outlinePanelEl.createDiv({ cls: "crisp-mind-outline-header" });
    outlineHeader.createSpan({ cls: "crisp-mind-outline-title", text: "大纲" });
    this.outlineDepthEl = outlineHeader.createEl("select", { cls: "crisp-mind-outline-depth", attr: { "aria-label": "大纲显示层级" } });
    for (const [value, label] of [["all", "全部层级"], ["1", "1 级"], ["2", "2 级"], ["3", "3 级"], ["4", "4 级"], ["5", "5 级"]]) {
      this.outlineDepthEl.createEl("option", { value, text: label });
    }
    this.outlineDepthEl.value = "all";
    this.outlineDepthEl.addEventListener("change", () => this.renderOutline());
    const outlineClose = outlineHeader.createEl("button", { attr: { "aria-label": "关闭大纲" } });
    setIcon(outlineClose, "x");
    outlineClose.addEventListener("click", () => {
      this.outlinePanelEl.style.display = "none";
      this.canvasController.render();
    });
    this.makeFloatingPanelDraggable(this.outlinePanelEl, outlineHeader);
    this.outlineFilterEl = this.outlinePanelEl.createEl("input", {
      cls: "crisp-mind-outline-filter",
      attr: { type: "search", placeholder: "筛选节点…", "aria-label": "筛选大纲节点" }
    });
    this.outlineTreeEl = this.outlinePanelEl.createDiv({ cls: "crisp-mind-outline-tree" });
    this.outlineFilterEl.addEventListener("input", () => this.renderOutline());

    this.inspectorEl = container.createDiv({ cls: "crisp-mind-inspector" });
    this.inspectorEl.style.display = "none";
    this.inspectorOpen = false;

    // Action Island
    this.islandEl = container.createDiv({ cls: "crisp-mind-node-island" });
    this.islandEl.style.display = "none";

    this.renderToolbar();
    this.saveStatusEl = container.createDiv({cls:"crisp-mind-save-status"});
    this.saveStatusEl.setAttribute("role", "status");
    const licensed = this.isLicensed();
    this.setSaveState(
      this.sourceWarning || (this.readOnly ? (licensed ? "只读大纲预览" : "未激活 · 只读预览") : "已保存"),
      !!this.sourceWarning
    );
    if (!licensed && !this.sourceWarning) {
      const banner = container.createDiv({ cls: "crisp-mind-license-banner" });
      banner.createSpan({ text: "Crisp Mind 未激活 · 当前为只读预览" });
      banner.createEl("button", { text: "打开授权设置" }).addEventListener("click", () => this.openLicenseSettings());
    } else if (this.readOnly) {
      const hint = container.createDiv({cls: "crisp-mind-hint"});
      hint.textContent = "大纲预览 · 原笔记保持不变";
    }
    this.canvasController.resetZoom();
    this.renderOutline();
    this.renderInspector();
  }

  updateBranchBar(node, path) {
    if (!this.branchBarEl || !this.branchPathEl) return;
    this.branchBarEl.style.display = node ? "flex" : "none";
    this.branchPathEl.textContent = node ? path.join("  /  ") : "";
  }

  updatePresentationBar(state) {
    if (!this.presentationBarEl || !this.presentationProgressEl) return;
    this.presentationBarEl.style.display = state?.active ? "flex" : "none";
    if (state?.active) {
      this.presentationProgressEl.textContent = `${state.index + 1} / ${state.total}`;
      const canPrev = state.index > 0;
      const canNext = state.index < state.total - 1;
      this.presentationBarEl.querySelectorAll(".crisp-mind-presentation-nav").forEach((button, index) => {
        button.disabled = index === 0 ? !canPrev : !canNext;
      });
    }
  }

  handleSelectionChange() {
    if (!this.canvasController.selectedNodes().length) this.inspectorOpen = false;
    if (this.inspectorOpen) this.renderInspector();
    else if (this.inspectorEl) {
      this.inspectorEl.style.display = "none";
      this.inspectorEl.empty();
    }
    this.renderOutline();
  }

  openInspector() {
    if (!this.canvasController.selectedNodeIds.size) {
      new Notice("请先选择至少一个节点");
      return false;
    }
    this.inspectorOpen = true;
    if (this.islandEl) this.islandEl.style.display = "none";
    this.renderInspector();
    return true;
  }

  closeInspector() {
    this.inspectorOpen = false;
    if (this.inspectorEl) {
      this.inspectorEl.style.display = "none";
      this.inspectorEl.empty();
    }
  }

  renderOutline() {
    if (!this.outlinePanelEl || !this.outlineTreeEl || this.outlinePanelEl.style.display === "none") return;
    const query = (this.outlineFilterEl?.value || "").normalize("NFKC").trim().toLocaleLowerCase();
    const controller = this.canvasController;
    const selected = controller.selectedNodeIds;
    const depthLimit = !query && this.outlineDepthEl?.value !== "all" ? Number(this.outlineDepthEl.value) : Infinity;
    this.outlineTreeEl.empty();

    const displayName = node => mindNodeLink(node.data?.text || "", controller.options.vaultName)?.display || node.data?.text || "Topic";
    const matched = new Set();
    if (query) {
      const markMatches = node => {
        const ownMatch = displayName(node).normalize("NFKC").toLocaleLowerCase().includes(query);
        // Visit all siblings; short-circuiting here drops later matching branches.
        let childMatch = false;
        for (const child of node.children || []) if (markMatches(child)) childMatch = true;
        if (ownMatch || childMatch) matched.add(node.id);
        return ownMatch || childMatch;
      };
      markMatches(controller.docData.root);
    }
    const filtered = node => !query || matched.has(node.id);

    const renderNode = (node, depth, isLast = false, isRoot = false) => {
      if (!filtered(node)) return;
      const level = depth + 1;
      if (!query && level > depthLimit) return;
      const row = this.outlineTreeEl.createDiv({
        cls: `crisp-mind-outline-row${selected.has(node.id) ? " is-selected" : ""}${node.id === controller.selectedNodeId ? " is-primary" : ""}${isLast ? " is-last" : ""}${isRoot ? " is-root" : ""}`
      });
      row.style.setProperty("--outline-depth", String(depth));
      const toggle = row.createEl("button", { cls: "crisp-mind-outline-toggle", attr: { "aria-label": !controller.isNodeExpanded(node) ? "展开" : "折叠" } });
      if (node.children?.length) {
        setIcon(toggle, !controller.isNodeExpanded(node) ? "chevron-right" : "chevron-down");
        toggle.addEventListener("click", event => {
          event.stopPropagation();
          controller.toggleCollapse(node.id);
        });
      } else {
        toggle.disabled = true;
        toggle.classList.add("is-empty");
        toggle.setAttribute("aria-hidden", "true");
      }
      const label = row.createEl("button", { cls: "crisp-mind-outline-label", attr: { title: displayName(node) } });
      label.createSpan({ cls: "crisp-mind-outline-text", text: displayName(node) });
      if (node.data?.note) label.createSpan({ cls: "crisp-mind-outline-note", text: "N" });
      if (node.data?.style?.fill) {
        const swatch = label.createSpan({ cls: "crisp-mind-outline-swatch" });
        swatch.style.backgroundColor = node.data.style.fill;
      }
      label.addEventListener("click", event => {
        if (event.shiftKey && controller.selectionAnchorId) controller.selectVisibleRange(controller.selectionAnchorId, node.id);
        else controller.selectNode(node.id, true, { additive: event.metaKey || event.ctrlKey });
      });
      if (!controller.isNodeExpanded(node) && !query) return;
      if (!query && level >= depthLimit) return;
      const children = node.children || [];
      children.forEach((child, index) => {
        if (!query || filtered(child)) {
          renderNode(child, depth + 1, index === children.length - 1, false);
        }
      });
    };
    renderNode(controller.docData.root, 0, false, true);
  }

  renderInspector() {
    if (!this.inspectorEl) return;
    const controller = this.canvasController;
    const selected = controller.selectedNodes();
    if (!this.inspectorOpen || !selected.length || this.readOnly) {
      this.inspectorEl.style.display = "none";
      this.inspectorEl.empty();
      return;
    }
    this.inspectorEl.style.display = "flex";
    this.inspectorEl.empty();

    const primary = controller.findNode(controller.selectedNodeId) || selected[0];
    const style = normalizeNodeStyle(primary.data?.style) || {};
    const header = this.inspectorEl.createDiv({ cls: "crisp-mind-inspector-header" });
    header.createSpan({ text: selected.length > 1 ? `已选 ${selected.length} 个节点` : "节点样式与备注" });
    const close = header.createEl("button", { attr: { "aria-label": "关闭检查器" } });
    setIcon(close, "x");
    close.addEventListener("click", () => {
      this.closeInspector();
    });
    this.makeFloatingPanelDraggable(this.inspectorEl, header);

    const styleSection = this.inspectorEl.createDiv({ cls: "crisp-mind-inspector-section" });
    styleSection.createDiv({ cls: "crisp-mind-inspector-title", text: selected.length > 1 ? "批量样式" : "节点样式" });

    const field = (label, control) => {
      const row = styleSection.createDiv({ cls: "crisp-mind-inspector-field" });
      row.createSpan({ text: label });
      row.appendChild(control);
      return row;
    };

    const shape = styleSection.createEl("select");
    for (const [value, label] of [["rounded", "圆角"], ["rectangle", "矩形"], ["pill", "胶囊"], ["ellipse", "椭圆"]]) {
      shape.createEl("option", { value, text: label });
    }
    shape.value = style.shape || "rounded";
    shape.addEventListener("change", () => controller.updateSelectedNodeStyles({ shape: shape.value }));
    field("形状", shape);

    const colorInput = (key, label) => {
      const wrap = this.inspectorEl.createDiv({ cls: "crisp-mind-inspector-color" });
      const input = wrap.createEl("input", { attr: { type: "color" } });
      input.value = style[key] || (key === "fill"
        ? (primary.id === controller.docData.root.id ? (controller.theme?.accentColor || "#7c3aed") : (controller.theme?.nodeBackground || "#ffffff"))
        : key === "textColor"
          ? (primary.id === controller.docData.root.id ? "#ffffff" : "#222222")
          : "#8a8a8a");
      input.addEventListener("change", () => controller.updateSelectedNodeStyles({ [key]: input.value }));
      const clear = wrap.createEl("button", { text: "默认", attr: { "aria-label": `恢复${label}默认值` } });
      clear.addEventListener("click", () => {
        controller.updateSelectedNodeStyles({ [key]: null });
        this.renderInspector();
      });
      return wrap;
    };
    field("填充", colorInput("fill", "填充"));
    field("文字", colorInput("textColor", "文字颜色"));
    field("边框", colorInput("borderColor", "边框颜色"));

    const stepperControl = (value, min, max, onChange, suffix = "") => {
      const wrap = this.inspectorEl.createDiv({ cls: "crisp-mind-inspector-stepper" });
      const minus = wrap.createEl("button", { text: "−", attr: { type: "button", "aria-label": "减少" } });
      const input = wrap.createEl("input", { attr: { type: "number", min: String(min), max: String(max), step: "1" } });
      const unit = wrap.createSpan({ cls: "crisp-mind-inspector-stepper__unit", text: suffix });
      const plus = wrap.createEl("button", { text: "+", attr: { type: "button", "aria-label": "增加" } });
      input.value = String(value);
      const apply = next => {
        const normalized = Math.max(min, Math.min(max, Number(next) || min));
        input.value = String(normalized);
        minus.disabled = normalized <= min;
        plus.disabled = normalized >= max;
        onChange(normalized);
      };
      minus.addEventListener("click", () => apply(Number(input.value) - 1));
      plus.addEventListener("click", () => apply(Number(input.value) + 1));
      input.addEventListener("change", () => apply(input.value));
      minus.disabled = value <= min;
      plus.disabled = value >= max;
      return wrap;
    };
    field("边框粗细", stepperControl(style.borderWidth ?? 1, 0, 6, value => controller.updateSelectedNodeStyles({ borderWidth: value }), "px"));
    field("字号", stepperControl(style.fontSize || 13, 10, 24, value => controller.updateSelectedNodeStyles({ fontSize: value }), "px"));

    const weight = styleSection.createEl("select");
    for (const [value, label] of [["400", "常规"], ["500", "中等"], ["600", "半粗"], ["700", "粗体"]]) weight.createEl("option", { value, text: label });
    weight.value = String(style.fontWeight || 500);
    weight.addEventListener("change", () => controller.updateSelectedNodeStyles({ fontWeight: Number(weight.value) }));
    field("字重", weight);

    const align = styleSection.createEl("select");
    for (const [value, label] of [["left", "左对齐"], ["center", "居中"], ["right", "右对齐"]]) align.createEl("option", { value, text: label });
    align.value = style.align || "center";
    align.addEventListener("change", () => controller.updateSelectedNodeStyles({ align: align.value }));
    field("对齐", align);

    const reset = styleSection.createEl("button", { cls: "crisp-mind-inspector-reset", text: "重置全部样式" });
    reset.addEventListener("click", () => {
      controller.updateSelectedNodeStyles({
        shape: null, fill: null, textColor: null, borderColor: null,
        borderWidth: null, fontSize: null, fontWeight: null, align: null
      });
      this.renderInspector();
    });

    const noteSection = this.inspectorEl.createDiv({ cls: "crisp-mind-inspector-section" });
    noteSection.createDiv({ cls: "crisp-mind-inspector-title", text: "节点备注" });
    if (selected.length === 1) {
      const note = noteSection.createEl("textarea", {
        cls: "crisp-mind-inspector-note",
        attr: { placeholder: "补充背景、判断依据或后续动作…", "aria-label": "节点备注" }
      });
      note.value = primary.data?.note || "";
      note.addEventListener("change", () => controller.updateSelectedNodeNote(note.value));
    } else {
      noteSection.createDiv({ cls: "crisp-mind-inspector-hint", text: "备注仅支持单节点编辑。" });
    }

    const annotationSection = this.inspectorEl.createDiv({ cls: "crisp-mind-inspector-section" });
    annotationSection.createDiv({ cls: "crisp-mind-inspector-title", text: "结构与标注" });
    const actions = annotationSection.createDiv({ cls: "crisp-mind-inspector-actions" });
    const boundary = (controller.docData.boundaries || []).find(item => item.nodeId === primary.id);
    const boundaryButton = actions.createEl("button", { text: boundary ? "编辑边界标签" : "添加边界" });
    boundaryButton.addEventListener("click", () => this.promptBoundary(primary, boundary));
    if (boundary) {
      const removeBoundary = actions.createEl("button", { cls: "is-danger", text: "移除边界" });
      removeBoundary.addEventListener("click", () => controller.removeBoundary(primary.id));
    }
    const summary = (controller.docData.summaries || []).find(item => item.nodeId === primary.id);
    const summaryButton = actions.createEl("button", { text: summary ? "编辑概要标签" : "添加概要" });
    summaryButton.addEventListener("click", () => this.promptSummary(primary, summary));
    if (summary) {
      const removeSummary = actions.createEl("button", { cls: "is-danger", text: "移除概要" });
      removeSummary.addEventListener("click", () => controller.removeSummary(primary.id));
    }
    if (selected.length === 2) {
      const relationButton = actions.createEl("button", { cls: "mod-cta", text: "建立关系" });
      relationButton.addEventListener("click", () => this.promptRelation(selected));
    } else if (selected.length > 2) {
      annotationSection.createDiv({ cls: "crisp-mind-inspector-hint", text: "建立关系请只选择两个节点。" });
    }
  }

  makeFloatingPanelDraggable(panel, header) {
    header.classList.add("is-draggable");
    header.setAttribute("title", "拖动标题栏移动面板");
    header.addEventListener("pointerdown", event => {
      if (event.button !== 0 || event.target.closest("button, input, select, textarea, a")) return;
      const ownerWindow = this.contentEl.ownerDocument.defaultView || window;
      const containerRect = this.canvasController.container.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const offsetX = event.clientX - panelRect.left;
      const offsetY = event.clientY - panelRect.top;
      panel.classList.add("is-dragging");
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.style.left = `${panelRect.left - containerRect.left}px`;
      panel.style.top = `${panelRect.top - containerRect.top}px`;

      const move = moveEvent => {
        const maxLeft = Math.max(8, containerRect.width - panelRect.width - 8);
        const maxTop = Math.max(8, containerRect.height - Math.min(panelRect.height, containerRect.height) - 8);
        const left = Math.max(8, Math.min(maxLeft, moveEvent.clientX - containerRect.left - offsetX));
        const top = Math.max(8, Math.min(maxTop, moveEvent.clientY - containerRect.top - offsetY));
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
      };
      const stop = () => {
        ownerWindow.removeEventListener("pointermove", move);
        ownerWindow.removeEventListener("pointerup", stop);
        ownerWindow.removeEventListener("pointercancel", stop);
        panel.classList.remove("is-dragging");
      };
      ownerWindow.addEventListener("pointermove", move);
      ownerWindow.addEventListener("pointerup", stop);
      ownerWindow.addEventListener("pointercancel", stop);
      event.preventDefault();
    });
  }

  promptBoundary(node, existing = null) {
    if (!this.requireLicense("边界编辑")) return;
    new CrispMindPromptModal(this.app, {
      title: existing ? "编辑边界" : "添加边界",
      value: existing?.label || "",
      placeholder: "边界名称，可留空",
      onSubmit: label => this.canvasController.setBoundary(node.id, label)
    }).open();
  }

  promptSummary(node, existing = null) {
    if (!this.requireLicense("概要编辑")) return;
    new CrispMindPromptModal(this.app, {
      title: existing ? "编辑概要" : "添加概要",
      value: existing?.label || "",
      placeholder: node.data?.text || "概要",
      onSubmit: label => this.canvasController.setSummary(node.id, label || node.data?.text || "概要")
    }).open();
  }

  promptRelation(nodes) {
    if (!this.requireLicense("关系编辑")) return;
    const from = nodes[0], to = nodes[1];
    const existing = (this.canvasController.docData.relations || []).find(relation =>
      (relation.from === from.id && relation.to === to.id) || (relation.from === to.id && relation.to === from.id)
    );
    new CrispMindPromptModal(this.app, {
      title: existing ? "编辑关系标签" : "建立关系",
      value: existing?.label || "",
      placeholder: "关系说明，可留空",
      onSubmit: label => this.canvasController.addRelation(from.id, to.id, label)
    }).open();
  }

  showRelationMenu(relation, event) {
    if (this.readOnly || !this.requireLicense("关系编辑")) return;
    const menu = new Menu();
    menu.addItem(item => item.setTitle("编辑关系标签").setIcon("pencil").onClick(() => {
      new CrispMindPromptModal(this.app, {
        title: "编辑关系标签",
        value: relation.label || "",
        placeholder: "关系说明",
        onSubmit: label => this.canvasController.addRelation(relation.from, relation.to, label, relation.color)
      }).open();
    }));
    menu.addItem(item => item.setTitle("删除关系").setIcon("trash-2").onClick(() => this.canvasController.removeRelation(relation.id)));
    menu.showAtMouseEvent(event);
  }

  showSummaryMenu(summary, event) {
    if (this.readOnly || !this.requireLicense("概要编辑")) return;
    const node = this.canvasController.findNode(summary.nodeId);
    const menu = new Menu();
    menu.addItem(item => item.setTitle("编辑概要标签").setIcon("pencil").onClick(() => node && this.promptSummary(node, summary)));
    menu.addItem(item => item.setTitle("删除概要").setIcon("trash-2").onClick(() => this.canvasController.removeSummary(summary.nodeId)));
    menu.showAtMouseEvent(event);
  }

  showInteractionHelp() {
    const modal = new Modal(this.app);
    modal.titleEl.setText("导图操作帮助");
    for (const [action, keys] of [
      ["添加子主题", "Tab"], ["添加同级主题", "Enter"],
      ["编辑节点", "双击或空格"], ["折叠 / 展开", "F 或节点旁按钮"],
      ["移动选择", "方向键；Shift + Tab 回到父节点"],
      ["复制 / 剪切 / 粘贴分支", "⌘ / Ctrl + C、X、V"],
      ["撤销 / 重做", "⌘ / Ctrl + Z、Shift + Z"],
      ["调整层级与顺序", "拖到节点中部成为子主题；上部 / 下部插入同级"],
      ["多选节点", "⌘ / Ctrl + 点击切换；Shift + 点击选择可见范围"],
      ["节点样式与备注", "工具栏检查器，或右键节点后选择"],
      ["大纲侧栏", "工具栏大纲按钮；可切换显示层级；点击节点定位，点击箭头折叠"],
      ["关系 / 边界 / 概要", "选中两个节点建立关系；右键节点添加边界或概要"],
      ["搜索并聚焦分支", "工具栏搜索；聚焦后从顶部或按 Esc 返回全图"],
      ["播放导图演示", "工具栏演示；左右方向键切换，Esc 退出"],
      ["平移画布", "滚动或拖拽空白处"],
      ["缩放画布", "触控板捏合或 ⌘ / Ctrl + 滚动"],
      ["节点内换行", "编辑文字时按 ⌘Enter / Ctrl+Enter；Enter 确认"],
      ["取消编辑或拖拽", "Esc"]
    ]) {
      const row = modal.contentEl.createDiv({cls: "crisp-mind-help-row"});
      row.createSpan({text: action}); row.createSpan({text: keys});
    }
    modal.open();
  }

  renderToolbar() {
    this.toolbarEl.innerHTML = "";

    // Zoom badge
    this.zoomBadge = this.toolbarEl.createEl("button", { cls: "crisp-mind-zoom-badge", text: "100%", attr: {"aria-label": "适应画布"} });
    this.zoomBadge.addEventListener("click", () => this.canvasController.resetZoom());

    this.createToolbarDivider();

    this.createToolbarButton("maximize", "适应画布", () => this.canvasController.resetZoom());
    if (!this.readOnly) {
    this.createToolbarButton("undo-2", "撤销 (⌘Z)", () => this.canvasController.undo());
    this.createToolbarButton("redo-2", "重做 (⌘⇧Z)", () => this.canvasController.redo());
    // Add Child (Tab)
    this.createToolbarButton("plus-circle", "添加子主题 (Tab)", () => {
      this.canvasController.addChildNode();
    });

    // Add Sibling (Enter)
    this.createToolbarButton("list-plus", "添加同级主题 (Enter)", () => {
      this.canvasController.addSiblingNode();
    });

    // Delete Node (Del)
    this.createToolbarButton("trash-2", "删除节点 (Del)", () => {
      if (this.canvasController.selectedNodeIds.size > 1) this.canvasController.deleteSelectedNodes();
      else this.canvasController.deleteNode();
    });

    this.createToolbarDivider();

    }
    this.createToolbarButton("chevrons-down-up", "收起所有分支", () => {
      this.canvasController.collapseAllBranches();
    });
    this.createToolbarButton("chevrons-up-down", "展开所有分支", () => {
      this.canvasController.expandAllBranches();
    });
    this.createToolbarDivider();

    // Layout Switcher
    this.createToolbarButton("layout-grid", "切换布局（切换后可点击适应画布）", (e) => {
      if (!this.requireLicense("布局切换") || this.readOnly) return;
      const menu = new Menu();
      menu.addItem((i) => i.setTitle("逻辑结构图 (从左向右)").onClick(() => this.canvasController.setLayout("logicalStructure")));
      menu.addItem((i) => i.setTitle("经典思维导图 (双向发散)").onClick(() => this.canvasController.setLayout("mindMap")));
      menu.addItem((i) => i.setTitle("组织架构图 (自顶向下)").onClick(() => this.canvasController.setLayout("organizationStructure")));
      menu.addItem((i) => i.setTitle("目录组织图 (大纲树)").onClick(() => this.canvasController.setLayout("catalogOrganization")));
      menu.addItem((i) => i.setTitle("水平时间轴 (Timeline)").onClick(() => this.canvasController.setLayout("timeline")));
      menu.addItem((i) => i.setTitle("因果鱼骨图 (Fishbone)").onClick(() => this.canvasController.setLayout("fishbone")));
      menu.showAtMouseEvent(e);
    });

    // Theme Switcher
    this.createToolbarButton("palette", "切换 Crisp 质感调色盘", (e) => {
      if (!this.requireLicense("主题切换") || this.readOnly) return;
      const menu = new Menu();
      menu.addItem((i) => i.setTitle("Crisp Obsidian (系统自适应)").onClick(() => this.canvasController.setTheme("crisp-obsidian")));
      menu.addItem((i) => i.setTitle("Crisp Cupertino (经典灰蓝)").onClick(() => this.canvasController.setTheme("crisp-cupertino")));
      menu.addItem((i) => i.setTitle("Crisp Nord (极光深暗)").onClick(() => this.canvasController.setTheme("crisp-nord")));
      menu.addItem((i) => i.setTitle("Crisp Mono Editorial (当代编辑)").onClick(() => this.canvasController.setTheme("crisp-mono")));
      menu.addItem((i) => i.setTitle("Crisp Amber (温暖羊皮纸)").onClick(() => this.canvasController.setTheme("crisp-amber")));
      menu.addItem((i) => i.setTitle("Crisp Paper (纸感画布)").onClick(() => this.canvasController.setTheme("crisp-paper")));
      menu.showAtMouseEvent(e);
    });

    this.createToolbarDivider();

    this.createToolbarButton("search", "搜索节点并聚焦分支", () => {
      if (this.canvasController.presentationActive) this.canvasController.stopPresentation();
      new CrispMindSearchModal(this.app, this).open();
    });

    this.createToolbarButton("presentation", "导图演示模式", () => {
      if (!this.requireLicense("演示模式")) return;
      if (this.canvasController.presentationActive) this.canvasController.stopPresentation();
      new CrispMindPresentationModal(this.app, this).open();
    });

    this.createToolbarButton("list-tree", "大纲侧栏", () => {
      const panel = this.outlinePanelEl;
      panel.style.display = panel.style.display === "none" ? "flex" : "none";
      if (panel.style.display !== "none") {
        this.renderOutline();
        this.outlineFilterEl?.focus();
      }
    });

    this.createToolbarButton("panel-right", "节点样式与备注", () => {
      if (!this.requireLicense("节点样式与备注")) return;
      if (this.inspectorOpen) this.closeInspector();
      else this.openInspector();
    });

    this.createToolbarDivider();

    // Extract to ANKS Topic Note
    if (!this.readOnly) this.createToolbarButton("external-link", "提取分支为同目录独立笔记", () => {
      this.extractCurrentNodeToTopic();
    });

    this.createToolbarButton("history", "快照与恢复", () => {
      if (!this.requireLicense("快照与恢复")) return;
      void this.showRecovery();
    });
    if (!this.readOnly) this.createToolbarButton("save", "保存 / 冲突处理", (e) => {
      const menu = new Menu();
      menu.addItem(i => i.setTitle("立即保存 / 重试").onClick(() => { void this.save(); }));
      menu.addItem(i => i.setTitle("另存为独立副本").onClick(() => { void this.saveCopy(); }));
      menu.showAtMouseEvent(e);
    });
    // Export Modal Trigger
    this.createToolbarButton("download", "导出思维导图 (PNG / PDF / SVG)", () => {
      if (!this.requireLicense("导出思维导图")) return;
      new CrispMindExportModal(this.app, this).open();
    });

    // Operation Help & Shortcuts Modal Trigger
    this.createToolbarButton("help-circle", "导图快捷键与操作帮助", () => {
      this.showInteractionHelp();
    });
  }

  createToolbarButton(iconName, tooltip, onClick) {
    const btn = this.toolbarEl.createEl("button", { cls: "crisp-mind-btn" });
    setIcon(btn, iconName);
    btn.setAttribute("aria-label", tooltip);
    btn.addEventListener("click", onClick);
    return btn;
  }

  createToolbarDivider() {
    this.toolbarEl.createDiv({ cls: "crisp-mind-divider" });
  }

  showNodeMenu(node, event) {
    if (this.readOnly) {
      this.showReadOnlyNodeMenu(node, event);
      return;
    }
    const c = this.canvasController;
    if (!c.selectedNodeIds.has(node.id)) {
      c.setSelectionState([node.id], node.id);
      c.render();
      this.handleSelectionChange();
    }
    const menu = new Menu();
    menu.addItem(i => i.setTitle("编辑文本").setIcon("pencil").onClick(() => c.editNodeText(c.findNode(node.id))));
    menu.addItem(i => i.setTitle("节点样式与备注").setIcon("sliders-horizontal").onClick(() => {
      this.openInspector();
    }));
    menu.addItem(i => i.setTitle("添加子主题 · Tab").setIcon("plus").onClick(() => c.addChildNode(node.id)));
    menu.addItem(i => i.setTitle("添加同级主题 · Enter").setIcon("list-plus").onClick(() => c.addSiblingNode(node.id)));
    if (node.children?.length) menu.addItem(i => i.setTitle(node.data.collapsed ? "展开分支 · F" : "折叠分支 · F").setIcon(node.data.collapsed ? "chevrons-up-down" : "chevrons-down-up").onClick(() => c.toggleCollapse(node.id)));
    const boundary = (c.docData.boundaries || []).find(item => item.nodeId === node.id);
    const summary = (c.docData.summaries || []).find(item => item.nodeId === node.id);
    menu.addItem(i => i.setTitle(boundary ? "编辑边界" : "添加边界").setIcon("box-select").onClick(() => this.promptBoundary(node, boundary)));
    menu.addItem(i => i.setTitle(summary ? "编辑概要" : "添加概要").setIcon("panel-top-dashed").onClick(() => this.promptSummary(node, summary)));
    if (c.selectedNodeIds.size === 2) menu.addItem(i => i.setTitle("为选中节点建立关系").setIcon("git-branch").onClick(() => this.promptRelation(c.selectedNodes())));
    menu.addItem(i => i.setTitle("设置 / 更换笔记链接").setIcon("link").onClick(() => this.editNodeLink(node.id)));
    const linkedNote = mindNodeLink(node.data?.text || "", this.app.vault.getName());
    if (linkedNote) {
      menu.addItem(i => i.setTitle("打开关联笔记").setIcon("file-text").onClick(() => {
        void this.openLinkedNote(linkedNote.target);
      }));
      menu.addItem(i => i.setTitle("在右侧分屏打开").setIcon("panel-right").onClick(() => {
        void this.openLinkedNote(linkedNote.target, "split");
      }));
    }
    menu.addItem(i => i.setTitle("提炼当前分支为独立笔记").setIcon("external-link").onClick(() => {
      void this.extractCurrentNodeToTopic();
    }));
    menu.addSeparator();
    menu.addItem(i => i.setTitle("复制分支 · ⌘C").setIcon("copy").onClick(() => { void c.clipboardAction("copy"); }));
    if (node.id !== c.docData.root.id) menu.addItem(i => i.setTitle("剪切分支 · ⌘X").setIcon("scissors").onClick(() => { void c.clipboardAction("cut"); }));
    menu.addItem(i => i.setTitle("粘贴为子主题 · ⌘V").setIcon("clipboard-paste").onClick(() => { void c.clipboardAction("paste"); }));
    menu.addSeparator();
    if (node.id !== c.docData.root.id) menu.addItem(i => i.setTitle("删除分支 · 可撤销").setIcon("trash-2").onClick(() => c.deleteNode(node.id)));
    menu.showAtMouseEvent(event);
  }

  // Read-only preview still offers the non-editing actions: follow links and copy the branch.
  showReadOnlyNodeMenu(node, event) {
    const c = this.canvasController;
    if (!node || !c) return;
    const menu = new Menu();
    const linkedNote = mindNodeLink(node.data?.text || "", this.app.vault.getName());
    if (linkedNote) {
      menu.addItem(i => i.setTitle("打开关联笔记").setIcon("file-text").onClick(() => {
        void this.openLinkedNote(linkedNote.target);
      }));
      menu.addItem(i => i.setTitle("在右侧分屏打开").setIcon("panel-right").onClick(() => {
        void this.openLinkedNote(linkedNote.target, "split");
      }));
    }
    if (node.children?.length) {
      menu.addItem(i => i.setTitle(c.isNodeExpanded(node) ? "折叠分支 · F" : "展开分支 · F")
        .setIcon(c.isNodeExpanded(node) ? "chevrons-down-up" : "chevrons-up-down")
        .onClick(() => c.toggleCollapse(node.id)));
    }
    menu.addItem(i => i.setTitle("复制分支 · ⌘C").setIcon("copy").onClick(() => {
      c.setSelectionState([node.id], node.id);
      void c.clipboardAction("copy");
    }));
    menu.showAtMouseEvent(event);
  }

  renderNodeIsland(node, screenCoord) {
    if (this.readOnly) return;
    this.islandEl.innerHTML = "";
    this.islandEl.style.display = "inline-flex";

    // Quick Add Child (+)
    const addChildBtn = this.islandEl.createEl("button", { cls: "crisp-mind-island-btn" });
    setIcon(addChildBtn.createSpan({ cls: "crisp-mind-action-icon" }), "plus");
    addChildBtn.createSpan({ text: "子主题" });
    addChildBtn.setAttribute("aria-label", "添加子主题 (Tab)");
    addChildBtn.addEventListener("click", () => {
      this.canvasController.addChildNode(node.id, true);
    });

    // Quick Add Sibling (Enter)
    if (node.id !== this.canvasController.docData.root.id) {
      const addSiblingBtn = this.islandEl.createEl("button", { cls: "crisp-mind-island-btn" });
      setIcon(addSiblingBtn.createSpan({ cls: "crisp-mind-action-icon" }), "corner-down-left");
      addSiblingBtn.createSpan({ text: "同级" });
      addSiblingBtn.setAttribute("aria-label", "添加同级主题 (Enter)");
      addSiblingBtn.addEventListener("click", () => {
        this.canvasController.addSiblingNode(node.id, true);
      });
    }

    // Toggle Todo [ ] / [x]
    const todoBtn = this.islandEl.createEl("button", { cls: "crisp-mind-island-btn" });
    const updateTodoButtonState = () => {
      const isDone = /^\[x\]\s/i.test(node.data.text);
      todoBtn.innerHTML = "";
      setIcon(todoBtn.createSpan({ cls: "crisp-mind-action-icon" }), isDone ? "square-check" : "square");
      todoBtn.createSpan({ text: isDone ? "已完成" : "待办" });
      todoBtn.setAttribute("aria-pressed", String(isDone));
      todoBtn.setAttribute("aria-label", isDone ? "标记为未完成" : "标记为已完成");
    };
    updateTodoButtonState();
    todoBtn.addEventListener("click", () => {
      // Resolve the live node (undo replaces node objects) and record one history step.
      const controller = this.canvasController;
      controller.transact(() => {
        const current = controller.findNode(node.id);
        if (!current) return false;
        const text = current.data.text;
        if (/^\[x\]\s*/i.test(text)) current.data.text = text.replace(/^\[x\]\s*/i, "[ ] ");
        else if (/^\[ \]\s*/.test(text)) current.data.text = text.replace(/^\[ \]\s*/, "[x] ");
        else current.data.text = `[ ] ${text}`;
      });
    });

    // Add Wikilink [[
    const linkBtn = this.islandEl.createEl("button", { cls: "crisp-mind-island-btn" });
    setIcon(linkBtn.createSpan({ cls: "crisp-mind-action-icon" }), "link");
    const link = mindNodeLink(node.data.text, this.app.vault.getName());
    linkBtn.createSpan({ text: link ? "打开笔记" : "链接" });
    linkBtn.setAttribute("aria-label", link ? `打开 ${link.target}` : "链接到笔记：搜索或粘贴 Obsidian 地址");
    linkBtn.addEventListener("click", () => {
      if (link) this.canvasController.options.onOpenLink(link.target);
      else this.editNodeLink(node.id);
    });

    // Quick Edit
    const editBtn = this.islandEl.createEl("button", { cls: "crisp-mind-island-btn" });
    setIcon(editBtn.createSpan({ cls: "crisp-mind-action-icon" }), "pencil");
    editBtn.createSpan({ text: "编辑" });
    editBtn.setAttribute("aria-label", "编辑文本 (Space)");
    editBtn.addEventListener("click", () => {
      this.canvasController.editNodeText(node);
    });

    const moreBtn = this.islandEl.createEl("button", { cls: "crisp-mind-island-btn", text: "更多" });
    moreBtn.setAttribute("aria-label", "分支操作：折叠、复制、粘贴、删除");
    moreBtn.addEventListener("click", e => this.showNodeMenu(this.canvasController.findNode(node.id), e));

    // Measure after labels are mounted; keep the entire toolbar inside its pane.
    const width = this.islandEl.offsetWidth || 340;
    const height = this.islandEl.offsetHeight || 36;
    const paneWidth = this.viewContainer.clientWidth;
    const paneHeight = this.viewContainer.clientHeight;
    let top = screenCoord.y - height - 10;
    if (top < 8) {
      top = screenCoord.y + ((node._h || 40) * this.canvasController.scale) + 10;
    }
    this.islandEl.style.left = `${Math.max(8, Math.min(paneWidth - width - 8, screenCoord.x - width / 2))}px`;
    this.islandEl.style.top = `${Math.max(8, Math.min(paneHeight - height - 8, top))}px`;
  }

  async openLinkedNote(target, pane = "tab") {
    try {
      const hash = target.indexOf("#");
      const path = hash < 0 ? target : target.slice(0, hash);
      const file = this.app.metadataCache.getFirstLinkpathDest(path, this.file?.path || "");
      if (!file) { new Notice("找不到链接的笔记，请检查路径或重新设置链接"); return; }
      const leaf = pane === "split"
        ? this.app.workspace.getLeaf("split", "vertical")
        : this.app.workspace.getLeaf("tab");
      await leaf.openFile(file, {active: true, eState: hash < 0 ? {} : {subpath: target.slice(hash)}});
      await this.app.workspace.revealLeaf(leaf);
    } catch (error) { new Notice(`无法打开笔记：${error.message}`); }
  }

  editNodeLink(id) {
    const c = this.canvasController, sourceFile = this.file;
    const originalText = c?.findNode(id)?.data.text;
    if (!c || c.destroyed || c.options.readOnly || originalText == null) return;
    this.promptWikilink(link => {
      if (this.canvasController !== c || this.file !== sourceFile || c.destroyed ||
          c.findNode(id)?.data.text !== originalText || c.options.readOnly || c.editor) {
        new Notice("导图或节点状态已变化，请重新添加链接");
        return;
      }
      c.transact(() => {
        const node = c.findNode(id); if (!node) return false;
        const previous = normalizeMindLinkText(node.data.text, this.app.vault.getName());
        node.data.text = /\[\[[^\]]+\]\]/.test(previous) ? previous.replace(/\[\[[^\]]+\]\]/, () => link) : `${previous} ${link}`;
      });
    });
  }

  promptWikilink(callback) {
    const modal = new Modal(this.app);
    modal.titleEl.setText("链接到笔记");
    modal.contentEl.createEl("p", {text:"选择当前仓库的笔记，或粘贴 obsidian://open 地址。添加后，点击节点下划线文字即可在新标签页打开。"});
    let value = "";
    new Setting(modal.contentEl).setName("笔记路径或 Obsidian 地址").addText(text => {
      text.setPlaceholder("obsidian://open?vault=…&file=…").onChange(input => value = input);
      text.inputEl.style.width = "100%";
    });
    const errorEl = modal.contentEl.createDiv({cls:"crisp-mind-link-error"}); errorEl.setAttribute("role", "alert");
    const apply = () => {
      try {
        let link = normalizeMindLinkText(value.trim(), this.app.vault.getName());
        if (!link) throw Error("请先输入地址或选择笔记");
        const target = mindNodeLink(link)?.target || link;
        const file = this.app.metadataCache.getFirstLinkpathDest(target.split("#")[0], this.file?.path || "");
        if (!file) throw Error("当前仓库找不到该笔记，请检查路径");
        if (!mindNodeLink(link)) link = `[[${target.replace(/\.md$/i, "")}|${file.basename}]]`;
        callback(link); modal.close();
      } catch (error) { errorEl.textContent = error.message; }
    };
    new Setting(modal.contentEl)
      .addButton(button => button.setButtonText("搜索笔记").onClick(() => {
        const owner = this;
        const picker = new (class extends FuzzySuggestModal {
          getItems() { return owner.app.vault.getMarkdownFiles(); }
          getItemText(file) { return file.path; }
          onChooseItem(file) { callback(`[[${file.path.replace(/\.md$/i, "")}|${file.basename}]]`); modal.close(); }
        })(this.app);
        picker.setPlaceholder("搜索笔记名称或路径"); picker.open();
      }))
      .addButton(button => button.setButtonText("添加链接").setCta().onClick(apply));
    modal.open();
  }

  async extractCurrentNodeToTopic() {
    const controller = this.canvasController, sourceFile = this.file;
    if (!controller || controller.destroyed || controller.options.readOnly || this.readOnly || !sourceFile) return;
    controller.commitEditor?.();
    const selectedId = controller.selectedNodeId;
    if (!selectedId) {
      new Notice("请先选中要提炼的分支节点");
      return;
    }
    const node = controller.findNode(selectedId);
    if (!node) return;
    const snapshot = JSON.stringify(cleanMindData(node));

    const { title, content } = extractNodeToTopicContent(node);
    const folder = sourceFile.parent?.path || "";
    const safeTitle = title.replace(/[\\/:*?"<>|#^\[\]\r\n]/g, " ").trim().slice(0, 120) || "未命名主题";
    const prefix = folder && folder !== "/" ? `${folder}/` : "";
    let targetPath = `${prefix}${safeTitle}.md`, suffix = 2;
    while (this.app.vault.getAbstractFileByPath(targetPath)) targetPath = `${prefix}${safeTitle} ${suffix++}.md`;

    try {
      const file = await this.app.vault.create(targetPath, content);
      // Undo replaces node objects; resolve the current node only after I/O finishes.
      const current = controller.findNode(selectedId);
      if (this.canvasController !== controller || this.file !== sourceFile || controller.destroyed ||
          this.readOnly || controller.options.readOnly || controller.editor || !current ||
          JSON.stringify(cleanMindData(current)) !== snapshot) {
        new Notice(`笔记已创建：${targetPath}；原导图或节点状态已变化，未替换节点`, 8000);
        return;
      }
      controller.transact(() => {
        current.data.text = this.app.fileManager.generateMarkdownLink(file, sourceFile.path);
      });
      new Notice(`已成功提炼并沉淀为笔记：${targetPath}`);
    } catch (e) {
      new Notice(`提炼失败：${e.message}`);
    }
  }

  notifyPulseContribution() {
    if (!this.plugin.settings.enablePulseSync) return;
    try {
      const pulse = this.app.plugins?.plugins?.["crisp-pulse"];
      if (pulse && typeof pulse.trackActivity === "function") {
        pulse.trackActivity({ type: "mindmap", file: this.file?.path });
      }
    } catch (e) {}
  }
}

/* ==========================================================================
   Crisp Mind Exporter Subsystem (Zero-Dependency Retina PNG, PDF & SVG)
   ========================================================================== */

function exportBackgroundColor(theme) {
  const background = theme?.backgroundColor;
  if (background && background !== "transparent") return background;
  return theme?.solidBackground || theme?.nodeBackground || "#ffffff";
}

class CrispMindExporter {
  constructor(view) {
    this.view = view;
    this.controller = view?.canvasController;
  }

  getBoundingBox(padding = 40) {
    const root = this.controller?.layoutRoot?.() || this.controller?.docData?.root;
    if (!root) return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 880, height: 680, viewBox: "-40 -40 880 680", padding };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const walk = (node) => {
      if (!node) return;
      if (node._x != null && node._y != null) {
        minX = Math.min(minX, node._x);
        minY = Math.min(minY, node._y);
        maxX = Math.max(maxX, node._x + (node._w || 120));
        maxY = Math.max(maxY, node._y + (node._h || 40));
      }
      if ((this.controller?.isNodeExpanded?.(node) ?? !node.data?.collapsed) && node.children) {
        node.children.forEach(walk);
      }
    };
    walk(root);

    if (this.controller?.layout === "timeline" && this.controller._timelineAxis) {
      minX = Math.min(minX, this.controller._timelineAxis.startX);
      maxX = Math.max(maxX, this.controller._timelineAxis.endX);
      minY = Math.min(minY, this.controller._timelineAxis.y - 20);
      maxY = Math.max(maxY, this.controller._timelineAxis.y + 20);
    } else if (this.controller?.layout === "fishbone" && this.controller._fishboneAxis) {
      minX = Math.min(minX, this.controller._fishboneAxis.startX);
      maxX = Math.max(maxX, this.controller._fishboneAxis.endX);
      minY = Math.min(minY, this.controller._fishboneAxis.y - 20);
      maxY = Math.max(maxY, this.controller._fishboneAxis.y + 20);
    }

    for (const group of [
      this.controller?.boundaryGroup,
      this.controller?.relationsGroup,
      this.controller?.annotationsGroup
    ]) {
      if (typeof group?.getBBox !== "function") continue;
      try {
        const box = group.getBBox();
        if (Number.isFinite(box.x) && box.width > 0 && box.height > 0) {
          minX = Math.min(minX, box.x);
          minY = Math.min(minY, box.y);
          maxX = Math.max(maxX, box.x + box.width);
          maxY = Math.max(maxY, box.y + box.height);
        }
      } catch (_) {}
    }

    if (!isFinite(minX)) {
      minX = 0; minY = 0; maxX = 800; maxY = 600;
    }

    const width = Math.ceil(maxX - minX + padding * 2);
    const height = Math.ceil(maxY - minY + padding * 2);
    const viewBox = `${Math.floor(minX - padding)} ${Math.floor(minY - padding)} ${width} ${height}`;
    return { minX, minY, maxX, maxY, width, height, viewBox, padding };
  }

  // Export what the map looks like, not the current interaction state: selection outlines
  // are removed for the capture and restored afterwards.
  withCleanRender(capture) {
    const c = this.controller;
    if (!c || typeof c.render !== "function" || !c.selectedNodeIds?.size) return capture();
    const ids = [...c.selectedNodeIds], primary = c.selectedNodeId, anchor = c.selectionAnchorId;
    c.selectedNodeIds = new Set();
    c.selectedNodeId = null;
    try {
      c.render();
      return capture();
    } finally {
      c.selectedNodeIds = new Set(ids);
      c.selectedNodeId = primary;
      c.selectionAnchorId = anchor;
      c.render();
    }
  }

  // Node labels use var(--font-interface), which does not exist inside a standalone SVG and
  // would fall back to the default serif face. Bake in the stack the canvas was measured with.
  resolveInterfaceFont() {
    let stack = "";
    try {
      const doc = this.controller?.document || (typeof document !== "undefined" ? document : null);
      const win = doc?.defaultView || (typeof window !== "undefined" ? window : null);
      stack = win?.getComputedStyle?.(doc.body)?.getPropertyValue?.("--font-interface")?.trim() || "";
    } catch (_) {}
    return (stack || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif').replace(/"/g, "'");
  }

  toSvg({ padding = 40, transparent = false } = {}) {
    return this.withCleanRender(() => this.buildSvg({ padding, transparent }));
  }

  buildSvg({ padding = 40, transparent = false } = {}) {
    const bbox = this.getBoundingBox(padding);
    const theme = this.controller?.theme || {};
    const font = this.resolveInterfaceFont();
    const bakeFont = html => html.replace(/var\(--font-interface\)/g, font);

    const boundariesHtml = this.controller?.boundaryGroup?.innerHTML || "";
    const linesHtml = this.controller?.linesGroup?.innerHTML || "";
    const relationsHtml = this.controller?.relationsGroup?.innerHTML || "";
    const nodesHtml = bakeFont(this.controller?.nodesGroup?.innerHTML || "");
    const annotationsHtml = this.controller?.annotationsGroup?.innerHTML || "";

    const patternDefs = !transparent && theme.paperPattern
      ? `<pattern id="crisp-paper-grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1.25" cy="1.25" r="0.85" fill="${theme.patternColor || 'rgba(0,0,0,0.08)'}" /></pattern>`
      : "";
    const bgRect = transparent
      ? ""
      : `<rect x="${bbox.minX - bbox.padding}" y="${bbox.minY - bbox.padding}" width="${bbox.width}" height="${bbox.height}" fill="${exportBackgroundColor(theme)}" />`
        + (patternDefs
          ? `<rect x="${bbox.minX - bbox.padding}" y="${bbox.minY - bbox.padding}" width="${bbox.width}" height="${bbox.height}" fill="url(#crisp-paper-grid)" />`
          : "");

    const svgString = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bbox.viewBox}" width="${bbox.width}" height="${bbox.height}">
  <defs>
    ${patternDefs}
    <style>
      text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
      .crisp-mind-node-label { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
      .is-task-completed { opacity: 0.55; }
    </style>
  </defs>
  ${bgRect}
  <g class="crisp-mind-export-boundaries">${boundariesHtml}</g>
  <g class="crisp-mind-export-lines">${linesHtml}</g>
  <g class="crisp-mind-export-relations">${relationsHtml}</g>
  <g class="crisp-mind-export-nodes">${nodesHtml}</g>
  <g class="crisp-mind-export-annotations">${annotationsHtml}</g>
</svg>`;

    return {
      svgString,
      width: bbox.width,
      height: bbox.height,
      bbox
    };
  }

  async toPng({ scale = 2, transparent = false, padding = 40 } = {}) {
    const { svgString, width, height } = this.toSvg({ padding, transparent });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");

    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    await new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve();
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(new Error("SVG 渲染失败：" + err));
      };
      img.src = url;
    });

    const dataUrl = canvas.toDataURL("image/png");
    const arrayBuffer = await (await fetch(dataUrl)).arrayBuffer();
    return { dataUrl, arrayBuffer, width: canvas.width, height: canvas.height };
  }

  async toPdf({ padding = 40 } = {}) {
    const { svgString, width, height } = this.toSvg({ padding, transparent: false });
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = exportBackgroundColor(this.controller?.theme || {});
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    await new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve();
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("SVG 转 PDF 栅格化失败"));
      };
      img.src = url;
    });

    const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.95);
    const base64Data = jpegDataUrl.replace(/^data:image\/jpeg;base64,/, "");
    const binaryJpeg = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    const ptWidth = Math.round(width * 0.75);
    const ptHeight = Math.round(height * 0.75);
    const arrayBuffer = CrispMindExporter.buildPdfBinary(binaryJpeg, canvas.width, canvas.height, ptWidth, ptHeight);
    return { arrayBuffer, ptWidth, ptHeight };
  }

  static buildPdfBinary(jpegBytes, imgPixelW, imgPixelH, ptWidth, ptHeight) {
    const Encoder = typeof TextEncoder !== "undefined" ? TextEncoder : (typeof globalThis !== "undefined" && globalThis.TextEncoder ? globalThis.TextEncoder : require("util").TextEncoder);
    const encoder = new Encoder();
    const chunks = [];
    const offsets = [];
    let currentOffset = 0;

    function writeStr(str) {
      const bytes = encoder.encode(str);
      chunks.push(bytes);
      currentOffset += bytes.length;
    }

    function writeBytes(bytes) {
      chunks.push(bytes);
      currentOffset += bytes.length;
    }

    writeStr("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

    offsets.push(currentOffset);
    writeStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

    offsets.push(currentOffset);
    writeStr("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

    offsets.push(currentOffset);
    writeStr(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptWidth} ${ptHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`);

    offsets.push(currentOffset);
    writeStr(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgPixelW} /Height ${imgPixelH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
    writeBytes(jpegBytes);
    writeStr("\nendstream\nendobj\n");

    offsets.push(currentOffset);
    const content = `q\n${ptWidth} 0 0 ${ptHeight} 0 0 cm\n/Im0 Do\nQ\n`;
    writeStr(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);

    const xrefOffset = currentOffset;
    writeStr(`xref\n0 6\n0000000000 65535 f \n`);
    for (const off of offsets) {
      writeStr(String(off).padStart(10, "0") + " 00000 n \n");
    }

    writeStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const out = new Uint8Array(totalLen);
    let pos = 0;
    for (const chunk of chunks) {
      out.set(chunk, pos);
      pos += chunk.length;
    }
    return out.buffer;
  }
}

// Next free "<folder>/<name>.<ext>" path. A root-level map has parent path "/", which must
// not produce "//name.ext".
async function exportTargetPath(vault, parentPath, baseName, extension) {
  const prefix = parentPath && parentPath !== "/" ? `${parentPath.replace(/\/+$/, "")}/` : "";
  const taken = async path => !!vault.getAbstractFileByPath?.(path) || !!(await vault.adapter?.exists?.(path));
  let path = `${prefix}${baseName}.${extension}`, index = 2;
  while (await taken(path)) path = `${prefix}${baseName} ${index++}.${extension}`;
  return path;
}

class CrispMindExportModal extends Modal {
  constructor(app, view) {
    super(app);
    this.view = view;
    this.exporter = new CrispMindExporter(view);
    this.selectedFormat = "png"; // png | pdf | svg
    this.scale = 2;              // 1 | 2 | 3
    this.transparent = false;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.classList.add("crisp-mind-export-modal");

    contentEl.createEl("h3", { text: "导出思维导图", cls: "crisp-mind-modal__title" });
    contentEl.createEl("p", { cls: "crisp-mind-modal__desc", text: "选择导出格式与质量，直接保存到笔记库目录或下载到本地。" });

    const formatSetting = new Setting(contentEl)
      .setName("导出格式")
      .setDesc("PNG 与 PDF 为高清位图（PDF 内嵌 2x 栅格图，非矢量），SVG 为可无损缩放的矢量图形。")
      .addDropdown(dd => {
        dd.addOption("png", "PNG 高清图片 (位图)")
          .addOption("pdf", "PDF 文档 (2x 栅格，打印/分享)")
          .addOption("svg", "SVG 矢量图形 (无损/设计)")
          .setValue(this.selectedFormat)
          .onChange(val => {
            this.selectedFormat = val;
            scaleSetting.settingEl.style.display = val === "png" ? "flex" : "none";
            transSetting.settingEl.style.display = val === "png" || val === "svg" ? "flex" : "none";
          });
      });

    const scaleSetting = new Setting(contentEl)
      .setName("渲染分辨率")
      .setDesc("输出图片的分辨率倍率。推荐 2x 兼顾锐利清晰与文件体积。")
      .addDropdown(dd => {
        dd.addOption("1", "1x (标清)")
          .addOption("2", "2x (高清 Retina 推荐)")
          .addOption("3", "3x (超清印刷级)")
          .setValue(String(this.scale))
          .onChange(val => { this.scale = Number(val); });
      });

    const transSetting = new Setting(contentEl)
      .setName("透明背景")
      .setDesc("导出为无背景透明图，便于贴入 Keynote、Notion 或公众号小红书排版。")
      .addToggle(toggle => {
        toggle.setValue(this.transparent).onChange(val => { this.transparent = val; });
      });

    const btnContainer = contentEl.createDiv({ cls: "crisp-mind-modal__actions" });

    const saveVaultBtn = btnContainer.createEl("button", { cls: "mod-cta", text: "保存至笔记库目录" });
    saveVaultBtn.addEventListener("click", async () => {
      saveVaultBtn.disabled = true;
      saveVaultBtn.textContent = "正在生成…";
      try {
        await this.handleExport("vault");
        this.close();
      } catch (err) {
        new Notice("导出失败：" + err.message);
        saveVaultBtn.disabled = false;
        saveVaultBtn.textContent = "保存至笔记库目录";
      }
    });

    const downloadBtn = btnContainer.createEl("button", { text: "直接下载到本地" });
    downloadBtn.addEventListener("click", async () => {
      downloadBtn.disabled = true;
      downloadBtn.textContent = "正在生成…";
      try {
        await this.handleExport("download");
        this.close();
      } catch (err) {
        new Notice("导出失败：" + err.message);
        downloadBtn.disabled = false;
        downloadBtn.textContent = "直接下载到本地";
      }
    });
  }

  async handleExport(destination) {
    const format = this.selectedFormat;
    // "Map.mind.md" has basename "Map.mind"; export as "Map.png", not "Map.mind.png".
    const baseName = (this.view.file ? this.view.file.basename : "crisp-mindmap").replace(/\.mind$/i, "") || "crisp-mindmap";
    const fileName = `${baseName}.${format}`;
    let dataBuffer;
    let mimeType = "application/octet-stream";

    if (format === "png") {
      mimeType = "image/png";
      const res = await this.exporter.toPng({ scale: this.scale, transparent: this.transparent });
      dataBuffer = res.arrayBuffer;
    } else if (format === "pdf") {
      mimeType = "application/pdf";
      const res = await this.exporter.toPdf();
      dataBuffer = res.arrayBuffer;
    } else if (format === "svg") {
      mimeType = "image/svg+xml";
      const res = this.exporter.toSvg({ transparent: this.transparent });
      dataBuffer = new TextEncoder().encode(res.svgString).buffer;
    }

    if (destination === "vault") {
      const targetPath = await exportTargetPath(this.app.vault, this.view.file?.parent?.path || "", baseName, format);
      const ab = dataBuffer instanceof ArrayBuffer ? dataBuffer : dataBuffer.buffer;
      // Never overwrite: an existing image with the same name gets a numbered sibling instead.
      if (typeof this.app.vault.createBinary === "function") await this.app.vault.createBinary(targetPath, ab);
      else await this.app.vault.adapter.writeBinary(targetPath, ab);
      new Notice(`导图已成功导出至：${targetPath}`);
    } else {
      const blob = new Blob([dataBuffer], { type: mimeType });
      const a = document.createElement("a");
      const href = URL.createObjectURL(blob);
      a.href = href;
      a.download = fileName;
      a.click();
      // Revoking synchronously can cancel the download before the browser has read the blob.
      window.setTimeout(() => URL.revokeObjectURL(href), 60000);
      new Notice(`已开始下载：${fileName}`);
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

/* ==========================================================================
   Search, Branch Focus & Presentation UI
   ========================================================================== */

class CrispMindPromptModal extends Modal {
  constructor(app, options = {}) {
    super(app);
    this.options = options;
    this.inputEl = null;
  }

  onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("crisp-mind-prompt-modal");
    this.contentEl.createEl("h3", { text: this.options.title || "输入内容", cls: "crisp-mind-modal__title" });
    this.inputEl = this.contentEl.createEl("input", {
      cls: "crisp-mind-prompt-input",
      attr: { type: "text", placeholder: this.options.placeholder || "", "aria-label": this.options.title || "输入内容" }
    });
    this.inputEl.value = this.options.value || "";
    const actions = this.contentEl.createDiv({ cls: "crisp-mind-modal__actions" });
    const cancel = actions.createEl("button", { text: "取消" });
    cancel.addEventListener("click", () => this.close());
    const confirm = actions.createEl("button", { cls: "mod-cta", text: "确定" });
    confirm.addEventListener("click", () => {
      const value = this.inputEl.value.trim();
      this.close();
      this.options.onSubmit?.(value);
    });
    this.inputEl.addEventListener("keydown", event => {
      // Enter that confirms an IME candidate must not submit the dialog.
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === "Enter") {
        event.preventDefault();
        confirm.click();
      }
    });
    window.setTimeout(() => {
      this.inputEl?.focus();
      this.inputEl?.select();
    }, 0);
  }

  onClose() {
    this.contentEl.empty();
  }
}

class CrispMindSearchModal extends Modal {
  constructor(app, view) {
    super(app);
    this.view = view;
    this.inputEl = null;
    this.resultsEl = null;
    this.statusEl = null;
  }

  onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("crisp-mind-search-modal");
    this.contentEl.createEl("h3", { text: "搜索节点", cls: "crisp-mind-modal__title" });
    this.contentEl.createEl("p", {
      cls: "crisp-mind-modal__desc",
      text: "查找节点并聚焦所在分支。聚焦只改变当前视图，不修改原来的折叠结构。"
    });

    this.inputEl = this.contentEl.createEl("input", {
      cls: "crisp-mind-search-input",
      attr: { type: "search", placeholder: "输入节点文字…", "aria-label": "搜索节点文字" }
    });
    this.statusEl = this.contentEl.createDiv({ cls: "crisp-mind-search-status" });
    this.resultsEl = this.contentEl.createDiv({ cls: "crisp-mind-search-results" });

    this.inputEl.addEventListener("input", () => this.updateResults());
    this.inputEl.addEventListener("keydown", (event) => {
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === "Enter") {
        const first = this.resultsEl.querySelector(".crisp-mind-search-result");
        if (first) {
          event.preventDefault();
          first.click();
        }
      }
    });
    this.updateResults();
    window.setTimeout(() => this.inputEl?.focus(), 0);
  }

  updateResults() {
    const query = this.inputEl?.value || "";
    const controller = this.view.canvasController;
    const results = searchMindNodes(controller.docData.root, query, controller.options.vaultName);
    this.resultsEl.empty();

    if (!query.trim()) {
      this.statusEl.textContent = "输入关键词后显示匹配节点与所属路径。";
      return;
    }
    this.statusEl.textContent = results.length ? `找到 ${results.length} 个节点` : "没有找到匹配节点";
    if (!results.length) return;

    for (const result of results) {
      const button = this.resultsEl.createEl("button", {
        cls: "crisp-mind-search-result",
        attr: { type: "button", "aria-label": `聚焦 ${result.text}` }
      });
      button.createDiv({ cls: "crisp-mind-search-result__text", text: result.text });
      button.createDiv({
        cls: "crisp-mind-search-result__path",
        text: result.path.slice(0, -1).join("  /  ") || "中心主题"
      });
      button.addEventListener("click", () => {
        this.close();
        controller.setBranchFocus(result.id);
      });
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

class CrispMindPresentationModal extends Modal {
  constructor(app, view) {
    super(app);
    this.view = view;
    this.steps = [];
    this.listEl = null;
  }

  onOpen() {
    this.steps = this.view.canvasController.getPresentationSteps();
    this.contentEl.addClass("crisp-mind-presentation-modal");
    this.render();
  }

  commit() {
    this.view.canvasController.setPresentationSteps(this.steps);
    this.steps = this.view.canvasController.getPresentationSteps();
  }

  render() {
    this.contentEl.empty();
    this.contentEl.createEl("h3", { text: "导图演示", cls: "crisp-mind-modal__title" });
    this.contentEl.createEl("p", {
      cls: "crisp-mind-modal__desc",
      text: "选择节点并安排讲解顺序。每一步的备注只在这里显示，播放时不会出现在画布上。"
    });

    const addRow = this.contentEl.createDiv({ cls: "crisp-mind-presentation-toolbar" });
    const addButton = addRow.createEl("button", { cls: "mod-cta", text: "添加当前节点" });
    addButton.disabled = this.view.readOnly || !this.view.canvasController.selectedNodeId;
    addButton.addEventListener("click", () => {
      const controller = this.view.canvasController;
      const nodeId = controller.selectedNodeId || controller.docData.root.id;
      if (!controller.findNode(nodeId)) return;
      this.steps.push({ nodeId, note: "" });
      this.commit();
      this.render();
    });

    const playButton = addRow.createEl("button", { text: "播放演示" });
    playButton.disabled = this.steps.length === 0;
    playButton.addEventListener("click", () => {
      this.commit();
      this.close();
      if (!this.view.canvasController.startPresentation()) {
        new Notice("请先添加至少一个演示节点");
      }
    });

    this.listEl = this.contentEl.createDiv({ cls: "crisp-mind-presentation-list" });
    if (!this.steps.length) {
      this.listEl.createDiv({
        cls: "crisp-mind-presentation-empty",
        text: "先在画布上选中节点，再添加为演示步骤。"
      });
      return;
    }

    this.steps.forEach((step, index) => {
      const node = this.view.canvasController.findNode(step.nodeId);
      if (!node) return;
      const row = this.listEl.createDiv({ cls: "crisp-mind-presentation-step" });
      const order = row.createDiv({ cls: "crisp-mind-presentation-order", text: String(index + 1).padStart(2, "0") });
      const body = row.createDiv({ cls: "crisp-mind-presentation-body" });
      body.createDiv({
        cls: "crisp-mind-presentation-node",
        text: mindNodeLink(node.data?.text || "", this.view.canvasController.options.vaultName)?.display || node.data?.text || "Topic"
      });
      const note = body.createEl("textarea", {
        cls: "crisp-mind-presentation-note",
        attr: { placeholder: "讲解备注（仅编排界面可见）", "aria-label": `第 ${index + 1} 步备注` }
      });
      note.value = step.note || "";
      note.addEventListener("change", () => {
        this.steps[index].note = note.value.slice(0, 5000);
        this.commit();
      });

      const controls = row.createDiv({ cls: "crisp-mind-presentation-controls" });
      const move = (offset, icon, label, disabled) => {
        const button = controls.createEl("button", { cls: "crisp-mind-presentation-control", attr: { "aria-label": label, title: label } });
        setIcon(button, icon);
        button.disabled = disabled;
        button.addEventListener("click", () => {
          const next = index + offset;
          if (next < 0 || next >= this.steps.length) return;
          [this.steps[index], this.steps[next]] = [this.steps[next], this.steps[index]];
          this.commit();
          this.render();
        });
      };
      move(-1, "arrow-up", "上移", index === 0);
      move(1, "arrow-down", "下移", index === this.steps.length - 1);
      const remove = controls.createEl("button", { cls: "crisp-mind-presentation-control is-danger", attr: { "aria-label": "移除步骤", title: "移除步骤" } });
      setIcon(remove, "x");
      remove.addEventListener("click", () => {
        this.steps.splice(index, 1);
        this.commit();
        this.render();
      });
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

/* ==========================================================================
   Crisp Mind Plugin Main
   ========================================================================== */

class CrispMindPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.licenseManager = new CrispMindLicenseManager(this.app, this.settings);

    if (!this.settings.licenseCode) {
      const vaultLicense = await discoverVaultCrispLicense(this.app);
      if (vaultLicense) {
        this.settings.licenseCode = vaultLicense;
        await this.saveSettings();
        console.log("Crisp Mind: 已继承库内可用的 Crisp 授权");
      } else if (lastInheritNote) {
        console.warn("Crisp Mind: " + lastInheritNote);
      }
    }

    if (this.settings.licenseCode) {
      void this.licenseManager.validateCurrentLicense().then(() => this.refreshLicenseViews());
    }

    try {
      addIcon(CRISP_MIND_ICON_ID, CRISP_MIND_SVG);
      addIcon("crisp-mind-logo", CRISP_MIND_SVG);
    } catch (e) {
      console.warn("[Crisp Mind] 无法注册自定义图标:", e);
    }

    this.registerView(VIEW_TYPE_CRISP_MIND, (leaf) => new CrispMindEditView(leaf, this));

    try {
      this.registerExtensions(["mind"], VIEW_TYPE_CRISP_MIND);
    } catch (e) {}

    this.addRibbonIcon(CRISP_MIND_ICON_ID, "新建 Crisp Mind 思维导图", () => {
      this.createNewMindMap();
    });

    this.addCommand({
      id: "create-crisp-mind",
      name: "新建思维导图 (Create Crisp Mind)",
      callback: () => this.createNewMindMap()
    });

    this.addCommand({
      id: "open-as-crisp-mind",
      name: "以思维导图视图打开当前大纲笔记",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === "md") {
          if (!checking) {
            this.openActiveFileAsMindMap(file);
          }
          return true;
        }
        return false;
      }
    });

    this.registerEvent(
      this.app.workspace.on("css-change", () => {
        this.app.workspace.getLeavesOfType(VIEW_TYPE_CRISP_MIND).forEach((leaf) => {
          if (leaf.view?.canvasController) {
            leaf.view.canvasController.theme = getComputedThemeConfig(leaf.view.canvasController.docData.theme || "crisp-obsidian");
            leaf.view.canvasController.render();
          }
        });
      })
    );

    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (!file || !file.path?.endsWith(".mind.md")) return;
        const leaves = this.app.workspace.getLeavesOfType("markdown");
        for (const leaf of leaves) {
          if (leaf.view?.file?.path === file.path) {
            leaf.setViewState({
              type: VIEW_TYPE_CRISP_MIND,
              state: { file: file.path }
            });
            break;
          }
        }
      })
    );

    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      if (file instanceof TFile && ["md", "mind"].includes(file.extension)) {
        menu.addItem(item => item.setTitle("用 Crisp Mind 打开").setIcon(CRISP_MIND_ICON_ID).onClick(() => this.openActiveFileAsMindMap(file)));
      }
    }));
    this.addSettingTab(new CrispMindSettingTab(this.app, this));
  }

  isLicensed() {
    return !!this.licenseManager?.isLicensed?.();
  }

  openLicenseSettings() {
    const setting = this.app.setting;
    setting?.open?.();
    setting?.openTabById?.(this.manifest.id);
  }

  requireLicense(feature = "此功能") {
    if (this.isLicensed()) return true;
    new Notice(`🔒 ${feature}需要激活 Crisp Mind，已为你打开授权设置。`);
    this.openLicenseSettings();
    return false;
  }

  refreshLicenseViews() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_CRISP_MIND).forEach(leaf => {
      leaf.view?.refreshLicenseAccess?.();
    });
  }

  async createNewMindMap(folderPath = "") {
    if (!this.requireLicense("新建思维导图")) return;
    const fileName = `未命名思维导图 ${new Date().toISOString().slice(0, 10)}.mind.md`;
    const basePath = folderPath ? `${folderPath}/${fileName}` : fileName;
    let fullPath = basePath, suffix = 2;
    while (this.app.vault.getAbstractFileByPath(fullPath)) fullPath = basePath.replace(/\.mind\.md$/, ` ${suffix++}.mind.md`);

    const defaultRoot = {
      id: generateUid(),
      data: { text: "中心主题" },
      children: [
        { id: generateUid(), data: { text: "主要分支 1" }, children: [] },
        { id: generateUid(), data: { text: "主要分支 2" }, children: [] }
      ]
    };

    const initialDoc = {
      title: "中心主题",
      frontmatter: "crisp-mind: true\n",
      data: {
        version: "1.1",
        layout: this.settings.defaultLayout,
        theme: this.settings.defaultTheme,
        root: defaultRoot
      }
    };

    const content = assembleMindMarkdown(initialDoc);
    const newFile = await this.app.vault.create(fullPath, content);
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE_CRISP_MIND, state: {file: newFile.path} });
    await this.app.workspace.revealLeaf(leaf);
    leaf.view.canvasController?.resetZoom();
  }

  async openActiveFileAsMindMap(file) {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CRISP_MIND).find(leaf => leaf.view.file?.path === file.path);
    if (existing) { await this.app.workspace.revealLeaf(existing); return; }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({
      type: VIEW_TYPE_CRISP_MIND,
      state: { file: file.path }
    });
    await this.app.workspace.revealLeaf(leaf);
    leaf.view.canvasController?.resetZoom();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

/* ==========================================================================
   Setting Tab & Attribution Notice
   ========================================================================== */

function renderAboutCard(container, pluginName, description, version = "1.2.0") {
  const doc = container.ownerDocument || (typeof window !== "undefined" ? window.document : null);
  if (!doc) return;
  const card = doc.createElement("section");
  card.className = "crisp-mind-about";

  const title = doc.createElement("h3");
  title.className = "crisp-mind-about__title";
  title.textContent = `关于 ${pluginName}`;

  const copy = doc.createElement("p");
  copy.className = "crisp-mind-about__description";
  copy.textContent = description;

  const meta = doc.createElement("div");
  meta.className = "crisp-mind-about__meta";

  const byline = doc.createElement("span");
  byline.className = "crisp-mind-about__author";
  const label = doc.createElement("span");
  label.textContent = "作者：";
  const author = doc.createElement("a");
  author.className = "crisp-mind-about__author-link";
  author.textContent = "小红书 letschips";
  author.href = "https://xhslink.cn/m/3MwtKu4822b";
  author.target = "_blank";
  author.rel = "noopener noreferrer";
  byline.append(label, author);

  const ver = doc.createElement("span");
  ver.className = "crisp-mind-about__version";
  ver.textContent = `版本：v${version}`;

  meta.append(byline, ver);
  card.append(title, copy, meta);
  container.append(card);
}

class CrispMindSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.licenseDraft = plugin.settings?.licenseCode || "";
    this.isCheckingLicense = false;
  }

  display() {
    const { containerEl } = this;
    containerEl.innerHTML = "";

    const headerEl = containerEl.createDiv({ cls: "crisp-mind-settings-header" });
    const logoEl = headerEl.createDiv({ cls: "crisp-mind-settings-logo" });
    logoEl.innerHTML = CRISP_MIND_SVG;
    headerEl.createEl("h2", { text: "Crisp Mind" });
    containerEl.createEl("p", {
      text: "专为 Obsidian 与思维创作者打造的本地优先、原生咬合式思维导图系统。",
      cls: "crisp-mind-settings-subhead"
    });

    const createGroup = (title, description, open = true) => {
      const details = containerEl.createEl("details", {
        cls: `crisp-mind-setting-card${open ? " is-open" : ""}`,
      });
      if (open) details.open = true;

      const summary = details.createEl("summary", {
        cls: "crisp-mind-setting-card__header",
      });

      const titleEl = summary.createDiv("crisp-mind-setting-card__title-group");
      titleEl.createDiv({ cls: "crisp-mind-setting-card__title", text: title });
      if (description) {
        titleEl.createDiv({ cls: "crisp-mind-setting-card__desc", text: description });
      }

      summary.createDiv({ cls: "crisp-mind-setting-card__chevron" });

      const contentWrapper = details.createDiv("crisp-mind-setting-card__content-wrapper");
      const body = contentWrapper.createDiv("crisp-mind-setting-card__body");

      summary.addEventListener("click", (evt) => {
        evt.preventDefault();
        if (details.open) {
          details.classList.remove("is-open");
          window.setTimeout(() => { details.open = false; }, 200);
        } else {
          details.open = true;
          window.requestAnimationFrame(() => {
            details.classList.add("is-open");
          });
        }
      });

      return body;
    };

    // Card 1: 导图偏好
    const prefGroup = createGroup(
      "导图偏好",
      "自定义思维导图的布局分支、配色主题与画布交互体验。",
      true
    );

    new Setting(prefGroup)
      .setName("默认导图布局")
      .setDesc("新建思维导图时采用的初始结构分支算法。")
      .addDropdown((dd) => {
        dd.addOption("logicalStructure", "逻辑结构图 (从左向右)")
          .addOption("mindMap", "经典思维导图 (双向发散)")
          .addOption("organizationStructure", "组织架构图 (自顶向下)")
          .addOption("catalogOrganization", "目录组织图 (大纲树)")
          .addOption("timeline", "水平时间轴 (Timeline)")
          .addOption("fishbone", "因果鱼骨图 (Fishbone)")
          .setValue(this.plugin.settings.defaultLayout)
          .onChange(async (val) => {
            this.plugin.settings.defaultLayout = val;
            await this.plugin.saveSettings();
          });
      });

    new Setting(prefGroup)
      .setName("默认调色盘主题")
      .setDesc("选择渲染思维导图节点线条的风格配色。默认跟随 Obsidian 当前主题变量。")
      .addDropdown((dd) => {
        dd.addOption("crisp-obsidian", "Crisp Obsidian (100% 同步当前主题变量)")
          .addOption("crisp-cupertino", "Crisp Cupertino (经典灰蓝冷色)")
          .addOption("crisp-nord", "Crisp Nord (极光深暗)")
          .addOption("crisp-mono", "Crisp Mono Editorial (当代编辑单色排版)")
          .addOption("crisp-amber", "Crisp Amber (温暖羊皮纸)")
          .addOption("crisp-paper", "Crisp Paper (纸感画布)")
          .setValue(this.plugin.settings.defaultTheme)
          .onChange(async (val) => {
            this.plugin.settings.defaultTheme = val;
            await this.plugin.saveSettings();
          });
      });

    new Setting(prefGroup)
      .setName("悬浮工具栏位置")
      .setDesc("选择悬浮胶囊工具栏停靠在画布的位置。")
      .addDropdown((dd) => {
        dd.addOption("bottom", "底部居中 (推荐)")
          .addOption("top", "顶部居中")
          .setValue(this.plugin.settings.toolbarPosition)
          .onChange(async (val) => {
            this.plugin.settings.toolbarPosition = val;
            await this.plugin.saveSettings();
            // Apply to maps that are already open.
            this.app.workspace.getLeavesOfType(VIEW_TYPE_CRISP_MIND).forEach(leaf => {
              leaf.view?.toolbarEl?.classList?.toggle("toolbar-top", val === "top");
            });
          });
      });

    new Setting(prefGroup)
      .setName("自动安全快照备份")
      .setDesc("在保存前自动生成历史快照，防止误改并支持一键恢复副本。")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.autoBackup !== false).onChange(async (val) => {
          this.plugin.settings.autoBackup = val;
          await this.plugin.saveSettings();
        });
      });

    new Setting(prefGroup)
      .setName("Crisp Pulse 知识脉冲联动")
      .setDesc("开启后，每一次思维导图结构化构思与编辑均自动计入 Pulse 贡献度分析。")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.enablePulseSync).onChange(async (val) => {
          this.plugin.settings.enablePulseSync = val;
          await this.plugin.saveSettings();
        });
      });

    // Card 2: 软件授权
    const licenseGroup = createGroup(
      "软件授权",
      "本地 Ed25519 签名验证与在线设备校验，支持离线使用；支持 Crisp Suite 系列授权。",
      true
    );

    const statusSetting = new Setting(licenseGroup)
      .setName("当前激活状态");

    const status = this.plugin.licenseManager ? this.plugin.licenseManager.getStatus() : { valid: false, reason: "未初始化" };
    if (status.valid && status.payload) {
      const owner = status.payload.userName || "Crisp 用户";
      const expiry = status.payload.expiresAt
        ? `，到期时间: ${String(status.payload.expiresAt).split("T")[0]}`
        : "";
      const verification = status.source === "offline" ? "离线验证" : "在线验证";
      statusSetting.setDesc(`✅ 已激活（${verification}，授权给: ${owner}${expiry}）`);
    } else if (this.plugin.settings.licenseCode) {
      statusSetting.setDesc(`❌ 未激活（${status.reason || "授权码无效"}）`);
    } else if (lastInheritNote) {
      statusSetting.setDesc(`🔒 未激活。${lastInheritNote}`);
    } else {
      statusSetting.setDesc("🔒 未激活（输入 Crisp 授权码以激活完整功能）");
    }

    if (status.valid) {
      statusSetting.addButton((btn) =>
        btn
          .setButtonText("清除授权")
          .onClick(async () => {
            this.plugin.licenseManager?.clear();
            this.licenseDraft = "";
            await this.plugin.saveSettings();
            this.plugin.refreshLicenseViews();
            new Notice("Crisp Mind: 已清除当前授权码");
            this.display();
          })
      );
    }

    new Setting(licenseGroup)
      .setName("输入授权码")
      .setDesc("支持 Crisp 系列激活码（全家桶或单款均可）。启动时自动扫描仓库内其他 Crisp 插件，采用其中第一个确实包含 Crisp Mind 权限的授权；单款授权不含 Crisp Mind 时不会被继承。")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("粘贴 Crisp 授权码...")
          .setValue(this.licenseDraft || this.plugin.settings.licenseCode || "")
          .onChange((value) => {
            this.licenseDraft = value.trim();
          });
      })
      .addButton((btn) => {
        btn
          .setButtonText(this.isCheckingLicense ? "验证中..." : "激活 / 重新验证")
          .setCta()
          .setDisabled(this.isCheckingLicense)
          .onClick(async () => {
            const codeToVerify = this.licenseDraft || this.plugin.settings.licenseCode;
            if (!codeToVerify) {
              new Notice("请先输入授权码");
              return;
            }
            this.isCheckingLicense = true;
            this.display();
            try {
              const res = await this.plugin.licenseManager?.activate(codeToVerify);
              await this.plugin.saveSettings();
              if (res && res.valid) {
                this.plugin.refreshLicenseViews();
                new Notice(`🎉 Crisp Mind 激活成功！欢迎使用，${res.payload?.userName || "Crisp 用户"}`);
              } else {
                new Notice(`❌ 激活未通过: ${res?.reason || "未知原因"}`);
              }
            } catch (err) {
              new Notice(`激活异常: ${err.message}`);
            } finally {
              this.isCheckingLicense = false;
              this.display();
            }
          });
      });

    // Card 3: 关于
    renderAboutCard(
      containerEl,
      "Crisp Mind",
      "专为 Obsidian 与思维创作者打造的本地优先、原生咬合式思维导图系统。支持双向 Markdown 互转、多种图道布局与 Obsidian 双链沉浸跃迁。",
      this.plugin.manifest?.version || "1.2.0"
    );
  }
}

module.exports = CrispMindPlugin;
