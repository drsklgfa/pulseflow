const fs = require('node:fs');
const path = require('node:path');

function loadTypeScript() {
  const candidates = [
    'typescript',
    '/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript',
    '/usr/local/lib/node_modules/typescript',
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // Try the next known location.
    }
  }
  throw new Error('TypeScript is not installed. Run npm install first.');
}

const ts = loadTypeScript();
const root = process.cwd();
const ignored = new Set(['node_modules', 'dist', 'coverage', '.git']);
const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) files.push(full);
  }
}

for (const folder of ['apps', 'packages']) walk(path.join(root, folder));
let failures = 0;
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2023,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
    },
    fileName: file,
    reportDiagnostics: true,
  });
  for (const diagnostic of result.diagnostics ?? []) {
    if (diagnostic.category !== ts.DiagnosticCategory.Error) continue;
    failures += 1;
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    const relative = path.relative(root, file);
    console.error(`${relative}: ${message}`);
  }
}

if (failures > 0) {
  console.error(`TypeScript syntax validation failed with ${failures} error(s).`);
  process.exit(1);
}
console.log(`TypeScript syntax OK: ${files.length} files.`);
