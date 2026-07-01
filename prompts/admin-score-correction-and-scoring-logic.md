# Admin: Correção de Pontuação e Lógica de Cálculo

## O que foi corrigido (30/06/2026)

### Bugs corrigidos na API

#### 1. Pontos calculados com placar desatualizado não eram recalculados

**Problema:** O sistema calculava pontos assim que uma partida era marcada como `FINISHED`. Se a API externa ainda não tivesse o placar correto naquele momento, os pontos eram calculados errados (normalmente 0). Depois que o placar era corrigido, o sistema **ignorava** a recalculação porque via que `pointsAwarded` já tinha um valor.

**Correção:**
- O cache de pontos agora inclui o placar (`home:away`) na chave. Se o placar muda, a partida é reprocessada automaticamente.
- O `CalculatePointsUseCase` agora aceita um parâmetro `forceRecalculate` que ignora pontos já calculados.
- O endpoint `POST /ranking/recalculate` agora **sempre** recalcula tudo (ignora valores antigos).

#### 2. PATCH /matches/:id não atualizava o campo `winner`

**Problema:** Ao atualizar o placar via endpoint admin, o campo `winner` não era recalculado a partir dos novos gols, e os pontos não eram recalculados.

**Correção:** Agora o `winner` é derivado automaticamente do placar informado, e após qualquer atualização de placar, os pontos são recalculados para aquela partida.

#### 3. Comparação de placar empate no ESPN usava string comparison

**Problema:** A detecção de vencedor nos pênaltis via ESPN comparava `home.score === away.score` como strings, o que poderia falhar em casos edge.

**Correção:** Agora usa `parseInt` para comparar como números.

---

## Novos endpoints admin

### `PATCH /matches/:id`
Agora suporta mais campos:

| Campo | Tipo | Descrição |
|---|---|---|
| `officialHomeScore` | `number` | Gols do mandante |
| `officialAwayScore` | `number` | Gols do visitante |
| `winner` | `'home' \| 'away' \| 'draw'` | Vencedor (calculado automaticamente se não informado) |
| `penaltyWinner` | `'home' \| 'away'` | Vencedor nos pênaltis |
| `homeTeam` | `string` | Corrige nome do time mandante |
| `awayTeam` | `string` | Corrige nome do time visitante |
| `status` | `MatchStatus` | Status da partida |
| `kickoffAt` | `string (ISO8601)` | Data/hora de início |

**Comportamento:** Quando `officialHomeScore`, `officialAwayScore`, `winner`, `penaltyWinner` ou `status=finished` são informados, os pontos de todos os palpites dessa partida são **recalculados automaticamente**.

### `POST /matches/:id/recalculate-points` *(novo)*
Força o recálculo dos pontos de uma partida específica, ignorando qualquer valor já calculado.

**Resposta:**
```json
{
  "processed": 8,
  "errors": 0,
  "message": "Recalculated points for 8 predictions on match Brasil vs Argentina"
}
```

### `POST /ranking/recalculate`
Agora **sempre força** o recálculo de todos os palpites de todas as partidas finalizadas.

**Resposta:**
```json
{
  "processed": 120,
  "errors": 0,
  "message": "Recalculated points for 120 predictions with 0 errors"
}
```

### `GET /ranking/score-rules` *(novo)*
Lista todas as regras de pontuação por fase.

**Resposta:**
```json
[
  { "id": "...", "stage": "group_stage", "basePoints": 1, "exactScoreBonus": 1, "active": true },
  { "id": "...", "stage": "round_of_32", "basePoints": 1, "exactScoreBonus": 1, "active": true },
  { "id": "...", "stage": "semi_finals", "basePoints": 2, "exactScoreBonus": 1, "active": true },
  ...
]
```

### `PATCH /ranking/score-rules/:id` *(novo)*
Atualiza a regra de pontuação de uma fase. Após alterar as regras, execute `POST /ranking/recalculate` para aplicar.

**Body:**
```json
{
  "basePoints": 2,
  "exactScoreBonus": 2,
  "active": true
}
```

---

## Como funciona o cálculo de pontos

### Regras por fase (padrão)

| Fase | Pontos base | Bônus placar exato |
|---|---|---|
| Fase de grupos | 1 | 1 |
| Rodada de 32 | 1 | 1 |
| Oitavas | 1 | 1 |
| Quartas | 1 | 1 |
| Semifinal | 2 | 1 |
| Final | 2 | 1 |

### Lógica de cálculo

```
Palpite acerta placar exato?
  ├─ SIM → basePoints + exactScoreBonus
  │     └─ (+ 1 bonus se jogo foi para pênaltis E acertou o tiebreakWinner)
  └─ NÃO → acertou o resultado (quem ganhou ou empate)?
          ├─ SIM → basePoints
          │     └─ (+ 1 bonus se jogo foi para pênaltis, palpitou empate e acertou tiebreakWinner)
          └─ NÃO → 0 pontos
```

**Palpites auto-preenchidos** (`isAutoFilled = true`) sempre recebem **0 pontos**.

### Campos relevantes do palpite

| Campo | Tipo | Descrição |
|---|---|---|
| `predictedHomeScore` | `number` | Gols mandante chutados |
| `predictedAwayScore` | `number` | Gols visitante chutados |
| `tiebreakWinner` | `'home' \| 'away' \| null` | Quem o usuário escolheu vencer nos pênaltis |
| `pointsAwarded` | `number \| null` | Pontos recebidos (null = não calculado ainda) |
| `exactScoreHit` | `boolean` | Se acertou o placar exato |
| `outcomeHit` | `boolean` | Se acertou o resultado (ganhador ou empate) |

### Campos relevantes da partida

| Campo | Tipo | Descrição |
|---|---|---|
| `officialHomeScore` | `number \| null` | Gols mandante no tempo regulamentar |
| `officialAwayScore` | `number \| null` | Gols visitante no tempo regulamentar |
| `winner` | `'home' \| 'away' \| 'draw' \| null` | Resultado do tempo regulamentar. Para jogos decididos nos pênaltis: sempre `'draw'` |
| `penaltyWinner` | `'home' \| 'away' \| null` | Vencedor nos pênaltis. `null` se não houve prorrogação/pênaltis |

---

## Como corrigir pontuação manualmente (passo a passo)

### Cenário 1: O jogo acabou mas os pontos estão errados

1. Verifique o placar no banco via `GET /matches/:id`
2. Se o placar estiver correto, rode `POST /matches/:id/recalculate-points`
3. Se o placar estiver errado, corrija via `PATCH /matches/:id` com os gols corretos — os pontos serão recalculados automaticamente

### Cenário 2: Todos os pontos estão errados (reset geral)

```http
POST /ranking/recalculate
Authorization: Bearer <admin-token>
```

Isso recalcula **todos** os palpites de **todas** as partidas finalizadas.

### Cenário 3: Jogo foi para pênaltis mas `penaltyWinner` não foi detectado

```http
PATCH /matches/:id
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "penaltyWinner": "away"
}
```

Os pontos são recalculados automaticamente após o PATCH.

---

## Sincronização de dados da API externa

O sistema sincroniza automaticamente a cada **5 minutos** via cron. Fontes de dados:

1. **worldcup26.ir** — placares, status das partidas, informações de estádios
2. **ESPN API** — placares em tempo real, status de completado, detecção de vencedor nos pênaltis

Se nenhuma das APIs tiver o dado correto, use os endpoints admin acima para inserir manualmente.
