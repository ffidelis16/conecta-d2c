import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const source = process.argv[2];
if (!source || !fs.existsSync(path.join(source, 'ABRIR-PREVIA.html'))) throw new Error('Informe o pacote revisado v0.5.1.');
const target = path.join(root, 'preview/hub-v0.5.1');
fs.mkdirSync(target, {recursive: true});
fs.cpSync(path.join(source, 'files-upload'), path.join(target, 'files-upload'), {recursive: true});
fs.mkdirSync(path.join(target, 'developer-files'), {recursive: true});
for (const name of ['conecta-d2c-hub.css', 'conecta-d2c-hub.js']) {
  fs.copyFileSync(path.join(source, 'developer-files', name), path.join(target, 'developer-files', name));
}
let html = fs.readFileSync(path.join(source, 'ABRIR-PREVIA.html'), 'utf8');
html = html.replaceAll('./files-upload/', './hub-v0.5.1/files-upload/').replaceAll('./developer-files/', './hub-v0.5.1/developer-files/');
html = html.replace(/ data-hub-events-url="[^"]*"| data-hub-visuals-url="[^"]*"| data-agenda-url="[^"]*"/g, '');
html = html.replace('data-hub-dynamic="true"', 'data-hub-dynamic="true" data-preview-reference-date="2026-09-29T12:00:00-03:00"');
html = html.replace('</head>', '<meta name="robots" content="noindex,nofollow"><style>.hub-preview-notice{position:relative;z-index:110;padding:10px 20px;background:#fff3d6;color:#002750;font:13px/1.5 system-ui;text-align:center}</style></head>');
html = html.replace('</body>', '<aside class="hub-preview-notice">Prévia de layout v0.5.1 · Dados de referência de 29/09/2026. Agenda não sincronizada; formulários ainda não conectados.</aside></body>');
html = html.replaceAll('?v=0.5.1', '?v=0.5.1-public-20261103');
fs.writeFileSync(path.join(root, 'preview/hub.html'), html);
const jsPath = path.join(target, 'developer-files/conecta-d2c-hub.js');
let js = fs.readFileSync(jsPath, 'utf8');
const old = 'render(api.buildModel(results[0].value, results[1].status === "fulfilled" ? results[1].value : []));';
if (!js.includes(old)) throw new Error('Renderer esperado não encontrado.');
js = js.replace(old, 'render(api.buildModel(results[0].value, results[1].status === "fulfilled" ? results[1].value : [], app.dataset.previewReferenceDate ? new Date(app.dataset.previewReferenceDate) : new Date()));');
fs.writeFileSync(jsPath, js);
console.log('Prévia isolada preparada em preview/hub.html; demais páginas preservadas.');
