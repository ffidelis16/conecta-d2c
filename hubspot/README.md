# Pacote HubSpot | Conecta D2C

Este diretório contém dois templates exclusivos do Design Manager:

- `templates/conecta-d2c-hub.html`: hub e agenda.
- `templates/conecta-d2c-event.html`: página individual de evento.

Ambos carregam apenas `assets/css/conecta-d2c.css` e `assets/js/conecta-d2c.js`. Não editar templates compartilhados da Nuvemshop.

Não abra esses templates diretamente por `file://`: as expressões `get_asset_url` são HubL. Para revisão sem portal, use os arquivos gerados em `../preview/`.

## Configuração antes de publicar

1. Faça upload de `assets/` e `data/agenda-conecta-d2c.csv` para a estrutura equivalente no HubSpot.
2. Publique a tabela no Gerenciador de arquivos como CSV público com `noindex`.
3. No template do hub, substitua `__AGENDA_PUBLIC_URL__` pela URL pública desse CSV. Nas atualizações futuras, use **Substituir** no mesmo arquivo, preservando a URL.
4. Preencha no elemento `<body>` dos dois templates os GUIDs de formulário em `data-form-regional-interest`, `data-form-event-pre-registration` e `data-form-event-registration`.
5. Mantenha `data-hubspot-portal-id` no portal correto. O script carrega o embed atual `forms/embed/{portalId}.js` e insere `hs-form-frame`; não usar o embed v2 legado.
6. Crie as páginas como rascunho, associe cada uma ao template correspondente e confira desktop/mobile. Não envie formulários de teste sem contato autorizado.

## Agenda

O CSV em `data/` é uma amostra visual baseada no Figma. Antes da publicação, valide cidade, data, local, parceiros, URLs e CTA com a operação. A documentação entregue ao cliente explica o modelo de tabela e a rotina de atualização.

## Limites conhecidos

- O formulário é exibido em lightbox e a marcação está pronta; os GUIDs não foram preenchidos porque o mapa dos três fluxos ainda será revisado.
- A sugestão geográfica requer `latitude` e `longitude` preenchidos na tabela. Sem essas colunas, a agenda continua pesquisável por cidade, UF e região.
