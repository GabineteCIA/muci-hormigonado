'use strict';
const ZONE='America/Asuncion';
const keys=['armaduras','temperatura','calidad','puntales'];
const labels=['Armaduras','Temperatura del hormigón','Calidad del hormigón','Puntales y encofrado'];
const states=['Sin registro','En control','En inspección','Verificado','Con observaciones'];
const n=v=>v!==null&&v!==''&&Number.isFinite(Number(v));
const stamp=s=>s?new Date(s.length===16?s+':00-03:00':s).getTime():NaN;
const number=v=>n(v)?Number(v).toLocaleString('es-PY',{maximumFractionDigits:1}):'—';
const hour=t=>Number.isFinite(t)?new Date(t).toLocaleTimeString('es-PY',{timeZone:ZONE,hour:'2-digit',minute:'2-digit',hour12:false}):'—';
function duration(h){if(!Number.isFinite(h)||h<0)return '—';let m=Math.round(h*60);return Math.floor(m/60)+' h'+(m%60?' '+m%60+' min':'');}
function calculate(d){
 const start=stamp(d.inicioReal),cut=stamp(d.cierreReal||d.corte),planned=stamp(d.fecha+'T'+d.inicioPrevisto),hours=Number(d.duracionHoras),target=Number(d.metaM3);
 const elapsed=Number.isFinite(start)&&Number.isFinite(cut)&&cut>=start?(cut-start)/3600000:NaN;
 const endPlan=planned+hours*3600000;
 const pct=n(d.m3)&&target>0?Number(d.m3)/target*100:NaN;
 const expected=Number.isFinite(cut)?Math.max(0,Math.min(100,(cut-planned)/(hours*3600000)*100)):NaN;
 const rate=elapsed>0&&n(d.m3)?Number(d.m3)/elapsed:NaN;
 const projected=rate>0?cut+Math.max(0,target-Number(d.m3))/rate*3600000:NaN;
 const end=d.cierreReal?stamp(d.cierreReal):projected;
 return {start,cut,elapsed,endPlan,pct,expected,rate,end,remaining:n(d.m3)?Math.max(0,target-Number(d.m3)):NaN,delta:Number.isFinite(end)?Math.round((endPlan-end)/60000):NaN};
}
function validate(d){
 if(!d||typeof d!=='object')throw Error('Archivo de datos no válido.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha)||!/^\d{2}:\d{2}$/.test(d.inicioPrevisto))throw Error('Revisá la fecha y el inicio previsto.');
 if(!n(d.metaM3)||d.metaM3<=0||!n(d.duracionHoras)||d.duracionHoras<=0||d.duracionHoras>72)throw Error('El volumen y la duración previstos deben ser mayores que cero.');
 for(const k of ['m3','camiones','personal','personalPrevisto'])if(d[k]!==null&&(!n(d[k])||d[k]<0||(k!=='m3'&&!Number.isInteger(Number(d[k])))))throw Error('Revisá los valores de volumen, camiones y personal.');
 for(const k of ['inicioReal','corte','cierreReal'])if(d[k]&&!Number.isFinite(stamp(d[k])))throw Error('Revisá las fechas y horas.');
 if(d.corte&&d.inicioReal&&stamp(d.corte)<stamp(d.inicioReal))throw Error('La actualización no puede ser anterior al inicio real.');
 if(d.cierreReal&&(!d.inicioReal||stamp(d.cierreReal)<stamp(d.inicioReal)))throw Error('Revisá el inicio y el cierre real.');
 if(d.cierreReal&&(!d.corte||stamp(d.cierreReal)>stamp(d.corte)))throw Error('La actualización debe ser igual o posterior al cierre.');
 if((['m3','camiones','personal'].some(k=>d[k]!==null)||keys.some(k=>d[k]!=='Sin registro'))&&!d.corte)throw Error('Agregá la fecha y hora de actualización para los datos registrados.');
 if(d.cierreReal&&d.m3===null)throw Error('Ingresá el volumen colocado al cierre.');
 for(const k of keys)if(!states.includes(d[k]))throw Error('Estado de fiscalización no válido.');
 return d;
}
if(typeof module!=='undefined')module.exports={calculate,validate};
if(typeof document!=='undefined'){
 const $=id=>document.getElementById(id);const text=(id,v)=>$(id).textContent=v;let current=null;const editing=new URLSearchParams(location.search).has('editar');
 function render(d){const c=calculate(d);text('sector',d.sector);text('fecha',new Date(d.fecha+'T12:00:00-03:00').toLocaleDateString('es-PY',{timeZone:ZONE,day:'numeric',month:'long',year:'numeric'}));
 text('m3',number(d.m3));text('camiones',number(d.camiones));text('personal',number(d.personal));text('meta','Meta: '+number(d.metaM3)+' m³');text('prev-personal','Previsto: ≈'+number(d.personalPrevisto));text('duracion','Previsto: '+number(d.duracionHoras)+' h · al último corte');text('transcurrido',duration(c.elapsed));
 text('porcentaje',Number.isFinite(c.pct)?number(c.pct)+' %':'—');text('ejecutado','Ejecutado: '+(Number.isFinite(c.pct)?number(c.pct)+' %':'—'));text('previsto','Previsto al corte: '+(Number.isFinite(c.expected)?number(c.expected)+' %':'—'));text('restante',Number.isFinite(c.remaining)?'Restan '+number(c.remaining)+' m³':'Pendiente de registro');$('fill').style.width=Math.min(100,Math.max(0,c.pct||0))+'%';if(Number.isFinite(c.pct))$('progress').setAttribute('aria-valuenow',Math.min(100,c.pct));else $('progress').removeAttribute('aria-valuenow');
 text('inicio',hour(c.start));text('fin-plan',hour(c.endPlan));$('fin-label').firstChild.textContent=d.cierreReal?'Cierre real':'Proyección';text('fin',hour(c.end));text('ritmo','Ritmo promedio: '+(Number.isFinite(c.rate)?number(c.rate)+' m³/h':'—'));
 let balance='Pendiente de datos',tone='neutral';
 if(Number.isFinite(c.delta)){balance=c.delta===0?'En el horario previsto':Math.abs(c.delta)+' min de '+(c.delta>0?'adelanto':'atraso')+(d.cierreReal?' al cierre':' estimado');tone=c.delta>=0?'good':'warn';}
 if(d.cierreReal&&c.remaining>0){balance='Cerrado con '+number(c.remaining)+' m³ pendientes';tone='warn';}
 if(!d.planConfirmado){balance='Plan pendiente de confirmar';tone='neutral';}
 text('balance',balance);$('balance').className='pill '+tone;
 text('estado',d.cierreReal?'Jornada cerrada':d.corte?'Datos registrados':'Esperando datos');
 text('corte',d.corte?'Última actualización: '+new Date(stamp(d.corte)).toLocaleString('es-PY',{timeZone:ZONE,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})+' h':'Sin actualización registrada');
 $('plan-note').hidden=d.planConfirmado;text('plan-note','Base por confirmar: '+number(d.metaM3)+' m³ · aproximadamente '+number(d.personalPrevisto)+' personas · '+number(d.duracionHoras)+' horas. Referencia: plan del 14/08/2026.');
 text('tiempo-note',d.cierreReal?'Comparación contra el cierre previsto de la jornada.':'Proyección según el ritmo promedio al último corte; puede cambiar con nuevas actualizaciones.');
 for(const k of keys){text(k,d[k]);$(k).className='pill '+(d[k]==='Verificado'?'good':d[k]==='Con observaciones'?'warn':'neutral');}
 $('observaciones-wrap').hidden=!d.observaciones;text('observaciones',d.observaciones||'');
 }
 function fillForm(d){for(const [k,v] of Object.entries(d)){const e=$('form').elements.namedItem(k);if(!e)continue;if(e.type==='checkbox')e.checked=!!v;else e.value=v===null?'':v;}}
 async function load(){try{const r=await fetch('datos.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error();const d=validate(await r.json());current=d;if(editing)fillForm(d);else render(d);$('error').hidden=true;}catch(e){$('error').hidden=false;text('error',current?'No se pudo consultar la última versión. Se conservan los datos anteriores.':'No se pudo cargar datos.json. Revisá que los cuatro archivos estén juntos en el repositorio.');}}
 if(editing){$('dashboard').hidden=true;$('editor').hidden=false;keys.forEach((k,i)=>{const label=document.createElement('label');label.textContent=labels[i];const select=document.createElement('select');select.name=k;for(const state of states){const option=document.createElement('option');option.value=state;option.textContent=state;select.append(option);}label.append(select);$('control-fields').append(label);});
 $('form').addEventListener('submit',event=>{event.preventDefault();$('feedback').hidden=false;try{if(!current)throw Error('Esperá a que se carguen los datos existentes.');const data={...current};const fd=new FormData($('form'));for(const [k,v]of fd.entries())data[k]=v;data.planConfirmado=$('form').elements.planConfirmado.checked;for(const k of ['metaM3','duracionHoras','personalPrevisto','m3','camiones','personal'])data[k]=data[k]===''?null:Number(data[k]);validate(data);const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='datos.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);text('feedback','Archivo descargado. En GitHub: Agregar archivo → Subir archivos → seleccioná datos.json → Confirmar cambios. El nombre debe ser exactamente datos.json, sin (1) ni otro número. Hasta subirlo, la página pública conserva los datos anteriores.');}catch(e){text('feedback',e.message);}});
 }
 load();if(!editing)setInterval(load,60000);
}
