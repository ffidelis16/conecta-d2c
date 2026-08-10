# Roteiro de implementação · Fortaleza

## 1. Pré-requisitos

- [ ] Acesso a **Files**, **Design Manager** e criação de landing pages no portal.
- [ ] Pasta e template exclusivos; não editar template compartilhado.
- [ ] Domínio e slug aprovados.
- [ ] Confirmação de que GTM, analytics, pixels e consentimento são herdados pelo portal.
- [ ] Um contato autorizado para testar o formulário real em rascunho.

## 2. Subir arquivos para HubSpot Files

1. Em **Marketing > Files**, crie a pasta `conecta-d2c/fortaleza`.
2. Suba **todo** o conteúdo interno de `files-upload/`, sem alterar nomes.
3. Abra um arquivo da pasta e copie a parte comum da URL até a pasta, por exemplo: `https://site.nuvemshop.com.br/hubfs/conecta-d2c/fortaleza`.
4. Confirme no navegador que o CSS, o JavaScript e uma imagem carregam por HTTPS.

## 3. Preparar o HTML

No PowerShell, dentro desta pasta de entrega:

```powershell
.\preparar-com-url.ps1 -AssetBaseUrl "https://site.nuvemshop.com.br/hubfs/conecta-d2c/fortaleza"
```

O comando gera `developer-files/conecta-d2c-fortaleza-pronto.html`. Não substituir a URL manualmente em vários pontos.

## 4. Criar o template

1. Em **Design Manager**, crie uma pasta exclusiva para Conecta D2C.
2. Crie um arquivo HTML do tipo **Page template** chamado `conecta-d2c-fortaleza.html`.
3. Cole integralmente o conteúdo de `developer-files/conecta-d2c-fortaleza-pronto.html`.
4. Publique o arquivo no Design Manager.

O CSS e o JavaScript **não** devem ser criados no Design Manager: o template os carrega pela pasta exclusiva de Files para manter a referência única e previsível.

## 5. Criar a landing page em rascunho

1. Crie uma landing page nova.
2. Selecione o template **Conecta D2C | Fortaleza | 20/08**.
3. Preencha título, descrição e demais campos de `METADADOS-DA-PAGINA.md`.
4. Mantenha a página em rascunho até concluir o QA.

## 6. QA obrigatório

- [ ] Desktop: 1440, 1280 e 1024 px.
- [ ] Mobile: 390, 375 e 360 px.
- [ ] Sem rolagem horizontal.
- [ ] Hero, fotos, logos, ícones, footer e fontes sem 404.
- [ ] Barra de parceiros em `#002750`.
- [ ] Conteúdo da caixa **Quem estará na sala** centralizado verticalmente.
- [ ] Navegação e âncoras funcionam.
- [ ] CTAs abrem e fecham o lightbox por botão, backdrop e tecla Esc.
- [ ] Formulário de inscrição aparece uma única vez no lightbox e envia um teste real.
- [ ] Após envio, o contato aparece no HubSpot e os eventos de tracking não duplicam.
- [ ] Canonical, Open Graph, cookies e tracking global obedecem à configuração do portal.
- [ ] O resultado visual corresponde ao preview aprovado.

Corrigir localmente e substituir o arquivo correspondente no HubSpot; não fazer correções improvisadas apenas no editor da página.
