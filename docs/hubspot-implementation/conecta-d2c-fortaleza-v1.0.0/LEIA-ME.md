# Conecta D2C · Fortaleza · implementação HubSpot

Pacote exclusivo da página individual do evento de Fortaleza. O Hub, a agenda e as futuras integrações de tabela não fazem parte desta entrega.

## Sequência curta

1. Crie uma pasta exclusiva no HubSpot Files e suba todo o conteúdo de `files-upload/`.
2. Copie a URL HTTPS pública da pasta, sem o nome de arquivo ao final.
3. Execute `preparar-com-url.ps1` com essa URL.
4. Crie um template exclusivo no Design Manager e cole `developer-files/conecta-d2c-fortaleza-pronto.html`.
5. Crie a landing page em rascunho, preencha os metadados e execute o QA antes de publicar.

## Conteúdo

- `files-upload/`: CSS, JavaScript e todos os assets necessários. Subir integralmente para uma única pasta no HubSpot Files.
- `developer-files/conecta-d2c-fortaleza.template.html`: origem do template; não subir diretamente.
- `developer-files/conecta-d2c-fortaleza-pronto.html`: arquivo gerado pelo script e único HTML a ser colado no Design Manager.
- `preparar-com-url.ps1`: injeta a URL definitiva de Files no HTML sem alterar a origem.
- `passo-a-passo-implementacao.md`: roteiro para a equipe implementadora.
- `METADADOS-DA-PAGINA.md`: campos da landing page.
- `TRACKING-E-FORMULARIO.md`: configuração do formulário e eventos.
- `MANIFESTO-DE-ARQUIVOS.md` e `CHECKSUMS-SHA256.txt`: conferência de integridade.

## Origem aprovada

- Preview: https://ffidelis16.github.io/conecta-d2c/preview/evento.html
- Repositório: https://github.com/ffidelis16/conecta-d2c
- Commit-base: `2424e99`

O pacote mantém o layout aprovado. A única adaptação técnica é o embed atual de formulário do HubSpot, necessário para a implantação no portal.
