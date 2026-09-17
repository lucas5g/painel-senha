# Painel de Senhas

Aplicação web de recepção, emissão e chamada de senhas para múltiplas unidades. Regras de negócio e critérios de aceite em [`prd.md`](./prd.md).

## Requisitos

- Node.js 22 ou superior e npm.
- PostgreSQL 16 ou superior, local ou remoto.
- Navegador atualizado nos computadores e na TV/monitor.

## Configurar e executar

1. Instale as dependências: `npm install`.
2. Preencha o `.env` preparado na raiz (ou crie um a partir de `.env.example`):

   ```dotenv
   DATABASE_URL=postgresql://USUARIO:SENHA@HOST:5432/BANCO
   APP_ORIGIN=http://localhost:3000
   BOOTSTRAP_EMAIL=operador@example.com
   BOOTSTRAP_NAME=Operador
   BOOTSTRAP_PASSWORD=defina-uma-senha-forte
   ```

   Use percent-encoding para caracteres especiais no usuário/senha da URL. Configure SSL conforme as instruções do seu provedor PostgreSQL. O banco precisa existir e o usuário precisa de permissão para criar as tabelas. O `.env` é ignorado pelo Git.

3. Aplique o esquema: `npm run db:migrate`.
4. Crie o primeiro acesso: `npm run db:bootstrap`. A senha deve ter no mínimo 12 caracteres. Executar novamente preserva a senha de um usuário já existente. Depois da criação, os valores `BOOTSTRAP_*` podem ser removidos do `.env`.
5. Inicie: `npm run dev` e abra `http://localhost:3000`.
6. Entre e abra **Configurações**. Cadastre uma unidade, confira o fuso, cadastre seus guichês e os demais usuários. O criador da unidade recebe acesso operacional automaticamente. Configure os vínculos dos demais usuários.
7. Na **Recepção**, busque/cadastre o assistido e emita uma senha. Em **Guichê**, escolha a estação e chame a próxima.
8. Abra **Abrir painel** na TV e clique em **Ativar som**. O link `/painel/ID_DA_UNIDADE` é público e não retorna dados pessoais.

### PostgreSQL local opcional

Se não tiver um servidor PostgreSQL, `docker compose up -d db` disponibiliza um na porta 5432. Use a conexão de exemplo em `.env.example`. Os dados ficam em um volume Docker. O Compose fornece somente o banco; a aplicação roda pelos comandos npm.

### Acesso por outros dispositivos

Use o endereço do servidor, por exemplo `http://192.168.1.10:3000`, e configure **esse mesmo endereço** em `APP_ORIGIN`. Reinicie a aplicação após alterar o ambiente. Requisições de alteração exigem que a origem corresponda a `APP_ORIGIN`.

Para produção: `npm run build` e `npm start`, com HTTPS no servidor/proxy e `APP_ORIGIN=https://seu-dominio`. O cookie de sessão usa `Secure` quando a origem configurada é HTTPS. Todos os dispositivos devem acessar a aplicação pela mesma origem configurada.

## Verificações

```sh
npm run typecheck
npm run build
npm test
```

`npm test` executa testes de CPF, idade e formatação. Para incluir os testes transacionais, aponte `TEST_DATABASE_URL` para um **banco descartável cujo nome termine em `_test`**:

```sh
TEST_DATABASE_URL=postgresql://USUARIO:SENHA@localhost:5432/painel_test npm test
```

Os testes aplicam o esquema, criam e removem seus próprios registros e verificam concorrência, FIFO, isolamento de unidade, idempotência, CPF, retorno em outro dia e restrições de configuração. O banco de produção não deve ser usado para testes.

## Organização

- `src/app`: páginas, estilos e rotas HTTP.
- `src/components`: recepção, guichê, configurações e painel público.
- `src/lib`: autenticação, banco, validações e operações transacionais.
- `migrations`: esquema PostgreSQL.
- `scripts`: migração e criação do primeiro acesso.
- `tests`: regras de domínio e integração PostgreSQL.

## Comportamento operacional

- Contadores e filas separados por unidade, dia local e atendimento; chamadas seguem a ordem de emissão entre todos os tipos.
- Operações da fila são serializadas por unidade em transações PostgreSQL. Restrições únicas protegem a numeração; identificadores de requisição permitem repetir operações sem duplicar efeitos.
- O cadastro do assistido é compartilhado entre unidades. O CPF é opcional e validado quando informado. Pessoas sem CPF são selecionadas manualmente por nome/nascimento, sem fusão automática.
- A virada do dia é lógica: as consultas usam o dia atual da unidade. Nenhum job de exclusão ou reinício é necessário. Registros anteriores são preservados.
- Todos os usuários autenticados gerenciam configurações; vínculos limitam a emissão, busca cadastral e chamadas por unidade.
- O painel consulta eventos a cada segundo, apresenta chamadas em sequência e não reproduz sons históricos ao abrir. É necessário ativar o áudio em cada navegador. Uma reconexão na mesma página retoma pelo último evento recebido.
- Impressão usa o diálogo do navegador. Reimprimir o comprovante exibido não cria nova senha. Confira papel/margens no driver da impressora; o conteúdo tem largura de 72 mm.
- Relatórios, integrações, voz e modo offline ficam fora desta versão.

Mudanças nas regras devem ser refletidas em `prd.md` junto com a implementação.
