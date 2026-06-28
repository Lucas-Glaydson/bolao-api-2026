/**
 * Script one-time: atualiza os times das partidas da 2ª rodada do R32
 * que a football-data.org ainda não publicou, usando os dados do Google/FIFA.
 * Só atualiza homeTeam/awayTeam onde ambos estão confirmados.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { MatchRepository } from '../src/infrastructure/database/repositories';

const KNOWN_TEAMS: Record<string, { homeTeam: string; awayTeam: string }> = {
  // 28/06 19:00 UTC = 28/06 16:00 BRT
  '537417': { homeTeam: 'South Africa', awayTeam: 'Canada' },
  // 29/06 17:00 UTC = 29/06 14:00 BRT
  '537423': { homeTeam: 'Brazil', awayTeam: 'Japan' },
  // 29/06 20:30 UTC = 29/06 17:30 BRT
  '537415': { homeTeam: 'Germany', awayTeam: 'Paraguay' },
  // 30/06 01:00 UTC = 29/06 22:00 BRT
  '537418': { homeTeam: 'Netherlands', awayTeam: 'Morocco' },
  // 30/06 17:00 UTC = 30/06 14:00 BRT
  '537424': { homeTeam: 'Ivory Coast', awayTeam: 'Norway' },
  // 30/06 21:00 UTC = 30/06 18:00 BRT
  '537416': { homeTeam: 'France', awayTeam: 'Sweden' },
  // 01/07 01:00 UTC = 30/06 22:00 BRT
  '537425': { homeTeam: 'Mexico', awayTeam: 'Ecuador' },
  // 02/07 00:00 UTC = 01/07 21:00 BRT
  '537421': { homeTeam: 'United States', awayTeam: 'Bosnia-Herzegovina' },
};

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const matchRepository = app.get(MatchRepository);

  console.log('\n=== FIXING R32 UNKNOWN TEAM NAMES ===\n');

  for (const [externalId, teams] of Object.entries(KNOWN_TEAMS)) {
    try {
      await matchRepository.upsertByExternalId(externalId, teams);
      console.log(`✅ ${externalId}: ${teams.homeTeam} vs ${teams.awayTeam}`);
    } catch (err) {
      console.error(`❌ ${externalId}: ${err.message}`);
    }
  }

  console.log('\nDone.');
  await app.close();
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
