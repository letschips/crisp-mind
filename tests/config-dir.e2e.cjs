// Standalone inheritance lifecycle E2E. Run: node tests/config-dir.e2e.cjs [report.json] [scenario]
// Isolated failure modes: wrong active config directory, fallback to a stale default directory,
// broken default/missing-configDir behavior, getBasePath-only adapter, corrupt JSON/bad signatures,
// sibling settings overwritten, or discovery bypassing local verification/issuing online requests.
// Local throwaway Ed25519 keys and real temporary files; no real credentials or network.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign, webcrypto, createHash } = require('node:crypto');

async function run(options = {}) {
  const root = options.root || path.resolve(__dirname, '..');
  const id = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')).id;
  const names = { 'crisp-pulse': 'CrispPulseLicenseManager', 'crisp-visual': 'CrispVisualLicenseManager',
    'crisp-mind': 'CrispMindLicenseManager', 'crisp-recall': 'CrispRecallPlugin' };
  assert.ok(names[id], `Unsupported plugin ${id}`);
  const pair = generateKeyPairSync('ed25519');
  const pem = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString().trim();
  const makeCode = (licenseId = 'CONFIG-DIR-LOCAL', bad = false) => {
    const payload = Buffer.from(JSON.stringify({ product: 'Crisp Suite', licenseId, features: ['all'],
      expiresAt: '2999-01-01T00:00:00Z' })).toString('base64url');
    return `${payload}.${(bad ? Buffer.alloc(64) : sign(null, Buffer.from(payload), pair.privateKey)).toString('base64url')}`;
  };
  let onlineCalls = 0;
  const timers = new Set();
  const transport = async () => { onlineCalls++; return { status: 200, json: { valid: true } }; };
  const host = options.obsidian || new Proxy({ addIcon() {}, setIcon() {} }, { get: (o, k) => o[k] || class {} });
  const module = { exports: {} };
  const quiet = { log() {}, warn() {}, error() {}, debug() {} };
  const sandbox = { module, exports: module.exports, console: quiet, TextEncoder, TextDecoder, Buffer,
    atob, btoa, crypto: webcrypto, structuredClone,
    setTimeout(fn, ms) { const t = setTimeout(fn, ms); timers.add(t); return t; }, clearTimeout,
    require: name => name === 'obsidian' ? { ...host, requestUrl: transport } : require(name) };
  // Proxies expose no enumerable base classes; resolve those on demand for Node.
  if (!options.obsidian) sandbox.require = name => name === 'obsidian'
    ? new Proxy({ requestUrl: transport, addIcon() {}, setIcon() {} }, { get: (o, k) => o[k] || class {} }) : require(name);
  sandbox.window = sandbox;
  const mainPath = path.join(root, 'main.js');
  const original = fs.readFileSync(mainPath, 'utf8');
  assert.match(original, /`-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----`/);
  const source = original.replace(/`-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----`/, '`' + pem + '`');
  vm.runInNewContext(`${source}\nmodule.exports.__configE2E = { discoverVaultCrispLicense, Manager: ${names[id]} };`, sandbox);
  const { discoverVaultCrispLicense, Manager } = module.exports.__configE2E;
  const scenarios = [
    { name: 'custom', dir: '.obsidian-work', configured: true },
    { name: 'nested-unicode', dir: '配置/工作库', configured: true },
    { name: 'getter', dir: '.obsidian-work', configured: true, getter: true },
    { name: 'default', dir: '.obsidian', configured: true },
    { name: 'missing-config', dir: '.obsidian', configured: false },
    { name: 'no-default-fallback', dir: '.obsidian-work', configured: true, absent: true },
  ].filter(s => !options.scenario || options.scenario === s.name);
  assert.ok(scenarios.length);
  const results = [];
  try {
    for (const scenario of scenarios) {
      const basePath = fs.mkdtempSync(path.join(os.tmpdir(), 'crisp-config-e2e-'));
      const snapshots = new Map();
      const write = (dir, sibling, data) => {
        const file = path.join(basePath, dir, 'plugins', sibling, 'data.json');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const text = typeof data === 'string' ? data : JSON.stringify(data);
        fs.writeFileSync(file, text); snapshots.set(file, text);
      };
      const good = makeCode();
      const stale = makeCode('STALE-DEFAULT');
      if (scenario.dir !== '.obsidian') write('.obsidian', 'crisp-base', { licenseCode: stale });
      if (!scenario.absent) {
        write(scenario.dir, 'crisp-aaa-bad', { licenseCode: makeCode('FORGED', true) });
        write(scenario.dir, 'crisp-bbb-corrupt', '{broken JSON');
        write(scenario.dir, 'crisp-reading-rail', { licenseCode: good, unrelated: 'keep' });
      }
      const app = { appId: 'LOCAL-CONFIG-E2E', plugins: { plugins: {} },
        vault: { adapter: scenario.getter ? { getBasePath: () => basePath } : { basePath } },
        workspace: { getLeavesOfType: () => [] } };
      if (scenario.configured) app.vault.configDir = scenario.dir;
      const beforeCalls = onlineCalls;
      try {
        const discovered = await discoverVaultCrispLicense(app);
        assert.equal(discovered, scenario.absent ? null : good, `${id}/${scenario.name}: must use only the active config directory`);
        assert.equal(onlineCalls, beforeCalls, 'discovery must use local signature checks');
        const settings = { licenseCode: '' };
        let valid = false;
        if (id === 'crisp-pulse') {
          const manager = new Manager(app, settings);
          valid = (await manager.initialize()).valid;
          await manager.backgroundVerification;
          assert.equal(manager.isEntitled(), !scenario.absent);
        } else if (id === 'crisp-visual') {
          const manager = new Manager(app, { settings, saveSettings: async () => {} });
          valid = (await manager.initialize()).valid;
          await manager.backgroundVerification;
          assert.equal(manager.isEntitled(), !scenario.absent);
        } else if (id === 'crisp-mind') {
          // Same discovery -> settings adoption -> validateCurrentLicense flow as onload().
          if (discovered) settings.licenseCode = discovered;
          const manager = new Manager(app, settings);
          valid = (await manager.validateCurrentLicense()).valid;
          assert.equal(manager.isLicensed(), !scenario.absent);
        } else {
          const plugin = Object.create(Manager.prototype);
          Object.assign(plugin, { app, settings, saveSettings: async () => {} });
          valid = (await plugin.refreshLicenseState({ online: true })).valid;
        }
        assert.equal(valid, !scenario.absent);
        assert.equal(settings.licenseCode, scenario.absent ? '' : good);
        assert.equal(onlineCalls - beforeCalls, scenario.absent ? 0 : 1, 'only lifecycle verification contacts transport');
        for (const [file, bytes] of snapshots) assert.equal(fs.readFileSync(file, 'utf8'), bytes, 'sibling settings must remain byte-identical');
        results.push({ name: scenario.name, passed: true, lifecycleValid: valid, onlineCalls: onlineCalls - beforeCalls,
          siblingFilesUnchanged: true });
      } catch (error) {
        // Do not include assertion actual/expected values (the throwaway credential) in evidence.
        results.push({ name: scenario.name, passed: false, error: error.message.split('\n')[0] });
      } finally { fs.rmSync(basePath, { recursive: true, force: true }); }
    }
  } finally { for (const timer of timers) clearTimeout(timer); }
  const report = { plugin: id, host: options.obsidian ? 'Obsidian Electron / real host classes' : 'Node / isolated host',
    artifactSha256: createHash('sha256').update(original).digest('hex'), results,
    passed: results.every(r => r.passed) };
  if (options.reportPath) fs.writeFileSync(options.reportPath, JSON.stringify(report, null, 2) + '\n');
  return report;
}
module.exports = { run };
if (require.main === module) run({ reportPath: process.argv[2], scenario: process.argv[3] })
  .then(report => { console.log(JSON.stringify(report, null, 2)); process.exitCode = report.passed ? 0 : 1; })
  .catch(error => { console.error(error.message.split('\n')[0]); process.exitCode = 1; });
