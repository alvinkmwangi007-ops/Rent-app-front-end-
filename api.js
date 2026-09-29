/* ALL server communication lives here. To go live: set USE_MOCK=false and API_BASE.
   Your backend (M-Pesa + SMS) must provide:
   POST /api/login                {username,password}      -> {token}
   GET  /api/overview                                      -> Overview (shape in mock.js)
   POST /api/tenants/:id/remind                            -> {sent:true}   (backend sends the SMS)
   GET  /api/events?token=...  (Server-Sent Events)        -> each message: {"tenantId":1,"amount":5000,"day":29,"time":"14:05"}
   Send a 401 for a bad/expired token. */
const CONFIG={USE_MOCK:true,API_BASE:'https://your-backend.example.com'};
let token=null;
async function call(path,opts={}){
  const r=await fetch(CONFIG.API_BASE+path,{...opts,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})}});
  if(!r.ok)throw new Error((await r.text())||('Request failed ('+r.status+')'));
  return r.json();
}
const API={
  async login(username,password){
    if(CONFIG.USE_MOCK)return MOCK.login(username,password);
    token=(await call('/api/login',{method:'POST',body:JSON.stringify({username,password})})).token;
  },
  logout(){token=null},
  async getOverview(){return CONFIG.USE_MOCK?MOCK.overview():call('/api/overview')},
  async remindTenant(id){return CONFIG.USE_MOCK?MOCK.remind(id):call('/api/tenants/'+id+'/remind',{method:'POST'})},
  onPayment(cb){ // returns a function that stops listening
    if(CONFIG.USE_MOCK)return MOCK.onPayment(cb);
    const es=new EventSource(CONFIG.API_BASE+'/api/events?token='+encodeURIComponent(token));
    es.onmessage=e=>cb(JSON.parse(e.data));
    return()=>es.close();
  }
};
