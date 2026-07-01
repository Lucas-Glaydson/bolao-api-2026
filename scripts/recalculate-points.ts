// recalculate-points.ts — recalcula pontos de todas as partidas finalizadas via NestJS context
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CalculatePointsUseCase } from '../src/application/use-cases/ranking/calculate-points.use-case';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const calc = app.get(CalculatePointsUseCase);

  console.log('🔄 Forçando recálculo de todos os palpites (forceRecalculate=true)...');
  const result = await calc.execute(true);
  console.log(`✅ Processados: ${result.processed} | Erros: ${result.errors}`);

  await app.close();
}
bootstrap().catch(e => { console.error(e); process.exit(1); });
