const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const vm = require("node:vm");
const { generateKeyPairSync, sign: edSign } = require("node:crypto");

// Locally generated Ed25519 pair used to sign license fixtures; setupTestContext swaps this
// public key into the plugin source so no real signing key is ever needed in tests.
const licenseKeys = generateKeyPairSync("ed25519");
const licensePublicPem = licenseKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
function makeLicenseCode(overrides = {}) {
  const payload = {
    product: "Crisp Suite",
    licenseId: "TEST-LICENSE",
    userName: "Test",
    expiresAt: "2999-01-01T00:00:00Z",
    features: ["all"],
    ...overrides,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = edSign(null, Buffer.from(data), licenseKeys.privateKey).toString("base64url");
  return `${data}.${signature}`;
}

// Test harness context simulating Obsidian environment
function setupTestContext(publicKeyPem, overrides = {}) {
  class Plugin {
    registerView() {}
    registerEvent() {}
    registerHoverLinkSource(id, info) { (this.hoverSources ||= {})[id] = info; }
    registerDomEvent() {}
    addRibbonIcon() {}
    addCommand() {}
    addSettingTab() {}
    loadData() { return Promise.resolve({}); }
    saveData() { return Promise.resolve(); }
  }
  class ItemView {}
  class TextFileView extends ItemView {
    constructor(leaf) {
      super();
      this.leaf = leaf;
      this.contentEl = {
        createDiv: () => ({
          classList: { add() {}, remove() {}, toggle() {} },
          appendChild() {},
          innerHTML: "",
          style: {},
          addEventListener() {}
        }),
        innerHTML: "",
        style: {}
      };
    }
  }
  class Setting {
    setName() { return this; }
    setDesc() { return this; }
    addDropdown() { return this; }
    addToggle() { return this; }
    addText() { return this; }
    addButton() { return this; }
  }
  class PluginSettingTab {}
  class Notice {}
  class Modal { open() {} close() {} }
  class TFile {}
  const testMenus = [];
  class Menu {
    constructor() { this.items = []; testMenus.push(this); }
    addItem(build) {
      const item = {
        setTitle(title) { this.title = title; return this; },
        setIcon(icon) { this.icon = icon; return this; },
        onClick(callback) { this.callback = callback; return this; }
      };
      build(item);
      this.items.push(item);
      return item;
    }
    addSeparator() { this.items.push({ separator: true }); }
    showAtMouseEvent() {}
  }

  const context = {
    require: (mod) => {
      if (mod === "crypto") return require("crypto");
      if (mod === "util") return require("util");
      if (mod === "fs") return require("fs");
      if (mod === "path") return require("path");
      class Component { registerEvent() {} register() {} load() {} unload() {} }
      return { Plugin, ItemView, TextFileView, Setting, PluginSettingTab, Notice, Modal, TFile, Menu, Component, addIcon: () => {}, setIcon: () => {} };
    },
    URL,
    module: { exports: {} },
    console,
    window: {
      setTimeout,
      getComputedStyle: () => ({
        getPropertyValue: (prop) => {
          if (prop === "--color-accent") return "#7c3aed";
          if (prop === "--background-primary") return "#1e1e2e";
          if (prop === "--background-secondary") return "#181825";
          if (prop === "--text-normal") return "#cdd6f4";
          if (prop === "--text-muted") return "#a6adc8";
          if (prop === "--background-modifier-border") return "#313244";
          return "";
        }
      })
    },
    document: {
      createElement: (tag) => ({
        tagName: tag,
        style: {},
        setAttribute() {},
        appendChild() {},
        classList: { add() {}, remove() {} }
      }),
      body: {}
    },
    setTimeout,
    clearTimeout,
    structuredClone: (obj) => JSON.parse(JSON.stringify(obj)),
    crypto: globalThis.crypto,
    atob: globalThis.atob,
    Buffer: globalThis.Buffer,
    TextEncoder: globalThis.TextEncoder,
    TextDecoder: globalThis.TextDecoder,
    ...overrides
  };

  const mainPath = path.join(__dirname, "../main.js");
  let source = fs.readFileSync(mainPath, "utf8");
  // Swap in a locally generated key so license fixtures can be signed in the test.
  if (publicKeyPem) {
    assert.match(source, /-----BEGIN PUBLIC KEY-----/);
    source = source.replace(/-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----/, publicKeyPem.trim());
  }
  const code = source +
    "\nmodule.exports.helpers = { inlineEditorFrame, normalizeMindLinkText, mindNodeLink, inspectMindSource, searchMindNodes, normalizePresentationSteps, normalizeNodeStyle, normalizeMindAnnotations, createBranchColorMap, sampleCubicBezierPoints, taperedPathFromPoints, relationRouteIntersectsNodes, findOrthogonalRelationRoute, roundedOrthogonalPath, findRelationLabelPosition, getDescendantTaskProgress, createTaskProgressMap, CrispMindCanvas, CrispMindEditView, parseMindMarkdown, assembleMindMarkdown, markdownOutlineToTree, treeToMarkdownOutline, validateAndRepairTree, extractNodeToTopicContent, getComputedThemeConfig, verifyLicenseCode, discoverVaultCrispLicense, collectVaultCrispLicenseCandidates, CrispMindLicenseManager, renderAboutCard, CrispMindExporter, CrispMindPromptModal, CrispMindSearchModal, clipboardImagePaths: typeof clipboardImagePaths === \"undefined\" ? undefined : clipboardImagePaths, noteMarkdownForPreview: typeof noteMarkdownForPreview === \"undefined\" ? undefined : noteMarkdownForPreview, normalizeMindImage: typeof normalizeMindImage === \"undefined\" ? undefined : normalizeMindImage, splitOutlineImage: typeof splitOutlineImage === \"undefined\" ? undefined : splitOutlineImage, mindImageBox: typeof mindImageBox === \"undefined\" ? undefined : mindImageBox, mindImageRelinks: typeof mindImageRelinks === \"undefined\" ? undefined : mindImageRelinks, mindLinkRelinks: typeof mindLinkRelinks === \"undefined\" ? undefined : mindLinkRelinks, mindOutlineRelinks: typeof mindOutlineRelinks === \"undefined\" ? undefined : mindOutlineRelinks, inlineSvgImages: typeof inlineSvgImages === \"undefined\" ? undefined : inlineSvgImages, exportTargetPath: typeof exportTargetPath === \"undefined\" ? undefined : exportTargetPath, exportBackgroundColor: typeof exportBackgroundColor === \"undefined\" ? undefined : exportBackgroundColor, snapshotSourceKey: typeof snapshotSourceKey === \"undefined\" ? undefined : snapshotSourceKey, MIND_SNAPSHOT_LIMIT: typeof MIND_SNAPSHOT_LIMIT === \"undefined\" ? undefined : MIND_SNAPSHOT_LIMIT, mindEntitled: typeof mindEntitled === \"undefined\" ? undefined : mindEntitled, splitOutlineBlockId: typeof splitOutlineBlockId === \"undefined\" ? undefined : splitOutlineBlockId, mindEmbedHeight: typeof mindEmbedHeight === \"undefined\" ? undefined : mindEmbedHeight, CrispMindEmbed: typeof CrispMindEmbed === \"undefined\" ? undefined : CrispMindEmbed, mindBlockIdNodeId: typeof mindBlockIdNodeId === \"undefined\" ? undefined : mindBlockIdNodeId, mindOutlineIsLossless: typeof mindOutlineIsLossless === \"undefined\" ? undefined : mindOutlineIsLossless, mindLicenseManagerFor: typeof mindLicenseManagerFor === \"undefined\" ? undefined : mindLicenseManagerFor, entitle: (p, on = true) => { const m = mindLicenseManagerFor(p); MIND_LICENSE_STATE.set(m, !!on); MIND_LICENSE_EXPIRY.delete(m); return p; } };";

  vm.runInNewContext(code, context);
  context.module.exports.testMenus = testMenus;
  return context.module.exports;
}

test("1. Markdown Outline to Tree conversion", () => {
  const { helpers } = setupTestContext();
  const md = `# Central Topic
- Branch 1 [[Note Link]]
  - Sub A
  - Sub B
- Branch 2
  - Sub C`;

  const tree = helpers.markdownOutlineToTree(md);
  assert.ok(tree, "Tree should not be null");
  assert.equal(tree.data.text, "Central Topic");
  assert.equal(tree.children.length, 2);
  assert.equal(tree.children[0].data.text, "Branch 1 [[Note Link]]");
  assert.equal(tree.children[0].children.length, 2);
  assert.equal(tree.children[0].children[0].data.text, "Sub A");
  assert.equal(tree.children[1].children[0].data.text, "Sub C");
});

test("2. Tree to Markdown Outline conversion preserves hierarchy", () => {
  const { helpers } = setupTestContext();
  const tree = {
    id: "root-1",
    data: { text: "Cognitive System" },
    children: [
      {
        id: "c-1",
        data: { text: "Core Plane [[Core]]" },
        children: [{ id: "c-1-1", data: { text: "System Policies" } }]
      },
      {
        id: "c-2",
        data: { text: "Topics Plane [[Topics]]" }
      }
    ]
  };

  const outline = helpers.treeToMarkdownOutline(tree);
  assert.ok(outline.includes("# Cognitive System"));
  assert.ok(outline.includes("- Core Plane [[Core]]"));
  assert.ok(outline.includes("  - System Policies"));
  assert.ok(outline.includes("- Topics Plane [[Topics]]"));
});

test("3. Dual-mode .mind.md Parsing and Assembling", () => {
  const { helpers } = setupTestContext();
  const rawFile = `---
crisp-mind: true
title: AI Architecture
tags: [mindmap, ai]
---

# AI Architecture
- LLM Engine
  - Context Window
  - Tool Invocation
- Memory Store

<!-- CRISP-MIND-DATA-START -->
\`\`\`crisp-mind
{
  "version": "1.0",
  "layout": "logicalStructure",
  "theme": "crisp-obsidian",
  "root": {
    "id": "root",
    "data": { "text": "AI Architecture" },
    "children": [
      {
        "id": "c1",
        "data": { "text": "LLM Engine" },
        "children": [
          { "id": "c11", "data": { "text": "Context Window" } },
          { "id": "c12", "data": { "text": "Tool Invocation" } }
        ]
      },
      {
        "id": "c2",
        "data": { "text": "Memory Store" }
      }
    ]
  }
}
\`\`\`
<!-- CRISP-MIND-DATA-END -->
`;

  const parsed = helpers.parseMindMarkdown(rawFile);
  assert.equal(parsed.title, "AI Architecture");
  assert.equal(parsed.data.layout, "logicalStructure");
  assert.equal(parsed.data.root.children.length, 2);

  // Test Assemble
  const reassembled = helpers.assembleMindMarkdown(parsed);
  assert.ok(reassembled.includes("crisp-mind: true"));
  assert.ok(reassembled.includes("# AI Architecture"));
  assert.ok(reassembled.includes("- LLM Engine"));
  assert.ok(reassembled.includes("<!-- CRISP-MIND-DATA-START -->"));
});

test("4. Tree Validation & Data Contract Self-Healing", () => {
  const { helpers } = setupTestContext();
  const brokenData = {
    root: {
      children: [
        null,
        { data: {} }
      ]
    }
  };

  const repaired = helpers.validateAndRepairTree(brokenData);
  assert.ok(repaired.root.id, "Root id must be repaired");
  assert.equal(repaired.root.data.text, "Central Topic");
  assert.equal(repaired.root.children.length, 1);
  assert.ok(repaired.root.children[0].id);
});

test("5. Extract Branch to Topic (ANKS Integration)", () => {
  const { helpers } = setupTestContext();
  const branchNode = {
    id: "sub-1",
    data: { text: "WeChat Publisher Workflow" },
    children: [
      { id: "s-1", data: { text: "Draft Compilation" } },
      { id: "s-2", data: { text: "Asset Syncing" } }
    ]
  };

  const { title, content } = helpers.extractNodeToTopicContent(branchNode);
  assert.equal(title, "WeChat Publisher Workflow");
  assert.ok(content.includes("crisp-type: topic-note"));
  assert.ok(content.includes("# WeChat Publisher Workflow"));
  assert.ok(content.includes("- Draft Compilation"));
  assert.ok(content.includes("- Asset Syncing"));
});

test("6. Obsidian Theme Adapter produces valid palette", () => {
  const { helpers } = setupTestContext();
  const palette = helpers.getComputedThemeConfig("crisp-obsidian");
  assert.equal(palette.accentColor, "#7c3aed");
  assert.equal(palette.backgroundColor, "#1e1e2e");
  assert.equal(palette.textColor, "#cdd6f4");
  for (const theme of ["crisp-obsidian", "crisp-cupertino", "crisp-nord", "crisp-mono", "crisp-amber", "crisp-paper"]) {
    const colors = helpers.getComputedThemeConfig(theme).branchColors;
    assert.equal(colors.length, 8, `${theme} should provide eight branch colors`);
    assert.ok(colors.every(color => /^#[\da-f]{6}$/i.test(color)), `${theme} should use explicit SVG-safe colors`);
  }
});

test("7. Crisp Paper palette is editorial in light and dark rooms", () => {
  const { helpers } = setupTestContext();
  const paper = helpers.getComputedThemeConfig("crisp-paper");
  assert.equal(paper.name, "crisp-paper");
  assert.equal(paper.paperPattern, true);
  assert.match(paper.backgroundColor, /^#/);
  assert.match(paper.lineColor, /^#/);
});

test("8. Node search returns the matching branch path in document order", () => {
  const { helpers } = setupTestContext();
  const doc = helpers.parseMindMarkdown("# Root\n- Product\n  - ASIN Lookup\n  - Inventory\n- Workflow\n  - ASIN Review");
  const results = helpers.searchMindNodes(doc.data.root, "asin");
  assert.equal(results.length, 2);
  assert.equal(results[0].text, "ASIN Lookup");
  assert.deepEqual(Array.from(results[0].path), ["Root", "Product", "ASIN Lookup"]);
  assert.equal(results[1].text, "ASIN Review");
  assert.deepEqual(Array.from(results[1].path), ["Root", "Workflow", "ASIN Review"]);
});

test("9. Presentation steps retain valid notes, drop duplicates, and ignore deleted nodes", () => {
  const { helpers } = setupTestContext();
  const doc = helpers.parseMindMarkdown("# Root\n- One\n- Two");
  const [one, two] = doc.data.root.children;
  const steps = helpers.normalizePresentationSteps([
    { nodeId: one.id, note: "First point" },
    { nodeId: one.id, note: "Duplicate" },
    { nodeId: "missing", note: "Ignore" },
    { nodeId: two.id, note: "Second point" }
  ], doc.data.root);
  assert.deepEqual(Array.from(steps, step => step.nodeId), [one.id, two.id]);
  assert.equal(steps[0].note, "First point");
  assert.equal(steps[1].note, "Second point");
});

test("branch colors stay tied to root branches and soften at deeper levels", () => {
  const { helpers } = setupTestContext();
  assert.equal(typeof helpers.createBranchColorMap, "function");
  const root = { id: "root", children: [
    { id: "first", children: [{ id: "first-child", children: [] }] },
    { id: "second", children: [] }
  ] };
  const map = helpers.createBranchColorMap(root, ["#336699", "#993366"], "#ffffff");
  assert.equal(map.get("first").color, "#336699");
  assert.equal(map.get("first").branchIndex, 0);
  assert.equal(map.get("first-child").branchIndex, 0);
  assert.notEqual(map.get("first-child").color, map.get("first").color);
  assert.equal(map.get("second").color, "#993366");
});

test("tapered connector paths are closed, finite, and accept curves and elbows", () => {
  const { helpers } = setupTestContext();
  assert.equal(typeof helpers.sampleCubicBezierPoints, "function");
  assert.equal(typeof helpers.taperedPathFromPoints, "function");
  const curve = helpers.sampleCubicBezierPoints(
    { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 30 }, { x: 40, y: 30 }, 8
  );
  assert.equal(curve.length, 9);
  const curvePath = helpers.taperedPathFromPoints(curve);
  const elbowPath = helpers.taperedPathFromPoints([{ x: 0, y: 0 }, { x: 0, y: 20 }, { x: 40, y: 20 }]);
  assert.match(curvePath, /^M -?\d/);
  assert.match(curvePath, / Z$/);
  assert.match(elbowPath, /^M -?\d/);
  assert.match(elbowPath, / Z$/);
  assert.doesNotMatch(`${curvePath} ${elbowPath}`, /NaN|Infinity/);
});

test("fishbone relation routes detour around node boxes and keep labels in clear space", () => {
  const { helpers } = setupTestContext();
  assert.equal(typeof helpers.findOrthogonalRelationRoute, "function");
  assert.equal(typeof helpers.roundedOrthogonalPath, "function");
  assert.equal(typeof helpers.findRelationLabelPosition, "function");
  const nodes = [
    { id: "from", _x: -20, _y: 40, _w: 20, _h: 20 },
    { id: "blocker", _x: 40, _y: 30, _w: 20, _h: 40 },
    { id: "to", _x: 100, _y: 40, _w: 20, _h: 20 }
  ];
  const route = helpers.findOrthogonalRelationRoute(
    { x: 0, y: 50 }, { x: 100, y: 50 }, nodes, new Set(["from", "to"]), 8
  );
  assert.ok(route.length > 2, "blocked direct link should take a detour");
  assert.equal(route[0].x, 0);
  assert.equal(route[0].y, 50);
  assert.equal(route.at(-1).x, 100);
  assert.equal(route.at(-1).y, 50);
  const obstacle = { left: 32, right: 68, top: 22, bottom: 78 };
  for (let index = 1; index < route.length; index++) {
    const a = route[index - 1], b = route[index];
    assert.ok(a.x === b.x || a.y === b.y, "route segments should be orthogonal");
    if (a.y === b.y && a.y > obstacle.top && a.y < obstacle.bottom) {
      assert.ok(Math.max(a.x, b.x) <= obstacle.left || Math.min(a.x, b.x) >= obstacle.right);
    }
    if (a.x === b.x && a.x > obstacle.left && a.x < obstacle.right) {
      assert.ok(Math.max(a.y, b.y) <= obstacle.top || Math.min(a.y, b.y) >= obstacle.bottom);
    }
  }
  assert.match(helpers.roundedOrthogonalPath(route), /Q/);
  const label = helpers.findRelationLabelPosition(route, 44, 22, nodes, 6);
  assert.ok(label, "route should provide a readable label position");
  for (const node of nodes) {
    const overlaps = label.x < node._x + node._w && label.x + label.width > node._x &&
      label.y < node._y + node._h && label.y + label.height > node._y;
    assert.equal(overlaps, false, `label overlaps ${node.id}`);
  }
});

test("parent task progress counts only descendant Markdown tasks", () => {
  const { helpers } = setupTestContext();
  assert.equal(typeof helpers.getDescendantTaskProgress, "function");
  const parent = { id: "parent", data: { text: "[ ] Parent task" }, children: [
    { data: { text: "[x] Complete" }, children: [] },
    { data: { text: "Plain node" }, children: [
      { data: { text: "[ ] Open" }, children: [] },
      { data: { text: "[X] Also complete" }, children: [] }
    ] }
  ] };
  const progress = helpers.getDescendantTaskProgress(parent);
  assert.equal(progress.total, 3);
  assert.equal(progress.completed, 2);
  assert.equal(progress.ratio, 2 / 3);
  assert.equal(typeof helpers.createTaskProgressMap, "function");
  const progressMap = helpers.createTaskProgressMap({ id: "root", data: { text: "[x] Root" }, children: [parent] });
  assert.equal(progressMap.get("root").total, 4);
  assert.equal(progressMap.get("root").completed, 2);
  assert.equal(progressMap.get("parent").total, 3);
  assert.equal(progressMap.get("parent").completed, 2);
  const empty = helpers.getDescendantTaskProgress({ children: [{ data: { text: "No task" } }] });
  assert.equal(empty.total, 0);
  assert.equal(empty.completed, 0);
  assert.equal(empty.ratio, 0);
});

function fakeSvgNode(tag) {
  return {
    tag,
    attrs: {},
    children: [],
    style: {},
    classList: {
      add() {},
      toggle() {}
    },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    appendChild(child) { this.children.push(child); return child; },
    append(...children) { this.children.push(...children); },
    addEventListener() {},
    remove() {}
  };
}

function renderCanvasToFakeSvg(canvas, helpers) {
  canvas.theme = helpers.getComputedThemeConfig("crisp-nord");
  canvas.branchColorMap = helpers.createBranchColorMap(
    canvas.docData.root, canvas.theme.branchColors, canvas.theme.backgroundColor
  );
  canvas.document = { createElementNS: (_namespace, tag) => fakeSvgNode(tag) };
  canvas.linesGroup = fakeSvgNode("g");
  canvas.nodesGroup = fakeSvgNode("g");
  canvas.nodeElements = new Map();
  canvas.renderBranch(canvas.docData.root);
  return canvas;
}

test("canvas renders tapered branch-colored paths for export and screen", () => {
  const { canvas, helpers } = canvasFixture();
  canvas.docData.root.children = [
    { id: "branch-a", data: { text: "A" }, children: [{ id: "child-a", data: { text: "Child" }, children: [] }] },
    { id: "branch-b", data: { text: "B" }, children: [] }
  ];
  canvas.calculateLayout();
  renderCanvasToFakeSvg(canvas, helpers);
  const rootLines = canvas.linesGroup.children;
  assert.equal(rootLines.length, 3);
  assert.equal(rootLines[0].attrs.fill, canvas.branchColorMap.get("branch-a").color);
  assert.equal(rootLines[1].attrs.fill, canvas.branchColorMap.get("child-a").color);
  assert.match(rootLines[0].attrs.d, / Z$/);
  assert.equal(rootLines[0].attrs.stroke, "none");
});

test("all six layouts render finite closed connector ribbons", () => {
  for (const layout of ["logicalStructure", "mindMap", "organizationStructure", "catalogOrganization", "timeline", "fishbone"]) {
    const { canvas, helpers } = canvasFixture();
    canvas.docData.root.children = [
      { id: "branch-a", data: { text: "A" }, children: [{ id: "child-a", data: { text: "Child A" }, children: [] }] },
      { id: "branch-b", data: { text: "B" }, children: [{ id: "child-b", data: { text: "Child B" }, children: [] }] }
    ];
    canvas.layout = layout;
    canvas.docData.layout = layout;
    canvas.calculateLayout();
    renderCanvasToFakeSvg(canvas, helpers);
    assert.equal(canvas.linesGroup.children.length, 4, `${layout} should render every tree edge`);
    for (const path of canvas.linesGroup.children) {
      assert.match(path.attrs.d, / Z$/, `${layout} connector should be closed`);
      assert.doesNotMatch(path.attrs.d, /NaN|Infinity/, `${layout} connector should stay finite`);
    }
  }
});

test("collapsed parent keeps an accessible task progress ring for hidden descendants", () => {
  const { canvas, helpers } = canvasFixture();
  canvas.docData.root.children = [{
    id: "parent",
    data: { text: "Plan", collapsed: true },
    children: [
      { id: "done", data: { text: "[x] Done" }, children: [] },
      { id: "open", data: { text: "[ ] Open" }, children: [] }
    ]
  }];
  canvas.calculateLayout();
  renderCanvasToFakeSvg(canvas, helpers);
  const parent = canvas.nodesGroup.children.find(node => node.attrs["data-node-id"] === "parent");
  const fold = parent.children.find(node => node.attrs["data-collapse"] === "parent");
  const track = fold.children.find(node => node.attrs.class === "crisp-mind-task-progress-track");
  assert.equal(track.attrs["data-task-progress"], "1/2");
  assert.match(fold.attrs["aria-label"], /待办完成 1\/2/);
  assert.equal(parent.children.some(node => node.attrs["data-node-id"] === "done"), false);
});

test("linked node menu opens the note in a right split and exposes branch extraction", () => {
  const plugin = setupTestContext();
  const opened = [], extracted = [];
  const node = { id: "branch", data: { text: "Topic [[Notes/Target|Target]]" }, children: [] };
  const view = {
    readOnly: false,
    app: { vault: { getName: () => "Test Vault" } },
    canvasController: {
      selectedNodeIds: new Set([node.id]),
      selectedNodeId: node.id,
      docData: { root: { id: "root" } }
    },
    openLinkedNote: (target, pane) => opened.push([target, pane]),
    extractCurrentNodeToTopic: () => extracted.push(true)
  };
  plugin.helpers.CrispMindEditView.prototype.showNodeMenu.call(view, node, {});
  const menu = plugin.testMenus.at(-1);
  const splitAction = menu.items.find(item => item.title === "在右侧分屏打开");
  const extractAction = menu.items.find(item => item.title === "提炼当前分支为独立笔记");
  assert.ok(splitAction);
  assert.ok(extractAction);
  splitAction.callback();
  extractAction.callback();
  assert.deepEqual(opened, [["Notes/Target", "split"]]);
  assert.equal(extracted.length, 1);
});

test("linked note split uses Obsidian's adjacent vertical pane and preserves heading", async () => {
  const { helpers } = setupTestContext();
  const calls = [];
  const file = { path: "Notes/Target.md" };
  const leaf = {
    openFile: async (openedFile, options) => calls.push(["openFile", openedFile, options])
  };
  const view = {
    file: { path: "Maps/Map.mind.md" },
    app: {
      metadataCache: { getFirstLinkpathDest: (path, source) => { calls.push(["resolve", path, source]); return file; } },
      workspace: {
        getLeaf: (...args) => { calls.push(["getLeaf", ...args]); return leaf; },
        revealLeaf: async revealed => calls.push(["revealLeaf", revealed])
      }
    }
  };
  await helpers.CrispMindEditView.prototype.openLinkedNote.call(view, "Notes/Target#Overview", "split");
  assert.equal(calls[1][0], "getLeaf");
  assert.equal(calls[1][1], "split");
  assert.equal(calls[1][2], "vertical");
  assert.equal(calls[2][0], "openFile");
  assert.equal(calls[2][2].eState.subpath, "#Overview");
});

function canvasFixture() {
  const { helpers } = setupTestContext();
  const C = helpers.CrispMindCanvas;
  C.prototype.initCanvas = function () {};
  C.prototype.render = function () { this.calculateLayout(); };
  let changes = 0;
  const data = helpers.parseMindMarkdown("# Root\n- One\n  - Nested\n- Two\n- Three").data;
  const canvas = new C({}, data, { onChange: () => changes++ });
  return { canvas, helpers, changes: () => changes };
}
test("opening a canvas does not request a save", () => {
  assert.equal(canvasFixture().changes(), 0);
});
test("undo restores theme and layout, redo reapplies both", () => {
  const { canvas } = canvasFixture();
  canvas.setTheme("crisp-nord");
  canvas.setLayout("organizationStructure");
  canvas.undo();
  assert.equal(canvas.docData.layout, "logicalStructure");
  assert.equal(canvas.layout, "logicalStructure");
  canvas.undo();
  assert.equal(canvas.docData.theme, "crisp-obsidian");
  canvas.redo();
  assert.equal(canvas.theme.name, "crisp-nord");
});
test("mind map places branches on both sides of the root", () => {
  const { canvas } = canvasFixture();
  canvas.setLayout("mindMap");
  const r = canvas.docData.root;
  assert.ok(r.children.some(c => c._x < r._x));
  assert.ok(r.children.some(c => c._x > r._x));
});
test("organization layout places siblings below root on same row", () => {
  const { canvas } = canvasFixture();
  canvas.setLayout("organizationStructure");
  const r = canvas.docData.root;
  assert.ok(r.children.every(c => c._y > r._y));
  assert.equal(r.children[0]._y, r.children[1]._y);
});
test("serialization excludes calculated geometry", () => {
  const { canvas, helpers } = canvasFixture();
  canvas.calculateLayout();
  const text = helpers.assembleMindMarkdown({data:canvas.docData});
  assert.ok(!text.includes('"_x"'));
  assert.ok(!text.includes('"_treeHeight"'));
});
test("every layout keeps its computed geometry out of the serialized file", () => {
  const transient = ["_x","_y","_w","_h","_treeHeight","_treeWidth","_lines",
    "_isUpper","_spineConnectX","_spineConnectY","_boneTipX","_boneTipY","_boneConnectX","_boneConnectY"];
  for (const layout of ["logicalStructure","mindMap","organizationStructure","catalogOrganization","timeline","fishbone"]) {
    const { canvas, helpers } = canvasFixture();
    canvas.docData.root.children = [
      { id:"b1", data:{text:"人员因素"}, children:[{ id:"s1", data:{text:"培训不足"}, children:[] }] },
      { id:"b2", data:{text:"设备因素"}, children:[{ id:"s2", data:{text:"老化故障"}, children:[] }] }
    ];
    canvas.layout = layout;
    canvas.calculateLayout();
    const text = helpers.assembleMindMarkdown({data:canvas.docData});
    const leaked = transient.filter(k => text.includes('"' + k + '"'));
    assert.deepEqual(leaked, [], layout + " leaked layout geometry: " + leaked.join(", "));
  }
});
test("switching away from fishbone leaves no bone residue in the file", () => {
  const { canvas, helpers } = canvasFixture();
  canvas.docData.root.children = [
    { id:"b1", data:{text:"人员因素"}, children:[] },
    { id:"b2", data:{text:"设备因素"}, children:[] }
  ];
  canvas.setLayout("fishbone");
  assert.ok(canvas.docData.root.children[0]._spineConnectX, "fishbone should compute spine coordinates first");
  canvas.setLayout("logicalStructure");
  const text = helpers.assembleMindMarkdown({data:canvas.docData});
  for (const key of ["_isUpper","_spineConnectX","_spineConnectY","_boneTipX","_boneTipY","_boneConnectX","_boneConnectY"]) {
    assert.ok(!text.includes('"' + key + '"'), "residual " + key + " survived the layout switch");
  }
  assert.ok(!JSON.stringify(canvas.history).includes('"_spineConnectX"'), "history must not carry bone geometry");
});
test("ordinary Markdown view returns exact original content", () => {
  const { helpers } = setupTestContext();
  const v = Object.create(helpers.CrispMindEditView.prototype);
  v.file = {path:"notes.md"};
  v.initViewUI = () => {}; v.renderLockedView = () => {};
  const source = "---\ncustom: yes\n---\n# Note\nA paragraph.\n- item\n";
  v.setViewData(source, true);
  assert.equal(v.getViewData(), source);
});

test("unchanged history is deduplicated and contains no geometry", () => {
  const {canvas} = canvasFixture(); canvas.calculateLayout(); canvas.saveState();
  assert.equal(canvas.history.length, 1);
  assert.ok(!JSON.stringify(canvas.history).includes('"_x"'));
});
test("branch focus changes only the viewport and never rewrites collapse state", () => {
  const { canvas, changes } = canvasFixture();
  const parent = canvas.docData.root.children[0];
  parent.data.collapsed = true;
  const savesBefore = changes();
  canvas.setBranchFocus(parent.id);
  assert.equal(canvas.branchFocusId, parent.id);
  assert.deepEqual(Array.from(canvas.visibleNodes(), node => node.id), [parent.id, parent.children[0].id]);
  assert.equal(parent.data.collapsed, true);
  assert.equal(changes(), savesBefore);
  canvas.clearBranchFocus();
  assert.equal(canvas.branchFocusId, null);
  assert.ok(!canvas.visibleNodes().some(node => node.id === parent.children[0].id));
});
test("presentation order persists in .mind.md and survives undo or redo", () => {
  const { canvas, helpers } = canvasFixture();
  const [one, two] = canvas.docData.root.children;
  canvas.setPresentationSteps([
    { nodeId: one.id, note: "Say one" },
    { nodeId: two.id, note: "Say two" }
  ]);
  const saved = helpers.assembleMindMarkdown({ data: canvas.docData });
  assert.ok(saved.includes('"presentation"'));
  assert.ok(saved.includes('"note": "Say one"'));
  assert.ok(saved.includes(`"nodeId": "${one.id}"`));
  canvas.undo();
  assert.equal(canvas.docData.presentation, undefined);
  canvas.redo();
  assert.equal(canvas.docData.presentation.steps.length, 2);
});
test("presentation navigation stays inside saved steps and exits cleanly", () => {
  const { canvas } = canvasFixture();
  const [one, two] = canvas.docData.root.children;
  canvas.setPresentationSteps([{ nodeId: one.id, note: "" }, { nodeId: two.id, note: "" }]);
  assert.equal(canvas.startPresentation(), true);
  assert.equal(canvas.presentationIndex, 0);
  canvas.goToPresentationStep(1);
  assert.equal(canvas.selectedNodeId, two.id);
  canvas.goToPresentationStep(99);
  assert.equal(canvas.presentationIndex, 1);
  canvas.stopPresentation();
  assert.equal(canvas.presentationActive, false);
});
test("node notes and styles are normalized, editable, and serialized", () => {
  const { canvas, helpers } = canvasFixture();
  const node = canvas.docData.root.children[0];
  canvas.selectNode(node.id);
  canvas.updateSelectedNodeStyles({
    shape: "pill",
    fill: "#AABBCC",
    textColor: "#112233",
    borderColor: "#445566",
    borderWidth: 4,
    fontSize: 16,
    fontWeight: 600,
    align: "left"
  });
  canvas.updateSelectedNodeNote("这是一条需要保留的背景说明");
  assert.equal(node.data.style.shape, "pill");
  assert.equal(node.data.style.fill, "#aabbcc");
  assert.equal(node.data.style.borderWidth, 4);
  assert.equal(node.data.note, "这是一条需要保留的背景说明");
  const text = helpers.assembleMindMarkdown({ data: canvas.docData });
  assert.ok(text.includes('"note": "这是一条需要保留的背景说明"'));
  assert.ok(text.includes('"shape": "pill"'));
  const parsed = helpers.parseMindMarkdown(text);
  assert.equal(parsed.data.root.children[0].data.style.fontSize, 16);
  assert.equal(parsed.data.root.children[0].data.note, "这是一条需要保留的背景说明");
});
test("relations, boundaries, and summaries keep valid node references only", () => {
  const { helpers } = setupTestContext();
  const doc = helpers.parseMindMarkdown("# Root\n- One\n- Two");
  const [one, two] = doc.data.root.children;
  doc.data.relations = [
    { id: "r1", from: one.id, to: two.id, label: "depends on", color: "#AABBCC" },
    { id: "r2", from: one.id, to: "missing", label: "drop" }
  ];
  doc.data.boundaries = [{ id: "b1", nodeId: one.id, label: "核心边界" }];
  doc.data.summaries = [{ id: "s1", nodeId: two.id, label: "阶段总结" }];
  helpers.validateAndRepairTree(doc.data);
  assert.equal(doc.data.relations.length, 1);
  assert.equal(doc.data.relations[0].color, "#aabbcc");
  assert.equal(doc.data.boundaries[0].label, "核心边界");
  assert.equal(doc.data.summaries[0].nodeId, two.id);
  const text = helpers.assembleMindMarkdown(doc);
  assert.ok(text.includes('"relations"'));
  assert.ok(text.includes('"boundaries"'));
  assert.ok(text.includes('"summaries"'));
});
test("summary bounds cover child branches instead of the selected parent", () => {
  const { canvas } = canvasFixture();
  const parent = canvas.docData.root.children[0];
  canvas.calculateLayout();
  const bounds = canvas.summaryBounds(parent);
  assert.ok(bounds, "an expanded parent should have summary bounds");
  assert.ok(bounds.x > parent._x + parent._w, "summary should start to the right of the parent node");
  parent.data.collapsed = true;
  canvas.calculateLayout();
  assert.equal(canvas.summaryBounds(parent), null, "collapsed children should hide their summary");
  parent.data.collapsed = false;
  canvas.calculateLayout();
  const leaf = canvas.docData.root.children[1];
  const leafBounds = canvas.summaryBounds(leaf);
  assert.ok(leafBounds.x <= leaf._x && leafBounds.x + leafBounds.width >= leaf._x + leaf._w);
});
test("multi-select supports additive and visible-range selection", () => {
  const { canvas } = canvasFixture();
  const [one, two] = canvas.docData.root.children;
  canvas.selectNode(one.id);
  canvas.selectNode(two.id, false, { additive: true });
  assert.deepEqual(Array.from(canvas.selectedNodeIds).sort(), [one.id, two.id].sort());
  assert.equal(canvas.selectedNodeId, two.id);
  canvas.selectVisibleRange(canvas.docData.root.id, two.id);
  assert.equal(canvas.selectedNodeIds.size, 4);
  canvas.selectNode(one.id, false, { additive: true });
  assert.equal(canvas.selectedNodeIds.has(one.id), false);
});
test("deleting selected branches removes their annotations and duplicate paste keeps style and note", () => {
  const { canvas, helpers } = canvasFixture();
  const root = canvas.docData.root;
  const one = root.children[0];
  one.data.note = "保留备注";
  one.data.style = { shape: "rounded", fill: "#abcdef" };
  canvas.docData.relations = [
    { id: "r1", from: one.id, to: root.children[1].id, label: "" },
    { id: "r2", from: root.children[1].id, to: root.children[2].id, label: "" }
  ];
  canvas.docData.boundaries = [{ id: "b1", nodeId: one.id, label: "" }];
  canvas.copyBranchText(one.id);
  canvas.pasteBranchText(canvas.clipboardBranchSnapshot.text, root.id);
  const pasted = root.children.at(-1);
  assert.notEqual(pasted.id, one.id);
  assert.equal(pasted.data.note, "保留备注");
  assert.equal(pasted.data.style.fill, "#abcdef");
  canvas.selectNode(one.id);
  canvas.deleteNode(one.id);
  assert.equal(canvas.docData.relations.length, 1);
  assert.equal(canvas.docData.relations[0].id, "r2");
  assert.equal(canvas.docData.boundaries, undefined);
});
test("batch delete selects the deleted branch's parent instead of falling back to root", () => {
  const { canvas } = canvasFixture();
  const parent = canvas.docData.root.children[0];
  const child = parent.children[0];
  canvas.selectNode(child.id);
  assert.equal(canvas.deleteSelectedNodes(), true);
  assert.equal(canvas.selectedNodeId, parent.id);
  assert.equal(canvas.findNode(child.id), null);
});
test("move rejects cycles and root move, reparent is a single undo step", () => {
  const {canvas} = canvasFixture(); const r=canvas.docData.root,a=r.children[0],b=r.children[1],nested=a.children[0];
  assert.equal(canvas.moveNode(a.id,nested.id),false);
  assert.equal(canvas.moveNode(r.id,b.id),false);
  assert.equal(canvas.moveNode(a.id,b.id),true);
  assert.equal(canvas.findParent(a.id).id,b.id);
  assert.equal(canvas.history.length,2); canvas.undo();
  assert.equal(canvas.findParent(a.id).id,r.id);
});
test("same-parent reorder preserves the exact intended order", () => {
  const {canvas}=canvasFixture();const [a,b,c]=canvas.docData.root.children;
  canvas.moveNode(a.id,c.id,'after');
  assert.deepEqual(Array.from(canvas.docData.root.children,n=>n.id),[b.id,c.id,a.id]);
  canvas.undo(); canvas.moveNode(c.id,a.id,'before');
  assert.deepEqual(Array.from(canvas.docData.root.children,n=>n.id),[c.id,a.id,b.id]);
});
test("collapse hides descendants without dropping serialized content", () => {
  const {canvas,helpers}=canvasFixture(); const a=canvas.docData.root.children[0],nested=a.children[0];
  canvas.toggleCollapse(a.id);
  assert.ok(!canvas.visibleNodes().some(n=>n.id===nested.id));
  assert.ok(helpers.assembleMindMarkdown({data:canvas.docData}).includes('Nested'));
  canvas.undo(); assert.ok(canvas.visibleNodes().some(n=>n.id===nested.id));
});
test("paste branch regenerates all IDs and one undo removes the whole paste", () => {
  const {canvas}=canvasFixture();const a=canvas.docData.root.children[0];
  const text=canvas.copyBranchText(a.id);const before=canvas.docData.root.children.length;
  canvas.pasteBranchText(text,canvas.docData.root.id);
  const added=canvas.docData.root.children.at(-1);
  assert.notEqual(added.id,a.id); assert.notEqual(added.children[0].id,a.children[0].id);
  assert.equal(added.children[0].data.text,'Nested');
  canvas.undo();assert.equal(canvas.docData.root.children.length,before);
});
test("multiline paste preserves indentation and is one transaction", () => {
  const {canvas}=canvasFixture();const r=canvas.docData.root;
  canvas.pasteBranchText('Alpha\n  Beta\nGamma',r.id);
  assert.equal(r.children.at(-2).children[0].data.text,'Beta');
  assert.equal(r.children.at(-1).data.text,'Gamma');
  assert.equal(canvas.history.length,2);
});
test("inspect source blocks corrupt JSON, duplicate IDs, and external outline edits", () => {
  const {helpers}=setupTestContext();const doc=helpers.parseMindMarkdown('# Root\n- One');
  const good=helpers.assembleMindMarkdown(doc);
  assert.equal(helpers.inspectMindSource(good),null);
  assert.match(helpers.inspectMindSource(good.replace('"version":','BROKEN:')),/损坏/);
  assert.match(helpers.inspectMindSource(good.replace('- One','- Changed')),/大纲/);
  doc.data.root.children[0].id=doc.data.root.id;
  assert.match(helpers.inspectMindSource(helpers.assembleMindMarkdown(doc)),/重复/);
});

function savedViewFixture() {
  const {helpers}=setupTestContext();const v=Object.create(helpers.CrispMindEditView.prototype);
  let disk=helpers.assembleMindMarkdown(helpers.parseMindMarkdown('# Root\n- One'));
  const backups=[];let fail=false;
  v.file={path:'test.mind.md',basename:'test.mind',parent:{path:''}};
  v.plugin=helpers.entitle({settings:{autoBackup:true},manifest:{id:'crisp-mind'}});v.renderLockedView=()=>{};
  v.app={vault:{configDir:'.obsidian',adapter:{exists:async()=>true,mkdir:async()=>{},write:async(p,t)=>backups.push(JSON.parse(t))},process:async(file,fn)=>{if(fail)throw Error('disk full');disk=fn(disk);}}};
  v.initViewUI=()=>{};v.requestSave=()=>{};v.notifyPulseContribution=()=>{};
  v.setViewData(disk,true);v.mindDoc.data.root.data.text='Changed';v.dirty=true;
  return {v,helpers,backups,disk:()=>disk,setDisk:s=>disk=s,setFail:b=>fail=b};
}
test('save creates recovery snapshot and persists matching source',async()=>{
  const {v,backups,disk}=savedViewFixture();await v.save();
  assert.equal(v.dirty,false);assert.ok(disk().includes('# Changed'));
  assert.ok(backups.some(b=>b.content.includes('# Root')));
});
test('save refuses changed disk and keeps dirty draft recoverable',async()=>{
  const f=savedViewFixture();f.setDisk('EXTERNAL');await f.v.save();
  assert.equal(f.disk(),'EXTERNAL');assert.equal(f.v.dirty,true);assert.ok(f.v.saveError);
  assert.ok(f.backups.some(b=>b.content.includes('# Changed')));
});
test('failed write retains the draft and a retry saves it',async()=>{
  const f=savedViewFixture();f.setFail(true);await f.v.save();
  assert.equal(f.v.dirty,true);assert.ok(f.v.saveError);
  f.setFail(false);await f.v.save();assert.equal(f.v.dirty,false);
});
test('external update while dirty does not replace local edits',()=>{
  const {v}=savedViewFixture();v.setViewData('external',false);
  assert.equal(v.mindDoc.data.root.data.text,'Changed');assert.ok(v.saveError);
});
test('corrupt managed file remains read-only and byte-preserved',()=>{
  const {v}=savedViewFixture();v.dirty=false;const raw='BROKEN';v.setViewData(raw,true);
  assert.equal(v.readOnly,true);assert.equal(v.getViewData(),raw);
});
test('unlicensed mind views open read-only and keep on-disk content unchanged',async()=>{
  const f=savedViewFixture();
  f.helpers.entitle(f.v.plugin,false);
  f.v.setViewData(f.v.originalData,true);
  assert.equal(f.v.readOnly,true);
  f.v.mindDoc.data.root.data.text='Should not persist';
  f.v.dirty=true;
  assert.equal(f.v.getViewData(),f.v.originalData);
  await f.v.save();
  assert.ok(f.disk().includes('# Root'));
  assert.ok(!f.disk().includes('Should not persist'));
});

test('read-only blocks structural mutation and undo',()=>{
  const {canvas}=canvasFixture();canvas.options.readOnly=true;
  const before=JSON.stringify(canvas.docData);
  canvas.addChildNode();canvas.deleteNode(canvas.docData.root.children[0].id);
  canvas.moveNode(canvas.docData.root.children[0].id,canvas.docData.root.children[1].id);
  canvas.pasteBranchText('One\nTwo');canvas.undo();
  assert.equal(JSON.stringify(canvas.docData),before);
});
test('JSON containing backticks safely round-trips',()=>{
  const {helpers}=setupTestContext();const doc=helpers.parseMindMarkdown('# Root\n- One');
  doc.data.root.children[0].data.text='```javascript';
  const raw=helpers.assembleMindMarkdown(doc);
  assert.equal(helpers.inspectMindSource(raw),null);
  assert.equal(helpers.parseMindMarkdown(raw).data.root.children[0].data.text,'```javascript');
});
test('new edits during an in-flight save remain dirty and save on next pass',async()=>{
  const f=savedViewFixture();let release, started;
  const gate=new Promise(r=>release=r);const ready=new Promise(r=>started=r);
  const process=f.v.app.vault.process;
  f.v.app.vault.process=async(file,fn)=>{started();await gate;return process(file,fn)};
  const saving=f.v.save();await ready;
  f.v.mindDoc.data.root.data.text='Newer';release();await saving;
  assert.equal(f.v.dirty,true);assert.ok(f.disk().includes('# Changed'));
  await f.v.save();assert.equal(f.v.dirty,false);assert.ok(f.disk().includes('# Newer'));
});
test('backup write failure prevents the primary file write',async()=>{
  const f=savedViewFixture();f.v.app.vault.adapter.write=async()=>{throw Error('backup disk full')};
  const before=f.disk();await f.v.save();assert.equal(f.disk(),before);assert.equal(f.v.dirty,true);
});
test('in-flight save stays bound to its original file across view changes',async()=>{
  const f=savedViewFixture();const original=f.v.file;let release,ready;
  const gate=new Promise(r=>release=r);const started=new Promise(r=>ready=r);
  f.v.app.vault.adapter.write=async()=>{ready();await gate};
  let target;const process=f.v.app.vault.process;
  f.v.app.vault.process=async(file,fn)=>{target=file;return process(file,fn)};
  const saving=f.v.save();await started;
  f.v.file={path:'different.mind.md'};release();await saving;
  assert.equal(target,original);
});

const exampleUri='obsidian://open?vault=AI-native%20Knowledge%20System&file=Topics%2Fmain-business%2Fknowledge%2Findex';
test('Obsidian URL converts to a readable native wikilink',()=>{
  const {helpers}=setupTestContext();
  const result=helpers.normalizeMindLinkText(exampleUri,'AI-native Knowledge System');
  assert.equal(result,'[[Topics/main-business/knowledge/index|index]]');
  assert.equal(helpers.mindNodeLink(result).target,'Topics/main-business/knowledge/index');
});
test('URI rejects other actions, missing file, and different vaults',()=>{
  const {helpers}=setupTestContext();
  for(const uri of ['obsidian://new?file=x','obsidian://open?vault=X', 'obsidian://open?vault=Other&file=x'])
    assert.throws(()=>helpers.normalizeMindLinkText(uri,'AI-native Knowledge System'));
});
test('URI paste creates a navigable node in one history step',()=>{
  const {canvas}=canvasFixture();canvas.options.vaultName='AI-native Knowledge System';
  canvas.pasteBranchText(exampleUri,canvas.docData.root.id);
  assert.equal(canvas.docData.root.children.at(-1).data.text,'[[Topics/main-business/knowledge/index|index]]');
  canvas.undo();assert.equal(canvas.docData.root.children.length,3);
});
test('aliases and task prefixes preserve display and destination',()=>{
  const {helpers}=setupTestContext();const link=helpers.mindNodeLink('[ ] 参考 [[Topics/index#章节|索引]]');
  assert.equal(link.target,'Topics/index#章节');assert.equal(link.display,'[ ] 参考 索引');
});

test('task-prefixed Obsidian URLs remain tasks and are clickable',()=>{
  const {helpers}=setupTestContext();const text='[ ] '+exampleUri;
  assert.equal(helpers.normalizeMindLinkText(text,'AI-native Knowledge System'),'[ ] [[Topics/main-business/knowledge/index|index]]');
  assert.equal(helpers.mindNodeLink(text,'AI-native Knowledge System').target,'Topics/main-business/knowledge/index');
});

test('addChildNode expands collapsed parent automatically',()=>{
  const {canvas}=canvasFixture();
  const parent = canvas.docData.root.children[0];
  parent.data.collapsed = true;
  canvas.addChildNode(parent.id);
  assert.equal(parent.data.collapsed, false);
  const newNode = parent.children.at(-1);
  assert.equal(newNode.data.text, '新节点');
  assert.ok(canvas.visibleNodes().some(n => n.id === newNode.id));
});

test('inspectMindSource ignores blank lines and alternative indentation',()=>{
  const {helpers}=setupTestContext();
  const doc = helpers.parseMindMarkdown('# Root\n- One\n  - Sub');
  const good = helpers.assembleMindMarkdown(doc);
  // Blank line between heading and outline
  const withBlank = good.replace('# Root\n', '# Root\n\n');
  assert.equal(helpers.inspectMindSource(withBlank), null);
  // 4 spaces indentation
  const with4Spaces = good.replace('  - Sub', '    - Sub');
  assert.equal(helpers.inspectMindSource(with4Spaces), null);
});

test('exportSVG includes theme background rect',()=>{
  const {canvas}=canvasFixture();
  canvas.calculateLayout();
  let inserted = null;
  const viewport = {
    removeAttribute: () => {},
    insertBefore: (n) => { inserted = n; }
  };
  canvas.svg = {
    cloneNode: () => ({
      setAttribute: () => {},
      removeAttribute: () => {},
      firstElementChild: viewport,
      querySelectorAll: () => [],
      get outerHTML() {
        return `<svg><rect fill="${inserted?.fill}"/></svg>`;
      }
    })
  };
  canvas.document = {
    createElementNS: (ns, tag) => {
      const el = { tag };
      el.setAttribute = (k, v) => { el[k] = v; };
      return el;
    }
  };
  const svg = canvas.exportSVG();
  assert.ok(svg.includes('<rect'));
  assert.ok(svg.includes(`fill="${canvas.theme.backgroundColor}"`));
});

test('extractNodeToTopicContent cleans task prefix and wikilink alias',()=>{
  const {helpers}=setupTestContext();
  const node = {
    id: 'test',
    data: { text: '[ ] 深度思考 [[Topics/tech/ai|AI架构]]' },
    children: []
  };
  const { title } = helpers.extractNodeToTopicContent(node);
  assert.equal(title, '深度思考 AI架构');
});

test('inline editor validation error does not deadlock canvas', () => {
  const { canvas } = canvasFixture();
  const node = canvas.docData.root.children[0];
  let inputEl = null;
  const container = {
    children: [],
    appendChild: (el) => { container.children.push(el); el.parentNode = container; },
    removeChild: (el) => { container.children = container.children.filter(c => c !== el); el.parentNode = null; },
    focus: () => {}
  };
  canvas.container = container;
  canvas.document = {
    createElement: (tag) => {
      if (tag === "textarea") {
        inputEl = {
          style: {},
          setAttribute: () => {},
          focus: () => {},
          select: () => {},
          addEventListener: (event, handler) => { inputEl[event] = handler; },
          value: ''
        };
        return inputEl;
      }
      return { getContext: () => null, style: {}, setAttribute: () => {} };
    }
  };
  canvas.editNodeText(node);
  assert.ok(canvas.editor);
  assert.equal(inputEl.parentNode, container);
  // Invalid obsidian URL
  inputEl.value = 'obsidian://invalid';
  // Trigger blur
  inputEl.blur();
  assert.equal(canvas.editor, null, 'Editor must be cleared on blur error');
  assert.equal(inputEl.parentNode, null, 'Input element must be removed from parent');
});

test('40. CrispMindLicenseManager validates initial status, empty code and clearing', async () => {
  const { helpers } = setupTestContext();
  const settings = { licenseCode: '' };
  const manager = new helpers.CrispMindLicenseManager({}, settings);
  assert.equal(manager.getStatus().valid, false);

  const emptyRes = await manager.activate('');
  assert.equal(emptyRes.valid, false);
  assert.match(emptyRes.reason, /授权码为空/);

  const invalidRes = await manager.activate('bad.token');
  assert.equal(invalidRes.valid, false);

  manager.clear();
  assert.equal(settings.licenseCode, '');
  assert.equal(manager.getStatus().valid, false);
});

test('40a. local-only verification accepts a valid code and does not reach the network', async () => {
  const { helpers } = setupTestContext(licensePublicPem);
  const res = await helpers.verifyLicenseCode(makeLicenseCode(), 'crisp-mind', {}, null, { online: false });
  assert.equal(res.valid, true);
  assert.equal(res.source, 'local');
});

test('40b. a single-plugin license for another plugin is rejected by Crisp Mind', async () => {
  const { helpers } = setupTestContext(licensePublicPem);
  const res = await helpers.verifyLicenseCode(
    makeLicenseCode({ features: ['crisp-focus'] }), 'crisp-mind', {}, null, { online: false });
  assert.equal(res.valid, false);
  assert.match(res.reason, /未包含 crisp-mind 权限/);
});

test('40c. candidate scan dedupes codes and drops malformed ones', () => {
  const { helpers } = setupTestContext(licensePublicPem);
  const good = makeLicenseCode();
  const app = { plugins: { plugins: {
    'crisp-pulse': { settings: { licenseCode: good } },
    'crisp-focus': { settings: { licenseCode: good } },
    'crisp-base': { settings: { licenseCode: 'no-signature-part' } },
    'crisp-recall': { settings: {} },
  } } };
  assert.deepEqual([...helpers.collectVaultCrispLicenseCandidates(app)], [good]);
});

test('40d. inheritance skips a license that does not cover Crisp Mind and adopts the usable one', async () => {
  const { helpers } = setupTestContext(licensePublicPem);
  const otherScoped = makeLicenseCode({ licenseId: 'SCOPED-ELSEWHERE', features: ['crisp-focus'] });
  const family = makeLicenseCode({ licenseId: 'FAMILY', features: ['all'] });
  const app = { plugins: { plugins: {
    'crisp-pulse': { settings: { licenseCode: otherScoped } },
    'crisp-focus': { settings: { licenseCode: family } },
  } } };
  const adopted = await helpers.discoverVaultCrispLicense(app);
  assert.equal(adopted, family, 'the first *usable* candidate must win, not the first found');
});

test('40e. inheritance adopts nothing when no candidate covers Crisp Mind', async () => {
  const { helpers } = setupTestContext(licensePublicPem);
  const app = { plugins: { plugins: {
    'crisp-pulse': { settings: { licenseCode: makeLicenseCode({ features: ['crisp-asr'] }) } },
  } } };
  assert.equal(await helpers.discoverVaultCrispLicense(app), null);
});

test('41. Completed tasks [x] receive task styling and strikethrough', () => {
  const { canvas } = canvasFixture();
  const node = canvas.docData.root.children[0];
  node.data.text = '[x] 已完成的核心交付';
  let hasStrikethrough = false;
  let addedCompletedClass = false;
  canvas.nodesGroup = { appendChild: () => {} };
  canvas.linesGroup = { appendChild: () => {} };
  canvas.document = {
    createElementNS: (ns, tag) => {
      const el = {
        tag,
        classList: { add(cls) { if (cls === 'is-task-completed') addedCompletedClass = true; } },
        setAttribute(k, v) { if (k === 'text-decoration' && v === 'line-through') hasStrikethrough = true; },
        appendChild: () => {},
        addEventListener: () => {},
        style: {}
      };
      return el;
    }
  };
  canvas.renderBranch(node);
  assert.ok(addedCompletedClass, 'Node group should receive is-task-completed class');
  assert.ok(hasStrikethrough, 'Text element should receive line-through decoration');
});

test('42. renderAboutCard injects attribution notice and official letschips links', () => {
  const { helpers } = setupTestContext();
  const container = {
    children: [],
    append(child) { this.children.push(child); }
  };
  const doc = {
    createElement(tag) {
      return {
        tagName: tag,
        className: '',
        textContent: '',
        href: '',
        target: '',
        rel: '',
        children: [],
        append(...items) { this.children.push(...items); }
      };
    }
  };
  container.ownerDocument = doc;
  helpers.renderAboutCard(container, 'Crisp Mind', '本地优先思维导图', '1.2.0');
  assert.equal(container.children.length, 1);
  const card = container.children[0];
  assert.equal(card.className, 'crisp-mind-about');
});

test('43. Timeline layout calculates milestone alternating coordinates and horizontal axis', () => {
  const { canvas } = canvasFixture();
  canvas.docData.root.children = [
    { id: 'm1', data: { text: '2024 Q1 启动' }, children: [] },
    { id: 'm2', data: { text: '2024 Q2 迭代' }, children: [] },
    { id: 'm3', data: { text: '2024 Q3 发布' }, children: [] }
  ];
  canvas.layout = 'timeline';
  canvas.calculateLayout();

  assert.equal(canvas.docData.root._x, 0);
  assert.equal(canvas.docData.root._y, 0);
  assert.ok(canvas._timelineAxis, 'Timeline axis object should be computed');
  assert.ok(canvas._timelineAxis.endX > canvas._timelineAxis.startX, 'Axis should extend to right');

  const m1 = canvas.docData.root.children[0];
  const m2 = canvas.docData.root.children[1];
  const m3 = canvas.docData.root.children[2];

  assert.ok(m1._y < canvas._timelineAxis.y, 'Even index milestone 1 should be above timeline axis');
  assert.ok(m2._y > canvas._timelineAxis.y, 'Odd index milestone 2 should be below timeline axis');
  assert.ok(m3._y < canvas._timelineAxis.y, 'Even index milestone 3 should be above timeline axis');
  assert.ok(m2._x > m1._x, 'Milestones should be arranged chronologically from left to right');
  assert.ok(m3._x > m2._x, 'Milestones should be arranged chronologically from left to right');
});

test('44. Fishbone layout calculates right-side fish head and slanted bones', () => {
  const { canvas } = canvasFixture();
  canvas.docData.root.children = [
    { id: 'b1', data: { text: '人员因素' }, children: [{ id: 's1', data: { text: '培训不足' }, children: [] }] },
    { id: 'b2', data: { text: '设备因素' }, children: [{ id: 's2', data: { text: '老化故障' }, children: [] }] }
  ];
  canvas.layout = 'fishbone';
  canvas.calculateLayout();

  const root = canvas.docData.root;
  assert.ok(canvas._fishboneAxis, 'Fishbone spine axis should be computed');
  assert.ok(root._x >= canvas._fishboneAxis.endX, 'Fish head should be placed on the far right');

  const b1 = canvas.docData.root.children[0];
  const b2 = canvas.docData.root.children[1];

  assert.ok(b1._y < canvas._fishboneAxis.y, 'b1 should be in the upper half of fishbone');
  assert.ok(b2._y > canvas._fishboneAxis.y, 'b2 should be in the lower half of fishbone');
  assert.ok(b1._spineConnectX, 'b1 should have spine connection coordinate');
  assert.ok(b2._spineConnectX, 'b2 should have spine connection coordinate');
});

test("fishbone layout keeps branch bones clear of their child node boxes", () => {
  const { canvas } = canvasFixture();
  const leaf = (id, text) => ({id, data: {text}, children: []});
  canvas.docData.root.children = [
    {id: "upper", data: {text: "Upper factor"}, children: []},
    {id: "lower", data: {text: "Storage separation"}, children: [
      leaf("storage-a", "Markdown notes"),
      leaf("storage-b", "Media sidecar"),
      leaf("storage-c", "URI links")
    ]}
  ];
  canvas.layout = "fishbone";
  canvas.calculateLayout();
  const nodes = canvas.visibleNodes();
  const overlaps = [];
  for (let first = 0; first < nodes.length; first++) {
    for (let second = first + 1; second < nodes.length; second++) {
      const a = nodes[first], b = nodes[second];
      const width = Math.min(a._x + a._w, b._x + b._w) - Math.max(a._x, b._x);
      const height = Math.min(a._y + a._h, b._y + b._h) - Math.max(a._y, b._y);
      if (width > 0 && height > 0) overlaps.push([a.id, b.id]);
    }
  }
  assert.deepEqual(overlaps, []);
});

test("bottom toolbar collapses and expands every branch as one undoable action", () => {
  const {canvas, helpers} = canvasFixture();
  const buttons = [];
  const toolbarEl = {
    innerHTML: "",
    createDiv() { return {}; },
    createEl() {
      const attrs = {};
      const record = {attrs, click: null};
      buttons.push(record);
      return {
        setAttribute(name, value) { attrs[name] = value; },
        addEventListener(event, callback) { if (event === "click") record.click = callback; }
      };
    }
  };
  const view = Object.create(helpers.CrispMindEditView.prototype);
  Object.assign(view, {toolbarEl, canvasController: canvas, readOnly: false});
  view.renderToolbar();
  const collapse = buttons.find(button => button.attrs["aria-label"] === "收起所有分支");
  const expand = buttons.find(button => button.attrs["aria-label"] === "展开所有分支");
  assert.equal(typeof collapse?.click, "function");
  assert.equal(typeof expand?.click, "function");

  const root = canvas.docData.root;
  const nonRootBranches = () => {
    const branches = [];
    const collectBranches = node => {
      if (node.children?.length) branches.push(node);
      (node.children || []).forEach(collectBranches);
    };
    collectBranches(canvas.docData.root);
    return branches.filter(node => node.id !== canvas.docData.root.id);
  };
  collapse.click();
  assert.equal(root.data.collapsed, false);
  assert.ok(nonRootBranches().every(node => node.data.collapsed));
  assert.deepEqual([...canvas.visibleNodes()].map(node => node.id), [root.id, ...root.children.map(node => node.id)]);

  expand.click();
  assert.ok(canvas.visibleNodes().some(node => node.id === root.children[0].children[0].id));
  canvas.undo();
  assert.ok(nonRootBranches().every(node => node.data.collapsed), "one undo should reverse the bulk expand");
  canvas.redo();
  assert.ok(canvas.visibleNodes().some(node => node.id === root.children[0].children[0].id));
});

test('45. CrispMindExporter computes accurate BoundingBox and generates standalone SVG', () => {
  const { helpers } = setupTestContext();
  const { canvas } = canvasFixture();
  canvas.calculateLayout();
  const mockView = { canvasController: canvas };
  const exporter = new helpers.CrispMindExporter(mockView);

  const bbox = exporter.getBoundingBox(40);
  assert.ok(bbox.width > 0, 'BoundingBox width should be positive');
  assert.ok(bbox.height > 0, 'BoundingBox height should be positive');
  assert.ok(bbox.viewBox.includes(`${bbox.width} ${bbox.height}`), 'viewBox should match dimensions');

  const svgRes = exporter.toSvg({ padding: 30, transparent: false });
  assert.ok(svgRes.svgString.startsWith('<?xml version="1.0"'), 'SVG should have XML header');
  assert.ok(svgRes.svgString.includes('<svg xmlns="http://www.w3.org/2000/svg"'), 'SVG should have xmlns');
  assert.ok(svgRes.svgString.includes('viewBox='), 'SVG should include viewBox');
  assert.ok(svgRes.svgString.includes('crisp-mind-export-nodes'), 'SVG should wrap nodes');
});

test('45a. Crisp Paper exports its dot texture with the selected paper background', () => {
  const { helpers } = setupTestContext();
  const { canvas } = canvasFixture();
  canvas.setTheme('crisp-paper');
  canvas.calculateLayout();
  const exporter = new helpers.CrispMindExporter({ canvasController: canvas });
  const svg = exporter.toSvg({ padding: 30, transparent: false }).svgString;
  assert.ok(svg.includes('id="crisp-paper-grid"'), 'Paper pattern definition should be exported');
  assert.ok(svg.includes('fill="url(#crisp-paper-grid)"'), 'Paper texture overlay should use the pattern');
  assert.ok(svg.includes(`fill="${canvas.theme.backgroundColor}"`), 'Export should retain the paper background color');
});

test('45b. Exporter includes boundaries, relations, and summaries', () => {
  const { helpers } = setupTestContext();
  const { canvas } = canvasFixture();
  canvas.calculateLayout();
  canvas.boundaryGroup = { innerHTML: '<g data-export="boundary"></g>' };
  canvas.linesGroup = { innerHTML: '' };
  canvas.relationsGroup = { innerHTML: '<g data-export="relation"></g>' };
  canvas.nodesGroup = { innerHTML: '' };
  canvas.annotationsGroup = { innerHTML: '<g data-export="summary"></g>' };
  const exporter = new helpers.CrispMindExporter({ canvasController: canvas });
  const svg = exporter.toSvg().svgString;
  assert.ok(svg.includes('crisp-mind-export-boundaries'));
  assert.ok(svg.includes('data-export="boundary"'));
  assert.ok(svg.includes('crisp-mind-export-relations'));
  assert.ok(svg.includes('data-export="relation"'));
  assert.ok(svg.includes('crisp-mind-export-annotations'));
  assert.ok(svg.includes('data-export="summary"'));
});

test('46. CrispMindExporter buildPdfBinary outputs standard valid PDF-1.4 binary', () => {
  const { helpers } = setupTestContext();
  const dummyJpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0xFF, 0xD9]);
  const pdfBuffer = helpers.CrispMindExporter.buildPdfBinary(dummyJpegBytes, 800, 600, 600, 450);

  assert.ok(pdfBuffer && pdfBuffer.byteLength > 0, 'Output must be an ArrayBuffer with positive byteLength');
  const text = Buffer.from(pdfBuffer).toString('binary');
  assert.ok(text.startsWith('%PDF-1.4'), 'PDF should begin with %PDF-1.4');
  assert.ok(text.includes('/Type /Catalog'), 'PDF should define Catalog');
  assert.ok(text.includes('/Type /Pages'), 'PDF should define Pages');
  assert.ok(text.includes('/Type /Page'), 'PDF should define Page');
  assert.ok(text.includes('/Type /XObject'), 'PDF should embed Image XObject');
  assert.ok(text.includes('/Filter /DCTDecode'), 'PDF should use DCTDecode filter for JPEG stream');
  assert.ok(text.includes('xref'), 'PDF should contain xref table');
  assert.ok(text.includes('trailer'), 'PDF should contain trailer');
  assert.ok(text.trim().endsWith('%%EOF'), 'PDF should terminate with %%EOF');
});



test('editor frame matches node geometry at 125 percent without minimum-width inflation',()=>{
  const {helpers}=setupTestContext();
  const frame=helpers.inlineEditorFrame({_x:100,_y:80,_w:100,_h:38},1.25,0,0,800,600);
  assert.equal(frame.width,125);assert.equal(frame.height,47.5);
  assert.equal(frame.left,125);assert.equal(frame.top,100);
});
test('editor near the viewport edge pans the whole canvas rather than detaching from its node',()=>{
  const {helpers}=setupTestContext();const node={_x:600,_y:500,_w:160,_h:38};
  const frame=helpers.inlineEditorFrame(node,1.25,0,0,800,600);
  assert.equal(frame.left,node._x*frame.scale+frame.translateX);
  assert.equal(frame.top,node._y*frame.scale+frame.translateY);
  assert.ok(frame.left+frame.width<=792);assert.ok(frame.top+frame.height<=592);
});
test('viewport transform keeps active editor aligned with its node',()=>{
  const {canvas}=canvasFixture();canvas.calculateLayout();
  const n=canvas.docData.root.children[0];canvas.editorNodeId=n.id;canvas.editor={style:{}};
  canvas.viewportGroup={setAttribute(){}};canvas.scale=1.25;canvas.translateX=90;canvas.translateY=70;
  canvas.updateTransform();
  assert.equal(canvas.editor.style.left,`${n._x*1.25+90}px`);
  assert.equal(canvas.editor.style.top,`${n._y*1.25+70}px`);
  assert.equal(canvas.editor.style.height,`${n._h*1.25}px`);
});

test("presentation reveals collapsed ancestors without changing saved folds", () => {
  const { canvas, changes } = canvasFixture();
  const parent = canvas.docData.root.children[0], nested = parent.children[0];
  parent.data.collapsed = true;
  canvas.container = { clientWidth: 900, clientHeight: 700 };
  canvas.setPresentationSteps([{ nodeId: nested.id }]);
  const before = changes();
  canvas.startPresentation();
  assert.ok(canvas.visibleNodes().includes(nested));
  assert.ok(Number.isFinite(canvas.translateX) && Number.isFinite(canvas.translateY));
  assert.equal(parent.data.collapsed, true);
  assert.equal(changes(), before);
  canvas.stopPresentation();
  assert.ok(!canvas.visibleNodes().includes(nested));
});

test("outline navigation reveals a hidden node and leaves unrelated branch focus", () => {
  const { canvas, changes } = canvasFixture();
  const [parent, other] = canvas.docData.root.children, nested = parent.children[0];
  parent.data.collapsed = true;
  canvas.container = { clientWidth: 900, clientHeight: 700 };
  canvas.setBranchFocus(other.id);
  const before = changes();
  canvas.selectNode(nested.id, true);
  assert.equal(canvas.branchFocusId, null);
  assert.ok(canvas.visibleNodes().includes(nested));
  assert.ok(Number.isFinite(canvas.translateX) && Number.isFinite(canvas.translateY));
  assert.equal(parent.data.collapsed, true);
  assert.equal(changes(), before);
});

test("deleting a selected parent and child selects a surviving ancestor", () => {
  const { canvas } = canvasFixture();
  const root = canvas.docData.root, parent = root.children[0], nested = parent.children[0];
  canvas.setNodeSelection([parent.id, nested.id], nested.id);
  canvas.deleteSelectedNodes();
  assert.equal(canvas.selectedNodeId, root.id);
  canvas.undo();
  assert.ok(canvas.findNode(nested.id));
});

test("outline filtering visits every matching sibling branch", () => {
  const { canvas, helpers } = canvasFixture();
  canvas.docData.root.children.forEach(n => { n.data.text = "Match " + n.data.text; });
  const labels = [];
  const element = () => ({
    style: { setProperty() {} }, classList: { add() {} },
    empty() { labels.length = 0; }, setAttribute() {}, addEventListener() {},
    createDiv() { return element(); }, createEl() { return element(); },
    createSpan(options) { if (options?.cls === "crisp-mind-outline-text") labels.push(options.text); return element(); }
  });
  const view = Object.create(helpers.CrispMindEditView.prototype);
  Object.assign(view, { canvasController: canvas, outlinePanelEl: element(), outlineTreeEl: element(), outlineFilterEl: { value: "Match" } });
  view.renderOutline();
  assert.deepEqual(labels, ["Root", "Match One", "Match Two", "Match Three"]);
});


test("deleting a selected ancestor also skips unselected parents of the primary node", () => {
  const { canvas } = canvasFixture();
  const root = canvas.docData.root, parent = root.children[0], middle = parent.children[0];
  middle.children = [{ id: "deep-node", data: { text: "Deep" }, children: [] }];
  canvas.setNodeSelection([parent.id, "deep-node"], "deep-node");
  canvas.deleteSelectedNodes();
  assert.equal(canvas.selectedNodeId, root.id);
});

test("a temporarily revealed branch can be collapsed with one toggle", () => {
  const { canvas } = canvasFixture();
  const parent = canvas.docData.root.children[0], nested = parent.children[0];
  parent.data.collapsed = true;
  canvas.selectNode(nested.id, true);
  canvas.toggleCollapse(parent.id);
  assert.ok(!canvas.visibleNodes().includes(nested));
  assert.equal(parent.data.collapsed, true);
  canvas.toggleCollapse(parent.id);
  assert.ok(canvas.visibleNodes().includes(nested));
});

test('multiline node text survives save, validation, reopen, and layout', () => {
  const { canvas, helpers } = canvasFixture();
  const node = canvas.docData.root.children[0];
  node.data.text = '第一行\n- 仍是同一节点\n第三行';
  const saved = helpers.assembleMindMarkdown({data:canvas.docData});
  assert.equal(helpers.inspectMindSource(saved), null);
  const reopened = helpers.parseMindMarkdown(saved);
  assert.equal(reopened.data.root.children[0].data.text, node.data.text);
  canvas.calculateLayout();
  assert.equal(node._lines.length, 3);
});

function multilineEditorFixture(registerEditorHotkeys) {
  const { canvas, helpers } = canvasFixture();
  const node = canvas.docData.root.children[0];
  const events = {};
  const el = {style:{},value:'',scrollHeight:72, selectionStart:0,selectionEnd:0,
    setAttribute(){},focus(){},select(){}, addEventListener(type,fn){events[type]=fn;},
    setRangeText(text,start,end){this.value=this.value.slice(0,start)+text+this.value.slice(end);this.selectionStart=this.selectionEnd=start+text.length;}
  };
  canvas.container={clientWidth:900,clientHeight:700,focus(){},appendChild(e){e.parentNode=this;},removeChild(e){e.parentNode=null;}};
  canvas.document={createElement(tag){if(tag==='canvas')return {getContext:()=>null};el.tagName=tag;return el;}};
  canvas.options.registerEditorHotkeys = registerEditorHotkeys;
  canvas.editNodeText(node);
  const key = (options={}) => {let prevented=false;events.keydown({key:'Enter',stopPropagation(){},preventDefault(){prevented=true;},...options});return prevented;};
  return {canvas,node,el,events,key,helpers};
}
for (const modifier of ['metaKey','ctrlKey']) test(`${modifier}+Enter inserts a newline at the selection without committing`, () => {
  const {canvas,node,el,key}=multilineEditorFixture();
  assert.equal(el.tagName,'textarea');
  el.value='Hello world';el.selectionStart=5;el.selectionEnd=6;
  assert.equal(key({[modifier]:true}),true);
  assert.equal(el.value,'Hello\nworld');
  assert.ok(canvas.editor);
  assert.equal(node.data.text,'One');
  assert.equal(key(),true);
  assert.equal(node.data.text,'Hello\nworld');
  assert.equal(canvas.editor,null);
  canvas.undo();assert.equal(canvas.docData.root.children[0].data.text,'One');
});
test('multiline editor preserves IME composition and Escape cancels the draft', () => {
  const {canvas,node,el,key}=multilineEditorFixture();
  el.value='Draft\ntext';
  assert.equal(key({metaKey:true,isComposing:true}),false);
  assert.ok(canvas.editor);
  key({key:'Escape'});
  assert.equal(node.data.text,'One');assert.equal(canvas.editor,null);
});


test('editor-scoped hotkeys insert breaks and are disposed on commit and cancel', () => {
  for (const keyName of ['Enter', 'Escape']) {
    let handler, disposed = 0;
    const {el, key} = multilineEditorFixture(callback => {handler=callback;return ()=>disposed++;});
    el.value='OneTwo';el.selectionStart=el.selectionEnd=3;
    handler();assert.equal(el.value,'One\nTwo');
    key({key:keyName});assert.equal(disposed,1);
    handler();assert.equal(el.value,'One\nTwo');
  }
});

test('copy between maps preserves hard breaks, notes, styles, and descendants', async () => {
  const source=canvasFixture().canvas, target=canvasFixture().canvas;
  const clipboardStore={};let text='';
  for(const c of [source,target]){c.options.clipboardStore=clipboardStore;c.window={navigator:{clipboard:{async writeText(value){text=value;},async readText(){return text;}}}};}
  const node=source.docData.root.children[0];
  node.data.text='First\nSecond';node.data.note='Context';node.data.style={fill:'#abcdef'};
  source.selectNode(node.id);
  await source.clipboardAction('copy');
  target.selectNode(target.docData.root.id);
  await target.clipboardAction('paste');
  const pasted=target.docData.root.children.at(-1);
  assert.equal(pasted.data.text,node.data.text);assert.equal(pasted.data.note,'Context');
  assert.equal(pasted.data.style.fill,'#abcdef');assert.notEqual(pasted.id,node.id);
  assert.notEqual(pasted.children[0].id,node.children[0].id);
  target.undo();assert.equal(target.docData.root.children.length,3);
  target.redo();assert.equal(target.docData.root.children.at(-1).data.text,'First\nSecond');
});

test('cut never deletes a branch changed while the clipboard write is pending', async () => {
  const {canvas}=canvasFixture();const node=canvas.docData.root.children[0];
  let complete;canvas.window={navigator:{clipboard:{writeText(){return new Promise(r=>complete=r);}}}};
  canvas.selectNode(node.id);const pending=canvas.clipboardAction('cut');
  node.data.note='New unsaved context';complete();await pending;
  assert.ok(canvas.findNode(node.id));assert.equal(node.data.note,'New unsaved context');
});

test('pending paste does not mutate a destroyed canvas', async () => {
  const {canvas}=canvasFixture();let complete;
  canvas.window={navigator:{clipboard:{readText(){return new Promise(r=>complete=r);}}}};
  canvas.selectNode(canvas.docData.root.id);
  const pending=canvas.clipboardAction('paste');canvas.destroy();complete('- Late node');await pending;
  assert.equal(canvas.docData.root.children.length,3);
});

test('failed clipboard writes do not publish a rich branch to other maps', async () => {
  const {canvas}=canvasFixture();const clipboardStore={};canvas.options.clipboardStore=clipboardStore;
  canvas.window={navigator:{clipboard:{async writeText(){throw Error('denied');}}}};
  canvas.selectNode(canvas.docData.root.children[0].id);await canvas.clipboardAction('copy');
  assert.equal(clipboardStore.snapshot,undefined);
});

test('unchanged cut still deletes once and can be undone', async () => {
  const {canvas}=canvasFixture();const node=canvas.docData.root.children[0];
  canvas.window={navigator:{clipboard:{async writeText(){}}}};
  canvas.selectNode(node.id);await canvas.clipboardAction('cut');
  assert.equal(canvas.findNode(node.id),null);
  canvas.undo();assert.ok(canvas.findNode(node.id));
});

test('plain external text remains ordinary outline paste when the rich snapshot differs', () => {
  const {canvas}=canvasFixture();canvas.options.clipboardStore={snapshot:{text:'- Old',node:{id:'old',data:{text:'Old',note:'Private note'},children:[]}}};
  canvas.pasteBranchText('- External',canvas.docData.root.id);
  const pasted=canvas.docData.root.children.at(-1);
  assert.equal(pasted.data.text,'External');assert.equal(pasted.data.note,undefined);
});

/* ---------- 1.5.2 regressions ---------- */

// Runs the real render() (canvasFixture stubs it) against fake SVG groups.
function renderForReal(canvas, helpers) {
  canvas.document = { createElementNS: (_n, tag) => fakeSvgNode(tag) };
  for (const key of ["linesGroup", "nodesGroup", "boundaryGroup", "relationsGroup", "annotationsGroup"]) {
    canvas[key] = Object.assign(fakeSvgNode("g"), { innerHTML: "" });
  }
  canvas.container = { style: { setProperty() {}, removeProperty() {} }, classList: { toggle() {} } };
  canvas.nodeElements = new Map();
  canvas.theme = helpers.getComputedThemeConfig("crisp-nord");
  setupTestContext().helpers.CrispMindCanvas.prototype.render.call(canvas);
  return canvas;
}

test("fishbone: a bone child moved one level deeper drops its old spine anchor", () => {
  const { canvas, helpers } = canvasFixture();
  canvas.docData.root.children = [{ id: "b1", data: { text: "B1" }, children: [
    { id: "s1", data: { text: "S1" }, children: [] },
    { id: "s2", data: { text: "S2" }, children: [] }] }];
  canvas.setLayout("fishbone");
  assert.ok(canvas.moveNode("s2", "s1", "inside"));
  canvas.calculateLayout();
  const s1 = canvas.findNode("s1"), s2 = canvas.findNode("s2");
  assert.equal(s2._boneConnectX, undefined, "level-3 node must not keep a bone anchor");
  renderCanvasToFakeSvg(canvas, helpers);
  const edge = canvas.linesGroup.children.at(-1).attrs.d;
  const startX = Number(edge.match(/^M ([\d.-]+)/)[1]);
  assert.ok(Math.abs(startX - s1._x) < 3, `S1→S2 edge should start at S1's left edge (${s1._x}), got ${startX}`);
});

test("timeline: collapsing the root removes the milestone dots", () => {
  const { canvas, helpers } = canvasFixture();
  canvas.setLayout("timeline");
  renderForReal(canvas, helpers);
  assert.equal(canvas.linesGroup.children.filter(n => n.tag === "circle").length, 3);
  canvas.docData.root.data.collapsed = true;
  renderForReal(canvas, helpers);
  assert.equal(canvas.linesGroup.children.filter(n => n.tag === "circle").length, 0);
});

test("fishbone branch focus draws bones from the spine of the focused root", () => {
  const { canvas, helpers } = canvasFixture();
  canvas.docData.root.children[0].children = [
    { id: "f1", data: { text: "F1" }, children: [] },
    { id: "f2", data: { text: "F2" }, children: [] }];
  canvas.setLayout("fishbone");
  canvas.branchFocusId = canvas.docData.root.children[0].id;
  renderForReal(canvas, helpers);
  const bone = canvas.findNode("f1");
  const firstEdge = canvas.linesGroup.children.find(n => n.tag === "path" && / Z$/.test(n.attrs.d || "") && n.attrs["data-branch-depth"]);
  const startX = Number(firstEdge.attrs.d.match(/^M ([\d.-]+)/)[1]);
  assert.ok(Math.abs(startX - bone._spineConnectX) < 3, `bone edge should start on the spine (${bone._spineConnectX}), got ${startX}`);
});

test("export captures the map without selection outlines and restores the selection", () => {
  const { helpers } = setupTestContext();
  const seen = [];
  const controller = {
    selectedNodeIds: new Set(["a", "b"]), selectedNodeId: "a", selectionAnchorId: "a",
    render() { seen.push(this.selectedNodeIds.size); },
    theme: {}, nodesGroup: { innerHTML: "" }
  };
  const exporter = new helpers.CrispMindExporter({ canvasController: controller });
  exporter.getBoundingBox = () => ({ minX: 0, minY: 0, width: 10, height: 10, viewBox: "0 0 10 10", padding: 0 });
  exporter.toSvg();
  assert.deepEqual(seen, [0, 2], "render once clean for capture, once to restore");
  assert.equal(controller.selectedNodeId, "a");
  assert.deepEqual([...controller.selectedNodeIds], ["a", "b"]);
});

test("export bakes a concrete font stack instead of the undefined CSS variable", () => {
  const { helpers } = setupTestContext();
  const controller = { theme: {}, nodesGroup: { innerHTML: '<text font-family="var(--font-interface)" style="font-family: var(--font-interface);">A</text>' } };
  const exporter = new helpers.CrispMindExporter({ canvasController: controller });
  exporter.getBoundingBox = () => ({ minX: 0, minY: 0, width: 10, height: 10, viewBox: "0 0 10 10", padding: 0 });
  const svg = exporter.toSvg().svgString;
  assert.doesNotMatch(svg, /var\(--font-interface\)/);
  assert.doesNotMatch(svg, /font-family="[^"]*"[^ >]*"/, "attribute quoting stays valid");
});

test("export background stays opaque when the window theme is translucent", () => {
  const { helpers } = setupTestContext();
  assert.equal(helpers.exportBackgroundColor({ backgroundColor: "transparent", solidBackground: "#202020" }), "#202020");
  assert.equal(helpers.exportBackgroundColor({ backgroundColor: "#f6f1e8" }), "#f6f1e8");
  assert.equal(helpers.exportBackgroundColor({}), "#ffffff");
});

test("export to vault never overwrites and strips the .mind suffix at the vault root", async () => {
  const { helpers } = setupTestContext();
  const existing = new Set(["Map.png", "Map 2.png", "Maps/Plan.png"]);
  const vault = { getAbstractFileByPath: p => existing.has(p) ? {} : null, adapter: { exists: async () => false } };
  assert.equal(await helpers.exportTargetPath(vault, "/", "Map", "png"), "Map 3.png");
  assert.equal(await helpers.exportTargetPath(vault, "", "Fresh", "svg"), "Fresh.svg");
  assert.equal(await helpers.exportTargetPath(vault, "Maps", "Plan", "png"), "Maps/Plan 2.png");
});

test("snapshots keep only the newest per file and leave other files and legacy snapshots alone", async () => {
  const { helpers } = setupTestContext();
  const files = new Map();
  const folder = ".obsidian/plugins/crisp-mind/backups";
  files.set(`${folder}/1000-node-legacy.json`, "{}");
  const otherKey = helpers.snapshotSourceKey("Other.mind.md");
  files.set(`${folder}/1001-${otherKey}-node-other.json`, "{}");
  const adapter = {
    exists: async p => p === folder || files.has(p),
    mkdir: async () => {},
    write: async (p, c) => { files.set(p, c); },
    list: async () => ({ files: [...files.keys()], folders: [] }),
    remove: async p => { files.delete(p); }
  };
  const view = Object.create(helpers.CrispMindEditView.prototype);
  view.app = { vault: { adapter, configDir: ".obsidian" } };
  const file = { path: "Map.mind.md" };
  // The plugin runs in its own vm realm with its own Date; space writes out in real time.
  for (let i = 0; i < helpers.MIND_SNAPSHOT_LIMIT + 5; i++) {
    await view.writeSnapshot(`v${i}`, "before-save", file);
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  const ownKey = helpers.snapshotSourceKey(file.path);
  const own = [...files.keys()].filter(p => p.includes(`-${ownKey}-`)).sort();
  assert.equal(own.length, helpers.MIND_SNAPSHOT_LIMIT);
  assert.equal(JSON.parse(files.get(own.at(-1))).content, `v${helpers.MIND_SNAPSHOT_LIMIT + 4}`, "newest kept");
  assert.equal(JSON.parse(files.get(own[0])).content, "v5", "oldest five pruned");
  assert.ok(files.has(`${folder}/1000-node-legacy.json`));
  assert.ok(files.has(`${folder}/1001-${otherKey}-node-other.json`));
});

function fakeModalEl() {
  const el = {
    listeners: {}, children: [], value: "",
    empty() {}, addClass() {}, focus() {}, select() {},
    createEl(tag, opts) { const c = fakeModalEl(); c.tag = tag; c.opts = opts; el.children.push(c); return c; },
    createDiv(opts) { return el.createEl("div", opts); },
    addEventListener(type, fn) { el.listeners[type] = fn; },
    querySelector() { return null; },
    click() { el.listeners.click?.(); }
  };
  return el;
}

test("IME Enter that confirms a candidate does not submit the prompt dialog", () => {
  const { helpers } = setupTestContext();
  const submitted = [];
  const modal = new helpers.CrispMindPromptModal({}, { onSubmit: v => submitted.push(v) });
  modal.contentEl = fakeModalEl();
  modal.onOpen();
  modal.inputEl.value = "边界";
  const press = extra => modal.inputEl.listeners.keydown({ key: "Enter", preventDefault() {}, ...extra });
  press({ isComposing: true, keyCode: 229 });
  assert.deepEqual(submitted, []);
  press({});
  assert.deepEqual(submitted, ["边界"]);
});

function keyboardFixture({ readOnly = false } = {}) {
  const { canvas, helpers } = canvasFixture();
  canvas.options.readOnly = readOnly;
  const handlers = {};
  const target = { addEventListener(type, fn) { (handlers[type] ||= []).push(fn); }, removeEventListener() {} };
  canvas.nodesGroup = target; canvas.window = target;
  canvas.container = Object.assign({}, target, { focus() {}, clientWidth: 800, clientHeight: 600 });
  canvas.bindEvents();
  const press = (key, extra = {}) => handlers.keydown.forEach(fn => fn({
    key, target: { closest: () => null }, preventDefault() {}, stopPropagation() {}, ...extra
  }));
  return { canvas, helpers, press };
}

test("Esc with nothing selected leaves branch focus", () => {
  const { canvas, press } = keyboardFixture();
  canvas.resetZoom = () => {};
  canvas.setBranchFocus(canvas.docData.root.children[0].id);
  press("Escape");
  assert.ok(canvas.branchFocusId, "first Esc clears the selection only");
  assert.equal(canvas.selectedNodeIds.size, 0);
  press("Escape");
  assert.equal(canvas.branchFocusId, null);
});

test("F folds a branch in read-only preview without touching history", () => {
  const { canvas, press } = keyboardFixture({ readOnly: true });
  const branch = canvas.docData.root.children[0];
  canvas.setSelectionState([branch.id], branch.id);
  const historyLength = canvas.history.length;
  press("f");
  assert.equal(branch.data.collapsed, true);
  assert.equal(canvas.history.length, historyLength);
});

test("read-only node menu still offers opening the linked note and copying", () => {
  const plugin = setupTestContext();
  const opened = [];
  const node = { id: "n", data: { text: "See [[Notes/Target|Target]]" }, children: [] };
  const view = {
    readOnly: true,
    app: { vault: { getName: () => "Vault" } },
    canvasController: { isNodeExpanded: () => true, setSelectionState() {}, clipboardAction: async () => {} },
    openLinkedNote: (target, pane) => opened.push([target, pane])
  };
  view.showReadOnlyNodeMenu = plugin.helpers.CrispMindEditView.prototype.showReadOnlyNodeMenu;
  plugin.helpers.CrispMindEditView.prototype.showNodeMenu.call(view, node, {});
  const titles = plugin.testMenus.at(-1).items.map(item => item.title);
  assert.ok(titles.includes("打开关联笔记"));
  assert.ok(titles.includes("复制分支 · ⌘C"));
  assert.ok(!titles.some(t => /删除|编辑/.test(t)), "no editing actions in read-only");
});

test("line and paragraph separators in node text do not make a saved map read-only on reopen", () => {
  const { helpers } = setupTestContext();
  const raw = helpers.assembleMindMarkdown({
    frontmatter: "crisp-mind: true\n",
    data: { version: "1.1", layout: "mindMap", theme: "crisp-obsidian", root: {
      id: "r", data: { text: "root line" }, children: [
        { id: "a", data: { text: "first second" }, children: [] },
        { id: "b", data: { text: "first second" }, children: [] }
      ]
    } }
  });
  assert.equal(helpers.inspectMindSource(raw), null);
});

test("saving a plain note as an editable map creates a clean .mind.md and leaves the note alone", async () => {
  const { helpers } = setupTestContext();
  const created = [];
  const v = Object.create(helpers.CrispMindEditView.prototype);
  v.file = { basename: "项目计划", path: "Notes/项目计划.md", parent: { path: "Notes" } };
  v.mindDoc = helpers.parseMindMarkdown("# 计划\n- 第一项\n- \n  - 子项\n");
  v.app = { vault: {
    getAbstractFileByPath: path => path === "Notes/项目计划.mind.md" ? {} : null,
    create: async (path, content) => { created.push({ path, content }); return { path }; }
  } };
  v.plugin = helpers.entitle({ openActiveFileAsMindMap: async () => {} });
  await v.saveAsEditableMap();
  assert.equal(created.length, 1);
  assert.equal(created[0].path, "Notes/项目计划 2.mind.md");
  assert.equal(helpers.inspectMindSource(created[0].content), null);
});

// ---- Node images (1.6.0) ----
function imageDoc(helpers, image = { path: "附件/架构图.png", width: 800, height: 400 }) {
  return { frontmatter: "crisp-mind: true\n", data: { version: "1.1", layout: "logicalStructure", theme: "crisp-obsidian", root: {
    id: "r", data: { text: "Root" }, children: [
      { id: "a", data: { text: "架构 [[系统]]", image }, children: [] },
      { id: "b", data: { text: "Plain" }, children: [] }
    ] } } };
}

test("node image round-trips through the outline embed and the JSON block", () => {
  const { helpers } = setupTestContext();
  const raw = helpers.assembleMindMarkdown(imageDoc(helpers));
  assert.ok(raw.includes("- 架构 [[系统]] ![[附件/架构图.png]]\n"), "outline line carries an Obsidian embed");
  assert.equal(helpers.inspectMindSource(raw), null);
  const parsed = helpers.parseMindMarkdown(raw);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.data.root.children[0].data.image)), { path: "附件/架构图.png", width: 800, height: 400 });
  assert.equal(parsed.data.root.children[0].data.text, "架构 [[系统]]");
});

test("outline parsing splits a trailing image embed from the node text", () => {
  const { helpers } = setupTestContext();
  const tree = helpers.markdownOutlineToTree("# R\n- 截图 ![[Pasted image 1.png|300]]\n- 笔记嵌入 ![[某笔记]]\n- ![[only.webp]]\n");
  assert.equal(tree.children[0].data.text, "截图");
  assert.equal(tree.children[0].data.image.path, "Pasted image 1.png");
  assert.equal(tree.children[1].data.text, "笔记嵌入 ![[某笔记]]", "non-image embeds stay in the text");
  assert.equal(tree.children[1].data.image, undefined);
  assert.equal(tree.children[2].data.text, "only");
  assert.equal(tree.children[2].data.image.path, "only.webp");
});

test("image data is normalized: bad paths and sizes are dropped, not trusted", () => {
  const { helpers } = setupTestContext();
  assert.equal(helpers.normalizeMindImage({ path: "a.txt" }), null);
  assert.equal(helpers.normalizeMindImage({ path: "x]]y.png" }), null);
  assert.equal(helpers.normalizeMindImage({ path: "../up.png" }), null);
  assert.equal(helpers.normalizeMindImage("a.png"), null);
  assert.deepEqual(JSON.parse(JSON.stringify(helpers.normalizeMindImage({ path: "/a/b.PNG", width: -1, height: "9" }))), { path: "a/b.PNG" });
  const repaired = helpers.validateAndRepairTree({ root: { id: "r", data: { text: "R", image: { path: "evil.exe" } }, children: [] } });
  assert.equal(repaired.root.data.image, undefined);
});

test("image display box keeps the aspect ratio inside the node limits", () => {
  const { helpers } = setupTestContext();
  assert.deepEqual(JSON.parse(JSON.stringify(helpers.mindImageBox({ path: "a.png", width: 800, height: 400 }))), { w: 240, h: 120 });
  assert.deepEqual(JSON.parse(JSON.stringify(helpers.mindImageBox({ path: "a.png", width: 100, height: 1000 }))), { w: 24, h: 240 });
  assert.deepEqual(JSON.parse(JSON.stringify(helpers.mindImageBox({ path: "a.png", width: 60, height: 40 }))), { w: 60, h: 40 });
  const unknown = helpers.mindImageBox({ path: "a.png" });
  assert.ok(unknown.w > 0 && unknown.h > 0);
});

test("a renamed image makes the outline differ only in the embed and is reported as relinkable", () => {
  const { helpers } = setupTestContext();
  const raw = helpers.assembleMindMarkdown(imageDoc(helpers));
  const renamed = raw.replace("![[附件/架构图.png]]", "![[新名字.png]]");
  assert.ok(helpers.inspectMindSource(renamed), "still flagged by the strict check");
  assert.deepEqual(JSON.parse(JSON.stringify(helpers.mindImageRelinks(renamed))), [{ nodeId: "a", target: "新名字.png" }]);
  assert.equal(helpers.mindImageRelinks(raw), null, "nothing to relink when consistent");
  // Text edits, removed embeds or added embeds are real conflicts, never auto-healed.
  assert.equal(helpers.mindImageRelinks(renamed.replace("- Plain", "- Plain edited")), null);
  assert.equal(helpers.mindImageRelinks(raw.replace(" ![[附件/架构图.png]]", "")), null);
  assert.equal(helpers.mindImageRelinks(raw.replace("- Plain", "- Plain ![[x.png]]")), null);
});

test("opening a renamed-image map heals the JSON path and saves instead of going read-only", () => {
  const { helpers } = setupTestContext();
  const raw = helpers.assembleMindMarkdown(imageDoc(helpers)).replace("![[附件/架构图.png]]", "![[新名字.png]]");
  const v = Object.create(helpers.CrispMindEditView.prototype);
  let saves = 0;
  v.file = { path: "Maps/a.mind.md" };
  v.plugin = helpers.entitle({});
  v.app = { metadataCache: { getFirstLinkpathDest: (target) => target === "新名字.png" ? { path: "附件/新名字.png", extension: "png" } : null } };
  v.initViewUI = () => {};
  v.requestSave = () => { saves++; };
  v.setSaveState = () => {};
  v.setViewData(raw, true);
  assert.equal(v.readOnly, false);
  assert.equal(v.sourceWarning, null);
  assert.equal(v.mindDoc.data.root.children[0].data.image.path, "附件/新名字.png");
  assert.equal(v.dirty, true);
  assert.equal(saves, 1);
  assert.equal(helpers.inspectMindSource(helpers.assembleMindMarkdown(v.mindDoc)), null);
});

test("an unresolvable renamed image stays read-only and is not rewritten", () => {
  const { helpers } = setupTestContext();
  const raw = helpers.assembleMindMarkdown(imageDoc(helpers)).replace("![[附件/架构图.png]]", "![[不存在.png]]");
  const v = Object.create(helpers.CrispMindEditView.prototype);
  v.file = { path: "Maps/a.mind.md" };
  v.plugin = helpers.entitle({});
  v.app = { metadataCache: { getFirstLinkpathDest: () => null } };
  v.initViewUI = () => {};
  v.requestSave = () => { throw new Error("must not save"); };
  v.setViewData(raw, true);
  assert.equal(v.readOnly, true);
  assert.ok(v.sourceWarning);
});

function noteLinkDoc(helpers, text, extraChildren = []) {
  const doc = helpers.parseMindMarkdown("# Root\n- Plain");
  doc.data.root.children.unshift({ id: "link-node", data: { text }, children: [] });
  for (const child of extraChildren) doc.data.root.children.push(child);
  return doc;
}

test("a renamed linked note makes the outline differ only in the wikilink and is reported as relinkable", () => {
  const { helpers } = setupTestContext();
  const raw = helpers.assembleMindMarkdown(
    noteLinkDoc(helpers, "[[Topics/self-media/outputs/visualizations/ANKS 与 Crisp 展示文档|ANKS 与 Crisp 展示文档]]")
  );
  const renamed = raw.replace(
    "- [[Topics/self-media/outputs/visualizations/ANKS 与 Crisp 展示文档|ANKS 与 Crisp 展示文档]]",
    "- [[ANKS 与 Crisp 展示文档演示|ANKS 与 Crisp 展示文档演示]]"
  );
  assert.ok(helpers.inspectMindSource(renamed), "still flagged by strict source check");
  assert.equal(helpers.mindImageRelinks(renamed), null, "not an image relink");
  const relinks = JSON.parse(JSON.stringify(helpers.mindLinkRelinks(renamed)));
  assert.equal(relinks.length, 1);
  assert.equal(relinks[0].nodeId, "link-node");
  assert.equal(relinks[0].target, "ANKS 与 Crisp 展示文档演示");
  assert.equal(helpers.mindLinkRelinks(raw), null, "nothing to relink when consistent");
  // Real outline edits, added/removed links, subpath edits, or manual alias rewrites stay conflicts.
  assert.equal(helpers.mindLinkRelinks(renamed.replace("- Plain", "- Plain edited")), null);
  assert.equal(helpers.mindLinkRelinks(raw.replace("- Plain", "- Plain [[Extra]]")), null);
  assert.equal(helpers.mindLinkRelinks(raw.replace(
    "- [[Topics/self-media/outputs/visualizations/ANKS 与 Crisp 展示文档|ANKS 与 Crisp 展示文档]]",
    "- Removed link"
  )), null);
  assert.equal(helpers.mindLinkRelinks(raw.replace(
    "- [[Topics/self-media/outputs/visualizations/ANKS 与 Crisp 展示文档|ANKS 与 Crisp 展示文档]]",
    "- [[ANKS 与 Crisp 展示文档演示|被人手改过的别名]]"
  )), null);
});

test("opening a renamed-note map heals the JSON wikilink and saves instead of going read-only", () => {
  const { helpers } = setupTestContext();
  const doc = noteLinkDoc(
    helpers,
    "[[Topics/self-media/outputs/visualizations/ANKS 与 Crisp 展示文档|ANKS 与 Crisp 展示文档]]",
    [
      { id: "custom-alias", data: { text: "参考 [[dir/OldNote#Sec 1|自定义名称]] 说明" }, children: [] },
      { id: "bare-link", data: { text: "[ ] 阅读 [[OldBare]]" }, children: [] },
      { id: "multi-line", data: { text: "第一行\n[[MultiOld|MultiOld]]" }, children: [] },
      { id: "img-node", data: { text: "配图 [[OldBare]]", image: { path: "附件/旧图.png", width: 400, height: 300 } }, children: [] },
      { id: "two-links", data: { text: "对比 [[OldBare|OldBare]] 与 ![[SubOld]] 以及 [[dir/OldMap.mind.md#^k1|OldMap.mind]]" }, children: [] }
    ]
  );
  const full = helpers.assembleMindMarkdown(doc);
  const splitAt = full.indexOf("<!-- CRISP-MIND-DATA-START -->");
  const outlinePart = full.slice(0, splitAt)
    .replace(
      "- [[Topics/self-media/outputs/visualizations/ANKS 与 Crisp 展示文档|ANKS 与 Crisp 展示文档]]",
      "- [[ANKS 与 Crisp 展示文档演示|ANKS 与 Crisp 展示文档演示]]"
    )
    .replace("- 参考 [[dir/OldNote#Sec 1|自定义名称]] 说明", "- 参考 [[NewNote#Sec 1|自定义名称]] 说明")
    .replace(/\[\[OldBare\|OldBare\]\]/g, "[[NewBare|NewBare]]")
    .replace(/\[\[OldBare\]\]/g, "[[NewBare]]")
    .replace("![[SubOld]]", "![[SubNew]]")
    .replace("[[dir/OldMap.mind.md#^k1|OldMap.mind]]", "[[NewMap.mind.md#^k1|NewMap.mind]]")
    .replace("[[MultiOld|MultiOld]]", "[[MultiNew|MultiNew]]")
    .replace("![[附件/旧图.png]]", "![[新图.png]]");
  const raw = outlinePart + full.slice(splitAt);

  const resolved = {
    "ANKS 与 Crisp 展示文档演示": { path: "Topics/self-media/outputs/visualizations/ANKS 与 Crisp 展示文档演示.md", basename: "ANKS 与 Crisp 展示文档演示", name: "ANKS 与 Crisp 展示文档演示.md" },
    "NewNote": { path: "Notes/NewNote.md", basename: "NewNote", name: "NewNote.md" },
    "NewBare": { path: "NewBare.md", basename: "NewBare", name: "NewBare.md" },
    "SubNew": { path: "SubNew.md", basename: "SubNew", name: "SubNew.md" },
    "NewMap.mind.md": { path: "Maps/NewMap.mind.md", basename: "NewMap.mind", name: "NewMap.mind.md" },
    "MultiNew": { path: "MultiNew.md", basename: "MultiNew", name: "MultiNew.md" },
    "新图.png": { path: "附件/新图.png", extension: "png" }
  };
  const v = Object.create(helpers.CrispMindEditView.prototype);
  let saves = 0;
  v.file = { path: "Maps/a.mind.md" };
  v.plugin = helpers.entitle({});
  v.app = { metadataCache: { getFirstLinkpathDest: (target) => resolved[target] || null } };
  v.initViewUI = () => {};
  v.requestSave = () => { saves++; };
  v.setSaveState = () => {};
  v.setViewData(raw, true);

  assert.equal(v.readOnly, false);
  assert.equal(v.sourceWarning, null);
  const byId = id => v.mindDoc.data.root.children.find(c => c.id === id);
  assert.equal(byId("link-node").data.text, "[[ANKS 与 Crisp 展示文档演示|ANKS 与 Crisp 展示文档演示]]");
  assert.equal(byId("custom-alias").data.text, "参考 [[NewNote#Sec 1|自定义名称]] 说明");
  assert.equal(byId("bare-link").data.text, "[ ] 阅读 [[NewBare]]");
  assert.equal(byId("multi-line").data.text, "第一行\n[[MultiNew|MultiNew]]", "multiline hard breaks survive");
  assert.equal(byId("img-node").data.text, "配图 [[NewBare]]");
  assert.equal(byId("img-node").data.image.path, "附件/新图.png");
  assert.equal(byId("two-links").data.text, "对比 [[NewBare|NewBare]] 与 ![[SubNew]] 以及 [[NewMap.mind.md#^k1|NewMap.mind]]");
  assert.equal(v.dirty, true);
  assert.equal(saves, 1);
  assert.equal(helpers.inspectMindSource(helpers.assembleMindMarkdown(v.mindDoc)), null);
});

test("an unresolvable or tampered wikilink diff stays read-only and is not rewritten", () => {
  const { helpers } = setupTestContext();
  const base = helpers.assembleMindMarkdown(noteLinkDoc(helpers, "[[Old|Old]]"));
  const outlineOnly = (text, fn) => {
    const idx = text.indexOf("<!-- CRISP-MIND-DATA-START -->");
    return fn(text.slice(0, idx)) + text.slice(idx);
  };
  const h1Base = helpers.assembleMindMarkdown(noteLinkDoc(helpers, "[[Old#H1|Old]]"));
  const cases = [
    outlineOnly(base, s => s.replace("[[Old|Old]]", "[[Missing|Missing]]")),
    outlineOnly(base, s => s.replace("[[Old|Old]]", "[[Existing|NotMatchingBasename]]")),
    outlineOnly(base, s => s.replace("[[Old|Old]]", "[[Old|ManualAliasChange]]")),
    outlineOnly(base, s => s.replace("[[Old|Old]]", "![[Existing|Existing]]")),
    outlineOnly(h1Base, s => s.replace("[[Old#H1|Old]]", "[[Existing#H2|Existing]]"))
  ];
  for (const raw of cases) {
    const v = Object.create(helpers.CrispMindEditView.prototype);
    v.file = { path: "Maps/a.mind.md" };
    v.plugin = helpers.entitle({});
    v.app = {
      metadataCache: {
        getFirstLinkpathDest: (target) => target === "Existing" ? { path: "Existing.md", basename: "Existing", name: "Existing.md" } : null
      }
    };
    v.initViewUI = () => {};
    v.requestSave = () => { throw new Error("must not save"); };
    v.setViewData(raw, true);
    assert.equal(v.readOnly, true);
    assert.ok(v.sourceWarning);
  }
});

test("image nodes grow to fit the picture and keep geometry out of the file", () => {
  const { canvas, helpers } = canvasFixture();
  const plain = canvas.docData.root.children[1];
  const node = canvas.docData.root.children[0];
  canvas.calculateLayout();
  const plainH = plain._h;
  assert.equal(canvas.setNodeImage(node.id, { path: "a.png", width: 800, height: 400 }), true);
  canvas.calculateLayout();
  assert.ok(node._w >= 240 + 16);
  assert.ok(node._h >= 120 + plainH - 4);
  assert.ok(node._img && node._img.w === 240 && node._img.h === 120);
  const text = helpers.assembleMindMarkdown({ data: canvas.docData });
  assert.ok(!text.includes('"_img"') && !text.includes('"_textY"'));
  canvas.undo();
  assert.equal(canvas.findNode(node.id).data.image, undefined, "insert is one undo step");
  canvas.redo();
  assert.equal(canvas.removeNodeImage(node.id), true);
  assert.equal(canvas.findNode(node.id).data.image, undefined);
});

test("canvas renders an image element, or a missing-image placeholder", () => {
  const { canvas, helpers } = canvasFixture();
  const node = canvas.docData.root.children[0];
  canvas.setNodeImage(node.id, { path: "a.png", width: 800, height: 400 });
  canvas.options.resolveImage = path => path === "a.png" ? { url: "app://local/a.png?1" } : null;
  canvas.calculateLayout();
  renderCanvasToFakeSvg(canvas, helpers);
  const all = [];
  const walk = n => { all.push(n); (n.children || []).forEach(walk); };
  walk(canvas.nodesGroup);
  const img = all.find(n => n.tag === "image");
  assert.ok(img, "image element rendered");
  assert.equal(img.attrs.href, "app://local/a.png?1");
  assert.equal(img.attrs["data-image-path"], "a.png");
  assert.equal(Number(img.attrs.width), 240);
  // Missing file: placeholder instead of a broken image.
  canvas.options.resolveImage = () => null;
  canvas.nodeElements = new Map();
  canvas.nodesGroup = { children: [], appendChild(c) { this.children.push(c); } };
  canvas.renderBranch(canvas.docData.root);
  const all2 = []; const walk2 = n => { all2.push(n); (n.children || []).forEach(walk2); };
  walk2(canvas.nodesGroup);
  assert.ok(!all2.some(n => n.tag === "image"));
  assert.ok(all2.some(n => (n.attrs?.class || "").includes("crisp-mind-image-missing")));
});

test("copying a branch keeps the image embed and pasting an outline restores it", () => {
  const { canvas } = canvasFixture();
  const node = canvas.docData.root.children[0];
  canvas.setNodeImage(node.id, { path: "a.png", width: 10, height: 10 });
  const text = canvas.copyBranchText(node.id);
  assert.ok(text.startsWith("- One ![[a.png]]"));
  canvas.clipboardBranchSnapshot = null;
  canvas.options.clipboardStore = null;
  assert.equal(canvas.pasteBranchText("- 外部 ![[b.jpg]]", canvas.docData.root.id), true);
  const pasted = canvas.docData.root.children.at(-1);
  assert.equal(pasted.data.text, "外部");
  assert.equal(pasted.data.image.path, "b.jpg");
});

test("export inlines vault images as data URIs so PNG/PDF/SVG do not lose them", async () => {
  const { helpers } = setupTestContext();
  const svg = '<g><image href="app://x/a.png?1" data-image-path="附件/a &amp; b.png" width="10"></image><image href="app://x/gone.png" data-image-path="gone.png"></image></g>';
  const seen = [];
  const out = await helpers.inlineSvgImages(svg, async path => { seen.push(path); return path === "gone.png" ? null : "data:image/png;base64,AAAA"; });
  assert.deepEqual(seen, ["附件/a & b.png", "gone.png"]);
  assert.ok(out.includes('href="data:image/png;base64,AAAA"'));
  assert.ok(!out.includes("app://x/a.png"));
  assert.ok(!out.includes("app://x/gone.png"), "unreadable images are dropped, never left as app:// links");
});

// ---- Node images, phase 2 (1.7.0) ----
test("image size presets change the display box and survive a round trip", () => {
  const { helpers } = setupTestContext();
  const big = { path: "a.png", width: 2000, height: 1000 };
  assert.deepEqual(JSON.parse(JSON.stringify(helpers.mindImageBox({ ...big, size: "s" }))), { w: 160, h: 80 });
  assert.deepEqual(JSON.parse(JSON.stringify(helpers.mindImageBox(big))), { w: 240, h: 120 });
  assert.deepEqual(JSON.parse(JSON.stringify(helpers.mindImageBox({ ...big, size: "l" }))), { w: 360, h: 180 });
  assert.equal(helpers.normalizeMindImage({ path: "a.png", size: "l" }).size, "l");
  assert.equal(helpers.normalizeMindImage({ path: "a.png", size: "m" }).size, undefined, "medium is the default and is not stored");
  assert.equal(helpers.normalizeMindImage({ path: "a.png", size: "xl" }).size, undefined);
  const raw = helpers.assembleMindMarkdown(imageDoc(helpers, { path: "a.png", width: 10, height: 10, size: "s" }));
  assert.equal(helpers.inspectMindSource(raw), null);
  assert.equal(helpers.parseMindMarkdown(raw).data.root.children[0].data.image.size, "s");
});

test("resizing images applies to every selected image node in one undo step", () => {
  const { canvas } = canvasFixture();
  const [one, , three] = canvas.docData.root.children;
  canvas.setNodeImage(one.id, { path: "a.png", width: 800, height: 400 });
  canvas.setNodeImage(three.id, { path: "b.png", width: 800, height: 400 });
  canvas.setNodeSelection([one.id, canvas.docData.root.children[1].id, three.id], one.id, false);
  assert.equal(canvas.setSelectedImageSize("l"), true);
  canvas.calculateLayout();
  assert.equal(one.data.image.size, "l");
  assert.equal(three.data.image.size, "l");
  assert.equal(canvas.docData.root.children[1].data.image, undefined, "nodes without images are untouched");
  assert.equal(one._img.w, 360);
  assert.equal(canvas.setSelectedImageSize("l"), false, "no-op does not add history");
  canvas.undo();
  assert.equal(canvas.findNode(one.id).data.image.size, undefined);
  assert.equal(canvas.findNode(three.id).data.image.size, undefined);
});

test("search also finds nodes by image file name and flags image nodes", () => {
  const { helpers } = setupTestContext();
  const root = { id: "r", data: { text: "Root" }, children: [
    { id: "a", data: { text: "架构", image: { path: "附件/系统总览图.png" } }, children: [] },
    { id: "b", data: { text: "总览" }, children: [] }
  ] };
  const results = helpers.searchMindNodes(root, "总览", "");
  assert.deepEqual([...results.map(r => r.id)], ["a", "b"]);
  assert.equal(results[0].image, "附件/系统总览图.png");
  assert.equal(results[1].image, undefined);
  assert.equal(helpers.searchMindNodes(root, "附件", "").length, 0, "folders are not searched, only the file name");
});

test("Crisp Mind registers its hover source so image and note previews follow the ⌘ setting", async () => {
  const exported = setupTestContext();
  const PluginClass = exported.default || exported;
  const plugin = Object.create(PluginClass.prototype);
  assert.equal(typeof plugin.registerHoverSource, "function");
  plugin.registerHoverSource();
  assert.equal(plugin.hoverSources["crisp-mind-view"].defaultMod, true);
});

// ---- Note hover preview (1.8.0) ----
test("note preview turns bare image paths into embeds and leaves everything else alone", () => {
  const { helpers } = setupTestContext();
  const note = "对应原图：\nimages/01_备案资料清单.jpeg\n查看方式：打开手册\n  images/缺失.png  \n![[已嵌入.png]]\n[[某笔记]]\nnot/an/image.pdf";
  const resolve = path => path === "images/01_备案资料清单.jpeg" ? "手册/images/01_备案资料清单.jpeg" : null;
  assert.equal(helpers.noteMarkdownForPreview(note, resolve),
    "对应原图：\n![[手册/images/01_备案资料清单.jpeg]]\n查看方式：打开手册\n  images/缺失.png  \n![[已嵌入.png]]\n[[某笔记]]\nnot/an/image.pdf");
  assert.equal(helpers.noteMarkdownForPreview("", resolve), "");
});

test("hovering the note badge reports enter and leave for that node", () => {
  const { canvas, helpers } = canvasFixture();
  const node = canvas.docData.root.children[0];
  node.data.note = "备注";
  const events = [];
  canvas.options.onNoteHover = (n, el, entering) => events.push([n.id, entering]);
  canvas.calculateLayout();
  const listeners = [];
  const make = tag => {
    const el = fakeSvgNode(tag);
    el.addEventListener = (type, fn) => listeners.push({ el, type, fn });
    return el;
  };
  canvas.theme = helpers.getComputedThemeConfig("crisp-nord");
  canvas.document = { createElementNS: (_ns, tag) => make(tag) };
  canvas.linesGroup = make("g"); canvas.nodesGroup = make("g"); canvas.nodeElements = new Map();
  canvas.renderBranch(canvas.docData.root);
  const badge = listeners.filter(l => (l.el.attrs.class || "").includes("crisp-mind-note-indicator"));
  assert.deepEqual(badge.map(l => l.type).sort(), ["mouseenter", "mouseleave"]);
  badge.find(l => l.type === "mouseenter").fn({});
  badge.find(l => l.type === "mouseleave").fn({});
  assert.deepEqual(JSON.parse(JSON.stringify(events)), [[node.id, true], [node.id, false]]);
});

// Regression (2026-11-05, user report): 1.8.0 listened for hover on the note badge, but an older
// rule kept `pointer-events: none` on it, so a real mouse never reached the badge.
test("styles let the note badge and node images receive the pointer", () => {
  const css = fs.readFileSync(path.join(__dirname, "../styles.css"), "utf8");
  const rules = selector => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(m => m[1].split(",").some(s => s.trim() === selector))
    .map(m => m[2]);
  for (const selector of [".crisp-mind-note-indicator", ".crisp-mind-node-image"]) {
    const last = rules(selector).map(body => body.match(/pointer-events:\s*([^;]+)/)?.[1]?.trim()).filter(Boolean).pop();
    assert.notEqual(last, "none", `${selector} must not disable pointer events`);
  }
});

// Regression (2026-11-05, user report): copying an image file (Finder, CleanShot) and pasting it
// into a node inserted the file path as new nodes instead of the picture.
test("clipboard file references and pasted file paths resolve to image files only", () => {
  const { helpers } = setupTestContext();
  const exists = p => ["/Users/me/Desktop/CleanShot 2026-11-05 at 10.27.00@2x.jpg", "/tmp/复制 测试.png"].includes(p);
  assert.deepEqual([...helpers.clipboardImagePaths({ fileUrl: "file:///tmp/%E5%A4%8D%E5%88%B6%20%E6%B5%8B%E8%AF%95.png", text: "" }, exists)], ["/tmp/复制 测试.png"]);
  assert.deepEqual([...helpers.clipboardImagePaths({ fileUrl: "", text: "/Users/me/Desktop/CleanShot 2026-11-05 at 10.27.00@2x.jpg" }, exists)], ["/Users/me/Desktop/CleanShot 2026-11-05 at 10.27.00@2x.jpg"]);
  assert.equal(helpers.clipboardImagePaths({ fileUrl: "", text: "/Users/me/notes.md" }, () => true).length, 0, "non-image files stay text");
  assert.equal(helpers.clipboardImagePaths({ fileUrl: "", text: "/Users/me/missing.png" }, exists).length, 0, "paths that do not exist stay text");
  assert.equal(helpers.clipboardImagePaths({ fileUrl: "", text: "- 主题 ![[a.png]]\n  - 子主题" }, () => true).length, 0, "copied outlines stay text");
  assert.deepEqual([...helpers.clipboardImagePaths({ fileUrl: "file:///tmp/%E5%A4%8D%E5%88%B6%20%E6%B5%8B%E8%AF%95.png", text: "/tmp/复制 测试.png" }, exists)], ["/tmp/复制 测试.png"], "deduplicated");
});

test("pasting a copied image file attaches it instead of creating path nodes", async () => {
  const { canvas } = canvasFixture();
  const node = canvas.docData.root.children[0];
  const before = canvas.docData.root.children.length;
  const pasted = [];
  canvas.options.onPasteImage = async () => { throw new Error("image data path must not run"); };
  canvas.options.readClipboardImageFiles = () => ["/Users/me/Desktop/shot.jpg"];
  canvas.options.onPasteImageFiles = async (paths, id) => { pasted.push([paths, id]); };
  canvas.window = { navigator: { clipboard: { readText: async () => "/Users/me/Desktop/shot.jpg", read: async () => [] } } };
  canvas.selectNode(node.id);
  await canvas.clipboardAction("paste");
  assert.deepEqual(JSON.parse(JSON.stringify(pasted)), [[["/Users/me/Desktop/shot.jpg"], node.id]]);
  assert.equal(canvas.docData.root.children.length, before);
  assert.equal(node.children.length, 1, "no path node was added");
});


/* ---------- 1.9.0 ---------- */
test("1.9 outline-only map is editable when the outline round-trips, prose stays read-only", () => {
  const { helpers } = setupTestContext();
  const raw = "---\ncrisp-mind: true\n---\n\n# 纯大纲\n- A\n  - A1\n- B\n";
  assert.equal(helpers.inspectMindSource(raw), null);
  assert.match(helpers.inspectMindSource(raw + "\n一段正文\n"), /缺少导图数据块/);
  assert.match(helpers.inspectMindSource("---\ncrisp-mind: true\n---\n\n随便写的笔记\n"), /缺少导图数据块/);
});

test("1.9 saving an outline-only map writes the data block and keeps the outline", async () => {
  const { helpers } = setupTestContext();
  const v = Object.create(helpers.CrispMindEditView.prototype);
  let disk = "---\ncrisp-mind: true\n---\n\n# 纯大纲\n- A\n- B\n";
  v.file = { path: "t.mind.md", basename: "t.mind", parent: { path: "" } };
  v.plugin = helpers.entitle({ settings: { autoBackup: false }, manifest: { id: "crisp-mind" } });
  v.app = { vault: { configDir: ".obsidian", adapter: { exists: async () => true, mkdir: async () => {}, write: async () => {} }, process: async (f, fn) => { disk = fn(disk); } } };
  v.initViewUI = () => {}; v.renderLockedView = () => {}; v.requestSave = () => {}; v.notifyPulseContribution = () => {};
  v.setViewData(disk, true);
  assert.equal(v.readOnly, false);
  v.mindDoc.data.root.children[0].data.text = "A2"; v.dirty = true;
  await v.save();
  assert.match(disk, /CRISP-MIND-DATA-START/);
  assert.match(disk, /^- A2$/m);
  assert.equal(helpers.inspectMindSource(disk), null);
});

test("1.9 a .mind.md left in a markdown leaf switches to the mind view unless opted out", () => {
  const exported = setupTestContext();
  const PluginClass = exported.default || exported;
  const plugin = Object.create(PluginClass.prototype);
  const calls = [];
  const leaf = path => { const l = { view: { file: { path } } }; l.setViewState = async state => calls.push([l.view.file.path, state.type, state.state.file]); return l; };
  const a = leaf("a.mind.md"), b = leaf("b.md"), c = leaf("c.mind.md");
  plugin.app = { workspace: { getLeavesOfType: type => (type === "markdown" ? [a, b, c] : []), activeLeaf: a } };
  plugin.keepAsMarkdown(c);
  plugin.convertMindLeaves();
  assert.deepEqual(calls, [["a.mind.md", "crisp-mind-view", "a.mind.md"]]);
  c.view.file.path = "d.mind.md"; // the opt-out belongs to the file it was made for
  plugin.convertMindLeaves();
  assert.deepEqual(calls.at(-1), ["d.mind.md", "crisp-mind-view", "d.mind.md"]);
});

test("1.9 relations keep arrow direction and dashes, render matching markers, and undo", () => {
  const { canvas, helpers } = canvasFixture();
  const [one, two, three] = canvas.docData.root.children;
  canvas.docData.relations = [
    { id: "r1", from: one.id, to: two.id, arrow: "both", dashed: true },
    { id: "r2", from: two.id, to: three.id, arrow: "none" },
    { id: "r3", from: one.id, to: three.id, arrow: "sideways", dashed: "yes" }
  ];
  helpers.normalizeMindAnnotations(canvas.docData);
  canvas.saveState(); // the relations above are the history baseline for undo
  const byId = Object.fromEntries(canvas.docData.relations.map(r => [r.id, r]));
  assert.equal(byId.r1.arrow, "both"); assert.equal(byId.r1.dashed, true);
  assert.equal(byId.r2.arrow, "none"); assert.equal(byId.r2.dashed, undefined);
  assert.equal(byId.r3.arrow, undefined); assert.equal(byId.r3.dashed, undefined);
  renderForReal(canvas, helpers);
  const paths = canvas.relationsGroup.children.filter(n => n.tag === "path" && n.attrs.class === "crisp-mind-relation");
  const [p1, p2, p3] = paths;
  assert.ok(p1.attrs["marker-start"] && p1.attrs["marker-end"]); assert.ok(p1.attrs["stroke-dasharray"]);
  assert.equal(p2.attrs["marker-start"], undefined); assert.equal(p2.attrs["marker-end"], undefined);
  assert.ok(p3.attrs["marker-end"]); assert.equal(p3.attrs["marker-start"], undefined); assert.equal(p3.attrs["stroke-dasharray"], undefined);
  assert.ok(canvas.setRelationStyle("r2", { arrow: "both", dashed: true }));
  assert.equal(canvas.findRelation("r2").arrow, "both");
  canvas.undo();
  assert.equal(canvas.findRelation("r2").arrow, "none");
  assert.equal(canvas.findRelation("r2").dashed, undefined);
});

// ---- 1.9.0 activation ----
test("1.9 entitlement ignores instance flags and needs a manager this module registered", () => {
  const { helpers } = setupTestContext();
  const plugin = { settings: {}, isLicensed: () => true, licenseManager: { isLicensed: () => true, status: { valid: true } } };
  assert.equal(helpers.mindEntitled(plugin), false);
  helpers.entitle(plugin);
  assert.equal(helpers.mindEntitled(plugin), true);
  assert.equal(helpers.mindEntitled(Object.create(plugin)), false, "a look-alike object is not entitled");
});

test("1.9 unactivated views lock: no canvas, nothing saved, patched flags do not unlock", async () => {
  const f = savedViewFixture();
  let locked = 0, canvasBuilt = 0;
  f.v.renderLockedView = () => locked++; f.v.initViewUI = () => canvasBuilt++;
  f.v.plugin = { settings: { autoBackup: true }, manifest: { id: "crisp-mind" }, isLicensed: () => true, requireLicense: () => true, licenseManager: { status: { valid: true } } };
  f.v.dirty = false;
  f.v.setViewData(f.v.originalData, true);
  assert.equal(f.v.locked, true); assert.equal(f.v.readOnly, true);
  assert.equal(locked, 1); assert.equal(canvasBuilt, 0);
  f.v.mindDoc.data.root.data.text = "Should not persist"; f.v.dirty = true;
  await f.v.save();
  assert.ok(!f.disk().includes("Should not persist"));
});

test("1.9 a signed code entitles, a forged one does not, and expiry ends it", async () => {
  const { helpers } = setupTestContext(licensePublicPem);
  const plugin = { app: {}, settings: {} };
  let now = Date.parse("2030-01-01T00:00:00Z");
  const manager = helpers.mindLicenseManagerFor(plugin, { now: () => now });
  const forged = makeLicenseCode().replace(/\.(.)/, (m, c) => "." + (c === "A" ? "B" : "A"));
  assert.equal((await manager.activate(forged)).valid, false);
  assert.equal(helpers.mindEntitled(plugin), false);
  assert.equal((await manager.activate(makeLicenseCode())).valid, true);
  assert.equal(helpers.mindEntitled(plugin), true);
  manager.status = { valid: false }; // instance status is display-only
  assert.equal(helpers.mindEntitled(plugin), true);
  manager.now = () => 0; // an instance clock is ignored
  await manager.activate(makeLicenseCode({ expiresAt: "2030-01-02T00:00:00Z" }));
  assert.equal(helpers.mindEntitled(plugin), true);
  now = Date.parse("2030-01-03T00:00:00Z");
  assert.equal(helpers.mindEntitled(plugin), false);
});

test("1.9 replacing crypto.subtle.verify after load cannot pass a forged code", async () => {
  const real = globalThis.crypto.subtle;
  const subtle = { importKey: real.importKey.bind(real), verify: real.verify.bind(real), digest: real.digest?.bind(real) };
  const { helpers } = setupTestContext(licensePublicPem, { crypto: { subtle, getRandomValues: a => globalThis.crypto.getRandomValues(a) } });
  subtle.verify = async () => true;
  const forged = makeLicenseCode().split(".")[0] + "." + Buffer.alloc(64, 7).toString("base64url");
  const manager = helpers.mindLicenseManagerFor({ app: {}, settings: {} });
  assert.equal((await manager.activate(forged)).valid, false);
});

test("1.9 a verifier that accepts everything at load time disables activation", async () => {
  const real = globalThis.crypto.subtle;
  const subtle = { importKey: real.importKey.bind(real), verify: async () => true };
  const { helpers } = setupTestContext(licensePublicPem, { crypto: { subtle, getRandomValues: a => globalThis.crypto.getRandomValues(a) } });
  const plugin = { app: {}, settings: {} };
  const result = await helpers.mindLicenseManagerFor(plugin).activate(makeLicenseCode());
  assert.equal(result.valid, false);
  assert.equal(helpers.mindEntitled(plugin), false);
});

// ---- Node block links (1.10.0) ----
test("node block id round-trips through the outline and keeps the label clean", () => {
  const { helpers } = setupTestContext();
  const tree = helpers.markdownOutlineToTree("# Root\n- One ^abc123\n  - Pic ![[img/a.png]] ^pic-1\n- Two");
  const [one, two] = tree.children;
  assert.equal(one.data.text, "One");
  assert.equal(one.data.blockId, "abc123");
  assert.equal(one.children[0].data.text, "Pic");
  assert.equal(one.children[0].data.image.path, "img/a.png");
  assert.equal(one.children[0].data.blockId, "pic-1");
  assert.equal(two.data.blockId, undefined);
  const outline = helpers.treeToMarkdownOutline(tree);
  assert.match(outline, /^- One \^abc123$/m);
  assert.match(outline, /^  - Pic !\[\[img\/a\.png\]\] \^pic-1$/m);
  assert.match(outline, /^- Two$/m);
});

test("a caret that is not a trailing block id stays part of the node text", () => {
  const { helpers } = setupTestContext();
  const tree = helpers.markdownOutlineToTree("# Root\n- a ^b c\n- x^abc\n- bad ^a_b");
  assert.equal(tree.children.map(n => n.data.text).join("|"), "a ^b c|x^abc|bad ^a_b");
  assert.ok(tree.children.every(n => n.data.blockId === undefined));
});

test("root never carries a block id and saved maps with block ids stay editable", () => {
  const { helpers } = setupTestContext();
  const doc = helpers.parseMindMarkdown("# Root\n- One\n- Two");
  doc.data.root.data.blockId = "rootid";
  doc.data.root.children[0].data.blockId = "k1";
  const raw = helpers.assembleMindMarkdown(doc);
  assert.match(raw, /^# Root$/m);
  assert.match(raw, /^- One \^k1$/m);
  assert.equal(helpers.inspectMindSource(raw), null);
  assert.equal(helpers.mindOutlineIsLossless("# Root\n- One ^k1\n- Two\n"), true);
  const reopened = helpers.parseMindMarkdown(raw);
  assert.equal(reopened.data.root.children[0].data.blockId, "k1");
  assert.equal(reopened.data.root.data.blockId, undefined);
});

test("repair drops malformed and duplicate block ids", () => {
  const { helpers } = setupTestContext();
  const data = helpers.validateAndRepairTree({ root: { id: "r", data: { text: "R" }, children: [
    { id: "a", data: { text: "A", blockId: "same" }, children: [] },
    { id: "b", data: { text: "B", blockId: "same" }, children: [] },
    { id: "c", data: { text: "C", blockId: "has space" }, children: [] }
  ] } });
  assert.equal(data.root.children.map(n => String(n.data.blockId)).join("|"), "same|undefined|undefined");
});

test("copy, paste and branch extraction never duplicate block ids", () => {
  const { canvas, helpers } = canvasFixture();
  const one = canvas.docData.root.children[0];
  one.data.blockId = "keep1";
  one.children[0].data.blockId = "keep2";
  const text = canvas.copyBranchText(one.id);
  assert.doesNotMatch(text, /\^keep/);
  canvas.pasteBranchText(canvas.clipboardBranchSnapshot.text, canvas.docData.root.id);
  const pasted = canvas.docData.root.children.at(-1);
  assert.equal(pasted.data.blockId, undefined);
  assert.equal(pasted.children[0].data.blockId, undefined);
  assert.equal(one.data.blockId, "keep1");
  canvas.pasteBranchText("- Foreign ^zzz", canvas.docData.root.id);
  assert.equal(canvas.docData.root.children.at(-1).data.text, "Foreign");
  assert.equal(canvas.docData.root.children.at(-1).data.blockId, undefined);
  const { content } = helpers.extractNodeToTopicContent(one);
  assert.doesNotMatch(content, /\^keep/);
});

test("a link subpath resolves to the node with that block id", () => {
  const { helpers } = setupTestContext();
  const tree = helpers.markdownOutlineToTree("# Root\n- One\n  - Deep ^deep1");
  const deep = tree.children[0].children[0];
  assert.equal(helpers.mindBlockIdNodeId(tree, "#^deep1"), deep.id);
  assert.equal(helpers.mindBlockIdNodeId(tree, "^deep1"), deep.id);
  assert.equal(helpers.mindBlockIdNodeId(tree, "#^missing"), null);
  assert.equal(helpers.mindBlockIdNodeId(tree, "#Heading"), null);
});

test("copy node link assigns one block id, saves it and copies a wikilink", async () => {
  const { canvas, helpers } = canvasFixture();
  const node = canvas.docData.root.children[0];
  const copied = [];
  const view = {
    readOnly: false,
    file: { path: "Maps/Plan.mind.md", basename: "Plan.mind" },
    app: { vault: { getName: () => "V" }, metadataCache: { fileToLinktext: () => "Maps/Plan.mind.md" } },
    canvasController: canvas,
    writeClipboard: async text => { copied.push(text); }
  };
  await helpers.CrispMindEditView.prototype.copyNodeLink.call(view, node.id);
  const id = node.data.blockId;
  assert.match(id, /^[a-z0-9]{6}$/);
  assert.deepEqual(copied, [`[[Maps/Plan.mind.md#^${id}|One]]`]);
  await helpers.CrispMindEditView.prototype.copyNodeLink.call(view, node.id);
  assert.equal(node.data.blockId, id, "existing id is reused");
  await helpers.CrispMindEditView.prototype.copyNodeLink.call(view, canvas.docData.root.id);
  assert.equal(copied.at(-1), "[[Maps/Plan.mind.md|Root]]");
  assert.equal(canvas.docData.root.data.blockId, undefined);
});

test("a block link that opens a map as Markdown keeps its subpath through the view switch", () => {
  const exported = setupTestContext();
  const PluginClass = exported.default || exported;
  const plugin = Object.create(PluginClass.prototype);
  const calls = [];
  const leaf = path => { const l = { view: { file: { path } } }; l.setViewState = async (state, eState) => calls.push([l.view.file.path, eState?.subpath]); return l; };
  const a = leaf("a.mind.md"), b = leaf("b.mind.md");
  plugin.app = { workspace: { getLeavesOfType: type => (type === "markdown" ? [a, b] : []), activeLeaf: a } };
  plugin.rememberMindSubpath(a, { path: "a.mind.md" }, { eState: { subpath: "#^k1" } });
  plugin.rememberMindSubpath(b, { path: "other.mind.md" }, { eState: { subpath: "#^zz" } });
  plugin.convertMindLeaves();
  assert.deepEqual(calls.map(c => c.join("|")), ["a.mind.md|#^k1", "b.mind.md|"]);
  plugin.convertMindLeaves(); // layout-change can convert the same leaf twice before it switches
  assert.equal(calls.at(-2)[1], "#^k1");
  plugin.rememberMindSubpath(a, { path: "a.mind.md" }, {}); // a plain open clears it
  plugin.convertMindLeaves();
  assert.equal(calls.at(-2)[1], undefined);
});

test("the mind view clears the pending subpath once it has selected the node", () => {
  const { canvas, helpers } = canvasFixture();
  const exported = setupTestContext();
  const node = canvas.docData.root.children[1];
  node.data.blockId = "two2";
  const leaf = {}, calls = [];
  const plugin = Object.create((exported.default || exported).prototype);
  plugin.rememberMindSubpath(leaf, { path: "m.mind.md" }, { eState: { subpath: "#^two2" } });
  canvas.centerOnNode = id => calls.push(id);
  const view = { leaf, canvasController: canvas, pendingSubpath: "#^two2", handleSelectionChange() {} };
  helpers.CrispMindEditView.prototype.applyPendingSubpath.call(view);
  assert.equal(canvas.selectedNodeId, node.id);
  assert.deepEqual(calls, [node.id]);
  assert.equal(view.pendingSubpath, null);
});

// ---- Embedded maps (1.11.0) ----
test("map embeds take over .mind.md only and hand every other note back", () => {
  const exported = setupTestContext();
  const plugin = Object.create((exported.default || exported).prototype);
  const unloads = [];
  plugin.register = fn => unloads.push(fn);
  const original = () => "markdown-embed";
  const registry = { embedByExtension: { md: original },
    registerExtension(ext, fn) { this.embedByExtension[ext] = fn; },
    unregisterExtension(ext) { delete this.embedByExtension[ext]; } };
  plugin.app = { embedRegistry: registry };
  plugin.registerMindEmbeds();
  const creator = registry.embedByExtension.md;
  assert.notEqual(creator, original);
  assert.equal(creator({ containerEl: {} }, { path: "Notes/a.md", extension: "md" }, ""), "markdown-embed");
  const embed = creator({ containerEl: {} }, { path: "Maps/a.mind.md", extension: "md" }, "#^k1");
  assert.ok(embed instanceof exported.helpers.CrispMindEmbed);
  assert.equal(embed.subpath, "#^k1");
  unloads.forEach(fn => fn());
  assert.equal(registry.embedByExtension.md, original, "restored on unload");
});

test("unloading leaves a newer embed wrapper from another plugin in place", () => {
  const exported = setupTestContext();
  const plugin = Object.create((exported.default || exported).prototype);
  const unloads = [];
  plugin.register = fn => unloads.push(fn);
  const registry = { embedByExtension: { md: () => "md" },
    registerExtension(ext, fn) { this.embedByExtension[ext] = fn; },
    unregisterExtension(ext) { delete this.embedByExtension[ext]; } };
  plugin.app = { embedRegistry: registry };
  plugin.registerMindEmbeds();
  const other = () => "other plugin";
  registry.embedByExtension.md = other;
  unloads.forEach(fn => fn());
  assert.equal(registry.embedByExtension.md, other);
});

test("embed height follows the map's shape within the allowed range", () => {
  const { helpers } = setupTestContext();
  assert.equal(helpers.mindEmbedHeight({ width: 400, height: 200 }, 700), 248);
  assert.equal(helpers.mindEmbedHeight({ width: 1600, height: 200 }, 700), 200, "wide maps never collapse below the minimum");
  assert.equal(helpers.mindEmbedHeight({ width: 400, height: 2000 }, 700), 480, "tall maps are capped");
  assert.equal(helpers.mindEmbedHeight(null, 700), 280);
});

test("the wheel scrolls the page until an embedded map is activated", () => {
  const { canvas } = canvasFixture();
  let active = false, prevented = 0;
  canvas.options.wheelGate = () => active;
  canvas.updateTransform = () => {};
  const wheel = () => canvas.onWheel({ deltaX: 0, deltaY: 40, deltaMode: 0, target: { closest: () => null },
    preventDefault() { prevented++; }, stopPropagation() {} });
  const before = canvas.translateY;
  wheel();
  assert.equal(prevented, 0);
  assert.equal(canvas.translateY, before);
  active = true;
  wheel();
  assert.equal(prevented, 1);
  assert.equal(canvas.translateY, before - 40);
});

test("fitting an embedded map uses its own small insets", () => {
  const { canvas } = canvasFixture();
  canvas.updateTransform = () => {};
  canvas.getBounds = () => ({ x: 0, y: 0, width: 600, height: 200 });
  canvas.container = { clientWidth: 664, clientHeight: 264 };
  canvas.options.zoomInset = { x: 64, y: 64 };
  canvas.resetZoom();
  assert.equal(canvas.scale, 1);
});
