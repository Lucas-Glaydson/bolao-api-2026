# Prompt mestre — Backend NestJS + MongoDB para sistema de bolão

Use este prompt em outra IA para gerar **somente o backend** de um sistema de bolão de futebol com **NestJS**, **MongoDB** e **Arquitetura Limpa**, sem frontend. O projeto deve ser pensado para uso entre amigos, com autenticação simples, integração com API externa de partidas e regras de pontuação configuráveis.

## Objetivo do sistema

Construir uma API backend para um bolão de futebol no estilo mata-mata, onde usuários autenticados possam registrar e atualizar palpites de partidas até **1 hora antes do início do jogo**, consultar rankings, visualizar **todos os palpites de todos os participantes**, acompanhar o placar geral, acompanhar rodadas/fases e ter a pontuação calculada automaticamente com base no resultado oficial das partidas. O sistema também deve liberar novos palpites apenas quando uma nova fase for oficialmente destravada no bolão.

## Escopo obrigatório

Gerar um projeto backend completo em **NestJS**, usando **MongoDB** como banco principal, com foco em:

- Arquitetura Limpa
- Boas práticas de modularização
- JWT simples para autenticação
- Swagger
- README completo
- Validações robustas
- Regras de negócio bem separadas
- Integração com API externa de futebol/copa
- Atualização automática ou manual dos resultados
- Sistema de pontuação do bolão
- Visualização agregada dos palpites

## Restrições importantes

- O sistema é **apenas backend**.
- Não gerar frontend, templates SSR, páginas web ou app mobile.
- Não expor rota pública de registro de usuário para o frontend.
- O cadastro de amigos será feito manualmente pelo backend ou por seed/script interno.
- Usar variáveis de ambiente para credenciais e configurações.
- Banco de dados: **MongoDB**.
- Framework principal: **NestJS**.
- Linguagem: **TypeScript**.

## Regras de pontuação

A pontuação deve ser parametrizável, mas iniciar com estas regras padrão:

- 16 avos: 1 ponto
- Oitavas: 1 ponto
- Quartas: 1 ponto
- Semifinal: 2 pontos
- Final: 2 pontos
- Placar exato: +2 pontos extras

## Regras funcionais

### Autenticação

- Criar autenticação com JWT simples.
- Deve existir apenas uma rota pública de login.
- O usuário faz login com credenciais previamente cadastradas.
- O cadastro não deve ficar exposto para consumo público no frontend.
- Pode existir rota protegida apenas para admin criar usuários manualmente, ou script/seed interno.
- Implementar hash de senha com bcrypt.
- Implementar perfis mínimos: `admin` e `user`.

### Usuários

- Cada amigo deve possuir conta individual.
- O admin poderá cadastrar usuários manualmente.
- Deve existir listagem de usuários para administração.
- Deve existir endpoint para consultar o perfil autenticado.

### Partidas

- Integrar com uma API externa de futebol/copa para obter partidas, status, horários e placares oficiais.
- Salvar as partidas localmente no MongoDB para evitar dependência total da API externa em tempo real.
- Permitir sincronização manual e opcionalmente automática por cron.
- Armazenar fase da competição, data/hora da partida, times, status e resultado oficial.
- Manter histórico mínimo de sincronização e tratamento de falhas.

### Palpites

- O usuário autenticado pode criar ou atualizar o próprio palpite.
- O palpite só pode ser alterado até **1 hora antes do início da partida**.
- Após o prazo, o sistema deve bloquear edição.
- Cada usuário só pode ter um palpite por partida, com comportamento de upsert.
- O palpite deve conter gols do time da casa e gols do visitante.
- O sistema deve permitir consultar:
  - palpites do usuário logado
  - palpites por partida
  - todos os palpites de todos os usuários para tela de visualização
  - visão agregada por rodada/fase
  - comparação geral entre usuários por partida e por fase
- Os usuários autenticados podem visualizar os palpites dos outros participantes.
- A visualização dos palpites deve permitir acompanhar quem apostou em qual placar em cada jogo.

### Rodadas e fases

- O bolão deve atualizar a cada rodada/fase.
- O sistema deve retornar partidas agrupadas por fase.
- Cada fase deve possuir um controle de liberação/desbloqueio para permitir palpites apenas quando aquela fase estiver aberta.
- A cada nova fase, o sistema deve destravar os jogos daquela fase para inserção/edição de palpites, respeitando também a regra de bloqueio de 1 hora antes de cada partida.
- Fases futuras não liberadas não devem aceitar palpites ainda.
- O usuário deve conseguir visualizar quais partidas ainda estão abertas para palpite.
- O usuário deve conseguir alterar palpites somente enquanto a janela estiver válida.

### Resultado e pontuação

- Quando o resultado oficial estiver disponível, calcular a pontuação automaticamente.
- Regras:
  - acertou vencedor/empate conforme regra definida para a fase: soma pontos da fase
  - acertou placar exato: soma bônus de +2
- Salvar a pontuação por palpite.
- Manter ranking geral por usuários.
- Gerar ranking ordenado por pontuação total, com critérios de desempate configuráveis, por exemplo: mais placares exatos, mais acertos de vencedor e data de criação do usuário ou outro critério definido.
- Permitir acompanhar o placar geral do bolão a qualquer momento.
- Permitir reprocessamento de pontuação caso haja correção de resultado.

## Features adicionais que devem ser incluídas

Adicionar estas melhorias no backend, mesmo que não estejam explicitamente pedidas originalmente:

### Visualização e acompanhamento

- Endpoint de **dashboard do bolão** com:
  - ranking geral
  - placar geral acumulado do bolão
  - top acertadores por fase
  - quantidade de palpites enviados
  - quantidade de jogos abertos, em andamento e encerrados
  - status da fase atual e próximas fases
- Endpoint de **matriz de palpites** para facilitar a construção de tela comparativa no frontend, exibindo todos os palpites de todos os usuários por partida e por fase.
- Endpoint de **timeline/status das partidas** com indicadores de prazo aberto/fechado para palpite.
- Endpoint com **estatísticas por usuário**:
  - total de pontos
  - quantidade de placares exatos
  - taxa de acerto por fase
  - quantidade de palpites feitos
- Endpoint com **estatísticas por partida**:
  - quantos usuários apostaram em cada placar
  - placar mais escolhido
  - distribuição de vencedores apostados
- Endpoint de **próximos jogos com deadline calculado**.

### Gestão e confiabilidade

- Seed inicial para usuários, roles e configuração de pontuação.
- Configuração centralizada das regras do bolão.
- Logs estruturados para sincronização de API externa e processamento de pontuação.
- Idempotência nos jobs de sincronização e cálculo.
- Tratamento de timezone, preferencialmente UTC no banco e conversão controlada.
- Proteção contra palpites duplicados.
- Índices do MongoDB para consultas frequentes.
- Paginação e filtros nas listagens maiores.

### Qualidade técnica

- Testes unitários para regras críticas.
- Testes e2e para autenticação, palpites e ranking.
- DTOs com class-validator.
- Exception filters e interceptors quando fizer sentido.
- Versionamento de API (`/api/v1`).
- Swagger bem descrito com exemplos de request/response.
- README completo com setup, env, arquitetura, fluxos e endpoints.

## Arquitetura obrigatória

Usar **Arquitetura Limpa**, separando claramente:

- `domain`
  - entidades
  - value objects, se necessário
  - interfaces/regras puras
- `application`
  - casos de uso
  - contratos de entrada/saída
  - services de orquestração
- `infrastructure`
  - persistência MongoDB/Mongoose
  - integrações externas
  - JWT
  - cron jobs
  - config
  - logger
- `presentation`
  - controllers
  - DTOs
  - guards
  - decorators
  - swagger

Exigir baixo acoplamento, alta coesão e dependência apontando para dentro.

## Stack e bibliotecas esperadas

Use preferencialmente:

- NestJS
- Mongoose
- @nestjs/jwt
- @nestjs/passport
- passport-jwt
- bcrypt
- class-validator
- class-transformer
- @nestjs/swagger
- axios ou HttpModule do Nest para API externa
- @nestjs/config
- @nestjs/schedule
- Jest para testes

## Modelagem sugerida

A IA deve propor a modelagem e justificar, mas no mínimo considerar coleções/documentos como:

### User
- id
- name
- email ou username
- passwordHash
- role
- isActive
- createdAt
- updatedAt

### Match
- id
- externalId
- competition
- stage
- roundLabel
- homeTeam
- awayTeam
- kickoffAt
- status
- officialHomeScore
- officialAwayScore
- winner
- syncedAt
- createdAt
- updatedAt

### Prediction
- id
- userId
- matchId
- predictedHomeScore
- predictedAwayScore
- lockedAt
- canEditUntil
- pointsAwarded
- exactScoreHit
- outcomeHit
- createdAt
- updatedAt

### ScoreRule / Settings
- id
- stage
- basePoints
- exactScoreBonus
- active

### StageControl
- id
- stage
- isOpen
- openedAt
- closedAt
- allowPredictions
- displayOrder

### Ranking Snapshot (opcional)
- id
- generatedAt
- standings
- referenceStage

## Casos de uso mínimos

A IA deve implementar casos de uso claros, incluindo pelo menos:

- login
- create user (admin/manual)
- list users
- get my profile
- sync matches from external API
- list matches
- list matches by stage
- get match by id
- create or update prediction
- get my predictions
- get predictions by match
- get all predictions for visualization
- get public prediction board with all users
- open current stage for predictions
- close stage for predictions
- calculate points for finished matches
- recalculate all rankings
- get ranking
- get overall scoreboard
- get dashboard stats
- get user stats
- get match stats

## Regras de negócio críticas

Implementar e isolar claramente estas regras:

1. O usuário não pode palpitar em jogo iniciado ou com menos de 1 hora para começar.
2. O usuário só pode editar o próprio palpite.
3. Cada usuário tem apenas um palpite por partida.
4. A pontuação depende da fase da partida.
5. Bônus de placar exato soma +2 além da pontuação base.
6. Usuários autenticados podem visualizar todos os palpites dos demais participantes.
7. Fases só aceitam palpites quando estiverem oficialmente liberadas/destravadas.
8. Partidas de fases futuras bloqueadas não podem receber palpites.
9. Partidas sem resultado oficial não geram pontos.
10. Reprocessamento não pode duplicar pontuação.
11. Datas devem ser comparadas com segurança considerando timezone.

## Endpoints esperados

A IA deve gerar rotas REST organizadas, por exemplo:

### Auth
- `POST /api/v1/auth/login`

### Users
- `POST /api/v1/users` (protegida, admin ou uso interno)
- `GET /api/v1/users`
- `GET /api/v1/users/me`

### Matches
- `POST /api/v1/matches/sync`
- `GET /api/v1/matches`
- `GET /api/v1/matches/:id`
- `GET /api/v1/matches/stage/:stage`
- `GET /api/v1/matches/upcoming/deadlines`

### Stages
- `GET /api/v1/stages`
- `PATCH /api/v1/stages/:stage/open`
- `PATCH /api/v1/stages/:stage/close`

### Predictions
- `PUT /api/v1/predictions/:matchId`
- `GET /api/v1/predictions/me`
- `GET /api/v1/predictions/match/:matchId`
- `GET /api/v1/predictions/board`
- `GET /api/v1/predictions/stage/:stage`
- `GET /api/v1/predictions/users/:userId`

### Ranking / Stats
- `POST /api/v1/ranking/recalculate`
- `GET /api/v1/ranking`
- `GET /api/v1/ranking/scoreboard`
- `GET /api/v1/stats/dashboard`
- `GET /api/v1/stats/users/:userId`
- `GET /api/v1/stats/matches/:matchId`

## Integração com API externa

A IA deve deixar a integração desacoplada por provider/adapter, para permitir trocar a API depois.

Exigir:

- interface para provider externo
- serviço de sincronização
- normalização dos dados recebidos
- tratamento para indisponibilidade da API
- cache/persistência local das partidas

## Variáveis de ambiente

Criar `.env.example` com pelo menos:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=
JWT_SECRET=
JWT_EXPIRES_IN=7d
EXTERNAL_FOOTBALL_API_BASE_URL=
EXTERNAL_FOOTBALL_API_KEY=
SYNC_CRON=0 */30 * * * *
APP_TIMEZONE=UTC
```

## Documentação obrigatória

### README

Atualizar ou gerar README contendo:

- visão geral do projeto
- tecnologias
- arquitetura de pastas
- como rodar localmente
- variáveis de ambiente
- seed/admin inicial
- decisões arquiteturais
- regras de negócio
- endpoints com exemplos
- fluxo de pontuação
- fluxo de sincronização de partidas
- exemplos de requests e responses
- como executar testes

### Swagger

- Configurar Swagger no bootstrap do NestJS.
- Documentar rotas, DTOs, schemas, autenticação bearer e exemplos.

## Qualidade de código exigida

- Código limpo e legível.
- Nomes consistentes.
- Separação real entre regra de negócio e framework.
- Evitar controllers gordos.
- Evitar lógica de negócio dentro de schemas Mongoose.
- Usar repositories/interfaces quando fizer sentido.
- Criar validações claras com mensagens amigáveis.
- Adicionar comentários apenas quando realmente agregarem valor.

## Saída esperada da IA

A resposta da IA deve entregar:

1. Estrutura completa de pastas do projeto.
2. Explicação breve da arquitetura adotada.
3. Código dos principais arquivos.
4. Implementação das entidades, casos de uso, controllers, DTOs e repositories.
5. Configuração do MongoDB, JWT, Swagger e env.
6. Exemplo de seed/admin.
7. README completo.
8. Exemplos de testes unitários e e2e.
9. Sugestões de evolução futura.

## Instrução final para a IA

Gere um backend realista, pronto para desenvolvimento incremental, com foco em **NestJS + MongoDB + Clean Architecture**, cobrindo autenticação, integração com API de partidas, palpites, ranking, estatísticas e documentação. Priorize organização, escalabilidade, clareza de domínio e regras de negócio desacopladas do framework.

***

# Checklist de acompanhamento

Use este checklist para acompanhar o que a outra IA já entregou e o que ainda falta.

## 1. Base do projeto

- [ ] Projeto criado em NestJS com TypeScript
- [ ] MongoDB configurado
- [ ] `.env.example` criado
- [ ] Configuração centralizada com `@nestjs/config`
- [ ] Prefixo global `/api/v1`
- [ ] Estrutura baseada em Arquitetura Limpa
- [ ] Separação entre domain, application, infrastructure e presentation

## 2. Autenticação

- [ ] Rota pública de login criada
- [ ] JWT configurado
- [ ] Guard JWT funcionando
- [ ] Hash de senha com bcrypt
- [ ] Perfil `admin` e `user` implementados
- [ ] Endpoint `me` funcionando
- [ ] Registro público NÃO exposto

## 3. Usuários

- [ ] Entidade/coleção de usuário criada
- [ ] Seed ou rota protegida para criar usuários manualmente
- [ ] Listagem de usuários implementada
- [ ] Validações de usuário implementadas

## 4. Partidas

- [ ] Entidade/coleção de partidas criada
- [ ] Provider de API externa abstraído por interface
- [ ] Serviço de sincronização implementado
- [ ] Endpoint de sync criado
- [ ] Partidas salvas localmente no MongoDB
- [ ] Listagem de partidas implementada
- [ ] Filtro por fase implementado
- [ ] Deadline calculado por partida implementado

## 5. Palpites

- [ ] Entidade/coleção de palpites criada
- [ ] Upsert de palpite por usuário/partida implementado
- [ ] Regra de bloqueio até 1h antes do jogo implementada
- [ ] Usuário só altera o próprio palpite
- [ ] Endpoint de meus palpites implementado
- [ ] Endpoint de palpites por partida implementado
- [ ] Endpoint geral para visualização implementado
- [ ] Endpoint por fase/rodada implementado

## 6. Pontuação

- [ ] Regras por fase configuráveis
- [ ] Bônus de placar exato implementado
- [ ] Cálculo de pontos por palpite implementado
- [ ] Reprocessamento sem duplicidade implementado
- [ ] Ranking geral implementado
- [ ] Placar geral acumulado implementado
- [ ] Critérios de desempate definidos
- [ ] Recalcular ranking/manual job implementado

## 7. Estatísticas e visualização

- [ ] Endpoint de dashboard implementado
- [ ] Ranking geral no dashboard
- [ ] Placar geral acumulado visível
- [ ] Top acertadores por fase
- [ ] Quantidade de palpites enviados
- [ ] Jogos abertos/em andamento/finalizados
- [ ] Todos os palpites dos usuários visíveis para participantes autenticados
- [ ] Endpoint para acompanhar palpites por usuário implementado
- [ ] Estatísticas por usuário implementadas
- [ ] Estatísticas por partida implementadas
- [ ] Matriz de palpites para comparação implementada

## 8. Documentação

- [ ] Swagger configurado
- [ ] DTOs documentados no Swagger
- [ ] Auth bearer documentado
- [ ] README criado/atualizado
- [ ] README com setup local
- [ ] README com variáveis de ambiente
- [ ] README com rotas, corpos e respostas
- [ ] README com regras de negócio

## 9. Qualidade e testes

- [ ] DTOs com class-validator
- [ ] Tratamento global de exceções
- [ ] Logs estruturados implementados
- [ ] Índices do MongoDB definidos
- [ ] Paginação e filtros implementados
- [ ] Testes unitários das regras críticas
- [ ] Testes e2e principais
- [ ] Timezone tratado corretamente

## 10. Pronto para evoluir

- [ ] Código organizado e sem controllers gordos
- [ ] Casos de uso separados da infraestrutura
- [ ] Integração externa desacoplada
- [ ] Controle de abertura e fechamento por fase implementado
- [ ] README explica como evoluir o projeto
- [ ] Base pronta para adicionar frontend depois

## 11. Conferência final

- [ ] Backend é realmente apenas NestJS + MongoDB
- [ ] Não há dependência de frontend no escopo
- [ ] Registro público não foi criado por engano
- [ ] Regras de pontuação estão corretas
- [ ] Regra de 1 hora antes do jogo está funcionando
- [ ] Liberação de fase está funcionando corretamente
- [ ] Todos os palpites estão visíveis para usuários autenticados
- [ ] Ranking e placar geral estão consistentes
- [ ] Endpoints principais estão consistentes
- [ ] Swagger sobe sem erro
- [ ] README está útil de verdade