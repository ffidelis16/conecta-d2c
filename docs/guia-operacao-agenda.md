# Conecta D2C | Guia de atualização da agenda

## Objetivo

Este guia orienta a atualização dos encontros do Conecta D2C no hub público. A agenda será lida de um arquivo CSV hospedado nos Arquivos do HubSpot. Assim, não é necessário editar o layout da página a cada nova cidade ou edição.

## Arquivos de trabalho

- **Planilha-mestre:** `modelo-tabela-agenda-conecta-d2c.xlsx`.
- **Arquivo publicado:** exportação da aba `Agenda` em CSV UTF-8, nomeado `agenda-conecta-d2c.csv`.

A planilha-mestre é a fonte de verdade. O CSV é apenas a versão pública que a página consulta.

## Rotina de atualização

1. Abra a planilha-mestre e atualize ou adicione os eventos na aba `Agenda`.
2. Valide os campos obrigatórios e as opções de status antes de publicar.
3. Exporte somente a aba `Agenda` como **CSV UTF-8**.
4. No HubSpot, acesse **Conteúdo > Arquivos**, abra o arquivo `agenda-conecta-d2c.csv` e use **Substituir**. Não crie uma nova cópia para a atualização recorrente.
5. Mantenha o arquivo público com `noindex`. A página precisa acessá-lo; a agenda não precisa aparecer isoladamente em buscas.
6. Verifique o hub em janela anônima: próximo destaque, uma busca por cidade e a paginação. Não é necessário enviar formulários para essa conferência.

O HubSpot pode manter a versão anterior em cache por até duas horas após a substituição. Caso a atualização não apareça de imediato, aguarde e confira novamente em janela anônima. Consulte as instruções oficiais de [substituição de arquivo](https://knowledge.hubspot.com/files/organize-edit-and-delete-files) e [visibilidade/URL de arquivos](https://knowledge.hubspot.com/files/copy-and-update-the-url-of-files-uploaded-to-the-file-manager).

## Campos da tabela

| Campo | Preenchimento | Regra operacional |
| --- | --- | --- |
| `event_id` | Obrigatório | Identificador único e permanente, em minúsculas e com hífens. Ex.: `fortaleza-2026-08-20`. |
| `event_name` | Obrigatório | Nome público do encontro. |
| `city` / `state` / `region` | Obrigatório | Cidade, UF com duas letras e região oficial do Brasil. |
| `venue` / `address` | Obrigatório para evento confirmado | Local e endereço exibidos no card e no mapa. |
| `latitude` / `longitude` | Obrigatório para sugestão de proximidade | Coordenadas decimais com ponto. Permitem sugerir os três eventos mais próximos. |
| `date` / `time` | Obrigatório para evento confirmado | Data em `AAAA-MM-DD` e hora em `HH:MM`, horário de Brasília. |
| `status` | Obrigatório | `confirmed`, `coming_soon`, `interest_only` ou `past`. |
| `featured` | Obrigatório | `SIM` mostra o encontro como destaque; mantenha somente um evento futuro como destaque. |
| `display_order` | Obrigatório | Número inteiro: menor número aparece antes entre itens da mesma situação. |
| `theme` / `partner` | Recomendado | Tema e parceiro mostrados no card quando disponíveis. |
| `image_url` | Obrigatório para cards com imagem | URL pública de imagem já aprovada e hospedada no HubSpot. |
| `event_url` | Obrigatório quando houver página individual | Caminho ou URL da página do evento. |
| `cta_type` | Obrigatório | `event_pre_registration`, `event_registration`, `regional_interest` ou `none`. |
| `published` | Obrigatório | `SIM` torna o item elegível para a página; `NÃO` mantém o registro apenas na planilha. |
| `last_updated` | Obrigatório | Data da última revisão do registro, em `AAAA-MM-DD`. |

## Como o status afeta a página

- `confirmed`: encontro com dados definidos e CTA de pré-cadastro ou inscrição.
- `coming_soon`: encontro anunciado, ainda sem todos os detalhes operacionais.
- `interest_only`: não abre pré-cadastro de edição; direciona para o lightbox de avisos regionais.
- `past`: alimenta a seção de encontros realizados e não exibe CTA de inscrição.

## Regras que evitam erros públicos

- Não altere o `event_id` de um evento já publicado. Crie um novo registro para uma nova edição.
- Não apague eventos passados que possam aparecer no histórico; use `status = past`.
- Não publique um registro sem cidade, UF, status, ordem e data de atualização.
- Não inclua contatos, e-mails, listas de participantes ou qualquer dado pessoal no CSV. Arquivos do HubSpot são hospedados em URL pública.
- Não use a planilha para configurar formulários. Os lightboxes são configurados separadamente no HubSpot.
- Antes de substituir o arquivo, guarde uma cópia da planilha-mestre com a data da atualização.

## Checklist antes de publicar

- [ ] Há apenas um destaque futuro marcado como `SIM`.
- [ ] Datas, horas e UFs seguem o padrão indicado.
- [ ] URLs de imagem e página individual foram abertas e conferidas.
- [ ] O CTA corresponde ao status do evento.
- [ ] Eventos que não devem aparecer estão com `published = NÃO`.
- [ ] O CSV foi exportado em UTF-8 e substituído no mesmo arquivo do HubSpot.
- [ ] O hub foi conferido em janela anônima, sem enviar formulário de teste.
