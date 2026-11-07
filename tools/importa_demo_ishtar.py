"""Importa solo nella copia locale: idempotente per SKU, senza cancellazioni."""
import csv
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
ROOT=Path(__file__).resolve().parents[1]
BASE="http://127.0.0.1:4273/api/catalogo"
def api(data=None):
    req=Request(BASE,data=None if data is None else json.dumps(data).encode(),headers={"X-Ishtar-Local":"1","Content-Type":"application/json","Origin":"http://127.0.0.1:4273"})
    try:
        with urlopen(req,timeout=180) as r:return json.load(r)
    except HTTPError as e:raise RuntimeError(e.read().decode()) from e
def main():
    before=api(); existing={p['sku']:p for p in before['products']}
    rows=list(csv.DictReader((ROOT/'frontend/catalogo/inventario-demo.csv').open(encoding='utf-8-sig',newline='')))
    report={'before':len(existing),'created':[],'skipped':[],'errors':[]}
    for row in rows:
        sku=row['SKU']
        if sku in existing:report['skipped'].append(sku);continue
        p={'sku':sku,'name':row['Nome'],'description':row['Descrizione'],'category':row['Categoria'],'gender':row['Genere'],
           'size':row['Taglia/Variante'],'color':row['Colore'],'material':row['Materiale'],'price':float(row['Prezzo Vendita']),
           'cost':float(row['Costo Acquisto']),'stock':int(row['Quantita Stock']),'photos':[row['Link Foto']] if row['Link Foto'] else [],
           'demo':True,'custom':{'fornitore':row['Fornitore'],'sistema_taglie':row['Sistema Taglie'],'note':row['Note']}}
        try:
            result=api({'product':p});report['created'].append({'sku':sku,'id':result['id']});print(f"{len(report['created'])} creati: {sku}",flush=True)
        except Exception as e:
            report['errors'].append({'sku':sku,'error':str(e)})
            print('Errore: '+str(e),flush=True)
            break
    after=api();report['after']=len(after['products'])
    (ROOT/'verifiche/importazione-demo-database.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'created':len(report['created']),'skipped':len(report['skipped']),'errors':report['errors'],'after':report['after']}),flush=True)
    if report['errors']:raise SystemExit(1)
if __name__=='__main__':main()
