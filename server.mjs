import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, extname, dirname } from 'path';
import https from 'https';

const PORT = 8765;
const DATA_DIR = resolve(dirname(new URL(import.meta.url).pathname), 'data');
const HORMUZ_CSV = resolve(DATA_DIR, 'hormuz-daily.csv');
const IMF_URL = 'https://data.humdata.org/dataset/91d28bb8-986d-430c-961c-6a24ecbd66ee/resource/cbd17f06-8ab2-4ba4-a666-f7a4bcc9ea3f/download/daily-chokepoint-transit-calls-and-shipment-volume-estimates.csv';
const CACHE_TTL = 3600_000; // 1小时内不重复下载

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

let lastFetch = 0;
let fetching = false;

// 跟随重定向下载
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'HormuzMonitor/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpsGet(res.headers.location).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString()));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// 从完整 CSV 提取霍尔木兹数据
function extractHormuz(fullCsv) {
  const lines = fullCsv.trim().split('\n');
  const header = lines[0];
  const cols = header.split(',');
  const dateIdx = cols.indexOf('date');
  const portIdx = cols.indexOf('portid');
  const nContIdx = cols.indexOf('n_container');
  const nDbIdx = cols.indexOf('n_dry_bulk');
  const nGcIdx = cols.indexOf('n_general_cargo');
  const nRoroIdx = cols.indexOf('n_roro');
  const nTankerIdx = cols.indexOf('n_tanker');
  const nCargoIdx = cols.indexOf('n_cargo');
  const nTotalIdx = cols.indexOf('n_total');
  const capIdx = cols.indexOf('capacity');

  const out = ['date,n_container,n_dry_bulk,n_general_cargo,n_roro,n_tanker,n_cargo,n_total,capacity'];
  const hormuzLines = [];

  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (c[portIdx] !== 'chokepoint6') continue;
    const date = c[dateIdx].split(' ')[0]; // strip time
    hormuzLines.push({
      date,
      line: `${date},${c[nContIdx]},${c[nDbIdx]},${c[nGcIdx]},${c[nRoroIdx]},${c[nTankerIdx]},${c[nCargoIdx]},${c[nTotalIdx]},${c[capIdx]}`
    });
  }

  // 按日期排序
  hormuzLines.sort((a, b) => a.date.localeCompare(b.date));
  hormuzLines.forEach(h => out.push(h.line));
  return out.join('\n');
}

async function updateData() {
  if (fetching) return;
  if (Date.now() - lastFetch < CACHE_TTL && existsSync(HORMUZ_CSV)) return;

  fetching = true;
  console.log(`[${ts()}] 正在从 IMF PortWatch 下载最新数据...`);
  try {
    const csv = await httpsGet(IMF_URL);
    const hormuz = extractHormuz(csv);
    const lineCount = hormuz.split('\n').length - 1;
    writeFileSync(HORMUZ_CSV, hormuz);
    lastFetch = Date.now();
    console.log(`[${ts()}] 数据更新完成: ${lineCount} 天霍尔木兹数据`);
  } catch (e) {
    console.log(`[${ts()}] 数据更新失败: ${e.message}`);
  } finally {
    fetching = false;
  }
}

const ts = () => new Date().toLocaleTimeString('zh-CN');

// MIME
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.csv': 'text/csv' };

const server = createServer((req, res) => {
  const url = req.url.split('?')[0];

  // 请求 CSV 时触发后台更新（不阻塞响应）
  if (url === '/data/hormuz-daily.csv') {
    updateData().catch(() => {});
  }

  let filePath = url === '/' ? '/hormuz-traffic.html' : url;
  filePath = resolve('.', '.' + filePath);
  try {
    const content = readFileSync(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n  霍尔木兹海峡流量监控`);
  console.log(`  ========================`);
  console.log(`  页面地址: http://localhost:${PORT}`);
  console.log(`  数据缓存: ${HORMUZ_CSV}`);
  console.log(`  自动更新: 每小时从 IMF PortWatch 拉取\n`);
});
