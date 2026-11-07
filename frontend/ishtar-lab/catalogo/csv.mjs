export function parseCSV(text) {
  text=text.replace(/^\uFEFF/,'');
  const header=text.split(/\r?\n/)[0];
  const count=s=>{let quoted=false,n=0;for(let i=0;i<header.length;i++){if(header[i]==='"'){if(header[i+1]==='"'&&quoted)i++;else quoted=!quoted;}else if(!quoted&&header[i]===s)n++;}return n;};
  const delimiter=[',',';','\t'].sort((a,b)=>count(b)-count(a))[0];
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||cell==='')quoted=!quoted;else cell+=c;}
    else if(c===delimiter&&!quoted){row.push(cell);cell='';}
    else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw Error('Virgolette non chiuse nel CSV');
  row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
  const headers=rows.shift()?.map(s=>s.trim());
  if(!headers?.length||new Set(headers).size!==headers.length||headers.some(h=>!h))throw Error('Intestazioni CSV vuote o duplicate');
  if(rows.length>10000)throw Error('Massimo 10.000 righe per file');
  for(let i=0;i<rows.length;i++)if(rows[i].length!==headers.length)throw Error(`Record ${i+2}: numero di colonne diverso dall’intestazione`);
  return {headers,rows,delimiter};
}
export function numberCSV(value) {
  let s=String(value??'').trim().replace(/[€\s]/g,'');
  if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
  if(!s)return 0;
  const n=Number(s);if(!Number.isFinite(n)||n<0)throw Error(`Numero non valido: ${value}`);return n;
}
