import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { deflateSync, inflateSync } from "node:zlib";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageName = "conecta-d2c-franca-v1.0.0";
const deliveryRoot = join(root, "docs", "hubspot-implementation");
const delivery = join(deliveryRoot, packageName);
const uploads = join(delivery, "files-upload");
const developerFiles = join(delivery, "developer-files");
const sourcePage = join(root, "preview", "evento-franca.html");
const sourceStylesheet = join(root, "hubspot", "assets", "css", "conecta-d2c.css");
const sourceJavascript = join(root, "hubspot", "assets", "js", "conecta-d2c.js");
const sourceImages = join(root, "hubspot", "assets", "images");
const version = "1.0.0";
const sourceCommit = process.env.SOURCE_COMMIT || "nao-informado";
const assetToken = "__ASSET_BASE_URL__";
const assetHubL = "{{ conecta_d2c_franca_asset_base }}";
const formId = "bdb0ccad-d2b3-471a-adf1-9187057e1ab3";
const portalId = "8180620";

if (!delivery.startsWith(deliveryRoot + sep)) {
  throw new Error("Destino do pacote invalido.");
}

const sha256 = (content) => createHash("sha256").update(content).digest("hex");
const writeText = (path, content) => writeFile(path, content.trim() + "\n", "utf8");

const crc32 = (content) => {
  let value = 0xffffffff;
  for (const byte of content) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  }
  return (value ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, content) => {
  const result = Buffer.alloc(12 + content.length);
  result.writeUInt32BE(content.length, 0);
  result.write(type, 4, 4, "ascii");
  content.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), content])), 8 + content.length);
  return result;
};

const optimisePngLosslessly = (content) => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!content.subarray(0, 8).equals(signature)) return content;
  const chunks = [];
  for (let offset = 8; offset < content.length;) {
    const length = content.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > content.length) return content;
    chunks.push({ type: content.subarray(offset + 4, offset + 8).toString("ascii"), content: content.subarray(offset + 8, offset + 8 + length) });
    offset = end;
  }
  const idat = chunks.filter((chunk) => chunk.type === "IDAT");
  if (!idat.length) return content;
  let optimised;
  try {
    optimised = deflateSync(inflateSync(Buffer.concat(idat.map((chunk) => chunk.content))), { level: 9 });
  } catch {
    return content;
  }
  if (optimised.length >= idat.reduce((total, chunk) => total + chunk.content.length, 0)) return content;
  const rebuilt = [signature];
  let inserted = false;
  for (const chunk of chunks) {
    if (chunk.type === "IDAT") {
      if (!inserted) {
        rebuilt.push(pngChunk("IDAT", optimised));
        inserted = true;
      }
      continue;
    }
    rebuilt.push(pngChunk(chunk.type, chunk.content));
  }
  return Buffer.concat(rebuilt);
};

const listFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return nested.flat();
};

const sourceHtml = await readFile(sourcePage, "utf8");
const baseCss = await readFile(sourceStylesheet, "utf8");
const baseJavascript = await readFile(sourceJavascript, "utf8");
for (const value of [
  formId,
  portalId,
  "Executiva de Vendas Nuvemshop Next",
  "Líder de Setor E-commerce e Integrações Citel",
  "Aeroclube+de+Franca",
]) {
  if (!sourceHtml.includes(value)) throw new Error("Fonte final nao contem: " + value);
}

const styles = [...sourceHtml.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1].trim());
const inlineScripts = [...sourceHtml.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1].trim());
if (!styles.length || !inlineScripts.length) throw new Error("Estrutura de CSS ou JS mudou.");

let template = sourceHtml
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>\s*/gi, "")
  .replace(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>\s*/gi, "")
  .replace('<link rel="stylesheet" href="../hubspot/assets/css/conecta-d2c.css">', '<link rel="stylesheet" href="' + assetHubL + '/conecta-d2c-franca.css?v=' + version + '">')
  .replace('<script src="../hubspot/assets/js/conecta-d2c.js" defer=""></script>', '<script src="' + assetHubL + '/conecta-d2c-franca.js?v=' + version + '" defer></script>')
  .replace('data-page="event"', 'data-page="event" data-package-version="' + version + '"');

const preferredNames = new Map([
  ["Marco Aurélio Viera da Silva", "marco-aurelio"],
  ["Shélibi de Carlo", "shelibi-de-carlo"],
  ["Kely Perez, Executiva de Vendas Nuvemshop Next", "kely-perez"],
  ["Danilo Faveri", "danilo-faveri"],
  ["Chegada com BBQ no Hangar Voe Solo", "bbq"],
  ["Conteúdo e pitches no Hangar Voe Solo", "experiencia"],
  ["Encerramento do Conecta D2C no Hangar Voe Solo", "encerramento"],
  ["Vista noturna de Franca, SP", "cta-final-franca"],
  ["Mapa de acesso ao Hangar Voe Solo", "mapa-aeroclube-franca"],
  ["Hangar Voe Solo em Franca, SP", "hangar-voe-solo"],
  ["M2X", "m2x"],
  ["Método Start", "metodo-start"],
]);

await rm(delivery, { recursive: true, force: true });
await mkdir(uploads, { recursive: true });
await mkdir(developerFiles, { recursive: true });

const dataAssets = new Map();
const allocated = new Map();
let fallbackIndex = 0;
for (const tagMatch of template.matchAll(/<img\b[^>]*>/gi)) {
  const tag = tagMatch[0];
  const sourceMatch = tag.match(/\bsrc="(data:image\/(png|jpeg);base64,([^"]+))"/i);
  if (!sourceMatch || dataAssets.has(sourceMatch[1])) continue;
  const alt = tag.match(/\balt="([^"]*)"/i)?.[1] || "";
  const extension = sourceMatch[2].toLowerCase() === "jpeg" ? "jpg" : "png";
  const original = Buffer.from(sourceMatch[3], "base64");
  const packaged = extension === "png" ? optimisePngLosslessly(original) : original;
  const preferred = preferredNames.get(alt) || "asset-" + String(++fallbackIndex).padStart(2, "0");
  const identity = sha256(original).slice(0, 8);
  let name = preferred + "." + extension;
  if (allocated.has(name) && allocated.get(name) !== identity) name = preferred + "-" + identity + "." + extension;
  allocated.set(name, identity);
  await writeFile(join(uploads, name), packaged);
  dataAssets.set(sourceMatch[1], { name, original: original.length, packaged: packaged.length, sha: sha256(packaged) });
}

for (const [source, asset] of dataAssets) template = template.replaceAll(source, assetHubL + "/" + asset.name);

const sharedAssets = [...new Set([...template.matchAll(/(?:src|href)="\.\.\/hubspot\/assets\/images\/([^"]+)"/gi)].map((match) => match[1]))].sort();
for (const name of sharedAssets) {
  await stat(join(sourceImages, name));
  await cp(join(sourceImages, name), join(uploads, name));
  template = template.replaceAll("../hubspot/assets/images/" + name, assetHubL + "/" + name);
}
if (template.includes("data:image/") || template.includes("../hubspot/assets/")) throw new Error("Template ainda possui asset local.");

const css = "/* Conecta D2C Franca · HubSpot Files · v" + version + " */\n" + baseCss + "\n\n" + styles.join("\n\n");
const javascript = "/* Conecta D2C Franca · formulário e tracking · v" + version + " */\n" + baseJavascript + "\n\n" + inlineScripts.join("\n\n");
await writeText(join(uploads, "conecta-d2c-franca.css"), css);
await writeText(join(uploads, "conecta-d2c-franca.js"), javascript);

const hubspotTemplate = '{% set conecta_d2c_franca_asset_base = "' + assetToken + '" %}\n' + template;
const localPreview = hubspotTemplate
  .replace('{% set conecta_d2c_franca_asset_base = "' + assetToken + '" %}\n', "")
  .replaceAll(assetHubL, "./files-upload");
await writeText(join(developerFiles, "conecta-d2c-franca.template.html"), hubspotTemplate);
await writeText(join(delivery, "preview-local.html"), localPreview);

const powershell = [
  "param(",
  "  [Parameter(Mandatory = $true)]",
  "  [ValidatePattern('^https://')]",
  "  [string]$AssetBaseUrl",
  ")",
  "",
  "$packageDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path",
  "$source = Join-Path $packageDirectory 'developer-files\\conecta-d2c-franca.template.html'",
  "$destination = Join-Path $packageDirectory 'developer-files\\conecta-d2c-franca-pronto.html'",
  "$template = [System.IO.File]::ReadAllText($source)",
  "$prepared = $template.Replace('" + assetToken + "', $AssetBaseUrl.Trim().TrimEnd('/'))",
  "if ($prepared -match '" + assetToken + "') { throw 'A URL dos assets nao foi aplicada.' }",
  "[System.IO.File]::WriteAllText($destination, $prepared, [System.Text.UTF8Encoding]::new($false))",
  "Write-Host \"HTML pronto: $destination\"",
].join("\n");
await writeText(join(delivery, "preparar-com-url.ps1"), powershell);

const uploadFiles = (await listFiles(uploads)).sort();
const manifestAssets = await Promise.all(uploadFiles.map(async (path) => {
  const content = await readFile(path);
  return "- " + relative(uploads, path).replaceAll("\\", "/") + " — " + content.length.toLocaleString("pt-BR") + " bytes — SHA-256 " + sha256(content);
}));

await writeText(join(delivery, "LEIA-ME.md"), [
  "# Conecta D2C Franca - pacote HubSpot",
  "",
  "1. Suba integralmente files-upload para uma pasta exclusiva no HubSpot Files.",
  "2. Execute preparar-com-url.ps1 com a URL HTTPS dessa pasta.",
  "3. Cole developer-files/conecta-d2c-franca-pronto.html em um template exclusivo no Design Manager.",
  "4. Crie a landing page em rascunho e valide formulario, tracking, assets e responsividade antes de publicar.",
  "",
  "Preview aprovado: https://ffidelis16.github.io/conecta-d2c/preview/evento-franca.html",
  "Commit-base: " + sourceCommit,
  "Portal: " + portalId + " | Form ID: " + formId,
].join("\n"));

await writeText(join(delivery, "METADADOS-DA-PAGINA.md"), [
  "# Metadados",
  "",
  "Titulo: Conecta D2C Franca 2026 | Nuvemshop",
  "Descricao: No Hangar Voe Solo, lideranças do e-commerce de Franca se encontram para uma noite de contexto, troca e decisões reais. Faça sua pré-inscrição.",
  "OG title: Conecta D2C Franca | Uma conversa fora da sala de reunião",
  "OG description: 22 de setembro, no Hangar Voe Solo. Um encontro curado para quem está conduzindo o próximo ciclo do e-commerce em Franca.",
].join("\n"));

await writeText(join(delivery, "TRACKING-E-FORMULARIO.md"), [
  "# Formulário e tracking",
  "",
  "Portal HubSpot: " + portalId,
  "Form ID: " + formId,
  "Contexto: event_pre_registration",
  "Evento: franca-2026-09-22",
  "",
  "Validar envio real e uma única ocorrência de form_submit e generate_lead.",
].join("\n"));

await writeText(join(delivery, "MANIFESTO-DE-ARQUIVOS.md"), [
  "# Manifesto",
  "",
  "Assets de upload:",
  "",
  ...manifestAssets,
  "",
  "PNGs foram recomprimidos apenas de forma lossless quando houve redução. JPEGs e SVGs foram preservados sem recodificação.",
].join("\n"));

const checksumFiles = (await listFiles(delivery)).filter((path) => !path.endsWith("CHECKSUMS-SHA256.txt"));
const checksums = await Promise.all(checksumFiles.map(async (path) => sha256(await readFile(path)) + "  " + relative(delivery, path).replaceAll("\\", "/")));
await writeText(join(delivery, "CHECKSUMS-SHA256.txt"), checksums.sort().join("\n"));

console.log("Pacote criado: " + packageName);
console.log("Assets extraidos: " + dataAssets.size + " incorporados e " + sharedAssets.length + " compartilhados.");
