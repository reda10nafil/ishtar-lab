const ts = require('../piattaforma/node_modules/typescript');
module.exports = {process(source,file){return {code:ts.transpileModule(source,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText};}};
