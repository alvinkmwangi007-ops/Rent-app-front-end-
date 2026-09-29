/* All server communication lives here. Set API_BASE to your backend URL.
   Your backend (M-Pesa + SMS) must provide:
   POST /api/login                {username,password}      -> {token}
  GET  /api/overview                                      -> Overview with month, daysInMonth, today, labels, tenants
  POST /api/tenants              {name,phone}              -> created tenant
   POST /api/tenants/:id/remind                            -> {sent:true}   (backend sends the SMS)
   GET  /api/events?token=...  (Server-Sent Events)        -> each message: {"tenantId":1,"amount":5000,"day":29,"time":"14:05"}
   Send a 401 for a bad/expired token. */
const API_BASE='https://your-backend.example.com';
let token=null;
async function call(path,opts={}){
  const r=await fetch(API_BASE+path,{...opts,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})}});
  if(!r.ok)throw new Error((await r.text())||('Request failed ('+r.status+')'));
  return r.json();
}
const API={
  async login(username,password){
    token=(await call('/api/login',{method:'POST',body:JSON.stringify({username,password})})).token;
  },
  logout(){token=null},
  async getOverview(){return call('/api/overview')},
  async addTenant(name,phone){return call('/api/tenants',{method:'POST',body:JSON.stringify({name,phone})})},
  async remindTenant(id){return call('/api/tenants/'+id+'/remind',{method:'POST'})},
  onPayment(cb){ // returns a function that stops listening
    const es=new EventSource(API_BASE+'/api/events?token='+encodeURIComponent(token));
    es.onmessage=e=>cb(JSON.parse(e.data));
    return()=>es.close();
  }
};
