/* Demo data only. Delete this file when USE_MOCK is false. */
const MOCK=(()=>{
const S=[['Wanjiru Kamau','A1','0712 345 601',15000],['Otieno Odhiambo','A2','0722 345 602',18000],['Amina Hassan','B1','0733 345 603',20000],['Kiprono Cheruiyot','B2','0700 345 604',16000],['Njeri Mwangi','C1','0711 345 605',25000],['Brian Mutua','C2','0721 345 606',22000],['Faith Achieng','D1','0734 345 607',12000],['Peter Ndungu','D2','0701 345 608',14000]];
const P=[[[2,1]],[[3,1]],[[5,.5],[18,.25]],[],[[1,1]],[[12,.4]],[[4,1]],[]];
const labels=['Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep'];
const T=S.map(([name,unit,phone,rent],i)=>({id:i,name,unit,phone,rent,
  history:Array.from({length:11},(_,m)=>(i*7+m*5)%9<7?rent:Math.round(rent*(.4+((i+m)%4)*.15)/500)*500),
  payments:P[i].map(([day,f])=>({day,amount:rent*f}))}));
const bal=t=>t.rent-t.payments.reduce((s,p)=>s+p.amount,0);
return{
 login:async(u,p)=>{if(u!=='manager'||p!=='rent2026')throw new Error('Wrong username or password.')},
 overview:async()=>({month:'September',daysInMonth:30,today:29,paybill:'123456',labels,tenants:JSON.parse(JSON.stringify(T))}),
 remind:async id=>({sent:true}),
 onPayment(cb){const h=setInterval(()=>{const o=T.filter(t=>bal(t)>0);if(!o.length)return;
  const t=o[Math.floor(Math.random()*o.length)],f=[.25,.5,1][Math.floor(Math.random()*3)],amount=Math.min(bal(t),Math.round(t.rent*f/100)*100);
  t.payments.push({day:29,amount});cb({tenantId:t.id,amount,day:29,time:new Date().toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})})},6000);
  return()=>clearInterval(h)}
}})();
