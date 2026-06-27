# Frontend Guide — Fase de Grupos & Classificação

> Base URL: `https://<seu-dominio>/api`  
> Todas as rotas exigem `Authorization: Bearer <jwt_token>` no header.

---

## 1. Buscar todos os jogos da fase de grupos

Lista todos os jogos com `stage = "group_stage"`, útil para montar a tabela de partidas por grupo.

### Request

```
GET /matches/stage/group_stage
Authorization: Bearer <token>
```

Nenhum corpo ou query param necessário.

### Response `200 OK`

```json
[
  {
    "id": "684e2a1f3c7b4a001e2d3f10",
    "externalId": "wc26-gA-r1-MEX-RSA",
    "competition": "FIFA World Cup 2026",
    "stage": "group_stage",
    "group": "A",
    "round": 1,
    "roundLabel": "Group A - Matchday 1",
    "homeTeam": "Mexico",
    "homeTeamLogo": "https://media.api-sports.io/football/teams/16.png",
    "awayTeam": "South Africa",
    "awayTeamLogo": "https://media.api-sports.io/football/teams/851.png",
    "kickoffAt": "2026-06-11T20:00:00.000Z",
    "status": "finished",
    "officialHomeScore": 2,
    "officialAwayScore": 0,
    "useManualScore": false,
    "manualHomeScore": null,
    "manualAwayScore": null,
    "winner": "home",
    "canPredict": false
  }
]
```

#### Campos importantes

| Campo | Tipo | Descrição |
|---|---|---|
| `stage` | `string` | Sempre `"group_stage"` neste endpoint |
| `group` | `"A"–"L"` | Grupo da partida |
| `round` | `1 \| 2 \| 3` | Rodada dentro do grupo |
| `status` | `"scheduled" \| "live" \| "finished" \| "postponed" \| "cancelled"` | Estado atual |
| `officialHomeScore` / `officialAwayScore` | `number \| null` | Placar oficial (null se não iniciou) |
| `winner` | `"home" \| "away" \| "draw" \| null` | Resultado (null enquanto não finalizado) |
| `canPredict` | `boolean` | `true` enquanto faltam mais de 60 min para o kickoff |

#### Como agrupar no frontend

```ts
// Agrupar por grupo (A–L)
const byGroup = matches.reduce((acc, match) => {
  const g = match.group ?? 'unknown';
  (acc[g] ??= []).push(match);
  return acc;
}, {} as Record<string, typeof matches>);

// Ordenar por rodada dentro do grupo
byGroup['A'].sort((a, b) => a.round - b.round);
```

---

## 2. Classificação dos grupos (standings)

Retorna a tabela de classificação calculada para todos os 12 grupos (A–L), com os dois classificados por grupo já identificados.

### Request

```
GET /matches/standings/groups
Authorization: Bearer <token>
```

### Response `200 OK`

```json
{
  "standings": [
    {
      "group": "A",
      "qualified": ["Mexico", "USA"],
      "teams": [
        {
          "team": "Mexico",
          "teamLogo": "https://media.api-sports.io/football/teams/16.png",
          "points": 7,
          "played": 3,
          "won": 2,
          "drawn": 1,
          "lost": 0,
          "goalsFor": 5,
          "goalsAgainst": 2,
          "goalDifference": 3
        },
        {
          "team": "USA",
          "teamLogo": "https://media.api-sports.io/football/teams/24.png",
          "points": 6,
          "played": 3,
          "won": 2,
          "drawn": 0,
          "lost": 1,
          "goalsFor": 4,
          "goalsAgainst": 3,
          "goalDifference": 1
        },
        {
          "team": "Canada",
          "teamLogo": "...",
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
          "team": "Honduras",
          "teamLogo": "...",
          "points": 0,
          "played": 3,
          "won": 0,
          "drawn": 0,
          "lost": 3,
          "goalsFor": 1,
          "goalsAgainst": 6,
          "goalDifference": -5
        }
      ]
    }
    // ... grupos B até L com mesma estrutura
  ],
  "message": "Group standings calculated successfully"
}
```

#### Estrutura de `standings[]`

| Campo | Tipo | Descrição |
|---|---|---|
| `group` | `"A"–"L"` | Identificador do grupo |
| `qualified` | `string[]` | Os dois primeiros classificados (array vazio se grupo sem jogos finalizados) |
| `teams[]` | `TeamStanding[]` | Times ordenados por: pontos → saldo de gols → gols marcados |

#### Estrutura de `TeamStanding`

| Campo | Tipo |
|---|---|
| `team` | `string` |
| `teamLogo` | `string \| undefined` |
| `points` | `number` |
| `played` | `number` |
| `won` / `drawn` / `lost` | `number` |
| `goalsFor` / `goalsAgainst` / `goalDifference` | `number` |

#### Renderizar tabela de grupo

```tsx
function GroupTable({ standing }: { standing: GroupStanding }) {
  return (
    <table>
      <thead>
        <tr>
          <th>#</th><th>Time</th><th>P</th><th>J</th>
          <th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th>
        </tr>
      </thead>
      <tbody>
        {standing.teams.map((t, i) => (
          <tr
            key={t.team}
            // destaca classificados (top 2)
            className={i < 2 ? 'qualified' : ''}
          >
            <td>{i + 1}</td>
            <td>
              {t.teamLogo && <img src={t.teamLogo} width={20} />}
              {t.team}
            </td>
            <td>{t.points}</td>
            <td>{t.played}</td>
            <td>{t.won}</td>
            <td>{t.drawn}</td>
            <td>{t.lost}</td>
            <td>{t.goalsFor}</td>
            <td>{t.goalsAgainst}</td>
            <td>{t.goalDifference}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## 3. Buscar todos os jogos (para o frontend montar o mata-mata)

Se precisar de **todos** os jogos (grupo + mata-mata) de uma vez:

```
GET /matches
Authorization: Bearer <token>
```

Mesma estrutura de resposta do endpoint `stage/:stage`, mas retorna todos os estágios.  
Filtre no frontend por `stage` para separar fase de grupos de mata-mata:

```ts
const groupMatches   = matches.filter(m => m.stage === 'group_stage');
const knockoutMatches = matches.filter(m => m.stage !== 'group_stage');
```

---

## 4. Fluxo recomendado para a tela de grupos

```
1. GET /matches/stage/group_stage
   → renderiza calendário de partidas por grupo (agrupado por `group`, ordenado por `round`)

2. GET /matches/standings/groups
   → renderiza tabela de classificação por grupo
   → destaca `qualified[]` como classificados

3. (tempo real) Polling ou WebSocket:
   - Pooling simples: refazer as duas requisições a cada 5 min durante jogos ao vivo
   - Identificar jogos ao vivo: `status === "live"`
```

---

## 5. Valores de `stage` disponíveis

| Valor | Descrição |
|---|---|
| `group_stage` | Fase de grupos |
| `round_of_32` | Rodada de 32 (se aplicável) |
| `round_of_16` | Oitavas de final |
| `quarter_finals` | Quartas de final |
| `semi_finals` | Semifinais |
| `final` | Final |
