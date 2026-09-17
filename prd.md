# PRD — Painel de Senhas

**Versão:** 1.0 — Regras validadas e implementação inicial

**Status:** Implementação inicial concluída, com build, testes transacionais PostgreSQL e fluxo principal no navegador validados. Implantação depende da configuração do ambiente.

## 1. Objetivo

Disponibilizar um sistema de emissão e chamada de senhas para atendimento de assistidos em **múltiplas unidades**.

O sistema deverá permitir o cadastro do assistido na recepção, a emissão de senha conforme o tipo de atendimento e a chamada para um guichê, com exibição em painel e alerta sonoro.

## 2. Escopo inicial

- Operação em múltiplas unidades.
- Cadastro com CPF opcional e recuperação pelo CPF ou por nome e nascimento.
- Emissão de senhas com identificação por tipo de atendimento.
- Numeração independente por tipo, reiniciada diariamente.
- Impressão e exibição da senha emitida.
- Chamada automática da próxima senha.
- Repetição da chamada.
- Painel para TV ou monitor com alerta sonoro.
- Atendimento sem distinção entre fila comum e preferencial.

**Para definição futura:** relatórios, integrações e necessidade de funcionamento sem internet.

## 3. Participantes

| Participante | Responsabilidade |
|---|---|
| Assistido | Informa seus dados e o atendimento desejado; recebe a senha e aguarda a chamada. |
| Recepção | Identifica ou cadastra o assistido e emite a senha. |
| Atendente | Chama a próxima senha para seu guichê e repete a chamada quando necessário. |

Haverá login com perfil único. Todo usuário autenticado poderá emitir e chamar nas unidades a que estiver vinculado e gerenciar usuários, unidades, vínculos de acesso e guichês nas telas de configuração. O painel público não exige login. Não haverá autocadastro público de usuários.

## 4. Tipos de atendimento

| Atendimento | Cor | Prefixo | Exemplo |
|---|---|---|---|
| Família | Preto | FAM | FAM-001 |
| Criminal | Vermelho | CRI | CRI-001 |
| Triagem | Amarelo | TRI | TRI-001 |
| Inicial Defesa | Verde | IDE | IDE-001 |

### Regras das senhas

- Cada tipo de atendimento possui seu próprio contador.
- Os contadores reiniciam diariamente.
- Os números são incrementados automaticamente a cada emissão.
- O número deve ter pelo menos três dígitos, com zeros à esquerda.
- O tipo de atendimento deverá ser identificado por texto e prefixo, além da cor.
- Triagem é um atendimento independente.
- Não haverá fluxo de encaminhamento entre tipos de atendimento nesta versão.

Cada unidade terá seus próprios contadores por tipo e dia. Duas unidades poderão emitir `FAM-001` no mesmo dia.

## 5. Fluxo principal

1. O assistido chega ao guichê de recepção.
2. A recepção informa o CPF do assistido ou, na ausência dele, nome e data de nascimento para busca.
3. O sistema verifica se já existe cadastro:
   - **Cadastro existente:** recupera os dados.
   - **Novo cadastro:** solicita nome e data de nascimento; o CPF é opcional.
   - **Busca por nome e nascimento:** apresenta possíveis cadastros para seleção manual. Homônimos não serão unidos automaticamente; a recepção poderá criar outro cadastro.
4. A recepção confere os dados e seleciona o tipo de atendimento.
5. O sistema emite a próxima senha daquele tipo.
6. A senha é exibida na tela e disponibilizada para impressão.
7. O assistido aguarda a chamada no painel.
8. Um atendente aciona **“Chamar próxima senha”**.
9. O sistema associa a senha chamada ao guichê e atualiza o painel.
10. O painel emite um alerta sonoro.
11. Se necessário, o atendente aciona **“Chamar novamente”**.

## 6. Requisitos funcionais

### RF01 — Operação em múltiplas unidades

O sistema deverá suportar várias unidades e identificar a unidade em que cada senha foi emitida.

Filas, chamadas e painéis serão separados por unidade, de forma que uma unidade não chame senhas de outra.

### RF02 — Cadastro do assistido

O cadastro deverá conter:

| Campo | Obrigatório | Observação |
|---|---|---|
| Nome | Sim | Nome do assistido. |
| CPF | Não | Quando informado, deve ser válido e único; utilizado na busca de cadastro existente. |
| Data de nascimento | Sim | Utilizada para calcular automaticamente a idade. |

A idade não deverá exigir preenchimento manual.

Sem CPF, o cadastro e a emissão serão permitidos usando identificador interno. A recepção buscará por nome e nascimento e selecionará manualmente o cadastro correto ou optará por criar um novo. Nome e nascimento continuam obrigatórios. A busca por nome aceita trecho do nome junto à data exata de nascimento e apresenta até 50 resultados; refine o nome se necessário.

O cadastro é compartilhado entre as unidades e acessível somente por usuários autenticados com autorização de operação em uma unidade. A recepção pode corrigir os dados na conferência; o cadastro selecionado é atualizado na emissão. Não se pode atribuir um CPF já vinculado a outro cadastro. A data de nascimento deve ser uma data válida, a partir de 01/01/1900 e não futura no fuso da unidade.

### RF03 — Busca por CPF

Ao informar um CPF já cadastrado, o sistema deverá recuperar o nome e a data de nascimento do assistido para conferência.

A emissão de uma nova senha para um assistido já cadastrado deverá reutilizar seu cadastro.

### RF04 — Seleção do atendimento

Para emitir uma senha, a recepção deverá selecionar exatamente um dos quatro tipos:

- Família.
- Criminal.
- Triagem.
- Inicial Defesa.

O tipo de atendimento é obrigatório para a emissão.

### RF05 — Emissão da senha

Ao confirmar a emissão, o sistema deverá:

- Gerar o número automaticamente.
- Utilizar o contador correspondente ao tipo de atendimento.
- Registrar o assistido, a unidade, o tipo, a data e o horário de emissão.
- Inserir a senha na fila de espera.
- Exibir a senha gerada.
- Disponibilizar sua impressão.

Emissões simultâneas não poderão gerar senhas duplicadas no mesmo contador e dia.

### RF06 — Reinício diário da numeração

A primeira senha de cada tipo no novo dia deverá iniciar em `001`.

O reinício da numeração não deverá apagar os registros anteriores. Uma senha deverá ser distinguível por sua unidade, data, tipo e número.

Na mudança de dia, senhas pendentes deixam de participar da fila, sem apagar o histórico. Se o assistido retornar, a recepção emite uma nova senha. Senhas de dias anteriores também deixam de ser atuais nos guichês e não podem ser chamadas novamente.

O dia é determinado pelo relógio do servidor no fuso configurado na unidade, com padrão `America/Sao_Paulo`. O fuso deve ser definido antes da primeira emissão e não poderá ser alterado após existirem senhas, para preservar a interpretação das datas dos contadores.

### RF07 — Impressão

A senha deverá ser disponibilizada em formato adequado para impressão.

**Conteúdo do comprovante:**

- Nome da unidade.
- Código da senha em destaque.
- Tipo de atendimento.
- Data e horário de emissão.

A identificação do atendimento deverá continuar compreensível em impressão monocromática.

### RF08 — Chamada da próxima senha

Todos os guichês poderão atender todos os tipos de atendimento.

O atendente deverá utilizar o comando **“Chamar próxima senha”**, sem seleção manual de uma senha específica.

O sistema deverá impedir que a mesma senha seja chamada como próxima por dois guichês simultaneamente.

Chamar a senha há mais tempo aguardando na unidade no dia atual, independentemente do tipo de atendimento. A ordem é definida pela emissão no servidor, com desempate estável por identificador. Operações concorrentes são coordenadas por unidade para preservar essa ordem.

### RF09 — Repetição da chamada

O atendente poderá chamar novamente a senha atualmente associada ao seu guichê.

A repetição deverá:

- Manter a mesma senha e o mesmo guichê.
- Atualizar o destaque da chamada no painel.
- Reproduzir novamente o alerta sonoro.

A repetição não deverá emitir uma nova senha nem avançar a fila.

### RF10 — Ações do atendente

As ações disponíveis nesta versão serão:

- **Chamar próxima senha.**
- **Chamar novamente.**

Não foram solicitados comandos de finalização, cancelamento ou registro de ausência.

Ao chamar a próxima senha, a anterior deixa de ser a senha atual do guichê, sem que isso represente um registro de atendimento concluído. Se a fila estiver vazia, a senha atual do dia permanece disponível para repetição.

### RF11 — Painel de chamadas

O sistema deverá fornecer uma tela para exibição em TV ou monitor.

O painel deverá apresentar:

- Código da senha chamada.
- Tipo de atendimento com sua cor.
- Guichê de destino.

A cada chamada, deverá emitir **somente um alerta sonoro**, sem leitura por voz.

O painel público e sua API não exibirão nome, CPF, data de nascimento ou identificador do assistido. Exibirão a unidade, senha, atendimento, guichê e últimas chamadas do dia.

As chamadas são eventos persistidos e consultados automaticamente a cada segundo. Eventos recebidos entre consultas são apresentados em ordem, com intervalo de 2,5 segundos entre destaques. Cada nova chamada ou repetição gera um evento e um único alerta em cada painel com som ativado. Ao abrir/recarregar o painel, as chamadas já existentes são exibidas sem reproduzir sons históricos. Após uma interrupção temporária, a mesma página recupera os eventos ainda não recebidos do dia atual. Na virada do dia, o painel limpa as chamadas anteriores.

O operador deverá clicar em **Ativar som** ao abrir o painel, conforme a restrição de reprodução automática dos navegadores. Caso o navegador suspenda o áudio, o controle solicita nova ativação. Não haverá leitura por voz. O painel indicará perda de conexão e tentará reconectar automaticamente.

### RF12 — Ausência de prioridade

Não haverá senhas preferenciais nem alteração de ordem em função da idade.

A data de nascimento será utilizada para os dados cadastrais e o cálculo da idade.

## 7. Telas previstas

### 7.1. Recepção — Cadastro e emissão

- Identificação da unidade.
- Busca por CPF.
- Nome e data de nascimento.
- Idade calculada.
- Seleção do tipo de atendimento.
- Comando para emitir senha.
- Confirmação da emissão com a senha em destaque.
- Opção de impressão.

### 7.2. Guichê — Chamada

- Identificação da unidade e do guichê.
- Senha atual.
- Tipo de atendimento.
- Botão **“Chamar próxima senha”**.
- Botão **“Chamar novamente”**.
- Indicação quando não houver senhas aguardando.

### 7.3. Painel público

- Senha chamada em destaque.
- Guichê de destino.
- Identificação textual e visual do atendimento.
- Alerta sonoro a cada chamada.

### 7.4. Login e configurações

- Login por e-mail e senha; sessão de 12 horas e opção de sair.
- Primeiro usuário criado por comando de configuração, sem credenciais padrão.
- Cadastro e edição de usuários, unidades, vínculos e guichês por qualquer usuário autenticado.
- Unidades e guichês podem ser desativados, preservando referências históricas.
- Usuários podem ser desativados; o próprio usuário não pode desativar seu acesso.
- Troca de senha e desativação invalidam as sessões do usuário afetado.
- Ao criar uma unidade, seu criador recebe vínculo de operação automaticamente.
- Senhas de acesso com pelo menos 12 caracteres; limitação de tentativas de login por e-mail.
- Nomes dos guichês são únicos dentro da unidade; um guichê existente não muda de unidade.

## 8. Requisitos de qualidade

- **Legibilidade:** senha e guichê devem ser facilmente reconhecíveis no painel.
- **Acessibilidade visual:** cores devem ser acompanhadas por texto, com contraste adequado.
- **Consistência:** emissão e chamada simultâneas não devem causar duplicidade.
- **Atualização automática:** o painel deverá receber novas chamadas sem atualização manual.
- **Proteção dos dados:** dados cadastrais deverão ficar restritos às telas e aos usuários autorizados.
- **Recuperação de falha de impressão:** uma falha de impressão não deverá gerar automaticamente outra senha.
- **Recuperação de requisição:** repetir a mesma operação de emissão ou chamada com o mesmo identificador de requisição retorna o resultado original, sem produzir efeitos duplicados. A interface preserva esse identificador ao tentar novamente uma operação que falhou sem confirmação.

## 9. Critérios de aceite principais

| Cenário | Resultado esperado |
|---|---|
| Informar CPF já cadastrado | O sistema recupera os dados do assistido. |
| Cadastrar um novo assistido | Nome e nascimento são registrados; CPF é registrado quando informado. |
| Informar data de nascimento | A idade é calculada automaticamente. |
| Emitir duas senhas de Família | São geradas FAM-001 e FAM-002, considerando o início do contador. |
| Emitir uma senha Criminal após as anteriores | É gerada CRI-001, considerando o início desse contador. |
| Emitir a primeira senha de um tipo no novo dia | A numeração desse tipo começa em 001. |
| Confirmar a emissão | A senha é exibida e disponibilizada para impressão. |
| Dois guichês chamarem a próxima senha simultaneamente | Cada guichê recebe uma senha diferente. |
| Chamar uma senha | O painel mostra a senha e o guichê, com alerta sonoro. |
| Chamar novamente | A mesma senha é anunciada novamente, sem avançar a fila. |
| Não haver senhas aguardando | O sistema informa que a fila está vazia. |
| Emitir sem CPF | Busca por nome e nascimento permite selecionar ou criar cadastro e emitir. |
| Duas unidades emitirem a primeira senha de Família | Cada uma emite FAM-001 na própria fila. |
| Virar o dia com senha pendente | A senha antiga permanece registrada, sai da fila e exige nova emissão no retorno. |
| Repetir a mesma requisição após perda de resposta | Retorna o resultado original, sem nova emissão ou avanço da fila. |
| Consultar painel público | Nenhum dado pessoal do assistido é retornado. |
| Operar em unidade sem vínculo | O servidor recusa a operação. |
| Reimprimir um comprovante | A mesma senha é impressa, sem incrementar contador. |

## 10. Decisões e evolução

As sete pendências originais foram resolvidas com o solicitante: isolamento por unidade, login com perfil único, CPF opcional, fila por chegada, substituição da senha atual sem conclusão, painel sem dados pessoais e nova emissão no retorno em outro dia. Também foram aprovadas busca manual por nome/nascimento, telas de configuração para todos os usuários e fuso por unidade com padrão Brasília.

Stack: Next.js, TypeScript e PostgreSQL. Conexão configurada por `DATABASE_URL` no `.env`; migrações e criação do primeiro usuário executadas por comandos documentados no README.

Toda mudança de regra deverá atualizar este documento e os critérios de aceite correspondentes. Relatórios, integrações e funcionamento sem internet ficam para uma próxima rodada.
