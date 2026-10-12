import http from 'node:http';
import { listNotes } from './notes.js';
import { renderPage } from './page.js';

export function createServer(db) {
  return http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/notes') {
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify(listNotes(db)));
    }
    if (req.method === 'GET' && req.url === '/') {
      res.setHeader('content-type', 'text/html');
      return res.end(renderPage(listNotes(db)));
    }
    res.statusCode = 404;
    res.end('not found');
  });
}
