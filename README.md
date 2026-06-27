<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## 🚀 Sistema de Mata-Mata

### ⚡ Funcionalidades Principais
Este é um sistema completo para gerenciar **bolões de mata-mata** com:

- ✅ **Classificação Automática**: Calcula standings dos grupos em tempo real (critérios FIFA)
- ✅ **Geração de Confrontos**: Cria automaticamente os jogos das oitavas baseado nos classificados
- ✅ **Pontuação Inteligente**: Calcula pontos dos palpites automaticamente a cada 5 minutos
- ✅ **API REST Completa**: Endpoints para gestão de partidas, palpites e rankings
- ✅ **Cron Jobs**: Sincronização automática e cálculos em tempo real

### 📡 Endpoints Chave
```bash
# Ver classificação dos grupos em tempo real
GET /api/v1/matches/standings/groups

# Gerar oitavas de final (Admin)
POST /api/v1/matches/generate-knockout

# Ver ranking atualizado
GET /api/v1/ranking

# Listar todos os jogos
GET /api/v1/matches
```

### 🔧 Quick Start
```bash
# 1. Configure o .env (MongoDB + JWT)
cp .env.example .env

# 2. Instale dependências
npm install

# 3. Popular regras e controles
npm run seed

# 4. Iniciar aplicação
npm run start:dev
```

📖 **Documentação Completa**: Ver [NOVOS-ENDPOINTS.md](./NOVOS-ENDPOINTS.md)

## 🧹 Scripts Disponíveis

```bash
npm run seed           # Popular regras de pontuação e controles de fase
npm run clean          # Limpar TODOS palpites e partidas (cuidado!)
npm run start:dev      # Iniciar em modo desenvolvimento
npm run build          # Build para produção
```

## Project setup

### Authentication

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@bolao.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "name": "Admin",
    "email": "admin@bolao.com",
    "role": "admin"
  }
}
```

### Users

#### Create User (Public - No Auth Required)
```http
POST /users
Content-Type: application/json

{
  "name": "João Silva",
  "email": "joao@bolao.com",
  "password": "senha123",
  "role": "user"
}
```

**Role options:** `"user"` or `"admin"`

#### Get All Users (Admin only)
```http
GET /users
Authorization: Bearer <token>
```

#### Get My Profile
```http
GET /users/me
Authorization: Bearer <token>
```

#### Get User by ID (Admin only)
```http
GET /users/:id
Authorization: Bearer <token>
```

### Matches

#### Sync Matches from External API (Admin only)
```http
POST /matches/sync
Authorization: Bearer <token>
```

#### Get All Matches
```http
GET /matches
Authorization: Bearer <token>
```

#### Get Upcoming Matches (with deadlines)
```http
GET /matches/upcoming/deadlines?limit=5
Authorization: Bearer <token>
```

#### Get Matches by Stage
```http
GET /matches/stage/:stage
Authorization: Bearer <token>
```

**Stage options:** `GROUP_STAGE`, `ROUND_OF_16`, `QUARTER_FINALS`, `SEMI_FINALS`, `FINAL`

#### Get Match by ID
```http
GET /matches/:id
Authorization: Bearer <token>
```

### Predictions

#### Create or Update Prediction
```http
PUT /predictions/:matchId
Authorization: Bearer <token>
Content-Type: application/json

{
  "predictedHomeScore": 2,
  "predictedAwayScore": 1
}
```

#### Get My Predictions
```http
GET /predictions/me
Authorization: Bearer <token>
```

#### Get All Predictions (Board)
```http
GET /predictions/board
Authorization: Bearer <token>
```

#### Get Predictions by Match
```http
GET /predictions/match/:matchId
Authorization: Bearer <token>
```

### Ranking

#### Recalculate Points (Admin only)
```http
POST /ranking/recalculate
Authorization: Bearer <token>
```

#### Get Ranking
```http
GET /ranking
Authorization: Bearer <token>
```

#### Get Scoreboard
```http
GET /ranking/scoreboard
Authorization: Bearer <token>
```

### Stages

#### Get All Stages
```http
GET /stages
Authorization: Bearer <token>
```

#### Open Stage (Admin only)
```http
PATCH /stages/:stage/open
Authorization: Bearer <token>
```

**Stage options:** `GROUP_STAGE`, `ROUND_OF_16`, `QUARTER_FINALS`, `SEMI_FINALS`, `FINAL`

#### Close Stage (Admin only)
```http
PATCH /stages/:stage/close
Authorization: Bearer <token>
```

### Stats

#### Get Dashboard Stats
```http
GET /stats/dashboard
Authorization: Bearer <token>
```

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
