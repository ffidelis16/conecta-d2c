import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const implementationDirectory = join(projectDirectory, "docs", "hubspot-implementation");
const packageName = "conecta-d2c-fortaleza-v1.0.0";
const packageDirectory = join(implementationDirectory, packageName);
const filesUploadDirectory = join(packageDirectory, "files-upload");
const developerFilesDirectory = join(packageDirectory, "developer-files");
const sourceTemplatePath = join(projectDirectory, "hubspot", "templates", "conecta-d2c-event.html");
const sourceCssPath = join(projectDirectory, "hubspot", "assets", "css", "conecta-d2c.css");
const sourceJavascriptPath = join(projectDirectory, "hubspot", "assets", "js", "conecta-d2c.js");
const sourceImagesDirectory = join(projectDirectory, "hubspot", "assets", "images");
const packageVersion = "1.0.0";
const sourceCommit = process.env.SOURCE_COMMIT || "não informado";
const assetBaseToken = "__ASSET_BASE_URL__";
const assetBaseHubL = "{{ conecta_d2c_fortaleza_asset_base }}";
const publicPreviewUrl = "https://ffidelis16.github.io/conecta-d2c/preview/evento.html";
const repositoryUrl = "https://github.com/ffidelis16/conecta-d2c";

if (!packageDirectory.startsWith(`${implementationDirectory}${sep}`)) {
  throw new Error("O pacote precisa permanecer dentro de docs/hubspot-implementation.");
}

const sha256 = (content) => createHash("sha256").update(content).digest("hex");

const listFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(absolutePath);
    return [absolutePath];
  }));
  return files.flat();
};

const writeText = (path, content) => writeFile(path, `${content.trim()}\n`, "utf8");

const sourceTemplate = await readFile(sourceTemplatePath, "utf8");
const sourceCss = await readFile(sourceCssPath, "utf8");
const sourceJavascript = await readFile(sourceJavascriptPath, "utf8");
const assetNames = [...new Set([...sourceTemplate.matchAll(/get_asset_url\('\.\.\/assets\/images\/([^']+)'\)/g)].map((match) => match[1]))].sort();

if (!sourceTemplate.includes('data-form-event-registration="bdb0ccad-d2b3-471a-adf1-9187057e1ab3"')) {
  throw new Error("O GUID de inscrição de Fortaleza não corresponde à versão aprovada.");
}

if (!assetNames.length) {
  throw new Error("Nenhum asset de imagem foi encontrado no template de Fortaleza.");
}

for (const assetName of assetNames) {
  await stat(join(sourceImagesDirectory, assetName));
}

const loaderStart = sourceJavascript.indexOf("  const ensureHubSpotScript = (portalId) => {");
const loaderEnd = sourceJavascript.indexOf("\n\n  const renderForm", loaderStart);
const legacyFormStart = sourceJavascript.indexOf("      const formTarget = document.createElement(\"div\");", loaderEnd);
const legacyFormEnd = sourceJavascript.indexOf("\n    } catch", legacyFormStart);

if ([loaderStart, loaderEnd, legacyFormStart, legacyFormEnd].some((index) => index < 0)) {
  throw new Error("A rotina de formulário da origem mudou; revise o adaptador HubSpot antes de gerar o pacote.");
}

const modernLoader = `  const ensureHubSpotScript = (portalId) => {
    if (window.customElements && customElements.get("hs-form-frame")) return Promise.resolve();
    if (formScriptPromise) return formScriptPromise;

    formScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = \`https://js.hsforms.net/forms/embed/\${portalId}.js\`;
      script.async = true;
      script.dataset.conectaHubspotEmbed = "true";
      script.onload = () => {
        if (!window.customElements) {
          reject(new Error("O navegador não disponibilizou Custom Elements para o formulário."));
          return;
        }
        window.customElements.whenDefined("hs-form-frame").then(resolve, reject);
      };
      script.onerror = () => reject(new Error("Não foi possível carregar o script de formulários do HubSpot."));
      document.head.appendChild(script);
    });
    return formScriptPromise;
  };`;

const modernFormCreation = `      const form = document.createElement("hs-form-frame");
      form.setAttribute("data-portal-id", app.dataset.hubspotPortalId);
      form.setAttribute("data-form-id", config.id);
      form.setAttribute("data-region", "na1");
      form.dataset.formContext = type;
      form.dataset.eventId = modalContext.eventId || "";
      form.dataset.eventName = modalContext.eventName || "";
      target.replaceChildren(form);`;

const submissionTracking = `
  const trackedFormSubmissions = new Set();
  window.addEventListener("hs-form-event:on-submission:success", (event) => {
    const formId = event.detail?.formId || event.detail?.form_id;
    const config = formConfig[modalContext.type];
    if (!formId || formId !== config?.id) return;
    const key = \`\${formId}:\${modalContext.type}\`;
    if (trackedFormSubmissions.has(key)) return;
    trackedFormSubmissions.add(key);
    track("form_submit", {
      form_context: modalContext.type,
      form_id: formId,
      event_id: modalContext.eventId || undefined,
      page_type: pageType,
    });
    track("generate_lead", {
      form_context: modalContext.type,
      form_id: formId,
      event_id: modalContext.eventId || undefined,
      page_type: pageType,
    });
  });`;

const packageJavascript = `${sourceJavascript.slice(0, loaderStart)}${modernLoader}${sourceJavascript.slice(loaderEnd, legacyFormStart)}${modernFormCreation}${sourceJavascript.slice(legacyFormEnd)}`
  .replace("  let modalContext = {};", `  let modalContext = {};${submissionTracking}`);

if (!packageJavascript.includes("forms/embed/${portalId}.js") || packageJavascript.includes("forms/embed/v2.js")) {
  throw new Error("O pacote não recebeu a integração atualizada de formulário do HubSpot.");
}

const packageTemplate = sourceTemplate
  .replace("label: Conecta D2C | Página de evento", "label: Conecta D2C | Fortaleza | 20/08")
  .replace("<!doctype html>", `{% set conecta_d2c_fortaleza_asset_base = "${assetBaseToken}" %}\n<!doctype html>`)
  .replaceAll("{{ get_asset_url('../assets/css/conecta-d2c.css') }}", `${assetBaseHubL}/conecta-d2c-fortaleza.css?v=${packageVersion}`)
  .replaceAll("{{ get_asset_url('../assets/js/conecta-d2c.js') }}", `${assetBaseHubL}/conecta-d2c-fortaleza.js?v=${packageVersion}`)
  .replace(/\{\{\s*get_asset_url\('\.\.\/assets\/images\/([^']+)'\)\s*\}\}/g, `${assetBaseHubL}/$1`)
  .replace('data-page="event"', `data-page="event" data-package-version="${packageVersion}"`);

if (packageTemplate.includes("get_asset_url('../assets/")) {
  throw new Error("O template do pacote ainda contém URLs relativas a assets locais.");
}

const localPreview = packageTemplate
  .replace(`{% set conecta_d2c_fortaleza_asset_base = "${assetBaseToken}" %}\n`, "")
  .replaceAll(assetBaseHubL, "./files-upload")
  .replaceAll("{{ html_lang }}", "pt-BR")
  .replaceAll("{{ html_lang_dir }}", "ltr")
  .replaceAll("{{ page_meta.html_title }}", "Conecta D2C Fortaleza")
  .replaceAll("{{ page_meta.meta_description|escape_attr }}", "Conecta D2C Fortaleza · evento presencial Nuvemshop.")
  .replaceAll("  {{ standard_header_includes }}\n", "")
  .replaceAll("  {{ standard_footer_includes }}\n", "");

await rm(packageDirectory, { recursive: true, force: true });
await mkdir(filesUploadDirectory, { recursive: true });
await mkdir(developerFilesDirectory, { recursive: true });

for (const assetName of assetNames) {
  await cp(join(sourceImagesDirectory, assetName), join(filesUploadDirectory, assetName));
}

await writeText(join(developerFilesDirectory, "conecta-d2c-fortaleza.template.html"), packageTemplate);
await writeText(join(filesUploadDirectory, "conecta-d2c-fortaleza.css"), `/* Conecta D2C Fortaleza · HubSpot Files · v${packageVersion} */\n${sourceCss}`);
await writeText(join(filesUploadDirectory, "conecta-d2c-fortaleza.js"), `/* Conecta D2C Fortaleza · HubSpot Forms atualizado · v${packageVersion} */\n${packageJavascript}`);
await writeText(join(packageDirectory, "preview-local.html"), localPreview);

await writeText(join(packageDirectory, "preparar-com-url.ps1"), `param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https://')]
  [string]$AssetBaseUrl
)

$packageDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $packageDirectory 'developer-files\\conecta-d2c-fortaleza.template.html'
$destination = Join-Path $packageDirectory 'developer-files\\conecta-d2c-fortaleza-pronto.html'
$normalizedUrl = $AssetBaseUrl.Trim().TrimEnd('/')
$template = [System.IO.File]::ReadAllText($source)

if ($template.IndexOf('${assetBaseToken}', [System.StringComparison]::Ordinal) -lt 0) {
  throw 'Token de URL não encontrado. Não use este script em um arquivo já preparado.'
}

$prepared = $template.Replace('${assetBaseToken}', $normalizedUrl)
if ($prepared -match '${assetBaseToken}') {
  throw 'A URL dos assets não foi aplicada integralmente.'
}

[System.IO.File]::WriteAllText($destination, $prepared, [System.Text.UTF8Encoding]::new($false))
Write-Host "HTML pronto: $destination"
Write-Host "Base de assets: $normalizedUrl"
`);

await writeText(join(packageDirectory, "LEIA-ME.md"), `# Conecta D2C · Fortaleza · implementação HubSpot

Pacote exclusivo da página individual do evento de Fortaleza. O Hub, a agenda e as futuras integrações de tabela não fazem parte desta entrega.

## Sequência curta

1. Crie uma pasta exclusiva no HubSpot Files e suba todo o conteúdo de \`files-upload/\`.
2. Copie a URL HTTPS pública da pasta, sem o nome de arquivo ao final.
3. Execute \`preparar-com-url.ps1\` com essa URL.
4. Crie um template exclusivo no Design Manager e cole \`developer-files/conecta-d2c-fortaleza-pronto.html\`.
5. Crie a landing page em rascunho, preencha os metadados e execute o QA antes de publicar.

## Conteúdo

- \`files-upload/\`: CSS, JavaScript e todos os assets necessários. Subir integralmente para uma única pasta no HubSpot Files.
- \`developer-files/conecta-d2c-fortaleza.template.html\`: origem do template; não subir diretamente.
- \`developer-files/conecta-d2c-fortaleza-pronto.html\`: arquivo gerado pelo script e único HTML a ser colado no Design Manager.
- \`preparar-com-url.ps1\`: injeta a URL definitiva de Files no HTML sem alterar a origem.
- \`passo-a-passo-implementacao.md\`: roteiro para a equipe implementadora.
- \`METADADOS-DA-PAGINA.md\`: campos da landing page.
- \`TRACKING-E-FORMULARIO.md\`: configuração do formulário e eventos.
- \`MANIFESTO-DE-ARQUIVOS.md\` e \`CHECKSUMS-SHA256.txt\`: conferência de integridade.

## Origem aprovada

- Preview: ${publicPreviewUrl}
- Repositório: ${repositoryUrl}
- Commit-base: \`${sourceCommit}\`

O pacote mantém o layout aprovado. A única adaptação técnica é o embed atual de formulário do HubSpot, necessário para a implantação no portal.`);

await writeText(join(packageDirectory, "passo-a-passo-implementacao.md"), `# Roteiro de implementação · Fortaleza

## 1. Pré-requisitos

- [ ] Acesso a **Files**, **Design Manager** e criação de landing pages no portal.
- [ ] Pasta e template exclusivos; não editar template compartilhado.
- [ ] Domínio e slug aprovados.
- [ ] Confirmação de que GTM, analytics, pixels e consentimento são herdados pelo portal.
- [ ] Um contato autorizado para testar o formulário real em rascunho.

## 2. Subir arquivos para HubSpot Files

1. Em **Marketing > Files**, crie a pasta \`conecta-d2c/fortaleza\`.
2. Suba **todo** o conteúdo interno de \`files-upload/\`, sem alterar nomes.
3. Abra um arquivo da pasta e copie a parte comum da URL até a pasta, por exemplo: \`https://site.nuvemshop.com.br/hubfs/conecta-d2c/fortaleza\`.
4. Confirme no navegador que o CSS, o JavaScript e uma imagem carregam por HTTPS.

## 3. Preparar o HTML

No PowerShell, dentro desta pasta de entrega:

\`\`\`powershell
.\\preparar-com-url.ps1 -AssetBaseUrl "https://site.nuvemshop.com.br/hubfs/conecta-d2c/fortaleza"
\`\`\`

O comando gera \`developer-files/conecta-d2c-fortaleza-pronto.html\`. Não substituir a URL manualmente em vários pontos.

## 4. Criar o template

1. Em **Design Manager**, crie uma pasta exclusiva para Conecta D2C.
2. Crie um arquivo HTML do tipo **Page template** chamado \`conecta-d2c-fortaleza.html\`.
3. Cole integralmente o conteúdo de \`developer-files/conecta-d2c-fortaleza-pronto.html\`.
4. Publique o arquivo no Design Manager.

O CSS e o JavaScript **não** devem ser criados no Design Manager: o template os carrega pela pasta exclusiva de Files para manter a referência única e previsível.

## 5. Criar a landing page em rascunho

1. Crie uma landing page nova.
2. Selecione o template **Conecta D2C | Fortaleza | 20/08**.
3. Preencha título, descrição e demais campos de \`METADADOS-DA-PAGINA.md\`.
4. Mantenha a página em rascunho até concluir o QA.

## 6. QA obrigatório

- [ ] Desktop: 1440, 1280 e 1024 px.
- [ ] Mobile: 390, 375 e 360 px.
- [ ] Sem rolagem horizontal.
- [ ] Hero, fotos, logos, ícones, footer e fontes sem 404.
- [ ] Barra de parceiros em \`#002750\`.
- [ ] Conteúdo da caixa **Quem estará na sala** centralizado verticalmente.
- [ ] Navegação e âncoras funcionam.
- [ ] CTAs abrem e fecham o lightbox por botão, backdrop e tecla Esc.
- [ ] Formulário de inscrição aparece uma única vez no lightbox e envia um teste real.
- [ ] Após envio, o contato aparece no HubSpot e os eventos de tracking não duplicam.
- [ ] Canonical, Open Graph, cookies e tracking global obedecem à configuração do portal.
- [ ] O resultado visual corresponde ao preview aprovado.

Corrigir localmente e substituir o arquivo correspondente no HubSpot; não fazer correções improvisadas apenas no editor da página.`);

await writeText(join(packageDirectory, "METADADOS-DA-PAGINA.md"), `# Metadados da página

- **Título:** Conecta D2C Fortaleza | Nuvemshop
- **Descrição:** Negócios, conteúdos e conexões em um fim de tarde à beira-mar. Conheça o Conecta D2C Fortaleza.
- **Slug:** definir com a equipe responsável pelo domínio.
- **Imagem social:** usar \`files-upload/fortaleza-hub-solar.png\` até haver um asset dedicado de Open Graph.
- **Idioma:** pt-BR.
- **Canonical:** URL final publicada da própria landing page.

Não publicar com slug provisório, canonical vazio ou imagem social apontando para ambiente local.`);

await writeText(join(packageDirectory, "TRACKING-E-FORMULARIO.md"), `# Formulário e tracking

## Formulário de confirmação

- **Portal HubSpot:** \`8180620\`
- **Form ID:** \`bdb0ccad-d2b3-471a-adf1-9187057e1ab3\`
- **Contexto:** \`event_registration\`
- **Evento:** \`fortaleza-2026-08-20\`

O pacote usa o embed atual do HubSpot: \`https://js.hsforms.net/forms/embed/8180620.js\` com \`hs-form-frame\`. Não substituir pelo embed v2 sem validação operacional, pois formulários atualizados podem recusá-lo.

## Eventos no dataLayer

- \`cta_click\`: clique em CTA de inscrição.
- \`form_open\`: abertura do lightbox.
- \`form_submit\`: envio confirmado pelo HubSpot.
- \`generate_lead\`: envio confirmado, com \`form_id\`, contexto e evento.
- \`form_error\`: falha de carregamento do formulário.

Validar no modo Preview do GTM e no console do navegador, sem duplicação de eventos. A existência do script não substitui um teste real de envio.`);

await writeText(join(packageDirectory, "ORIGEM-E-VERSAO.md"), `# Origem e versão

- **Pacote:** ${packageName}
- **Escopo:** página individual Conecta D2C Fortaleza.
- **Fonte:** template, CSS, JavaScript e assets do repositório Conecta D2C.
- **Commit-base:** \`${sourceCommit}\`
- **Preview de referência:** ${publicPreviewUrl}
- **Data de geração:** ${new Date().toISOString()}

Não inclui Hub, agenda, CSV, filtros, tabelas ou CTAs de futuras edições.`);

const copiedAssets = await Promise.all(assetNames.map(async (assetName) => {
  const content = await readFile(join(filesUploadDirectory, assetName));
  return `- \`${assetName}\` — ${content.length.toLocaleString("pt-BR")} bytes — SHA-256 \`${sha256(content)}\``;
}));

await writeText(join(packageDirectory, "MANIFESTO-DE-ARQUIVOS.md"), `# Manifesto de arquivos

## Arquivos de implantação

- \`developer-files/conecta-d2c-fortaleza.template.html\`
- \`files-upload/conecta-d2c-fortaleza.css\`
- \`files-upload/conecta-d2c-fortaleza.js\`
- \`preparar-com-url.ps1\`
- \`preview-local.html\`

## Assets copiados

${copiedAssets.join("\n")}

Total de assets: ${assetNames.length}.`);

const checksumFiles = (await listFiles(packageDirectory)).filter((file) => !file.endsWith("CHECKSUMS-SHA256.txt"));
const checksums = await Promise.all(checksumFiles.map(async (file) => {
  const content = await readFile(file);
  return `${sha256(content)}  ${relative(packageDirectory, file).replaceAll("\\\\", "/")}`;
}));
await writeText(join(packageDirectory, "CHECKSUMS-SHA256.txt"), checksums.sort().join("\n"));

console.log(`Pacote criado em: ${packageDirectory}`);
console.log(`Assets copiados: ${assetNames.length}`);
