const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise real application modules without contacting or modifying Supabase.
function load(file, mocks, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => {
    if (!(name in mocks)) throw Error(`Unexpected dependency: ${name}`);
    return mocks[name];
  }, Error, process: { env: {} }, ...globals }, { filename: file });
  return exports;
}


module.exports = { load };
