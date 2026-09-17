# PRD — Painel de Senhas

**Versão:** 0.1 — Definição inicial  
**Status:** Aguardando validação das pendências ao final do documento.

## 1. Objetivo

Disponibilizar um sistema de emissão e chamada de senhas para atendimento de assistidos em **múltiplas unidades**.

O sistema deverá permitir o cadastro do assistido na recepção, a emissão de senha conforme o tipo de atendimento e a chamada para um guichê, com exibição em painel e alerta sonoro.

## 2. Escopo inicial

- Operação em múltiplas unidades.
- Cadastro e recuperação dos dados do assistido pelo CPF.
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

Os perfis de acesso, a necessidade de login e as responsabilidades administrativas ainda precisam ser confirmados.

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

**Pendente:** confirmar se cada unidade terá seus próprios contadores. A recomendação é que sim.

## 5. Fluxo principal

1. O assistido chega ao guichê de recepção.
2. A recepção informa o CPF do assistido.
3. O sistema verifica se já existe cadastro:
   - **Cadastro existente:** recupera os dados.
   - **Novo cadastro:** solicita nome e data de nascimento.
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

**Proposta para validação:** filas, chamadas e painéis separados por unidade, de forma que uma unidade não chame senhas de outra.

### RF02 — Cadastro do assistido

O cadastro deverá conter:

| Campo | Obrigatório | Observação |
|---|---|---|
| Nome | Sim | Nome do assistido. |
| CPF | Sim | Utilizado na busca de cadastro existente. |
| Data de nascimento | Sim | Utilizada para calcular automaticamente a idade. |

A idade não deverá exigir preenchimento manual.

**Pendente:** definir como proceder quando o assistido não tiver ou não souber o CPF.

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

**Pendente:** definir o tratamento de senhas que ainda estiverem aguardando quando ocorrer a mudança de dia.

### RF07 — Impressão

A senha deverá ser disponibilizada em formato adequado para impressão.

**Conteúdo sugerido para o comprovante:**

- Nome da unidade.
- Código da senha em destaque.
- Tipo de atendimento.
- Data e horário de emissão.

A identificação do atendimento deverá continuar compreensível em impressão monocromática.

### RF08 — Chamada da próxima senha

Todos os guichês poderão atender todos os tipos de atendimento.

O atendente deverá utilizar o comando **“Chamar próxima senha”**, sem seleção manual de uma senha específica.

O sistema deverá impedir que a mesma senha seja chamada como próxima por dois guichês simultaneamente.

**Proposta para validação:** chamar a senha há mais tempo aguardando na unidade, independentemente do tipo de atendimento.

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

**Proposta para validação:** ao chamar a próxima senha, a anterior deixa de ser a senha atual do guichê, sem que isso represente um registro de atendimento concluído.

### RF11 — Painel de chamadas

O sistema deverá fornecer uma tela para exibição em TV ou monitor.

O painel deverá apresentar:

- Código da senha chamada.
- Tipo de atendimento com sua cor.
- Guichê de destino.

A cada chamada, deverá emitir **somente um alerta sonoro**, sem leitura por voz.

**Proposta para validação:** o painel público não exibirá nome, CPF ou data de nascimento.

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

## 8. Requisitos de qualidade

- **Legibilidade:** senha e guichê devem ser facilmente reconhecíveis no painel.
- **Acessibilidade visual:** cores devem ser acompanhadas por texto, com contraste adequado.
- **Consistência:** emissão e chamada simultâneas não devem causar duplicidade.
- **Atualização automática:** o painel deverá receber novas chamadas sem atualização manual.
- **Proteção dos dados:** dados cadastrais deverão ficar restritos às telas e aos usuários autorizados.
- **Recuperação de falha de impressão:** uma falha de impressão não deverá gerar automaticamente outra senha.

## 9. Critérios de aceite principais

| Cenário | Resultado esperado |
|---|---|
| Informar CPF já cadastrado | O sistema recupera os dados do assistido. |
| Cadastrar um novo assistido | Nome, CPF e data de nascimento são registrados. |
| Informar data de nascimento | A idade é calculada automaticamente. |
| Emitir duas senhas de Família | São geradas FAM-001 e FAM-002, considerando o início do contador. |
| Emitir uma senha Criminal após as anteriores | É gerada CRI-001, considerando o início desse contador. |
| Emitir a primeira senha de um tipo no novo dia | A numeração desse tipo começa em 001. |
| Confirmar a emissão | A senha é exibida e disponibilizada para impressão. |
| Dois guichês chamarem a próxima senha simultaneamente | Cada guichê recebe uma senha diferente. |
| Chamar uma senha | O painel mostra a senha e o guichê, com alerta sonoro. |
| Chamar novamente | A mesma senha é anunciada novamente, sem avançar a fila. |
| Não haver senhas aguardando | O sistema informa que a fila está vazia. |

## 10. Pendências para fechar o PRD

1. **Unidades:** podemos adotar filas, contadores e painéis independentes por unidade? Assim, duas unidades podem emitir `FAM-001` no mesmo dia.
2. **Acessos:** recepção, atendente e administrador terão login? Algum outro perfil será necessário?
3. **CPF:** se a pessoa não tiver ou não souber o CPF, o cadastro e a emissão ficarão bloqueados ou haverá uma exceção?
4. **Ordem da fila:** podemos chamar pela ordem de chegada, misturando os quatro tipos de atendimento?
5. **Troca da senha atual:** ao clicar em “Chamar próxima”, a senha anterior pode simplesmente deixar de ser a atual, sem finalização manual?
6. **Painel público:** confirma a exibição somente de senha, tipo de atendimento e guichê, sem o nome do assistido?
7. **Virada do dia:** senhas ainda aguardando devem deixar de participar da fila do novo dia ou continuar disponíveis para chamada?

Relatórios, integrações e funcionamento sem internet ficam para uma próxima rodada, conforme solicitado.
