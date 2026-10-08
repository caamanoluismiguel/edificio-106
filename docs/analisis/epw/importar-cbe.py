"""Codex: ejecuta la carga original de CBE y contrasta sus datos; no publica archivos.
Uso: python importar-cbe.py /ruta/clima /ruta/archivo.epw [resultado.json]
Requiere un entorno aislado con el Pipfile de CBE 8e3d089.
"""
import base64
import csv
import hashlib
import importlib.metadata
import json
import os
import subprocess
import sys
from pathlib import Path

source, epw = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
out = (Path(sys.argv[3]) if len(sys.argv) > 3 else Path(__file__).with_name('cbe-importacion-2024.json')).resolve()
commit = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
assert commit == '8e3d08911b93aded23589c247ca997cea462f7a6'
sys.path.insert(0, str(source))
os.chdir(source)  # CBE busca assets/ respecto a su directorio de ejecución.
import main  # registra la aplicación original y sus callbacks
from dash._callback_context import context_value
from dash._utils import AttributeDict
from pages.select import submitted_data
from pages.lib.extract_df import create_df
import numpy as np

data = epw.read_bytes()
lines = data.decode('utf8').split('\n')
token = context_value.set(AttributeDict(triggered_inputs=[{'prop_id': 'upload-data.contents'}]))
try:
    result = submitted_data(None, None,
        ['data:application/octet-stream;base64,' + base64.b64encode(data).decode()], [epw.name], None)
finally:
    context_value.reset(token)
assert result[4] == 'green', result[3]
assert result[1] == lines
df, meta = create_df(lines, epw.name)
assert result[0] == meta
rows = list(csv.reader(lines[8:8768]))
assert len(df) == len(rows) == 8760
cols = {'year': 0, 'month': 1, 'day': 2, 'hour': 3,
        'DBT': 6, 'DPT': 7, 'RH': 8, 'p_atm': 9,
        'glob_hor_rad': 13, 'dir_nor_rad': 14, 'dif_hor_rad': 15,
        'wind_dir': 20, 'wind_speed': 21, 'tot_sky_cover': 22}
errors = {}
for name, column in cols.items():
    expected = np.array([float(r[column]) for r in rows])
    actual = df[name].to_numpy(dtype=float)
    assert np.isfinite(actual).all()
    errors[name] = float(np.max(np.abs(actual - expected)))
    assert errors[name] == 0, (name, errors[name])
stats = {name: dict(min=float(df[name].min()), max=float(df[name].max()), mean=float(df[name].mean()))
         for name in ('DBT', 'RH', 'wind_speed', 'glob_hor_rad', 'dir_nor_rad', 'dif_hor_rad')}
dates = [(1, 1, 1), (2, 28, 24), (3, 1, 1), (12, 31, 24)]
samples = []
for month, day, hour in dates:
    sample = df[(df.month == month) & (df.day == day) & (df.hour == hour)]
    assert len(sample) == 1
    samples.append(dict(epw=[int(sample.iloc[0]['year']), month, day, hour],
                        cbe_time=str(sample.index[0]),
                        values={k: float(sample.iloc[0][k]) for k in cols}))
report = dict(autor='OpenAI Codex', fecha='2026-10-08', cbe_commit=commit,
    python=sys.version.split()[0],
    versions={k: importlib.metadata.version(k) for k in
              ('dash', 'pvlib', 'pythermalcomfort', 'pandas', 'numpy', 'scipy', 'numba')},
    epw=epw.name, epw_sha256=hashlib.sha256(data).hexdigest(),
    upload_callback_success=True, callback_message=result[3], callback_color=result[4],
    rows=len(df), columns=len(df.columns), metadata=meta, maximum_errors=errors,
    stats=stats, samples=samples, filters='Todos los meses y horas; unidades SI; sin filtros.',
    derived_nan_counts={c: int(df[c].isna().sum()) for c in df.columns if c.startswith('utci_') or c == 'MRT'},
    scope='Carga local original submitted_data + create_df completa; no prueba el navegador ni el servicio público.')
out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(dict(success=True, rows=len(df), period=meta['period'], max_error=max(errors.values()), output=str(out)), indent=2))
