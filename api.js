/* All server communication lives here. Set API_BASE to your backend URL.
   Your backend must provide:
   POST /api/login                {username,password}      -> {token}
  GET  /api/overview                                      -> Overview with month, daysInMonth, today, labels, tenants
  POST /api/tenants              {name,phone}              -> created tenant
   PATCH /api/tenants/:id          {name,phone,unit,rent}    -> updated tenant
   POST /api/tenants/:id/remind                            -> {sent:true}   (backend sends the SMS)
   GET  /api/events?token=...  (Server-Sent Events)        -> each message: {"tenantId":1,"amount":5000,"day":29,"time":"14:05"}
   The V4 backend accepts bearer tokens or a session cookie, and sends an "auth" SSE event when a session expires. */
const API_BASE=''; // Same origin as the V4 backend; set a full URL if hosted elsewhere.
let token=null;
const AUTH_REASONS=['no_session','invalid_session','signed_out','session_expired'];
class ApiError extends Error{constructor(reason,message){super(message);this.reason=reason}}
async function call(path,opts={}){
  let r;
  try{r=await fetch(API_BASE+path,{credentials:'include',...opts,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(opts.headers||{})}})}
  catch{throw new ApiError('offline',"Can't reach the server. Check that the backend is running.")}
  let data=null;try{data=await r.json()}catch{}
  if(!r.ok||!data||data.ok===false)throw new ApiError((data&&data.reason)||'bad_reply',(data&&data.message)||('Request failed ('+r.status+')'));
  return data;
}
const API={
  isAuthError:e=>AUTH_REASONS.includes(e.reason),
  async login(username,password){
    token=(await call('/api/login',{method:'POST',body:JSON.stringify({username,password})})).token;
  },
  async logout(){token=null;try{await call('/api/logout',{method:'POST'})}catch{}},
  async getOverview(){return call('/api/overview')},
  async addTenant(name,phone){return call('/api/tenants',{method:'POST',body:JSON.stringify({name,phone})})},
  async updateTenant(id,fields){return call('/api/tenants/'+id,{method:'PATCH',body:JSON.stringify(fields)})},
  async remindTenant(id){return call('/api/tenants/'+id+'/remind',{method:'POST'})},
  onPayment(cb,onLost=()=>{}){ // returns a function that stops listening
    const es=new EventSource(API_BASE+'/api/events?token='+encodeURIComponent(token||''),{withCredentials:true});
    es.onmessage=e=>cb(JSON.parse(e.data));
    es.addEventListener('auth',e=>{es.close();const d=JSON.parse(e.data);onLost(new ApiError(d.reason||'invalid_session',d.message||'Your session has expired. Please sign in again.'))});
    es.onerror=async()=>{try{await call('/api/me')}catch(e){if(API.isAuthError(e)){es.close();onLost(e)}}};
    return()=>es.close();
  }
};
