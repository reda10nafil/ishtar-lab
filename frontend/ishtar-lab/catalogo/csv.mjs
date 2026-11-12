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
// Cella vuota: null ("non indicato"), distinta dallo zero. Separatori: con punto e virgola insieme è decimale quello che
// compare per ultimo, con gruppi di migliaia verificati (1.234,50 · 1,234.50); con la sola virgola è decimale (12,50) salvo
// gruppi inglesi di migliaia (1,234,567); con il solo punto i gruppi esatti di tre cifre sono migliaia (1.200 · 1.234.567),
// altrimenti è decimale (89.9 · 0.500). La convenzione decisa per l'intera colonna ('punto' o 'virgola', vedi importa.mjs)
// prevale sulle forme ambigue. Ammessi solo cifre, separatori e un + iniziale: niente 1e3, 0x10, segni o celle di soli simboli.
export function numberCSV(value,convenzione=null) {
  const grezzo=String(value??'').trim();
  if(!grezzo)return null;
  const invalido=()=>Error(`Numero non valido: ${value}`);
  let s=grezzo.replace(/[€\s ]/g,'').replace(/^\+/,'');
  if(/^[.,]\d+$/.test(s))s='0'+s;
  if(!/^\d[\d.,]*$/.test(s))throw invalido();
  const virgole=s.split(',').length-1,punti=s.split('.').length-1;
  const gruppi=sep=>new RegExp(`^\\d{1,3}(\\${sep}\\d{3})+$`);
  let normale;
  if(virgole&&punti){
    const virgolaDecimale=s.lastIndexOf(',')>s.lastIndexOf('.');
    const [migliaia,decimale]=virgolaDecimale?['.',',']:[',','.'];
    const parti=s.split(decimale);
    if(parti.length!==2||!gruppi(migliaia).test(parti[0])||!/^\d+$/.test(parti[1]))throw invalido();
    normale=parti[0].split(migliaia).join('')+'.'+parti[1];
  }else if(virgole){
    if(convenzione==='punto'){if(!gruppi(',').test(s))throw invalido();normale=s.replace(/,/g,'');}
    else if(virgole===1)normale=s.replace(',','.');
    else if(gruppi(',').test(s))normale=s.replace(/,/g,'');
    else throw invalido();
  }else if(punti){
    if(convenzione==='punto'){if(punti!==1)throw invalido();normale=s;}
    else if(convenzione==='virgola'){if(!gruppi('.').test(s))throw invalido();normale=s.replace(/\./g,'');}
    else if(/^[1-9]\d{0,2}(\.\d{3})+$/.test(s))normale=s.replace(/\./g,'');
    else if(punti===1)normale=s;
    else throw invalido();
  }else normale=s;
  const n=Number(normale);if(!Number.isFinite(n)||n<0)throw invalido();return n;
}
