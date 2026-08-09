# Conecta D2C

Implementação das páginas do Conecta D2C no HubSpot.

## Operação da agenda

A agenda pública será alimentada por uma tabela atualizável, publicada como CSV nos arquivos do HubSpot. O arquivo de trabalho e o procedimento completo estão em [docs/guia-operacao-agenda.md](docs/guia-operacao-agenda.md).

O modelo editável está em `outputs/modelo-tabela-agenda-conecta-d2c.xlsx`.

## Escopo implementado localmente

- Hub de eventos com agenda pesquisável.
- Página individual de evento.
- Lightboxes HubSpot para avisos regionais, pré-cadastro e inscrição.

A marcação dos três lightboxes, a agenda pesquisável e os eventos de tracking estão implementados. Antes da publicação, ainda é necessário preencher os GUIDs dos formulários, a URL pública do CSV no HubSpot e validar os dados operacionais da agenda.
