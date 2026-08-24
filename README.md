# Bot da Min — Telegram

## Sobre

Bot para clube literário com XP, níveis, títulos e ranking por grupo, além de ferramentas administrativas para manter a comunidade e seu histórico de progressão.

## Funcionalidades

- XP automático separado por grupo, com ganho de 3 a 7 XP, cooldown de 40 segundos e proteção contra repetição.
- Níveis, títulos, perfil literário e ranking.
- Administração de XP com recompensa, ajuste, histórico e reversão.
- Owner permanente e administradores globais.
- Alteração do nome e da foto do bot em conversa privada.
- Deploy no Render com PostgreSQL no Neon e monitoramento HTTP.
- Catálogo global de cartas colecionáveis e Acervo Literary.

## Tecnologias

- Node.js 22 e CommonJS
- PostgreSQL e Sequelize
- Telegram Bot API
- Render e Neon

## Instalação

Crie um `.env` local a partir de `.env.example`, preencha as variáveis necessárias e execute:

```text
npm ci
npm run db:migrate
npm test
npm start
```

Não inicie o bot localmente enquanto ele estiver rodando no Render com o mesmo token: a API de polling deve ser consumida por apenas uma instância.

## Variáveis de ambiente

- `TELEGRAM_BOT_TOKEN`: token fornecido pelo BotFather.
- `BOT_OWNER_ID`: ID numérico do owner permanente.
- `DATABASE_URL`: conexão PostgreSQL usada em produção.
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST` e `DB_PORT`: conexão usada em desenvolvimento.
- `PORT`: porta do servidor HTTP; no Render, é fornecida pela plataforma.
- `NODE_ENV`: ambiente de execução, como `development` ou `production`.

Em produção, configure `DATABASE_URL`. Em desenvolvimento, configure as variáveis `DB_*`.

## Comandos

Públicos em grupos:

- `/ajuda` (aliases `/help` e `/start`): guia público.
- `/literaryxp`: perfil de XP, nível e título do autor; ao responder a outra pessoa, exige administração global do bot.
- `/rank`: ranking de XP do grupo.
- `/statusxp`: resumo das regras e estatísticas de XP.
- `/admliterary`: administradores globais ativos.
- `/acervo`: explora estantes e encontra cartas somente no privado.
- `/colecao`: mostra as cartas encontradas.

Exclusivos do owner ou de administradores globais:

- `/darxp quantidade motivo`: recompensa XP; exige resposta à mensagem do membro.
- `/ajustarxp quantidade motivo`: corrige XP; exige resposta à mensagem do membro.
- `/historico`: consulta alterações manuais; exige resposta à mensagem do membro.
- `/desfazerxp ID motivo`: reverte uma transação pelo ID, sem exigir resposta.
- `/comandosadm`: abre o guia administrativo.

Outros comandos exclusivos do owner ou de administradores globais:

- `/daradmin ID` e `/removeradmin ID`: concedem ou revogam acesso global; também aceitam resposta a uma mensagem.
- `/criarfranquia` e `/franquias`: criam e listam franquias.
- `/adicionarcarta`, `/cartas`, `/excluircarta <número>` e `/excluirfranquia <número>`: administram o catálogo com arquivamento lógico; os comandos sensíveis funcionam somente no privado.
- `/trocarfoto` e `/trocarnome novo nome`: exclusivos de conversa privada.

`/meuid` mostra o ID do usuário e auxilia a administração global.

## XP

Mensagens válidas entregam aleatoriamente de 3 a 7 XP, no máximo uma vez a cada 40 segundos. Comandos não entregam XP, mensagens repetidas são protegidas por uma janela própria e toda a progressão é separada por grupo. O XP acumulado determina níveis e títulos literários.

## Deploy

O Render executa o serviço e o Neon fornece o PostgreSQL. O build usa `npm ci`; o script `render:start` aplica as migrations e inicia o bot. O endpoint `/health` é usado para monitoramento, e `PORT` é respeitada pelo servidor HTTP. Mantenha somente uma instância usando o token de polling.

## Segurança

- Não versione o arquivo `.env` nem publique o token.
- Revogue imediatamente qualquer token exposto.
- Use permissões administrativas com cuidado.
- Faça backup antes de alterações importantes no banco.
