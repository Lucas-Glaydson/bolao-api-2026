# Mata-Mata Bolão API

API backend completa para sistema de bolão de futebol no formato mata-mata entre amigos, desenvolvida com **NestJS**, **MongoDB** e **Arquitetura Limpa**.

## 📋 Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Funcionalidades](#funcionalidades)
- [Regras de Negócio](#regras-de-negócio)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Executando o Projeto](#executando-o-projeto)
- [Endpoints](#endpoints)
- [Documentação API (Swagger)](#documentação-api-swagger)
- [Seeds](#seeds)
- [Testes](#testes)

## 🎯 Sobre o Projeto

Sistema backend de bolão de futebol mata-mata onde usuários autenticados podem:
- Fazer palpites de placares de partidas
- Visualizar palpites de todos os participantes
- Acompanhar ranking em tempo real
- Receber pontuação automática baseada em regras configuráveis
- Controlar abertura e fechamento de fases da competição

O sistema é ideal para grupos de amigos que querem organizar um bolão durante copas do mundo ou competições no formato mata-mata.

## 🚀 Tecnologias

- **[NestJS](https://nestjs.com/)** - Framework Node.js progressivo
- **[MongoDB](https://www.mongodb.com/)** - Banco de dados NoSQL
- **[Mongoose](https://mongoosejs.com/)** - ODM para MongoDB
- **[Passport JWT](https://www.passportjs.org/)** - Autenticação com JSON Web Tokens
- **[bcrypt](https://www.npmjs.com/package/bcrypt)** - Hash de senhas
- **[class-validator](https://github.com/typestack/class-validator)** - Validação de DTOs
- **[Swagger](https://swagger.io/)** - Documentação automática da API
- **[Axios](https://axios-http.com/)** - Cliente HTTP para integração com API externa

## 🏗️ Arquitetura

O projeto segue os princípios da **Arquitetura Limpa (Clean Architecture)**, garantindo:
- Separação clara de responsabilidades
- Baixo acoplamento
- Alta coesão
- Facilidade de manutenção e testes

### Estrutura de Pastas

```
src/
├── domain/               # Camada de domínio
│   ├── entities/         # Entidades do negócio
│   └── repositories/     # Interfaces dos repositórios
├── application/          # Camada de aplicação
│   └── use-cases/        # Casos de uso (regras de negócio)
├── infrastructure/       # Camada de infraestrutura
│   ├── database/         # Configuração do banco de dados
│   │   ├── schemas/      # Schemas Mongoose
│   │   └── repositories/ # Implementação dos repositórios
│   ├── external-api/     # Integração com APIs externas
│   └── config/           # Configurações da aplicação
├── presentation/         # Camada de apresentação
│   ├── controllers/      # Controllers REST
│   ├── dtos/             # Data Transfer Objects
│   ├── guards/           # Guards de autenticação e autorização
│   └── decorators/       # Decorators customizados
└── modules/              # Módulos NestJS
```

## ✨ Funcionalidades

### Autenticação
- ✅ Login com JWT
- ✅ Perfis de usuário (Admin e User)
- ✅ Proteção de rotas por autenticação
- ✅ Proteção de rotas por papel (role-based)

### Usuários
- ✅ Criação manual de usuários (somente admin)
- ✅ Listagem de usuários
- ✅ Consulta de perfil do usuário logado

### Partidas
- ✅ Sincronização com API externa de futebol
- ✅ Armazenamento local das partidas
- ✅ Listagem de todas as partidas
- ✅ Filtro por fase da competição
- ✅ Listagem de próximas partidas
- ✅ Cálculo automático de deadline (1h antes do jogo)

### Palpites
- ✅ Criar/atualizar palpite (upsert por usuário/partida)
- ✅ Bloqueio automático 1 hora antes da partida
- ✅ Consultar meus palpites
- ✅ Consultar palpites por partida
- ✅ Visualização pública de todos os palpites (board)
- ✅ Controle de fases abertas para palpites

### Pontuação e Ranking
- ✅ Cálculo automático de pontos
- ✅ Regras de pontuação por fase
- ✅ Bônus de placar exato (+2 pontos)
- ✅ Ranking geral ordenado
- ✅ Critérios de desempate (placares exatos, acertos)
- ✅ Reprocessamento manual de pontuação

### Controle de Fases
- ✅ Abertura de fase para palpites
- ✅ Fechamento de fase
- ✅ Listagem de status das fases

### Estatísticas e Dashboard
- ✅ Dashboard geral do bolão
- ✅ Estatísticas de partidas
- ✅ Total de palpites
- ✅ Usuário com mais pontos

## 📜 Regras de Negócio

### Palpites
1. Usuário só pode palpitar até **1 hora antes** do início da partida
2. Cada usuário tem apenas **um palpite por partida** (upsert)
3. Usuário só pode editar o próprio palpite
4. Palpites só são permitidos em fases **oficialmente liberadas**
5. Todos os usuários autenticados podem visualizar todos os palpites

### Pontuação
1. Pontuação base varia por fase (16avos, oitavas, quartas: 1 ponto / semis e final: 2 pontos)
2. Bônus de **+2 pontos** para placar exato
3. Somente acertar o vencedor/empate dá a pontuação base
4. Pontuação só é calculada após resultado oficial disponível
5. Reprocessamento não duplica pontuação

### Fases
1. Somente admin pode abrir/fechar fases
2. Fases futuras bloqueadas não aceitam palpites
3. Deadline da partida sobrepõe a abertura da fase

## 📦 Instalação

### Pré-requisitos
- Node.js 18+
- MongoDB 6+
- npm ou yarn

### Passos

1. Clone o repositório
```bash
git clone <repository-url>
cd mata-mata-api
```

2. Instale as dependências
```bash
npm install
```

3. Copie o arquivo de exemplo de variáveis de ambiente
```bash
cp .env.example .env
```

4. Configure as variáveis de ambiente (veja seção abaixo)

## ⚙️ Configuração

### Variáveis de Ambiente

Edite o arquivo `.env` com suas configurações:

```env
# Application
PORT=3000
NODE_ENV=development
APP_TIMEZONE=UTC

# Database
MONGODB_URI=mongodb://localhost:27017/mata-mata-bolao

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d

# External Football API
EXTERNAL_FOOTBALL_API_BASE_URL=https://api.football-data.org/v4
EXTERNAL_FOOTBALL_API_KEY=your_api_key_here

# Sync Configuration
SYNC_CRON=0 */30 * * * *
```

### API Externa de Futebol

Para obter dados de partidas, você precisará de uma chave API de um provedor de dados de futebol. Exemplos:
- [Football-Data.org](https://www.football-data.org/)
- [API-Football](https://www.api-football.com/)

## 🏃 Executando o Projeto

### Desenvolvimento

```bash
# Iniciar MongoDB localmente (se não estiver usando MongoDB Atlas)
mongod

# Rodar seeds para popular o banco
npm run seed

# Iniciar a aplicação em modo de desenvolvimento
npm run start:dev
```

A aplicação estará disponível em:
- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/api/docs`

### Produção

```bash
# Build
npm run build

# Executar
npm run start:prod
```

## 🔗 Endpoints

### Autenticação

#### `POST /api/v1/auth/login` - Login do usuário
**Request:**
```json
{
  "email": "admin@bolao.com",
  "password": "admin123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Admin",
    "email": "admin@bolao.com",
    "role": "admin"
  }
}
```

---

### Usuários

#### `POST /api/v1/users` - Criar usuário 🔓 (Público - Sem autenticação)
**Request:**
```json
{
  "name": "João Silva",
  "email": "joao@bolao.com",
  "password": "senha123",
  "role": "user"
}
```

**Response (201):**
```json
{
  "id": "507f1f77bcf86cd799439012",
  "name": "João Silva",
  "email": "joao@bolao.com",
  "role": "user",
  "isActive": true,
  "createdAt": "2026-06-22T10:30:00.000Z",
  "updatedAt": "2026-06-22T10:30:00.000Z"
}
```

#### `GET /api/v1/users` - Listar usuários 🔒 (Admin)
**Response (200):**
```json
[
  {
    "id": "507f1f77bcf86cd799439011",
    "name": "Admin",
    "email": "admin@bolao.com",
    "role": "admin",
    "isActive": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "507f1f77bcf86cd799439012",
    "name": "João Silva",
    "email": "joao@bolao.com",
    "role": "user",
    "isActive": true,
    "createdAt": "2026-06-22T10:30:00.000Z",
    "updatedAt": "2026-06-22T10:30:00.000Z"
  }
]
```

#### `GET /api/v1/users/me` - Perfil do usuário logado 🔒
**Response (200):**
```json
{
  "id": "507f1f77bcf86cd799439012",
  "name": "João Silva",
  "email": "joao@bolao.com",
  "role": "user",
  "isActive": true,
  "createdAt": "2026-06-22T10:30:00.000Z",
  "updatedAt": "2026-06-22T10:30:00.000Z"
}
```

#### `GET /api/v1/users/:id` - Buscar usuário por ID 🔒 (Admin)
**Response (200):**
```json
{
  "id": "507f1f77bcf86cd799439012",
  "name": "João Silva",
  "email": "joao@bolao.com",
  "role": "user",
  "isActive": true,
  "createdAt": "2026-06-22T10:30:00.000Z",
  "updatedAt": "2026-06-22T10:30:00.000Z"
}
```

---

### Partidas

#### `POST /api/v1/matches/sync` - Sincronizar partidas da API externa 🔒 (Admin)
**Response (200):**
```json
{
  "synced": 64,
  "errors": 0,
  "message": "Successfully synced 64 matches with 0 errors"
}
```

#### `GET /api/v1/matches` - Listar todas as partidas 🔒
**Response (200):**
```json
[
  {
    "id": "507f1f77bcf86cd799439013",
    "externalId": "12345",
    "competition": "FIFA World Cup",
    "stage": "GROUP_STAGE",
    "roundLabel": "Group A - Matchday 1",
    "homeTeam": "Brasil",
    "awayTeam": "Argentina",
    "kickoffAt": "2026-06-25T16:00:00.000Z",
    "status": "SCHEDULED",
    "officialHomeScore": null,
    "officialAwayScore": null,
    "winner": null,
    "canPredict": true,
    "syncedAt": "2026-06-22T10:00:00.000Z",
    "createdAt": "2026-06-22T10:00:00.000Z",
    "updatedAt": "2026-06-22T10:00:00.000Z"
  }
]
```

#### `GET /api/v1/matches/:id` - Buscar partida por ID 🔒
**Response (200):**
```json
{
  "id": "507f1f77bcf86cd799439013",
  "externalId": "12345",
  "competition": "FIFA World Cup",
  "stage": "ROUND_OF_16",
  "roundLabel": "Round of 16",
  "homeTeam": "Brasil",
  "awayTeam": "Argentina",
  "kickoffAt": "2026-06-25T16:00:00.000Z",
  "status": "FINISHED",
  "officialHomeScore": 2,
  "officialAwayScore": 1,
  "winner": "HOME",
  "canPredict": false,
  "syncedAt": "2026-06-22T10:00:00.000Z",
  "createdAt": "2026-06-22T10:00:00.000Z",
  "updatedAt": "2026-06-25T18:00:00.000Z"
}
```

#### `GET /api/v1/matches/stage/:stage` - Listar partidas por fase 🔒
**Stages disponíveis:** `GROUP_STAGE`, `ROUND_OF_16`, `QUARTER_FINALS`, `SEMI_FINALS`, `FINAL`

**Response (200):** Array de partidas (mesmo formato acima)

#### `GET /api/v1/matches/upcoming/deadlines?limit=5` - Próximas partidas com deadline 🔒
**Response (200):** Array de partidas (mesmo formato acima)

---

### Palpites

#### `PUT /api/v1/predictions/:matchId` - Criar/atualizar palpite 🔒
**Request:**
```json
{
  "predictedHomeScore": 2,
  "predictedAwayScore": 1
}
```

**Response (200):**
```json
{
  "id": "507f1f77bcf86cd799439014",
  "userId": "507f1f77bcf86cd799439012",
  "matchId": "507f1f77bcf86cd799439013",
  "predictedHomeScore": 2,
  "predictedAwayScore": 1,
  "lockedAt": null,
  "canEditUntil": "2026-06-25T15:00:00.000Z",
  "pointsAwarded": null,
  "exactScoreHit": false,
  "outcomeHit": false,
  "createdAt": "2026-06-22T11:00:00.000Z",
  "updatedAt": "2026-06-22T11:00:00.000Z"
}
```

#### `GET /api/v1/predictions/me` - Meus palpites 🔒
**Response (200):**
```json
[
  {
    "id": "507f1f77bcf86cd799439014",
    "userId": "507f1f77bcf86cd799439012",
    "matchId": "507f1f77bcf86cd799439013",
    "predictedHomeScore": 2,
    "predictedAwayScore": 1,
    "lockedAt": "2026-06-25T15:00:00.000Z",
    "canEditUntil": "2026-06-25T15:00:00.000Z",
    "pointsAwarded": 3,
    "exactScoreHit": true,
    "outcomeHit": true,
    "createdAt": "2026-06-22T11:00:00.000Z",
    "updatedAt": "2026-06-25T18:00:00.000Z"
  }
]
```

#### `GET /api/v1/predictions/board` - Todos os palpites (visualização pública) 🔒
**Response (200):**
```json
[
  {
    "id": "507f1f77bcf86cd799439014",
    "userId": "507f1f77bcf86cd799439012",
    "userName": "João Silva",
    "userEmail": "joao@bolao.com",
    "matchId": "507f1f77bcf86cd799439013",
    "predictedHomeScore": 2,
    "predictedAwayScore": 1,
    "pointsAwarded": 3,
    "exactScoreHit": true,
    "outcomeHit": true,
    "createdAt": "2026-06-22T11:00:00.000Z"
  }
]
```

#### `GET /api/v1/predictions/match/:matchId` - Palpites de uma partida 🔒
**Response (200):** Array de palpites com dados do usuário (mesmo formato do board)

---

### Ranking

#### `POST /api/v1/ranking/recalculate` - Recalcular pontuação 🔒 (Admin)
**Response (200):**
```json
{
  "processed": 128,
  "errors": 0,
  "message": "Recalculated points for 128 predictions with 0 errors"
}
```

#### `GET /api/v1/ranking` - Ranking geral 🔒
**Response (200):**
```json
[
  {
    "position": 1,
    "userId": "507f1f77bcf86cd799439012",
    "userName": "João Silva",
    "totalPoints": 45,
    "exactScoreHits": 8,
    "outcomeHits": 30
  },
  {
    "position": 2,
    "userId": "507f1f77bcf86cd799439015",
    "userName": "Maria Santos",
    "totalPoints": 42,
    "exactScoreHits": 6,
    "outcomeHits": 28
  }
]
```

#### `GET /api/v1/ranking/scoreboard` - Placar geral com total de usuários 🔒
**Response (200):**
```json
{
  "ranking": [
    {
      "position": 1,
      "userId": "507f1f77bcf86cd799439012",
      "userName": "João Silva",
      "totalPoints": 45,
      "exactScoreHits": 8,
      "outcomeHits": 30
    }
  ],
  "totalUsers": 15
}
```

---

### Fases

#### `GET /api/v1/stages` - Listar todas as fases 🔒
**Response (200):**
```json
[
  {
    "id": "507f1f77bcf86cd799439020",
    "stage": "GROUP_STAGE",
    "isOpen": true,
    "openedAt": "2026-06-15T00:00:00.000Z",
    "closedAt": null,
    "allowPredictions": true,
    "displayOrder": 1
  },
  {
    "id": "507f1f77bcf86cd799439021",
    "stage": "ROUND_OF_16",
    "isOpen": false,
    "openedAt": null,
    "closedAt": null,
    "allowPredictions": false,
    "displayOrder": 2
  }
]
```

#### `PATCH /api/v1/stages/:stage/open` - Abrir fase 🔒 (Admin)
**Stages disponíveis:** `GROUP_STAGE`, `ROUND_OF_16`, `QUARTER_FINALS`, `SEMI_FINALS`, `FINAL`

**Response (200):**
```json
{
  "id": "507f1f77bcf86cd799439021",
  "stage": "ROUND_OF_16",
  "isOpen": true,
  "openedAt": "2026-06-22T12:00:00.000Z",
  "closedAt": null,
  "allowPredictions": true,
  "displayOrder": 2
}
```

#### `PATCH /api/v1/stages/:stage/close` - Fechar fase 🔒 (Admin)
**Response (200):**
```json
{
  "id": "507f1f77bcf86cd799439020",
  "stage": "GROUP_STAGE",
  "isOpen": false,
  "openedAt": "2026-06-15T00:00:00.000Z",
  "closedAt": "2026-06-22T12:00:00.000Z",
  "allowPredictions": false,
  "displayOrder": 1
}
```

---

### Estatísticas

#### `GET /api/v1/stats/dashboard` - Dashboard geral 🔒
**Response (200):**
```json
{
  "totalUsers": 15,
  "totalMatches": 64,
  "totalPredictions": 850,
  "matchesFinished": 48,
  "matchesScheduled": 16,
  "topScorer": {
    "userId": "507f1f77bcf86cd799439012",
    "userName": "João Silva",
    "totalPoints": 45
  },
  "currentStage": "QUARTER_FINALS",
  "openStages": ["GROUP_STAGE", "ROUND_OF_16", "QUARTER_FINALS"]
}
```

---

**Legenda:**
- 🔒 = Requer autenticação (Bearer Token)
- 🔓 = Rota pública (sem autenticação)
- **(Admin)** = Requer papel de administrador

## 📚 Documentação API (Swagger)

A documentação completa da API está disponível via Swagger UI:

```
http://localhost:3000/api/docs
```

O Swagger inclui:
- Descrição detalhada de cada endpoint
- Schemas de request e response
- Exemplos de uso
- Autenticação via Bearer Token
- Teste interativo dos endpoints

## 🌱 Seeds

Para popular o banco de dados com dados iniciais, execute:

```bash
npm run seed
```

Isso criará:
- **1 usuário admin**: `admin@bolao.com` / `admin123`
- **3 usuários normais**: 
  - `joao@bolao.com` / `senha123`
  - `maria@bolao.com` / `senha123`
  - `pedro@bolao.com` / `senha123`
- **Regras de pontuação** para todas as fases
- **Controles de fase** (inicialmente fechados)

## 🧪 Testes

```bash
# Testes unitários
npm run test

# Testes e2e
npm run test:e2e

# Cobertura de testes
npm run test:cov
```

## 📝 Decisões Arquiteturais

### Por que Arquitetura Limpa?
- **Desacoplamento**: Regras de negócio independentes do framework
- **Testabilidade**: Casos de uso isolados facilitam testes
- **Manutenibilidade**: Mudanças em uma camada não afetam outras
- **Flexibilidade**: Fácil trocar MongoDB por outro banco, ou NestJS por Express

### Por que MongoDB?
- **Flexibilidade de schema**: Ideal para iterações rápidas
- **Performance**: Ótimo para leitura de rankings e estatísticas
- **Simplicidade**: Mongoose oferece excelente integração com NestJS

### Por que JWT?
- **Stateless**: Não precisa armazenar sessões no servidor
- **Escalabilidade**: Facilita distribuição em múltiplos servidores
- **Simplicidade**: Ideal para API entre amigos

## 🚧 Próximas Melhorias

- [ ] Testes unitários completos
- [ ] Testes e2e para fluxos críticos
- [ ] Sistema de notificações (email/push)
- [ ] Histórico de alterações de palpites
- [ ] Rankings por fase
- [ ] Estatísticas avançadas por usuário
- [ ] Exportação de dados (CSV/Excel)
- [ ] WebSockets para atualizações em tempo real
- [ ] Rate limiting
- [ ] Logs estruturados com Winston

## 📄 Licença

Este projeto é privado e não possui licença pública.

## 👥 Autor

Sistema desenvolvido para uso entre amigos.

---

🎉 **Divirta-se no seu bolão!**
