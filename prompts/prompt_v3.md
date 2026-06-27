# Prompt v3 — Frontend do Bolão Mata-Mata Copa 2026

## 🎯 Objetivo

Construir o frontend completo do bolão da Copa do Mundo 2026. A API está pronta e documentada abaixo com os contratos exatos de cada endpoint, os tipos corretos e o fluxo completo de todas as fases do torneio.

---

## 🔧 Configuração Base

```
Base URL: http://localhost:3001/api/v1
Documentação Swagger: http://localhost:3001/api/docs
Auth: Bearer JWT no header Authorization em todas as rotas (exceto POST /users e POST /auth/login)
```

### Armazenar token após login

```typescript
// Salvar
localStorage.setItem('token', data.access_token);
localStorage.setItem('user', JSON.stringify(data.user));

// Usar em cada requisição
headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
```

---

## 📐 Tipos TypeScript (contratos exatos da API)

```typescript
type MatchStage  = 'group_stage' | 'round_of_16' | 'quarter_finals' | 'semi_finals' | 'final';
type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
type MatchWinner = 'home' | 'away' | 'draw' | null;
type GroupLabel  = 'A'|'B'|'C'|'D'|'E'|'F'|'G'|'H'|'I'|'J'|'K'|'L';
type UserRole    = 'admin' | 'user';

// --- Autenticação ---
interface LoginResponse {
  access_token: string;
  user: { id: string; name: string; email: string; role: UserRole; };
}

// --- Partida ---
interface Match {
  id: string;
  externalId: string;
  competition: string;
  stage: MatchStage;
  group?: GroupLabel;       // Presente nos jogos da fase de grupos
  round?: number;           // 1, 2 ou 3 (rodada dentro do grupo)
  roundLabel: string;       // Ex: "Group A - 1" | "Oitavas de Final - R16-1"
  homeTeam: string;
  homeTeamLogo?: string;    // URL do escudo (CDN da API-Sports)
  awayTeam: string;
  awayTeamLogo?: string;
  kickoffAt: string;        // ISO date string
  status: MatchStatus;
  officialHomeScore: number | null;
  officialAwayScore: number | null;
  winner: MatchWinner;
  canPredict: boolean;      // false quando faltam < 1h para o kickoff
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
}

// --- Classificação de Grupos ---
interface TeamStanding {
  team: string;
  teamLogo?: string;        // URL do escudo (mesmo CDN da API-Sports)
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

interface GroupStanding {
  group: GroupLabel;
  teams: TeamStanding[];    // Ordenado: 1º → 4º lugar
  qualified: string[];      // Nomes dos top 2 times no momento
}

interface StandingsResponse {
  standings: GroupStanding[];
  message: string;
}

// --- Palpites ---
interface PredictionResponse {
  id: string;
  userId: string;
  matchId: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  lockedAt: string | null;
  canEditUntil: string;     // ISO date — deadline para editar
  pointsAwarded: number | null;
  exactScoreHit: boolean;
  outcomeHit: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PredictionWithUser {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  matchId: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  pointsAwarded: number | null;
  exactScoreHit: boolean;
  outcomeHit: boolean;
  createdAt: string;
}

// --- Ranking ---
interface RankingEntry {
  userId: string;
  userName: string;
  userEmail: string;
  totalPoints: number;
  exactScores: number;
  outcomeHits: number;
  totalPredictions: number;
  position: number;
}

interface ScoreboardResponse {
  ranking: RankingEntry[];
  totalUsers: number;
}

// --- Fases ---
interface StageControl {
  id: string;
  stage: MatchStage;
  isOpen: boolean;
  allowPredictions: boolean;
  openedAt: string | null;
  closedAt: string | null;
  displayOrder: number;     // 0=grupos, 1=oitavas, 2=quartas, 3=semis, 4=final
}
```

---

## 🗺️ Mapa Completo de Endpoints

### Autenticação
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/auth/login` | ❌ | Login — retorna JWT |

### Usuários
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/users` | ❌ | Registro de novo usuário |
| GET | `/users/me` | ✅ JWT | Perfil do usuário logado |
| GET | `/users` | ✅ Admin | Listar todos os usuários |

### Partidas
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/matches` | ✅ JWT | Todas as partidas |
| GET | `/matches/stage/:stage` | ✅ JWT | Partidas por fase |
| GET | `/matches/:id` | ✅ JWT | Partida por ID |
| GET | `/matches/upcoming/deadlines` | ✅ JWT | Próximas partidas |
| GET | `/matches/standings/groups` | ✅ JWT | Classificação dos 12 grupos |
| POST | `/matches/sync` | ✅ Admin | Sincroniza API externa |
| POST | `/matches/generate-knockout` | ✅ Admin | Gera/atualiza oitavas |

### Palpites
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| PUT | `/predictions/:matchId` | ✅ JWT | Criar ou atualizar palpite |
| GET | `/predictions/me` | ✅ JWT | Meus palpites |
| GET | `/predictions/board` | ✅ JWT | Todos os palpites (público) |
| GET | `/predictions/match/:matchId` | ✅ JWT | Palpites de uma partida |

### Ranking
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/ranking` | ✅ JWT | Array de ranking |
| GET | `/ranking/scoreboard` | ✅ JWT | Ranking + totalUsers |
| POST | `/ranking/recalculate` | ✅ Admin | Recalcular pontos |

### Fases (Admin)
| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/stages` | ✅ JWT | Status de todas as fases |
| PATCH | `/stages/:stage/open` | ✅ Admin | Abrir fase para palpites |
| PATCH | `/stages/:stage/close` | ✅ Admin | Fechar fase |

---

## 🖥️ Telas e Fluxos

---

### Tela 1 — Login / Registro

**Login** (`POST /auth/login`):
```json
// Request
{ "email": "joao@bolao.com", "password": "senha123" }

// Response
{
  "access_token": "eyJ...",
  "user": { "id": "...", "name": "João", "email": "joao@bolao.com", "role": "user" }
}
```

**Registro** (`POST /users`):
```json
// Request
{ "name": "João Silva", "email": "joao@bolao.com", "password": "senha123" }

// Response: UserResponseDto com id, name, email, role, createdAt
```

---

### Tela 2 — Fase de Grupos

Chame **em paralelo** ao carregar:
- `GET /matches/standings/groups` → classificação
- `GET /matches/stage/group_stage` → todos os jogos dos grupos

**Exemplo de partida (group_stage):**
```json
{
  "id": "abc123",
  "stage": "group_stage",
  "group": "A",
  "round": 1,
  "roundLabel": "Group A - 1",
  "homeTeam": "México",
  "homeTeamLogo": "https://media.api-sports.io/football/teams/16.png",
  "awayTeam": "Canadá",
  "awayTeamLogo": "https://media.api-sports.io/football/teams/101.png",
  "kickoffAt": "2026-06-11T18:00:00.000Z",
  "status": "finished",
  "officialHomeScore": 2,
  "officialAwayScore": 0,
  "winner": "home",
  "canPredict": false
}
```

**Exemplo de standings:**
```json
{
  "standings": [{
    "group": "A",
    "teams": [
      { "team": "México",   "teamLogo": "https://media.api-sports.io/football/teams/16.png",  "points": 9, "played": 3, "won": 3, "drawn": 0, "lost": 0, "goalsFor": 8, "goalsAgainst": 2, "goalDifference": 6 },
      { "team": "Canadá",   "teamLogo": "https://media.api-sports.io/football/teams/101.png", "points": 6, "played": 3, "won": 2, "drawn": 0, "lost": 1, "goalsFor": 5, "goalsAgainst": 3, "goalDifference": 2 },
      { "team": "Honduras", "teamLogo": "https://media.api-sports.io/football/teams/95.png",  "points": 1, "played": 3, "won": 0, "drawn": 1, "lost": 2, "goalsFor": 2, "goalsAgainst": 5, "goalDifference": -3 },
      { "team": "Jamaica",  "teamLogo": "https://media.api-sports.io/football/teams/110.png", "points": 1, "played": 3, "won": 0, "drawn": 1, "lost": 2, "goalsFor": 1, "goalsAgainst": 6, "goalDifference": -5 }
    ],
    "qualified": ["México", "Canadá"]
  }]
}
```

**Agrupar jogos por grupo e rodada:**
```typescript
// Agrupar partidas por grupo
const byGroup = matches.reduce((acc, m) => {
  const g = m.group ?? 'X';
  if (!acc[g]) acc[g] = [];
  acc[g].push(m);
  return acc;
}, {} as Record<string, Match[]>);

// Dentro de cada grupo, ordenar por rodada
byGroup['A'].sort((a, b) => (a.round ?? 0) - (b.round ?? 0));
```

**Layout:**
- Abas para os 12 grupos (A–L)
- Cada aba: **tabela de classificação** (Pos · Logo · Time · PJ · V · E · D · GP · GC · SG · Pts) + **jogos** separados por Rodada 1 / 2 / 3
- Times em `qualified[]` destacados com badge "Classificado" (verde)
- Badge de status colorido em cada jogo (ver paleta)

---

### Tela 3 — Oitavas de Final

`GET /matches/stage/round_of_16`

**Exemplo de partida (round_of_16):**
```json
{
  "id": "xyz789",
  "stage": "round_of_16",
  "group": null,
  "round": null,
  "roundLabel": "Oitavas de Final - R16-1",
  "homeTeam": "México",
  "homeTeamLogo": "https://media.api-sports.io/football/teams/16.png",
  "awayTeam": "TBD-B2",
  "awayTeamLogo": null,
  "kickoffAt": "2026-07-01T00:00:00.000Z",
  "status": "scheduled",
  "officialHomeScore": null,
  "officialAwayScore": null,
  "winner": null,
  "canPredict": true
}
```

**Chaveamento dos 12 confrontos (FIFA 2026):**
```
R16-1:  1ºA vs 2ºB    R16-7:  1ºB vs 2ºA
R16-2:  1ºC vs 2ºD    R16-8:  1ºD vs 2ºC
R16-3:  1ºE vs 2ºF    R16-9:  1ºF vs 2ºE
R16-4:  1ºG vs 2ºH    R16-10: 1ºH vs 2ºG
R16-5:  1ºI vs 2ºJ    R16-11: 1ºJ vs 2ºI
R16-6:  1ºK vs 2ºL    R16-12: 1ºL vs 2ºK
```

**Ordenar os cards pelo número do roundLabel:**
```typescript
matches.sort((a, b) => {
  const numA = parseInt(a.roundLabel.match(/R16-(\d+)/)?.[1] ?? '0');
  const numB = parseInt(b.roundLabel.match(/R16-(\d+)/)?.[1] ?? '0');
  return numA - numB;
});
```

**Times não definidos ainda:**
```typescript
const displayName = (t: string) => t.startsWith('TBD') ? 'A Definir' : t;
const displayLogo = (logo?: string | null, team?: string) =>
  (!logo || team?.startsWith('TBD')) ? '/placeholder.png' : logo;
```

---

### Tela 4 — Quartas, Semis e Final

Mesma estrutura da Tela 3, trocando o stage:
- `GET /matches/stage/quarter_finals`
- `GET /matches/stage/semi_finals`
- `GET /matches/stage/final`

Esses jogos são populados pelo admin à medida que a API externa sincroniza os resultados.

---

### Componente: MatchCard (reutilizável em todas as fases)

```
┌──────────────────────────────────────────────┐
│  Grupo A · Rodada 1                [FINALIZ.] │
│                                               │
│  🏳 México          2  ·  0         🏴 Canadá │
│                                               │
│  📅 11/06 às 15h (horário local)              │
│  Meu palpite: 2×0 ✅  |  Editar até 14h       │
└──────────────────────────────────────────────┘
```

| `status` | Exibição |
|----------|----------|
| `scheduled` | Horário formatado + botão palpite se `canPredict === true` |
| `live` | Badge vermelho pulsante "AO VIVO" + placar em tempo real |
| `finished` | Placar final + resultado do palpite (✅ acertou / ❌ errou) |
| `postponed` | Badge amarelo "ADIADO" |
| `cancelled` | Badge cinza "CANCELADO" |

---

### Tela 5 — Dar Palpite

`PUT /predictions/:matchId`

> **Atenção**: os campos no body são `predictedHomeScore` e `predictedAwayScore`

```json
// Request body (CORRETO)
{ "predictedHomeScore": 2, "predictedAwayScore": 1 }

// Response
{
  "id": "pred123",
  "userId": "user456",
  "matchId": "abc123",
  "predictedHomeScore": 2,
  "predictedAwayScore": 1,
  "lockedAt": null,
  "canEditUntil": "2026-06-11T17:00:00.000Z",
  "pointsAwarded": null,
  "exactScoreHit": false,
  "outcomeHit": false,
  "createdAt": "2026-06-10T10:00:00.000Z",
  "updatedAt": "2026-06-10T10:00:00.000Z"
}
```

**Validações:**
- Só enviar se `match.canPredict === true`
- `predictedHomeScore` e `predictedAwayScore`: inteiros ≥ 0
- Mostrar `canEditUntil` como deadline visível no card
- Após `lockedAt` não nulo → palpite bloqueado, apenas visualização

---

### Tela 6 — Meus Palpites

`GET /predictions/me`

```json
[{
  "id": "pred123",
  "userId": "user456",
  "matchId": "abc123",
  "predictedHomeScore": 2,
  "predictedAwayScore": 1,
  "lockedAt": "2026-06-11T17:00:01.000Z",
  "canEditUntil": "2026-06-11T17:00:00.000Z",
  "pointsAwarded": 3,
  "exactScoreHit": true,
  "outcomeHit": true,
  "createdAt": "...",
  "updatedAt": "..."
}]
```

Para exibir dados do jogo junto ao palpite, chame `GET /matches/:id` com o `matchId`.

**Exibir resultado:**
```typescript
const badge = (p: PredictionResponse) => {
  if (p.pointsAwarded === null) return '⏳ Aguardando resultado';
  if (p.exactScoreHit)         return `✅ Placar exato (+${p.pointsAwarded} pts)`;
  if (p.outcomeHit)            return `✅ Resultado certo (+${p.pointsAwarded} pts)`;
  return '❌ Errou (0 pts)';
};
```

---

### Tela 7 — Board (Palpites de Todos)

`GET /predictions/board`

```json
[{
  "id": "pred123",
  "userId": "user456",
  "userName": "João",
  "userEmail": "joao@bolao.com",
  "matchId": "abc123",
  "predictedHomeScore": 2,
  "predictedAwayScore": 1,
  "pointsAwarded": 3,
  "exactScoreHit": true,
  "outcomeHit": true,
  "createdAt": "..."
}]
```

Para ver os palpites de uma partida específica: `GET /predictions/match/:matchId`

---

### Tela 8 — Ranking

`GET /ranking/scoreboard`

```json
{
  "ranking": [
    { "position": 1, "userId": "...", "userName": "João", "userEmail": "joao@bolao.com", "totalPoints": 24, "exactScores": 3, "outcomeHits": 8, "totalPredictions": 12 },
    { "position": 2, "userId": "...", "userName": "Maria", "userEmail": "maria@bolao.com", "totalPoints": 18, "exactScores": 2, "outcomeHits": 6, "totalPredictions": 10 }
  ],
  "totalUsers": 10
}
```

> Use `GET /ranking` se quiser apenas o array sem `totalUsers`.

**Layout:**
- Tabela: Pos · Nome · Pts · Placares Exatos · Acertos · Palpites
- Top 3 com medalhas 🥇🥈🥉
- Linha do usuário logado destacada (comparar `userId` com `user.id` do localStorage)

---

### Tela 9 — Perfil do Usuário

`GET /users/me`

```json
{
  "id": "...",
  "name": "João Silva",
  "email": "joao@bolao.com",
  "role": "user",
  "isActive": true,
  "createdAt": "..."
}
```

---

## ⚽ Fluxo Completo: Fase de Grupos → Mata-Mata

### Diagrama do fluxo automático

```
┌──────────────────────────────────────────────────────────────────┐
│  1. Jogos acontecem → API externa retorna resultados            │
│  2. Cron (a cada 30min) → POST /matches/sync                    │
│     ├── Atualiza placares, status de todos os jogos             │
│     ├── Roda generate-knockout (atualiza oitavas provisórias)   │
│     └── Calcula pontos dos palpites finalizados                 │
│  3. GET /matches/stage/group_stage → jogos com placar e logos   │
│  4. GET /matches/standings/groups → classificação com teamLogo  │
│  5. GET /matches/stage/round_of_16 → 12 confrontos              │
│     ├── Times reais quando grupo encerrou (3 rodadas jogadas)   │
│     └── "TBD-X1" quando grupo ainda em andamento               │
└──────────────────────────────────────────────────────────────────┘
```

### Verificar se todos os grupos encerraram

```typescript
const { standings } = await api.get<StandingsResponse>('/matches/standings/groups');

const isGroupComplete = (g: GroupStanding) =>
  g.teams.length === 4 && g.teams.every(t => t.played === 3);

const allGroupsDone = standings.every(isGroupComplete);

// Contar quantos grupos já encerraram
const groupsDone = standings.filter(isGroupComplete).length; // 0 a 12
```

### Obter logo de um time a partir dos standings

```typescript
const getLogo = (teamName: string, standings: GroupStanding[]): string | undefined => {
  for (const group of standings) {
    const found = group.teams.find(t => t.team === teamName);
    if (found?.teamLogo) return found.teamLogo;
  }
  return undefined;
};
```

### Verificar se uma fase aceita palpites

```typescript
const stages = await api.get<StageControl[]>('/stages');

const canPredictStage = (stage: MatchStage) =>
  stages.find(s => s.stage === stage)?.allowPredictions ?? false;

// Uso no componente:
const groupStageOpen = canPredictStage('group_stage');
const r16Open = canPredictStage('round_of_16');
```

### Ação de gerar oitavas (admin, 1 vez)

```http
POST /api/v1/matches/generate-knockout
Authorization: Bearer {admin_token}
```

```json
// Grupos incompletos → cria provisório com TBD
{ "generated": 12, "updated": 0, "message": "Generated/updated knockout matches: 12 new, 0 updated" }

// Grupos completos → atualiza com times reais + logos
{ "generated": 0, "updated": 12, "message": "Generated/updated knockout matches: 0 new, 12 updated" }
```

### Progressão do torneio (todas as fases)

```
group_stage     → 48 jogos (12 grupos × 3 rodadas × 2 jogos/rodada aprox.)
round_of_16     → 12 jogos (R16-1 a R16-12)
quarter_finals  → 6 jogos
semi_finals     → 3 jogos (incluindo 3º lugar)
final           → 1 jogo
```

Para carregar qualquer fase:
```typescript
// Sempre o mesmo padrão
const matches = await api.get<Match[]>(`/matches/stage/${stage}`);
```

---

## ⚙️ Controle de Fases (Admin Panel)

```typescript
// Abrir fase para palpites
await api.patch(`/stages/${stage}/open`);

// Fechar fase
await api.patch(`/stages/${stage}/close`);
```

**Ordem natural das fases** (`displayOrder`):
```
0 → group_stage
1 → round_of_16
2 → quarter_finals
3 → semi_finals
4 → final
```

---

## 💰 Pontuação por Fase

| Fase | Acertar resultado | Placar exato |
|------|-------------------|--------------|
| Fase de Grupos | 1 pt | +2 pts → **3 pts** |
| Oitavas | 1 pt | +2 pts → **3 pts** |
| Quartas | 1 pt | +2 pts → **3 pts** |
| Semifinais | 2 pts | +2 pts → **4 pts** |
| Final | 2 pts | +2 pts → **4 pts** |

---

## 🎨 Paleta de Status

| Status | Cor | Hex |
|--------|-----|-----|
| `scheduled` | Cinza neutro | `#6B7280` |
| `live` | Vermelho pulsante | `#EF4444` |
| `finished` | Verde | `#16A34A` |
| `postponed` | Amarelo | `#D97706` |
| `cancelled` | Cinza apagado | `#9CA3AF` |

---

## 🔄 Estratégia de Atualização

```typescript
// Durante jogos ao vivo: polling agressivo
const LIVE_POLL_INTERVAL = 60_000; // 60 segundos

const hasLiveMatch = (matches: Match[]) =>
  matches.some(m => m.status === 'live');

// Usar syncedAt para evitar re-render desnecessário
const hasChanged = (prev: Match[], next: Match[]) =>
  prev.some((p, i) => p.syncedAt !== next[i]?.syncedAt);
```
