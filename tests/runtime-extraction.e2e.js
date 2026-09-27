(async () => {
  const plugin = app.plugins.plugins['crisp-mind'];
  if (!plugin?.isLicensed()) throw Error('Requires the existing activated runtime');
  const report = {checks:[], version:plugin.manifest.version};
  const check = (name, pass) => report.checks.push({name,pass:!!pass});
  const folder = 'Crisp-Mind-QA-' + Date.now();
  const previous = app.workspace.activeLeaf;
  await app.vault.createFolder(folder);
  const content = (title='QA', text='Branch') => `# ${title}\n- ${text}\n\n<!-- CRISP-MIND-DATA-START -->\n\`\`\`crisp-mind\n${JSON.stringify({version:'1.1',layout:'logicalStructure',theme:'crisp-obsidian',root:{id:'qa-root',data:{text:title},children:[{id:'qa-branch',data:{text},children:[]}]}})}\n\`\`\`\n<!-- CRISP-MIND-DATA-END -->\n`;
  let leaf;
  try {
    const source = await app.vault.create(folder+'/source.mind.md', content());
    leaf = app.workspace.getLeaf('tab');
    await leaf.setViewState({type:'crisp-mind-view',state:{file:source.path}});
    await leaf.loadIfDeferred();
    const v = leaf.view;
    const reset = () => {
      v.setViewData(content(), true);
      const c=v.canvasController, n=c.docData.root.children[0];
      c.setSelectionState([n.id],n.id);
      return {c,n};
    };
    // Hold only the test note's create operation to reproduce user actions during I/O.
    const pending = async action => {
      const create=app.vault.create;
      let release;
      app.vault.create=async function(path,content,...args) {
        if (path.startsWith(folder+'/Branch')) await new Promise(r=>release=r);
        return create.call(this,path,content,...args);
      };
      try {
        const operation=v.extractCurrentNodeToTopic();
        if (!release) { await operation; throw Error('Extraction did not reach note creation'); }
        action();release();await operation;
      } finally { app.vault.create=create; }
    };
    let {c,n}=reset();
    await v.extractCurrentNodeToTopic();
    check('normal extraction links a real note', /\[\[/.test(c.findNode(n.id).data.text));
    c.undo();check('normal extraction undo restores text', c.findNode(n.id).data.text==='Branch');
    c.redo();check('normal extraction redo restores link', /\[\[/.test(c.findNode(n.id).data.text));
    ({c,n}=reset());
    c.transact(()=>{c.docData.root.data.note='unrelated edit';});
    await pending(()=>c.undo());
    check('undo during extraction still links the live node', /\[\[/.test(c.findNode(n.id).data.text));
    ({c,n}=reset());
    await pending(()=>c.transact(()=>{n.data.text='New text';}));
    check('new node text survives pending extraction', c.findNode(n.id).data.text==='New text');
    ({c,n}=reset());
    await pending(()=>v.setViewData(content('Other','Other branch'),true));
    check('switched document unchanged', v.canvasController.docData.root.children[0].data.text==='Other branch');
    check('old node not mutated after document switch', n.data.text==='Branch');
    ({c,n}=reset());
    c.options.readOnly=true;v.readOnly=true;
    const before=app.vault.getFiles().filter(f=>f.path.startsWith(folder+'/')).length;
    await v.extractCurrentNodeToTopic();
    check('read-only extraction creates no file',app.vault.getFiles().filter(f=>f.path.startsWith(folder+'/')).length===before);
    v.readOnly=false;c.options.readOnly=false;
    ({c,n}=reset());
    const prompt=v.promptWikilink;
    let apply;v.promptWikilink=callback=>apply=callback;
    v.editNodeLink(n.id);
    // Reusing node IDs occurs when the same file is reloaded or restored.
    v.dirty=true;const raw=v.getViewData();
    v.setViewData(raw,true);
    apply('[[QA target]]');
    check('stale link dialog cannot edit replacement controller',v.canvasController.findNode(n.id).data.text==='Branch');
    v.promptWikilink=prompt;
    await v.save();
  } finally {
    if(leaf) await leaf.detach();
    if(previous) app.workspace.setActiveLeaf(previous,{focus:true});
    const testFolder=app.vault.getAbstractFileByPath(folder);
    // Let Obsidian finish indexing newly created fixtures before trashing them.
    for(let attempt=0;attempt<100;attempt++) {
      const files=app.vault.getMarkdownFiles().filter(f=>f.path.startsWith(folder+'/'));
      if(files.every(f=>app.metadataCache.getFileCache(f))) break;
      await new Promise(r=>setTimeout(r,50));
    }
    if(testFolder) await app.vault.trash(testFolder,true);
  }
  report.pass=report.checks.every(c=>c.pass);
  return JSON.stringify(report);
})()
