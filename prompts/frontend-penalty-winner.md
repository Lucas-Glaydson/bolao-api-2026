# Frontend — Breaking Change: campo `penaltyWinner` nas partidas

## O que mudou na API

O campo `winner` de uma partida de mata-mata que foi decidida nos pênaltis **agora retorna `"draw"`** (resultado do tempo regulamentar), em vez de retornar o time vencedor.

Um **novo campo `penaltyWinner`** foi adicionado à resposta de todas as rotas de partidas para indicar explicitamente quem venceu nos pênaltis.

### Exemplo — Holanda 1x1 Marrocos (Marrocos vence nos pênaltis)

**Antes (comportamento antigo):**
```json
{
  "winner": "away",
  "penaltyWinner": null
}
```

**Agora (comportamento novo):**
```json
{
  "winner": "draw",
  "penaltyWinner": "away"
}
```

---

## Rotas afetadas

Todas as rotas que retornam objetos de partida:

- `GET /matches`
- `GET /matches/:id`
- `GET /matches/stage/:stage`
- `GET /matches/upcoming/deadlines`

---

## Tipo atualizado

Adicione `penaltyWinner` ao tipo/interface `Match` (ou equivalente) no frontend:

```ts
export interface Match {
  // ... campos existentes ...
  winner: 'home' | 'away' | 'draw' | null;
  penaltyWinner: 'home' | 'away' | null; // NOVO — quem venceu nos pênaltis (null se não houve)
  canPredict: boolean;
}
```

---

## O que precisa ser ajustado no código

### 1. Lógica de "quem avançou" no mata-mata

Qualquer lugar que usa `match.winner` para saber qual time avançou no bracket deve ser atualizado:

```ts
// ANTES (errado para pênaltis)
const teamThatAdvanced = match.winner; // retornava 'away', mas agora retorna 'draw'

// AGORA (correto)
function getAdvancingTeam(match: Match): 'home' | 'away' | null {
  if (match.winner === 'home' || match.winner === 'away') return match.winner;
  if (match.winner === 'draw') return match.penaltyWinner; // decidido nos pênaltis
  return null; // partida não finalizada
}
```

### 2. Exibição do resultado no placar

Mostre o vencedor nos pênaltis quando aplicável:

```ts
// Exemplo de label do resultado
function getMatchResultLabel(match: Match): string {
  if (match.status !== 'finished') return '';
  if (match.penaltyWinner) {
    const winner = match.penaltyWinner === 'home' ? match.homeTeam : match.awayTeam;
    return `${match.officialHomeScore} x ${match.officialAwayScore} — ${winner} vence nos pên.`;
  }
  if (match.winner === 'home') return `${match.officialHomeScore} x ${match.officialAwayScore} — ${match.homeTeam} vence`;
  if (match.winner === 'away') return `${match.officialHomeScore} x ${match.officialAwayScore} — ${match.awayTeam} vence`;
  return `${match.officialHomeScore} x ${match.officialAwayScore} — Empate`;
}
```

### 3. Palpites — exibição do `tiebreakWinner`

O campo `tiebreakWinner` do palpite do usuário (`'home' | 'away' | null`) deve ser comparado com `match.penaltyWinner` (não mais com `match.winner`) para determinar se o usuário acertou:

```ts
// Verificação visual de acerto no palpite
const gotTiebreakRight =
  match.penaltyWinner !== null &&
  prediction.tiebreakWinner === match.penaltyWinner;
```

---

## Resumo dos campos relevantes para partidas de mata-mata

| Campo | Tipo | Significado |
|---|---|---|
| `winner` | `'home' \| 'away' \| 'draw' \| null` | Resultado do tempo regulamentar. Para jogos decididos nos pênaltis, sempre `'draw'`. |
| `penaltyWinner` | `'home' \| 'away' \| null` | Quem venceu nos pênaltis. `null` se o jogo não foi para os pênaltis. |
