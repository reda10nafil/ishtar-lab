const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('../piattaforma/node_modules/typescript');
const source=fs.readFileSync(path.join(__dirname,'../piattaforma/apps/console/src/esporta.ts'),'utf8');
let content;const sandbox={exports:{},Blob:class{constructor(parts){content=parts.join('')}},URL:{createObjectURL(){return 'blob:test'},revokeObjectURL(){}},document:{createElement(){return {click(){}}}}};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText,sandbox);
const values=['Shirt\r=1+1','Shirt\r\n=1+1','Shirt\n=1+1','A;B','A"B','=1+1','+1','-1','@name','\t=1','è Ishtar',null,-42];
console.log(JSON.stringify(values.map(value=>{sandbox.exports.scaricaCsv('test',['Name','Status'],[[value,'Draft']]);return {value,csv:content}})));
