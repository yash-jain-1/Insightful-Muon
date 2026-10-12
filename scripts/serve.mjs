// Tiny static server for previewing public/ locally: http://localhost:8000
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve('public');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf' };
const port = Number(process.env.PORT) || 8000;
// Mirror GitHub Pages' project path (e.g. /Insightful-Muon/) so links and the 404 page behave the same.
const prefix = process.env.PREFIX || '/Insightful-Muon';

createServer(async (req, res) => {
  let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (pathname.startsWith(prefix + '/')) pathname = pathname.slice(prefix.length);
  const path = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const file = join(root, path.endsWith('/') ? join(path, 'index.html') : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    // like GitHub Pages: unknown paths get 404.html
    const page = await readFile(join(root, '404.html')).catch(() => 'not found');
    res.writeHead(404, { 'content-type': 'text/html' }).end(page);
  }
}).listen(port, () => console.log(`Previewing on http://localhost:${port}${prefix}/`));
