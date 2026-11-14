#!/usr/bin/env node
// lmphone - 맥에서 도는 LM Studio를 폰 브라우저로 쓰는 서버
// 의존성 없음 (node 내장 모듈만)

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8787);
const LM_HOST = process.env.LM_HOST || '127.0.0.1';
const LM_PORT = Number(process.env.LM_PORT || 1234);
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const TOKEN_FILE = path.join(ROOT, '.token');
const TUNNEL_FILE = path.join(ROOT, '.tunnel-url');

// ---- 토큰 (인터넷에 열리므로 필수) ----
let TOKEN;
if (process.env.LMPHONE_TOKEN) {
  TOKEN = process.env.LMPHONE_TOKEN;
} else if (fs.existsSync(TOKEN_FILE)) {
  TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
} else {
  TOKEN = crypto.randomBytes(12).toString('base64url');
  fs.writeFileSync(TOKEN_FILE, TOKEN + '\n', { mode: 0o600 });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

function authed(req, url) {
  if (url.searchParams.get('k') === TOKEN) return 'query';
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)lk=([^;]+)/);
  if (m && decodeURIComponent(m[1]) === TOKEN) return 'cookie';
  if ((req.headers.authorization || '') === 'Bearer ' + TOKEN) return 'header';
  return null;
}

function tunnelUrl() {
  try { return fs.readFileSync(TUNNEL_FILE, 'utf8').trim(); } catch { return ''; }
}

// LM Studio로 그대로 흘려보내기 (SSE 스트리밍 유지)
function proxy(req, res, upstreamPath, body) {
  const up = http.request({
    host: LM_HOST, port: LM_PORT, path: upstreamPath,
    method: body ? 'POST' : 'GET',
    headers: body
      ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }
      : {},
  }, (ur) => {
    const h = { ...ur.headers };
    delete h['content-encoding'];
    if ((h['content-type'] || '').includes('event-stream')) {
      h['cache-control'] = 'no-cache, no-transform';
      h['x-accel-buffering'] = 'no';
      delete h['content-length'];
    }
    res.writeHead(ur.statusCode || 200, h);
    ur.pipe(res);
  });

  up.on('error', (e) => {
    if (res.headersSent) return res.end();
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      error: 'LM Studio에 연결 못 함 (' + LM_HOST + ':' + LM_PORT + '). LM Studio > Developer > 서버가 켜져 있는지 확인.',
      detail: e.message,
    }));
  });

  // 폰에서 중지 누르면 맥 쪽 생성도 끊기
  res.on('close', () => { if (!up.destroyed) up.destroy(); });

  if (body) up.end(body); else up.end();
}

function serveFile(res, file, status = 200) {
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(status, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const auth = authed(req, url);

  // 토큰을 쿼리로 들고 오면 쿠키로 저장 (폰에서 한 번만 스캔하면 끝)
  if (auth === 'query' && req.method === 'GET' && !p.startsWith('/api/')) {
    res.writeHead(302, {
      'set-cookie': `lk=${encodeURIComponent(TOKEN)}; Path=/; Max-Age=31536000; SameSite=Lax`,
      location: p === '/' ? '/' : p,
    });
    return res.end();
  }

  if (!auth) {
    if (p === '/' || p === '/index.html') return serveFile(res, path.join(PUBLIC, 'locked.html'), 401);
    res.writeHead(401, { 'content-type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: '인증 필요' }));
  }

  if (p === '/api/models') return proxy(req, res, '/v1/models');

  if (p === '/api/chat' && req.method === 'POST') {
    let chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => proxy(req, res, '/v1/chat/completions', Buffer.concat(chunks)));
    return;
  }

  if (p === '/api/link') {
    const base = tunnelUrl() || `http://${localIP()}:${PORT}`;
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      url: base + '/?k=' + TOKEN,
      lan: `http://${localIP()}:${PORT}/?k=` + TOKEN,
      tunnel: tunnelUrl(),
    }));
  }

  if (p === '/qr') return serveFile(res, path.join(PUBLIC, 'qr.html'));

  const file = path.join(PUBLIC, p === '/' ? 'index.html' : p.replace(/^\/+/, ''));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end('nope'); }
  serveFile(res, file);
});

function localIP() {
  const nets = require('os').networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family === 'IPv4' && !n.internal) return n.address;
    }
  }
  return '127.0.0.1';
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('lmphone 서버: http://' + localIP() + ':' + PORT + '/?k=' + TOKEN);
  console.log('토큰:', TOKEN);
});
