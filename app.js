const KES=n=>'KES '+Math.round(n).toLocaleString('en-KE'),$=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let D=null,authed=false,sel=null,mode='year',feed=[],flashId=null,stop=null,addingTenant=false,editingTenant=false,formErr='',f={};
const paid=t=>t.payments.reduce((s,p)=>s+p.amount,0),bal=t=>t.rent-paid(t);
const st=t=>bal(t)<=0?['Paid','ok']:paid(t)>0?['Partial','part']:['Unpaid','due'];
function toast(m){const e=$('#toast');e.textContent=m;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>e.hidden=true,3500)}
async function login(){
  try{await API.login($('#u').value.trim(),$('#p').value);D=await API.getOverview();authed=true;
    stop=API.onPayment(onPayment,authLost);render()}catch(e){toast(e.message)}}
function authLost(e){authed=false;sel=null;addingTenant=editingTenant=false;formErr='';f={};if(stop){stop();stop=null}API.logout();toast(e.message);render()}
async function logout(){authed=false;sel=null;feed=[];addingTenant=editingTenant=false;formErr='';f={};if(stop){stop();stop=null}await API.logout();render()}
function onPayment(ev){const t=D.tenants.find(x=>x.id===ev.tenantId);if(!t)return;
  if(!t.payments.some(p=>p.__id&&p.__id===ev.id))t.payments.push({day:ev.day,amount:ev.amount});
  flashId=t.id;feed.unshift(`${ev.time} - ${esc(t.name)} (${esc(t.unit)}) paid ${KES(ev.amount)}`);feed=feed.slice(0,5);
  toast(`M-Pesa: ${KES(ev.amount)} from ${t.name}`);if(!addingTenant&&!editingTenant)render()}
async function remind(id){const t=D.tenants.find(x=>x.id===id);
  try{await API.remindTenant(id);toast(`Reminder sent to ${t.name} (${t.phone}) for ${KES(bal(t))}.`)}catch(e){if(API.isAuthError(e))authLost(e);else toast('Could not send reminder: '+e.message)}}
const phoneOf=v=>'254'+String(v).replace(/\D/g,'').replace(/^(254|0)/,'');
const phoneOk=p=>/^254[17]\d{8}$/.test(p);
const field=(key,label,type='text')=>`<label>${label}<input type="${type}" value="${esc(f[key]??'')}" oninput="f.${key}=this.value"></label>`;
const phoneField=()=>`<label>Phone number<div class="phone-field"><span>254</span><input type="tel" inputmode="numeric" value="${esc(f.phone??'')}" placeholder="712 345 678" oninput="f.phone=this.value"></div></label>`;
const errorBox=()=>formErr?`<p class="err" role="alert">${esc(formErr)}</p>`:'';
function closeTenantForm(){addingTenant=editingTenant=false;formErr='';f={};render()}
function openAddTenant(){addingTenant=true;editingTenant=false;formErr='';f={};render()}
function openEditTenant(id){const t=D.tenants.find(x=>x.id===id);addingTenant=false;editingTenant=true;formErr='';
  f={name:t.name,phone:String(t.phone).replace(/\D/g,'').replace(/^(254|0)/,''),unit:t.unit,rent:t.rent};render()}
function addTenantForm(){return `<div class="sec"><h2>Add tenant</h2>${errorBox()}${field('name','Name')}${phoneField()}<button class="pri" onclick="saveNewTenant()">Save tenant</button> <button onclick="closeTenantForm()">Cancel</button></div>`}
function editTenantForm(t){return `<div class="sec"><h2>Edit ${esc(t.name)}</h2>${errorBox()}${field('name','Name')}${phoneField()}${field('unit','Unit (M-Pesa account number)')}${field('rent','Monthly rent (KES)','number')}<button class="pri" onclick="saveTenantChanges(${t.id})">Save changes</button> <button onclick="closeTenantForm()">Cancel</button></div>`}
async function saveNewTenant(){formErr='';const name=(f.name||'').trim(),phone=phoneOf(f.phone||'');
  if(!name)formErr="Enter the tenant's name.";
  else if(!phoneOk(phone))formErr='Enter a valid Kenyan mobile number, such as 0712 345 678.';
  if(!formErr)try{await API.addTenant(name,phone);D=await API.getOverview();closeTenantForm();toast('Tenant added.');return}
    catch(e){if(API.isAuthError(e))return authLost(e);formErr=e.message}
  render()}
async function saveTenantChanges(id){formErr='';const name=(f.name||'').trim(),phone=phoneOf(f.phone||''),rent=Number(String(f.rent).replace(/[ ,]/g,''));
  if(!name)formErr="Enter the tenant's name.";
  else if(!phoneOk(phone))formErr='Enter a valid Kenyan mobile number, such as 0712 345 678.';
  else if(!/^[A-Za-z0-9-]{1,12}$/.test((f.unit||'').trim()))formErr='Unit can use letters, digits and dashes (up to 12 characters).';
  else if(!Number.isInteger(rent)||rent<=0)formErr='Monthly rent must be a whole number greater than zero.';
  if(!formErr)try{await API.updateTenant(id,{name,phone,unit:f.unit.trim(),rent});D=await API.getOverview();closeTenantForm();toast('Changes saved.');return}
    catch(e){if(API.isAuthError(e))return authLost(e);formErr=e.message}
  render()}
function chartYear(t){const W=600,H=230,L=46,B=26,vals=[...t.history,paid(t)],mx=Math.max(t.rent,...vals)*1.1,bw=(W-L)/12,y=v=>H-B-(H-B-12)*v/mx;
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Rent paid each month over the past year">`;
  [0,.5,1].forEach(k=>s+=`<text class="svgt" x="${L-6}" y="${y(t.rent*k)+4}" text-anchor="end">${t.rent*k/1000}k</text>`);
  vals.forEach((v,i)=>{const x=L+i*bw+bw*.18,c=v>=t.rent?'var(--green)':v>0?'var(--amber)':'var(--red)';
    s+=`<rect x="${x}" y="${y(v)}" width="${bw*.64}" height="${H-B-y(v)}" rx="3" fill="${c}"/><text class="svgt" x="${x+bw*.32}" y="${H-8}" text-anchor="middle">${esc(D.labels[i])}</text>`});
  return s+`<line x1="${L}" x2="${W}" y1="${y(t.rent)}" y2="${y(t.rent)}" stroke="var(--ink)" stroke-dasharray="4 4" opacity=".5"/></svg>`}
function chartMonth(t){const W=600,H=230,L=46,B=26,mx=t.rent*1.1,x=d=>L+(W-L-8)*d/D.daysInMonth,y=v=>H-B-(H-B-12)*v/mx;
  let cum=0,pts=`${x(0)},${y(0)}`;[...t.payments].sort((a,b)=>a.day-b.day).forEach(p=>{pts+=` ${x(p.day)},${y(cum)}`;cum+=p.amount;pts+=` ${x(p.day)},${y(cum)}`});
  pts+=` ${x(D.today)},${y(cum)}`;
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative rent paid this month">`;
  [0,.5,1].forEach(k=>s+=`<text class="svgt" x="${L-6}" y="${y(t.rent*k)+4}" text-anchor="end">${t.rent*k/1000}k</text>`);
  [1,10,20,D.daysInMonth].forEach(d=>s+=`<text class="svgt" x="${x(d)}" y="${H-8}" text-anchor="middle">${d}</text>`);
  return s+`<line x1="${L}" x2="${W-8}" y1="${y(t.rent)}" y2="${y(t.rent)}" stroke="var(--ink)" stroke-dasharray="4 4" opacity=".5"/><polygon points="${pts} ${x(D.today)},${y(0)}" fill="var(--green)" opacity=".15"/><polyline points="${pts}" fill="none" stroke="var(--green)" stroke-width="3" stroke-linejoin="round"/></svg>`}
function home(){const T=D.tenants,tp=T.reduce((s,t)=>s+paid(t),0),tr=T.reduce((s,t)=>s+t.rent,0),full=T.filter(t=>bal(t)<=0).length;
  const rows=[...T].sort((a,b)=>bal(b)-bal(a)).map(t=>{const[l,c]=st(t),pc=Math.min(100,paid(t)/t.rent*100);
    return `<div class="row ${flashId===t.id?'flash':''}" tabindex="0" onclick="sel=${t.id};render()" onkeydown="if(event.key==='Enter'){sel=${t.id};render()}"><div><div class="nm">${esc(t.name)}</div><div class="sm">Unit ${esc(t.unit)}</div></div><div class="bw"><div class="bar"><i style="width:${pc}%"></i></div><div class="sm">${KES(paid(t))} of ${KES(t.rent)}</div></div><span class="tag ${c}">${l}</span></div>`}).join('');
  return `<div class="stats"><div><b>${KES(tp)}</b><span>Collected in ${D.month}</span></div><div><b>${KES(tr-tp)}</b><span>Outstanding</span></div><div><b>${full}/${T.length}</b><span>Tenants fully paid</span></div></div>
  <div class="sec"><div class="bar"><i style="width:${tp/tr*100}%"></i></div></div>
  <div class="sec feed"><h2>Live payments</h2>${feed.length?feed.map(f=>`<p>${f}</p>`).join(''):'<p class="sm">Waiting for the next M-Pesa payment.</p>'}</div>
  ${addingTenant?addTenantForm():''}<div class="sec"><div class="top" style="margin:0 0 10px"><h2>Tenants</h2><button class="pri" onclick="openAddTenant()">Add tenant</button></div>${rows}</div>`}
function profile(t){const b=bal(t),[l,c]=st(t);
  return `<button onclick="sel=null;render()">Back to tenants</button>
  <div class="sec" style="margin-top:14px"><div class="top" style="margin:0"><div><h2>${esc(t.name)}</h2><div class="sm">Unit ${esc(t.unit)} · ${esc(t.phone)}</div></div><span class="tag ${c}">${l}</span></div></div>
  <div class="stats"><div><b>${KES(paid(t))}</b><span>Paid this month</span></div><div><b>${KES(Math.max(b,0))}</b><span>Balance</span></div><div><b>${KES(t.rent)}</b><span>Monthly rent</span></div></div>
  <div class="sec"><div class="top" style="margin-bottom:10px"><h2>${mode==='year'?'Payments over the year':'Payments this month'}</h2><div class="tog"><button class="${mode==='month'?'on':''}" onclick="mode='month';render()">Month</button> <button class="${mode==='year'?'on':''}" onclick="mode='year';render()">Year</button></div></div>${mode==='year'?chartYear(t):chartMonth(t)}</div>
  ${editingTenant?editTenantForm(t):`<button class="pri" ${b<=0?'disabled':''} onclick="remind(${t.id})">Remind tenant</button> <button onclick="openEditTenant(${t.id})">Edit details</button>`}`}
function render(){const a=$('#app');
  if(!authed){a.innerHTML=`<div class="login"><h1>Rent Desk</h1><p class="sm">Manager sign in</p><label>Username<input id="u" autocomplete="username"></label><label>Password<input id="p" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter')login()"></label><button class="pri" onclick="login()">Sign in</button></div>`;return}
  const t=sel===null?null:D.tenants.find(x=>x.id===sel);
  a.innerHTML=`<div class="top"><h1>Rent Desk</h1><div style="display:flex;gap:12px;align-items:center"><span class="live"><i class="dot"></i>Live</span><button onclick="logout()">Sign out</button></div></div>`+(t?profile(t):home());flashId=null}
render();
