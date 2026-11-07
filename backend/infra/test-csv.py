"""Verifica l'output del vero serializer con un parser CSV indipendente."""
import csv
import io
import json
from pathlib import Path
import subprocess
root=Path(__file__).resolve().parent
cases=json.loads(subprocess.check_output(['node',str(root/'csv-probe.cjs')],text=True,encoding='utf-8'))
for case in cases:
    assert case['csv'].startswith('\ufeff')
    rows=list(csv.reader(io.StringIO(case['csv'].lstrip('\ufeff'),newline=''),delimiter=';'))
    assert len(rows)==2 and all(len(row)==2 for row in rows), repr(case)
    value=case['value']
    expected='' if value is None else str(value)
    if isinstance(value,str) and value and value[0] in '=+-@\t\r': expected="'"+value
    assert rows[1]==[expected,'Draft'],repr(rows)
print(f'CSV: {len(cases)} casi superati; CR/LF, formule, separatori, Unicode e numeri conservati.')
