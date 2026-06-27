# � API Mata-Mata - Endpoints Principais

## 📡 Endpoints de Classificação e Mata-Mata

### 1. Ver Classificação dos Grupos em Tempo Real

```http
GET /api/v1/matches/standings/groups
Authorization: Bearer {token}
```

**Descrição**: Retorna a classificação atual de todos os 12 grupos baseado nos resultados dos jogos finalizados.

**Critérios de Classificação (FIFA)**:
1. Pontos (Vitória: 3, Empate: 1, Derrota: 0)
2. Saldo de gols
3. Gols marcados
4. Ordem alfabética (desempate)

**Response (200 OK)**:
```json
{
  "standings": [
    {
      "group": "A",
      "teams": [
        {
          "team": "México",
          "points": 9,
          "played": 3,
          "won": 3,
          "drawn": 0,
          "lost": 0,
          "goalsFor": 8,
          "goalsAgainst": 2,
          "goalDifference": 6
        },
        {
          "team": "Canadá",
          "points": 6,
          "played": 3,
          "won": 2,
          "drawn": 0,
          "lost": 1,
          "goalsFor": 5,
          "goalsAgainst": 3,
          "goalDifference": 2
        },
        {
          "team": "País A3",
          "points": 3,
          "played": 3,
          "won": 1,
          "drawn": 0,
          "lost": 2,
          "goalsFor": 3,
          "goalsAgainst": 5,
          "goalDifference": -2
        },
        {
          "team": "País A4",
          "points": 0,
          "played": 3,
          "won": 0,
          "drawn": 0,
          "lost": 3,
          "goalsFor": 1,
          "goalsAgainst": 7,
          "goalDifference": -6
        }
      ],
      "qualified": ["México", "Canadá"]
    },
    {
      "group": "B",
      "teams": [...],
      "qualified": [...]
    }
    // ... Grupos C até L
  ],
  "message": "Group standings calculated successfully"
}
```

**Campos Importantes**:
- `qualified`: Array com os 2 times classificados (1º e 2º lugar)
- `goalDifference`: Saldo de gols (goalsFor - goalsAgainst)
- `played`: Total de jogos disputados

---

### 2. Gerar Oitavas de Final (Admin)

```http
POST /api/v1/matches/generate-knockout
Authorization: Bearer {admin_token}
```

**Descrição**: Gera/atualiza os confrontos das oitavas de final baseado nos times classificados dos grupos.

**Requer**: Token de usuário admin

**Response (200 OK) - Quando grupos completos**:
```json
{
  "generated": 0,
  "updated": 12,
  "message": "Generated/updated knockout matches: 0 new, 12 updated"
}
```

**Response (200 OK) - Quando grupos incompletos**:
```json
{
  "generated": 0,
  "updated": 0,
  "message": "Generated/updated knockout matches: 0 new, 0 updated"
}
```

**Chaveamento das Oitavas** (12 confrontos):
- R16-1: 1º Grupo A vs 2º Grupo B
- R16-2: 1º Grupo C vs 2º Grupo D
- R16-3: 1º Grupo E vs 2º Grupo F
- R16-4: 1º Grupo G vs 2º Grupo H
- R16-5: 1º Grupo I vs 2º Grupo J
- R16-6: 1º Grupo K vs 2º Grupo L
- R16-7: 1º Grupo B vs 2º Grupo A
- R16-8: 1º Grupo D vs 2º Grupo C
- R16-9: 1º Grupo F vs 2º Grupo E
- R16-10: 1º Grupo H vs 2º Grupo G
- R16-11: 1º Grupo J vs 2º Grupo I
- R16-12: 1º Grupo L vs 2º Grupo K

**Nota**: Este endpoint substitui os times placeholder (ex: "Time R16-1A") pelos times reais classificados.

---

## 🔄 Endpoints Modificados

### POST /api/v1/matches/sync (Admin)

Agora além de sincronizar resultados, também:
1. ✅ Calcula classificação dos grupos
2. ✅ Gera oitavas automaticamente (se grupos completos)
3. ✅ Calcula pontos dos palpites

---

## 🤖 Processos Automáticos

### Cron Jobs Ativos:

**A cada 30 minutos**:
- Sincroniza resultados da API externa
- Atualiza classificação dos grupos
- Gera oitavas se todos grupos completos

**A cada 5 minutos**:
- Detecta jogos finalizados
- Calcula pontos dos palpites automaticamente

**Diariamente à meia-noite**:
- Limpa cache de cálculos

---

## 🎯 Como Usar no Frontend

### Exemplo: Mostrar Classificação de um Grupo

```typescript
// Buscar todas as classificações
const response = await fetch('http://localhost:3001/api/v1/matches/standings/groups', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const data = await response.json();

// Filtrar Grupo A
const grupoA = data.standings.find(s => s.group === 'A');

// Renderizar tabela
grupoA.teams.forEach((team, index) => {
  console.log(`${index + 1}º - ${team.team}: ${team.points} pts (SG: ${team.goalDifference})`);
});

// Mostrar classificados
console.log('Classificados:', grupoA.qualified.join(', '));
```

### Exemplo: Verificar se Oitavas Podem Ser Geradas

```typescript
const response = await fetch('http://localhost:3001/api/v1/matches/standings/groups', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const data = await response.json();

// Verificar se todos grupos têm 2 classificados
const todosGruposCompletos = data.standings.every(
  grupo => grupo.qualified.length === 2
);

if (todosGruposCompletos) {
  console.log('✅ Todos os grupos completos! Pode gerar oitavas.');
} else {
  console.log('⏳ Aguardando término da fase de grupos...');
}
```

### Exemplo: Forçar Geração de Oitavas (Admin)

```typescript
// Apenas admin
const response = await fetch('http://localhost:3001/api/v1/matches/generate-knockout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
});

const result = await response.json();
console.log(result.message);
// "Generated/updated knockout matches: 0 new, 12 updated"
```

---

## 📊 Estrutura de Dados

### GroupStanding
```typescript
interface GroupStanding {
  group: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L';
  teams: TeamStanding[];
  qualified: string[]; // Top 2 times
}
```

### TeamStanding
```typescript
interface TeamStanding {
  team: string;           // Nome do time
  points: number;         // Pontos totais
  played: number;         // Jogos disputados
  won: number;            // Vitórias
  drawn: number;          // Empates
  lost: number;           // Derrotas
  goalsFor: number;       // Gols marcados
  goalsAgainst: number;   // Gols sofridos
  goalDifference: number; // Saldo de gols
}
```

---

## ⚠️ Observações Importantes

1. **Classificação em Tempo Real**: Atualiza automaticamente conforme jogos finalizam
2. **Oitavas Automáticas**: Geradas automaticamente quando todos grupos completam 3 rodadas
3. **Cache**: Sistema usa cache para evitar recálculos desnecessários
4. **Placares Manuais**: Suporta `manualHomeScore`/`manualAwayScore` para inserção manual de resultados
5. **Formato 2026**: Configurado para 12 grupos (A-L) com 4 times cada

### 🎯 Foco: Mata-Mata

Este sistema está otimizado para gerenciar **partidas de mata-mata** com:
- ✅ Cálculo automático de classificação
- ✅ Geração automática dos confrontos das oitavas
- ✅ Sistema de pontuação diferenciado para cada fase
- ✅ Atualização em tempo real via cron jobs

---

## 🔑 Autenticação

**Endpoints Públicos** (requer JWT):
- GET /api/v1/matches/standings/groups

**Endpoints Admin** (requer JWT de admin):
- POST /api/v1/matches/generate-knockout

**Como obter token**:
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "alefe.gla@bolao.com",
  "password": "419604"
}
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "name": "Alefe",
    "email": "alefe.gla@bolao.com",
    "role": "admin"
  }
}
```

---

## 🚀 Base URL

```
http://localhost:3001/api/v1
```

**Swagger Documentation**: http://localhost:3001/api/docs
