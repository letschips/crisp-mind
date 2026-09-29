// Real-Obsidian regression for 1.5.2. Run with:
//   obsidian vault="<vault>" eval code="$(cat tests/runtime-1.5.2.e2e.js)"
// Creates an isolated QA folder, and moves it plus its own snapshots to the system trash.
(async () => {
  const plugin = app.plugins.plugins['crisp-mind'];
  if (!plugin?.isLicensed()) throw Error('Requires the existing activated runtime');
  const report = {version: plugin.manifest.version, checks: []};
  const check = (name, pass, detail) => report.checks.push(detail === undefined ? {name, pass: !!pass} : {name, pass: !!pass, detail});
  const folder = 'Crisp-Mind-QA-' + Date.now();
  const tree = {id:'qa-root',data:{text:'QA'},children:[
    {id:'b1',data:{text:'Branch'},children:[{id:'s1',data:{text:'S1'},children:[]},{id:'s2',data:{text:'S2'},children:[]}]},
    {id:'b2',data:{text:'Other'},children:[]}]};
  const outline = '# QA\n- Branch\n  - S1\n  - S2\n- Other\n';
  const content = `${outline}\n<!-- CRISP-MIND-DATA-START -->\n\`\`\`crisp-mind\n${JSON.stringify({version:'1.1',layout:'logicalStructure',theme:'crisp-obsidian',root:tree})}\n\`\`\`\n<!-- CRISP-MIND-DATA-END -->\n`;
  const backups = `${app.vault.configDir}/plugins/crisp-mind/backups`;
  let leaf, sourcePath;
  await app.vault.createFolder(folder);
  try {
    const source = await app.vault.create(folder + '/source.mind.md', content);
    sourcePath = source.path;
    leaf = app.workspace.getLeaf('tab');
    await leaf.setViewState({type:'crisp-mind-view', state:{file:source.path}});
    await leaf.loadIfDeferred?.();
    await new Promise(r => setTimeout(r, 300));
    const v = leaf.view, c = v.canvasController;
    check('view opens editable', !v.readOnly && !!c);

    // Export: the modal class is module-private, so capture the instance the toolbar creates
    // by holding Obsidian's base Modal.open for one click, then run a real vault export.
    c.selectNode('b1');
    let base = Object.getPrototypeOf(app.setting);
    while (base && !(Object.prototype.hasOwnProperty.call(base, 'open') && Object.prototype.hasOwnProperty.call(base, 'onOpen'))) base = Object.getPrototypeOf(base);
    const realOpen = base.open;
    let exportModal = null;
    base.open = function () { exportModal = this; };
    try {
      [...v.toolbarEl.querySelectorAll('button')].find(b => /导出思维导图/.test(b.getAttribute('aria-label') || '')).click();
    } finally { base.open = realOpen; }
    check('export modal captured', !!exportModal?.handleExport);
    await app.vault.create(folder + '/source.svg', 'existing user file');
    exportModal.selectedFormat = 'svg';
    await exportModal.handleExport('vault');
    const kept = await app.vault.adapter.read(folder + '/source.svg');
    check('export does not overwrite an existing file', kept === 'existing user file');
    const exportedPath = folder + '/source 2.svg';
    const svg = await app.vault.adapter.read(exportedPath).catch(() => '');
    check('export uses a numbered name without .mind', svg.length > 0 && !app.vault.getAbstractFileByPath(folder + '/source.mind.svg'));
    check('exported file is indexed by the vault', !!app.vault.getAbstractFileByPath(exportedPath));
    check('export bakes the font stack', svg && !svg.includes('var(--font-interface)'));
    const b1 = svg.slice(svg.indexOf('data-node-id="b1"'), svg.indexOf('</g>', svg.indexOf('data-node-id="b1"')));
    check('export omits the selection outline', b1 && !/stroke-width="2\.5"/.test(b1) && !/is-selected/.test(b1));
    check('selection survives export', c.selectedNodeIds.has('b1') && c.selectedNodeId === 'b1');
    const parsed = new DOMParser().parseFromString(svg.replace(/^<\?xml[^>]*>\s*/, ''), 'image/svg+xml');
    check('exported SVG parses', !parsed.querySelector('parsererror'));

    // Wheel over the outline panel scrolls the panel, not the canvas.
    v.outlinePanelEl.style.display = 'flex'; v.renderOutline();
    const before = c.translateY;
    v.outlineTreeEl.dispatchEvent(new WheelEvent('wheel', {deltaY: 120, bubbles: true, cancelable: true}));
    check('wheel over outline panel leaves canvas still', c.translateY === before);
    c.svg.dispatchEvent(new WheelEvent('wheel', {deltaY: 120, bubbles: true, cancelable: true}));
    check('wheel over canvas still pans', c.translateY !== before);
    v.outlinePanelEl.style.display = 'none';

    // Island todo toggle is one undoable step.
    c.selectNode('b2');
    const historyBefore = c.historyIndex;
    const todo = [...v.islandEl.querySelectorAll('button')].find(b => /待办|已完成/.test(b.textContent));
    todo.click();
    check('island todo marks the node', c.findNode('b2').data.text === '[ ] Other');
    check('island todo adds one history step', c.historyIndex === historyBefore + 1);
    c.undo();
    check('undo restores todo text', c.findNode('b2').data.text === 'Other');

    // Fishbone: moving a bone child deeper drops its stale anchor.
    c.setLayout('fishbone');
    c.moveNode('s2', 's1', 'inside');
    check('fishbone level-3 node has no stale anchor', c.findNode('s2')._boneConnectX === undefined);
    c.undo(); c.undo();

    // Esc steps out of branch focus once nothing is selected.
    c.setBranchFocus('b1');
    const esc = () => c.container.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true, cancelable:true}));
    esc(); esc();
    check('Esc leaves branch focus', c.branchFocusId === null);

    // Snapshot retention on the real adapter.
    for (let i = 0; i < 33; i++) { await v.writeSnapshot(`qa-${i}`, 'before-save', source); await new Promise(r => setTimeout(r, 2)); }
    let mine = 0;
    for (const p of (await app.vault.adapter.list(backups)).files) {
      try { if (JSON.parse(await app.vault.adapter.read(p)).sourcePath === sourcePath) mine++; } catch (_) {}
    }
    check('snapshots capped at 30 per map', mine === 30, mine);
  } catch (error) {
    check('no exception', false, String(error?.stack || error));
  } finally {
    if (leaf) leaf.detach();
    // Clean up only snapshots that belong to the QA map.
    try {
      for (const p of (await app.vault.adapter.list(backups)).files) {
        try { if (JSON.parse(await app.vault.adapter.read(p)).sourcePath === sourcePath) await app.vault.adapter.trashSystem(p); } catch (_) {}
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, 500));
    const qa = app.vault.getAbstractFileByPath(folder);
    if (qa) await app.vault.trash(qa, true);
  }
  report.pass = report.checks.every(x => x.pass);
  return JSON.stringify(report, null, 1);
})()
