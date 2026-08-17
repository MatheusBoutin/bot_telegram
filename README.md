# Bot da Min — Telegram

Bot em Node.js 22, CommonJS, Sequelize 6/PostgreSQL e cliente HTTPS nativo da API do Telegram.

## Configuração

Copie `.env.example` para `.env` e configure as variáveis sem versionar credenciais. `BOT_OWNER_ID` é obrigatório e deve conter o ID numérico da conta Telegram que será owner permanente.

Para descobrir o ID, inicie temporariamente com um ID numérico válido conhecido ou obtenha o ID pelo Telegram e use `/meuid`. Depois defina definitivamente:

```env
BOT_OWNER_ID=123456789
```

O bot falha na inicialização se essa variável estiver ausente ou inválida. O owner é reconhecido implicitamente, não precisa de registro em `bot_admins` e não pode ser revogado.

## Banco de dados

```powershell
npm run db:migrate
```

Não aplique migrations diretamente em produção sem backup e janela de manutenção. A migration de catálogo aborta, sem alterar dados, se encontrar o mesmo `normalizedName` em mais de um grupo. A mensagem de erro inclui os conflitos e a consulta de diagnóstico.

O backfill de dardos transforma cada saldo antigo em saldo efetivo do dia: registros atualizados hoje mantêm `clamp(saldo, 0, 3)`; registros antigos equivalem ao refresh diário de 3; para cada usuário é escolhido o menor valor. Assim nenhum usuário recebe dardos extras em razão de possuir vários grupos.

## Comandos globais

- `/meuid`: mostra o ID do usuário.
- `/daradmin ID` ou em resposta: concede administração global.
- `/removeradmin ID` ou em resposta: revoga administração global (nunca o owner).
- `/admins`: lista owner e administradores ativos.
- `/criarfranquia`, `/franquias`, `/adicionarpersonagem`, `/personagens`: catálogo global, em grupos ou no privado, somente para owner/admin global.
- `/dardos`: funciona no privado, em grupos e supergrupos; a quota diária é global por usuário.

XP, perfil, ranking e administração de XP continuam específicos de cada grupo.
