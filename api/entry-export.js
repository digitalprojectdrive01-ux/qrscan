// Power BI / reporting feed for the Entry Control Dashboard.
//   ?dataset=events|presence|process   (default events)
//   ?format=json|csv                   (default json)
// Auth: ?token=PBI_TOKEN  (or header x-report-token)  OR  an admin Supabase JWT.
// Uses the service key server-side only.
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, PBI_TOKEN

const DATASETS = {
  events:   { table: "ec_event",    cols: ["id","card_code","person_type","process_code","card_no","direction","created_at"], order: "created_at.desc" },
  presence: { table: "ec_presence", cols: ["card_code","person_type","process_code","card_no","status","updated_at"],           order: "updated_at.desc" },
  process:  { table: "ec_process",  cols: ["process_code","process_name","workshop","spec_internal","spec_vendor","sort_order"], order: "sort_order.asc" }
};

async function getCaller(base, anonKey, jwt){
  try{ const r=await fetch(base+"/auth/v1/user",{headers:{apikey:anonKey,Authorization:"Bearer "+jwt}}); if(!r.ok) return null; return await r.json(); }catch(e){ return null; }
}
async function roleOf(base, serviceKey, userId){
  const r=await fetch(base+"/rest/v1/user_roles?select=role&user_id=eq."+encodeURIComponent(userId),{headers:{apikey:serviceKey,Authorization:"Bearer "+serviceKey}});
  if(!r.ok) return "view"; const j=await r.json(); return (j[0]&&j[0].role)||"view";
}
async function fetchAll(base, serviceKey, table, cols, order){
  const pageSize=1000; let from=0, all=[];
  for(let g=0; g<500; g++){
    const url=base+"/rest/v1/"+table+"?select="+cols.join(",")+"&order="+order;
    const r=await fetch(url,{headers:{apikey:serviceKey,Authorization:"Bearer "+serviceKey,Range:from+"-"+(from+pageSize-1),"Range-Unit":"items"}});
    if(!r.ok) throw new Error("Supabase "+r.status+": "+(await r.text()));
    const chunk=await r.json(); all=all.concat(chunk);
    if(chunk.length<pageSize) break; from+=pageSize; if(all.length>500000) break;
  }
  return all;
}
function csvCell(v){ if(v===null||v===undefined) return ""; const s=String(v); return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }
function toCsv(rows, cols){ const out=[cols.join(",")]; for(const r of rows) out.push(cols.map((c)=>csvCell(r[c])).join(",")); return out.join("\r\n"); }

export default async function handler(req, res){
  res.setHeader("Cache-Control","no-store");
  const base=process.env.SUPABASE_URL||"", serviceKey=process.env.SUPABASE_SERVICE_KEY||"", anonKey=process.env.SUPABASE_ANON_KEY||"";
  if(!base||!serviceKey){ res.status(500).json({error:"Missing SUPABASE_URL / SUPABASE_SERVICE_KEY env vars"}); return; }

  const token=req.query.token||req.headers["x-report-token"];
  const authz=req.headers["authorization"]||"";
  let ok=false;
  if(token && process.env.PBI_TOKEN && token===process.env.PBI_TOKEN){ ok=true; }
  else if(authz.indexOf("Bearer ")===0){
    const u=await getCaller(base, anonKey, authz.slice(7));
    if(u&&u.id && (await roleOf(base, serviceKey, u.id))==="admin") ok=true;
  }
  if(!ok){ res.status(401).json({error:"unauthorized"}); return; }

  const key=(req.query.dataset||"events");
  const ds=DATASETS[key]; if(!ds){ res.status(400).json({error:"unknown dataset (events|presence|process)"}); return; }

  try{
    const rows=await fetchAll(base, serviceKey, ds.table, ds.cols, ds.order);
    if((req.query.format||"json")==="csv"){ res.setHeader("Content-Type","text/csv; charset=utf-8"); res.status(200).send(toCsv(rows, ds.cols)); }
    else { res.setHeader("Content-Type","application/json; charset=utf-8"); res.status(200).json(rows); }
  }catch(e){ res.status(502).json({error:String((e&&e.message)||e)}); }
}
