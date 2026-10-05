import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || 10000);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const ai = Boolean(process.env.GEMINI_API_KEY);
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.ico':'image/x-icon'};

const SYSTEM = `You are ORBITA, the calm mission-control intelligence for a school science exhibition model. You control two physical zones: Agriculture and Industry. Be concise, fluent, confident and safety-minded. Never invent sensor readings. You receive current status in the user message when available. For control requests, output ONLY JSON with keys "reply" and "actions". actions is an array of objects: {"zone":"agriculture|industry","action":"pump_on|pump_off|auto_on|auto_off|machine_on|machine_off|emergency_stop"}. If the user is only asking a question, actions must be []. Do not create actions that were not requested or clearly necessary. If a request is ambiguous, ask a short clarification and use []. Emergency stop is allowed only when the user clearly asks to stop/shut down machines. If the user asks for automatic irrigation based on dryness, choose auto_on and explain that the ESP32 sensor logic performs the actual threshold decision.`;
const ALLOWED = new Set(['pump_on','pump_off','auto_on','auto_off','machine_on','machine_off','emergency_stop']);

function send(res,status,body,headers={}){const data=Buffer.from(typeof body==='string'?body:JSON.stringify(body));res.writeHead(status,{'Content-Type':headers['Content-Type']||'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(data)}
async function body(req){let s='';for await(const c of req)s+=c;if(!s)return{};try{return JSON.parse(s)}catch{return null}}
async function staticFile(path,res){let p=normalize(join(ROOT,path));if(!p.startsWith(ROOT))return send(res,403,{error:'Forbidden'});try{const b=await readFile(p);send(res,200,b,{'Content-Type':MIME[extname(p)]||'application/octet-stream','Cache-Control':'no-cache'});}catch{send(res,404,{error:'Not found'})}}

async function api(req,res){
  if(req.method==='GET'&&req.url==='/api/health')return send(res,200,{ok:true,gemini:Boolean(ai),model:GEMINI_MODEL,uptime:process.uptime()});
  if(req.method!=='POST')return send(res,405,{ok:false,error:'Method not allowed'});
  const data=await body(req);if(data===null)return send(res,400,{ok:false,error:'Invalid JSON'});
  if(req.url==='/api/assistant'){
    if(!data.message?.trim())return send(res,400,{ok:false,error:'Message is required.'});
    if(!ai)return send(res,503,{ok:false,error:'Gemini is not configured. Add GEMINI_API_KEY on Render.'});
    const history=Array.isArray(data.history)?data.history.slice(-10).map(x=>({role:x.role==='assistant'?'model':'user',parts:[{text:String(x.text||'').slice(0,1800)}]})):[];
    const prompt=`${SYSTEM}\n\nCURRENT STATUS:\n${JSON.stringify(data.status||{}).slice(0,5000)}\n\nUSER REQUEST:\n${data.message}`;
    try{
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[...history,{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.2,responseMimeType:'application/json'}})});
      const payload=await response.json(); if(!response.ok) throw new Error(payload?.error?.message||`Gemini HTTP ${response.status}`);
      const text=payload?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
      let parsed;try{parsed=JSON.parse(text||'{}')}catch{parsed={reply:text||'I could not parse that command.',actions:[]}}
      const actions=Array.isArray(parsed.actions)?parsed.actions.filter(a=>(a?.zone==='agriculture'||a?.zone==='industry')&&ALLOWED.has(a?.action)).slice(0,5):[];
      return send(res,200,{ok:true,reply:String(parsed.reply||'Command processed.').slice(0,1200),actions,model:GEMINI_MODEL});
    }catch(e){return send(res,502,{ok:false,error:e.message})}
  }
  return send(res,404,{ok:false,error:'Unknown API route'});
}

const server=http.createServer(async(req,res)=>{try{if(req.url?.startsWith('/api/'))return api(req,res);let path=req.url==='/'?'/index.html':req.url.split('?')[0];return staticFile(path,res)}catch(e){return send(res,500,{ok:false,error:e.message})}});
server.listen(PORT,'0.0.0.0',()=>console.log(`ORBITA listening on 0.0.0.0:${PORT}`));
