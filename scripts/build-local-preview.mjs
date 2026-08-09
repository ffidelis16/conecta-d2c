import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = path.resolve(scriptDirectory, "..");
const templatesDirectory = path.join(repositoryDirectory, "hubspot", "templates");
const previewDirectory = path.join(repositoryDirectory, "preview");

const assetPath = (_, asset) => `../hubspot/assets/${asset}`;

const renderPreview = (source, metadata) => source
  .replace(/\{\{\s*get_asset_url\('\.\.\/assets\/([^']+)'\)\s*\}\}/g, assetPath)
  .replace(/\{\{\s*html_lang\s*\}\}/g, "pt-BR")
  .replace(/\{\{\s*html_lang_dir\s*\}\}/g, "ltr")
  .replace(/\{\{\s*page_meta\.html_title\s*\}\}/g, metadata.title)
  .replace(/\{\{\s*page_meta\.meta_description\|escape_attr\s*\}\}/g, metadata.description)
  .replace(/\{\{\s*standard_header_includes\s*\}\}/g, "")
  .replace(/\{\{\s*standard_footer_includes\s*\}\}/g, "")
  .replaceAll("/eventos/conecta-d2c/fortaleza", "evento.html")
  .replaceAll("/eventos/conecta-d2c", "hub.html")
  .replace(/[ \t]+(?=\r?\n)/g, "");

const createPreview = async (templateName, previewName, metadata) => {
  const source = await readFile(path.join(templatesDirectory, templateName), "utf8");
  await writeFile(path.join(previewDirectory, previewName), renderPreview(source, metadata), "utf8");
};

const index = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Conecta D2C | Prévia local</title>
  <style>body{margin:0;padding:48px;font-family:Arial,sans-serif;background:#f7f7f7;color:#001f3e}main{max-width:680px;margin:auto}a{display:inline-block;margin:8px 12px 0 0;padding:14px 20px;border-radius:999px;background:#0050c3;color:#fff;font-weight:700;text-decoration:none}</style>
</head>
<body>
  <main>
    <p>CONECTA D2C · PRÉVIA LOCAL</p>
    <h1>Escolha a página para revisar.</h1>
    <a href="hub.html">Abrir Hub</a>
    <a href="evento.html">Abrir evento</a>
  </main>
</body>
</html>`;

await mkdir(previewDirectory, { recursive: true });
await Promise.all([
  createPreview("conecta-d2c-hub.html", "hub.html", {
    title: "Conecta D2C | Hub",
    description: "Eventos presenciais Conecta D2C.",
  }),
  createPreview("conecta-d2c-event.html", "evento.html", {
    title: "Conecta D2C Fortaleza",
    description: "Página de evento Conecta D2C.",
  }),
]);
await writeFile(path.join(previewDirectory, "index.html"), index, "utf8");
