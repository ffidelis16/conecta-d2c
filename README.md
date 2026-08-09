# Conecta D2C

Implementação das páginas do Conecta D2C no HubSpot.

## Operação da agenda

A agenda pública será alimentada por uma tabela atualizável, publicada como CSV nos arquivos do HubSpot. O arquivo de trabalho e o procedimento completo estão em [docs/guia-operacao-agenda.md](docs/guia-operacao-agenda.md).

O modelo editável está em `outputs/modelo-tabela-agenda-conecta-d2c.xlsx`.

## Prévia local

Os arquivos em `hubspot/templates/` são fontes HubL e só recebem CSS, JavaScript e imagens quando renderizados pelo HubSpot. Para revisar no navegador sem publicar, abra `preview/index.html` (ou diretamente `preview/hub.html` e `preview/evento.html`).

Depois de alterar um template, atualize a prévia com:

```powershell
node scripts/build-local-preview.mjs
```

## Escopo implementado localmente

- Hub de eventos com agenda pesquisável.
- Página individual de evento.
- Lightboxes HubSpot para avisos regionais, pré-cadastro e inscrição.

A marcação dos três lightboxes, a agenda pesquisável e os eventos de tracking estão implementados. Antes da publicação, ainda é necessário preencher os GUIDs dos formulários, a URL pública do CSV no HubSpot e validar os dados operacionais da agenda.
