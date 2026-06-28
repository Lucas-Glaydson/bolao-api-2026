import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { UserRepository, ScoreRuleRepository } from '../src/infrastructure/database/repositories';
import { UserRole } from '../src/domain/entities';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const userRepository = app.get(UserRepository);
  const scoreRuleRepository = app.get(ScoreRuleRepository);

  // ── Create users ──────────────────────────────────────────────────────────
  const newUsers = [
    { name: 'Gustavo', email: 'gustavo@bolao.com' },
    { name: 'Ederson', email: 'ederson@bolao.com' },
  ];

  for (const u of newUsers) {
    const existing = await userRepository.findByEmail(u.email);
    if (existing) {
      console.log(`ℹ️  User already exists: ${u.email}`);
    } else {
      const passwordHash = await bcrypt.hash('123456', 10);
      await userRepository.create({
        name: u.name,
        email: u.email,
        passwordHash,
        role: UserRole.USER,
        isActive: true,
        mustChangePassword: true,
      });
      console.log(`✅ Created user: ${u.email} (senha: 123456)`);
    }
  }

  // ── Update score rules (exactScoreBonus = 2 for all stages) ───────────────
  // New scoring:
  //   Resultado                  → 1 pt  (basePoints)
  //   Resultado + pênaltis       → 2 pts (basePoints + 1, handled in code)
  //   Placar exato               → 3 pts (basePoints + exactScoreBonus = 1+2)
  //   Placar exato + pênalti     → 4 pts (basePoints + exactScoreBonus + 1 = 1+2+1)
  const allRules = await scoreRuleRepository.findAll();
  for (const rule of allRules) {
    if (rule.exactScoreBonus !== 2 || rule.basePoints !== 1) {
      await scoreRuleRepository.update(rule.id, { basePoints: 1, exactScoreBonus: 2 });
      console.log(`✅ Updated score rule for stage: ${rule.stage} → basePoints=1, exactScoreBonus=2`);
    } else {
      console.log(`ℹ️  Score rule already correct for stage: ${rule.stage}`);
    }
  }

  await app.close();
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
