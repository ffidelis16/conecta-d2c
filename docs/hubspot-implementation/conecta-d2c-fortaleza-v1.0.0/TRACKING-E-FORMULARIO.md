# Formulário e tracking

## Formulário de confirmação

- **Portal HubSpot:** `8180620`
- **Form ID:** `bdb0ccad-d2b3-471a-adf1-9187057e1ab3`
- **Contexto:** `event_registration`
- **Evento:** `fortaleza-2026-08-20`

O pacote usa o embed atual do HubSpot: `https://js.hsforms.net/forms/embed/8180620.js` com `hs-form-frame`. Não substituir pelo embed v2 sem validação operacional, pois formulários atualizados podem recusá-lo.

## Eventos no dataLayer

- `cta_click`: clique em CTA de inscrição.
- `form_open`: abertura do lightbox.
- `form_submit`: envio confirmado pelo HubSpot.
- `generate_lead`: envio confirmado, com `form_id`, contexto e evento.
- `form_error`: falha de carregamento do formulário.

Validar no modo Preview do GTM e no console do navegador, sem duplicação de eventos. A existência do script não substitui um teste real de envio.
