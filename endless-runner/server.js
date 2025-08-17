// Simple static file server for the Endless Runner project
// Usage: node server.js

const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname);
const port = process.env.PORT || 8000;

function contentType(file){
  const ext = path.extname(file).toLowerCase();
  switch(ext){
    case '.html': return 'text/html';
    case '.js': return 'text/javascript';
    case '.css': return 'text/css';
    case '.json': return 'application/json';
    case '.png': return 'image/png';
    case '.jpg': case '.jpeg': return 'image/jpeg';
  case '.webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}

const server = http.createServer((req, res) => {
  try {
    let reqPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
    if(reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(root, reqPath);

    if(!filePath.startsWith(root)){
      res.writeHead(403); res.end('Forbidden'); return;
    }

    fs.stat(filePath, (err, stats) => {
      if(err){ res.writeHead(404); res.end('Not found'); return; }
      if(stats.isDirectory()){ res.writeHead(302, { Location: path.join(req.url, '/index.html') }); res.end(); return; }

      res.writeHead(200, { 'Content-Type': contentType(filePath) });
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    });
  } catch(e){ res.writeHead(500); res.end('Server error'); }
});

server.listen(port, () => console.log(`Static server running at http://localhost:${port}/`));

// Graceful shutdown
process.on('SIGINT', () => { console.log('Shutting down'); server.close(() => process.exit(0)); });
