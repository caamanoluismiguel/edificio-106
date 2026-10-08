// Codex, 8 oct 2026. Auditoría local: no escribe EPW ni modifica la aplicación.
// node docs/analisis/epw/auditar.mjs /ruta/archivo2024.epw
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

// Adaptación del import JSON sin atributos que Vite admite en el módulo original.
register('data:text/javascript,' + encodeURIComponent(`
import {readFile} from 'node:fs/promises';
export async function load(url,context,next){
 if(url.endsWith('.json')) return {format:'module',source:'export default '+await readFile(new URL(url),'utf8'),shortCircuit:true};
 return next(url,context);
}`), import.meta.url);
const { Clima } = await import('../../../fuente/src/clima.js');
const { epw } = await import('../../../fuente/src/epw.js');
const { posicionSol, LAT, LON } = await import('../../../fuente/src/sol.js');
const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '../../..');
const sha = b => createHash('sha256').update(b).digest('hex');

// Solo satisface las dos lecturas del Clima original con archivos locales.
const originalFetch = globalThis.fetch;
globalThis.fetch = async url => {
  const allowed = { 'local:datos/clima_horario.bin.gz': 'datos/clima_horario.bin.gz',
    'local:ajuste': 'datos/ajuste_albrook.json' };
  assert.ok(allowed[String(url)], 'Lectura fuera de las entradas locales previstas');
  return new Response(fs.readFileSync(path.join(root, allowed[String(url)])));
};
const clima = new Clima();
try {
  await clima.cargarHorario('local:');
  assert.equal(await clima.cargarAjuste('local:ajuste'), true);
} finally { globalThis.fetch = originalFetch; }

const file = fs.readFileSync(process.argv[2]);
const text = file.toString('utf8');
const lines = text.trimEnd().split(/\r?\n/);
const headers = lines.slice(0,8);
assert.equal(headers[0].split(',')[0], 'LOCATION');
assert.equal(+headers[0].split(',').at(-2), -5);
const rows = lines.slice(8).map(l=>l.split(','));
assert.equal(rows.length,8760);
assert.ok(rows.every(r=>r.length===35));
assert.equal(new Set(rows.map(r=>r.slice(0,4).join(','))).size,8760);
assert.ok(rows.every(r=>+r[0]===2024 && +r[4]===60));
assert.ok(!rows.some(r=>+r[1]===2 && +r[2]===29));
assert.equal(text.replaceAll('\r\n','').includes('\n'),false);
const calendar=[];
for(let month=1;month<=12;month++) for(let day=1;day<=new Date(Date.UTC(2024,month,0)).getUTCDate();day++){
  if(month===2 && day===29) continue;
  for(let hour=1;hour<=24;hour++) calendar.push([2024,month,day,hour]);
}
rows.forEach((r,i)=>assert.deepEqual(r.slice(0,4).map(Number),calendar[i]));
const regenerated=epw(clima,2024);
assert.equal(regenerated,text,'El archivo de Descargas difiere del exportador y datos actuales');

const errors={temp:0,rh:0,wind:0,dni:0,dhi:0,ghi:0,rain:0};
let invalid=0,dewAboveDry=0;
const sourceIndices=[];
for(const r of rows){
  const [year,month,day,hour]=r.slice(0,4).map(Number);
  // Cálculo independiente del índice de fin de intervalo; no usa indice() ni el clamp del exportador.
  const i=(Date.UTC(year,month-1,day,hour)-Date.UTC(2001,0,1))/3600000;
  assert.ok(i>=0 && i<clima.n);
  sourceIndices.push(i);
  const [temp,rh]=clima.th(i);
  const dni=clima.valor('dni',i),dhi=clima.valor('difusa',i);
  const altitude=posicionSol({y:year,m:month,d:day,h:hour-1,min:30},LAT,LON).alt;
  const expected={temp,rh,wind:clima.valor('viento',i)/3.6,dni,dhi,
    ghi:dni*Math.max(0,Math.sin(altitude*Math.PI/180))+dhi,rain:clima.valor('lluvia',i)};
  const column={temp:6,rh:8,wind:21,dni:14,dhi:15,ghi:13,rain:33};
  for(const [key,index] of Object.entries(column)) errors[key]=Math.max(errors[key],Math.abs(+r[index]-expected[key]));
  const valid=+r[6]>-70 && +r[6]<70 && +r[8]>=0 && +r[8]<=100 && +r[9]>31000 && +r[9]<120000 &&
    +r[20]>=0 && +r[20]<=360 && +r[21]>=0 && +r[21]<=40 && [13,14,15].every(k=>+r[k]>=0 && +r[k]<9999);
  invalid+=!valid;dewAboveDry+=+r[7]>+r[6];
}
assert.equal(invalid,0);assert.equal(dewAboveDry,0);
assert.ok(errors.temp<=.050001 && errors.rh<=.500001 && errors.wind<=.050001 && errors.ghi<=.500001);
assert.equal(errors.dni,0);assert.equal(errors.dhi,0);assert.equal(errors.rain,0);

const summary = col => {
  const a=rows.map(r=>+r[col]);return {min:Math.min(...a),max:Math.max(...a),mean:a.reduce((s,v)=>s+v,0)/a.length};
};
const stamp=i=>new Date(Date.UTC(2001,0,1)+i*3600000).toISOString().replace('.000Z',' (hora Panamá representada como UTC)');
const boundaryDays=['2024,1,1,1','2024,2,28,24','2024,3,1,1','2024,12,31,24'];
const samples=boundaryDays.map(key=>{
  const j=rows.findIndex(r=>r.slice(0,4).join(',')===key);return {epw:key,source_index:sourceIndices[j],source_time:stamp(sourceIndices[j]),data:rows[j]};
});
const gaps=[];
for(let j=1;j<sourceIndices.length;j++) if(sourceIndices[j]-sourceIndices[j-1]!==1)
  gaps.push({after:rows[j-1].slice(0,4).join(','),before:rows[j].slice(0,4).join(','),hours:sourceIndices[j]-sourceIndices[j-1]});

// Reproducción del límite real de la serie en 2025, sin alterar el archivo del usuario.
const requestedEnd=(Date.UTC(2026,0,1)-Date.UTC(2001,0,1))/3600000;
const exported2025=epw(clima,2025);
const warning=' Cierre 31/12 h24: ERA5 adicional del 01/01/2026 00:00 Panama; consultado 2026-10-08. Ajuste mensual de Albrook prolongado una hora.';
const lines2025=exported2025.trimEnd().split('\r\n');
assert.equal(lines2025.length,8768);
assert.ok(lines2025.slice(8).every(line=>line.split(',').length===35));
assert.ok(lines2025[6].startsWith('COMMENTS 2,'));
assert.ok(lines2025[6].endsWith(warning));
assert.equal(exported2025.split(warning).length,2);
assert.ok(!exported2025.includes('se reutiliza'));
assert.ok(!regenerated.includes('Registros fuera del final'));
// SHA-256 capturado antes del ajuste de Codex sobre epw.js de aa47881.
// Solo pueden cambiar COMMENTS 2 y la última fila: reconstruir la salida anterior.
const baseline2025='98d65c44c2982e84e547c6c4541fa4e4f4515686f9e58eb1f88bf98521255c7e';
const before=[...lines2025];
before[6]=before[6].replace(warning,'');
const oldLast=before.at(-2).split(',');oldLast[3]='24';before[before.length-1]=oldLast.join(',');
assert.equal(sha(before.join('\r\n')+'\r\n'),baseline2025);
// Referencia: extender solo en memoria el C107 y dejar que Clima.th haga el ajuste.
// Debe coincidir con el cierre especial sin modificar el binario del visor.
const cierre=JSON.parse(fs.readFileSync(path.join(root,'fuente/src/epw-cierre.json')));
const extended=Object.create(clima);extended.n=clima.n+1;extended.horario={};
const scales={nubes:[1,0],lluvia:[10,0],temp:[6,10],humedad:[1,0],dni:[.25,0],difusa:[.25,0],viento:[1,0],dir:[.5,0]};
for(const [k,[scale,offset]] of Object.entries(scales)){
  const original=clima.horario[k],column=new original.constructor(clima.n+1);
  column.set(original);column[clima.n]=Math.round((cierre.valores[k]-offset)*scale);extended.horario[k]=column;
}
assert.deepEqual(epw(extended,2025).trimEnd().split('\r\n').slice(8),lines2025.slice(8));
const raw=Object.create(clima);raw.ajuste=null;
const rawLast=epw(raw,2025).trimEnd().split('\r\n').at(-1).split(',');
assert.equal(rawLast[6],'26.2');assert.equal(rawLast[8],'86');
assert.equal(rawLast[20],'340');assert.equal(rawLast[21],'4.4');
assert.ok(!epw(raw,2025).includes('Ajuste mensual de Albrook prolongado'));
// Acortar una hora la serie demuestra que el contador no está fijado a 2025/1.
const truncated=Object.create(clima);
truncated.n=clima.n-1;
assert.ok(epw(truncated,2025).split('\r\n')[6].includes('Registros fuera del final de la serie: 2;'));
const last2025=exported2025.trimEnd().split('\r\n').slice(-2).map(l=>l.split(','));
const eof={requested_index:requestedEnd,available_last_index:clima.n-1,available_last_time:stamp(clima.n-1),
  lacks_next_hour:requestedEnd>=clima.n,
  last_two_rows_equal_excluding_time:last2025[0].slice(5).join(',')===last2025[1].slice(5).join(','),
  reused_index:null,recovered_from_era5:true,last_record:last2025.at(-1),
  warning_in_comments_2:warning.trim(),only_comments_and_last_record_changed:true,baseline_sha256:baseline2025,
  matches_extended_clima:true,raw_mode_verified:true,
  truncated_series_count_verified:2};
assert.equal(eof.lacks_next_hour,true);
assert.equal(eof.last_two_rows_equal_excluding_time,false);
const sources=['fuente/src/epw.js','fuente/src/clima.js','fuente/src/ajuste.js','fuente/src/sol.js',
  'fuente/src/epw-cierre.json','datos/clima_horario.bin.gz','datos/ajuste_albrook.json'];
const report={autor:'OpenAI Codex',fecha:'2026-10-08',node:process.version,
  epw:{name:path.basename(process.argv[2]),sha256:sha(file),bytes:file.length,header_lines:8,rows:rows.length,fields:35,crlf:true,
    same_bytes_as_current_export:true,year:2024,timezone:-5,feb29_omitted:true},
  sources_sha256:Object.fromEntries(sources.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))])),
  checks:{unique_dates:8760,calendar_order:true,invalid_primary_ranges:invalid,dew_above_dry:dewAboveDry,
    maximum_rounding_errors:errors,source_gaps:gaps},
  stats:{temp:summary(6),rh:summary(8),wind_ms:summary(21),ghi_Whm2:summary(13),dni_Whm2:summary(14),dhi_Whm2:summary(15)},
  samples,end_of_series_2025:eof,
  limitations:['Reproducción numérica no valida ERA5 frente al clima medido.',
    'GHI reconstruida usando altura solar del centro de hora; no medida.',
    'Presión estándar 101037 Pa; cielo opaco igualado al total; nieve 0 y días desde nieve 88 son constantes.',
    'No ejecuta la interfaz CBE Clima; no certifica importación completa.']};
fs.writeFileSync(path.join(out,'resultado.json'),JSON.stringify(report,null,2)+'\n');
if(process.argv[3]) fs.writeFileSync(process.argv[3],exported2025);
console.log(JSON.stringify({epw:report.epw,checks:report.checks,stats:report.stats,end_of_series_2025:eof},null,2));
