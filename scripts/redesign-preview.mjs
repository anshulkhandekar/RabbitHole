// Isolated UI verification: no real extension storage, backend, or browsing capture.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
const fixture = JSON.parse(
  await readFile("tests/fixtures/starting-investing.json", "utf8"),
);
const bridge = `<script>
const state={active:'s1',sessions:{s1:${JSON.stringify(fixture)}},config:{token:'fixture-only',backend:'http://127.0.0.1:8766',agentUrl:'https://example.org'},excluded:{},queue:[]};
const event={addListener(){},removeListener(){}};
window.chrome={runtime:{getURL:p=>p,async sendMessage(m){if(m.type==='ui-context')return {regular:false,included:false,count:0,url:'',title:''};if(m.type==='review'){state.sessions[m.id].attempts.push(m.attempt)}if(m.type==='patch'){Object.assign(state.sessions[m.id],m.patch)}return structuredClone(state)}},storage:{local:{async get(){return{}},async set(){}},onChanged:event},tabs:{onActivated:event,onUpdated:event,async create(){}},permissions:{async request(){return false}}};
</script>`;
createServer(async (req, res) => {
  try {
    if (new URL(req.url, "http://localhost").pathname === "/reading.html") {
      res.setHeader("Content-Type", "text/html");
      res.end(`<!doctype html><title>RabbitHole reading widget fixture</title>
<style>body{font:16px system-ui;background:#17171a;color:#eee;margin:60px;min-height:1800px}button{margin:8px;padding:10px}</style>
<h1>Reading widget verification</h1><p>This isolated fixture never contacts Go or the real backend.</p>
<button onclick="change({theme:'light'});document.body.style.background='#f7f7f5';document.body.style.color='#17171a'">Light</button>
<button onclick="change({theme:'dark'});document.body.style.background='#17171a';document.body.style.color='#eee'">Dark</button>
<button onclick="change({handoff:'waiting',syncError:false})">Waiting</button>
<button onclick="change({handoff:null,syncError:true})">Sync error</button>
<button onclick="change({handoff:null,syncError:false})">Collecting</button>
<button onclick="const s=getSelection();s.removeAllRanges();const r=document.createRange();r.selectNodeContents(document.querySelector('article'));s.addRange(r);listener({type:'highlight'}, {}, ()=>{})">Save selected text</button>
<article><p>A sample source for checking the capture feedback.</p></article>
<script>
let listener; const ctx={id:'fixture',status:'active',included:true,readingMode:true,theme:'dark',excluded:[],settings:{articleCapture:false,autoHighlights:false}};
function change(p){Object.assign(ctx,p);listener({type:'reading-update'})}
window.chrome={runtime:{id:'fixture',getURL:p=>'/'+p,onMessage:{addListener(fn){listener=fn},removeListener(){}},async sendMessage(m){
if(m.type==='reading-context')return structuredClone(ctx);
if(m.type==='reading-position')ctx.widgetPosition=m.position;
if(m.type==='reading-control'){if(m.control==='hide')ctx.readingMode=false;else ctx.status=m.control==='pause'?'paused':'active'}
return {saved:true};}}};
</script><script src="/content.js"></script>`);
      return;
    }
    if (req.url === "/responsive.html") {
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><title>RabbitHole responsive fixture</title><style>body{margin:0;background:#ddd}iframe{border:0;width:880px;height:800px}</style><iframe title="880px workspace" src="/index.html?workspace=1"></iframe>',
      );
      return;
    }
    const path = resolve(
      "dist/extension",
      "." + new URL(req.url, "http://localhost").pathname,
    );
    if (!path.startsWith(resolve("dist/extension") + "/")) throw Error();
    let file = path.endsWith("/") ? path + "index.html" : path;
    let body = await readFile(file);
    if (extname(file) === ".html")
      body = Buffer.from(
        body
          .toString()
          .replace('<script type="module"', bridge + '<script type="module"'),
      );
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".woff2": "font/woff2",
        ".svg": "image/svg+xml",
      }[extname(file)] ?? "application/octet-stream",
    );
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(Number(process.env.PORT ?? 8766), "127.0.0.1", () =>
  console.log(
    "Isolated RabbitHole UI fixture: http://127.0.0.1:8766/index.html?workspace=1",
  ),
);
