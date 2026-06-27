import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import {
  UserRepository,
  ScoreRuleRepository,
  StageControlRepository,
} from '../src/infrastructure/database/repositories';
import { UserRole, MatchStage } from '../src/domain/entities';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const userRepository = app.get(UserRepository);
  const scoreRuleRepository = app.get(ScoreRuleRepository);
  const stageControlRepository = app.get(StageControlRepository);

  try {
    console.log('🌱 Starting database seeding...');

    // Create admin user
    const adminEmail = 'admin@bolao.com';
    const existingAdmin = await userRepository.findByEmail(adminEmail);
    
    if (!existingAdmin) {
      const adminPassword = await bcrypt.hash('admin123', 10);
      await userRepository.create({
        name: 'Administrador',
        email: adminEmail,
        passwordHash: adminPassword,
        role: UserRole.ADMIN,
        isActive: true,
        mustChangePassword: false,
      });
      console.log('✅ Admin user created (email: admin@bolao.com, password: admin123)');
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    // Create sample users
    const users = [
      { name: 'João Silva', email: 'joao@bolao.com', password: 'senha123' },
      { name: 'Maria Santos', email: 'maria@bolao.com', password: 'senha123' },
      { name: 'Pedro Oliveira', email: 'pedro@bolao.com', password: 'senha123' },
    ];

    for (const user of users) {
      const existing = await userRepository.findByEmail(user.email);
      if (!existing) {
        const passwordHash = await bcrypt.hash(user.password, 10);
        await userRepository.create({
          name: user.name,
          email: user.email,
          passwordHash,
          role: UserRole.USER,
          isActive: true,
          mustChangePassword: true,
        });
        console.log(`✅ User created: ${user.name}`);
      }
    }

    // Create score rules
    const scoreRules = [
      { stage: MatchStage.GROUP_STAGE, basePoints: 1, exactScoreBonus: 2 },
      { stage: MatchStage.ROUND_OF_32, basePoints: 1, exactScoreBonus: 2 },
      { stage: MatchStage.ROUND_OF_16, basePoints: 1, exactScoreBonus: 2 },
      { stage: MatchStage.QUARTER_FINALS, basePoints: 1, exactScoreBonus: 2 },
      { stage: MatchStage.SEMI_FINALS, basePoints: 2, exactScoreBonus: 2 },
      { stage: MatchStage.FINAL, basePoints: 2, exactScoreBonus: 2 },
    ];

    for (const rule of scoreRules) {
      const existing = await scoreRuleRepository.findByStage(rule.stage);
      if (!existing) {
        await scoreRuleRepository.create({
          stage: rule.stage,
          basePoints: rule.basePoints,
          exactScoreBonus: rule.exactScoreBonus,
          active: true,
        });
        console.log(`✅ Score rule created for ${rule.stage}`);
      }
    }

    // Create stage controls
    const stageControls = [
      { stage: MatchStage.GROUP_STAGE, displayOrder: 0 },
      { stage: MatchStage.ROUND_OF_32, displayOrder: 1 },
      { stage: MatchStage.ROUND_OF_16, displayOrder: 2 },
      { stage: MatchStage.QUARTER_FINALS, displayOrder: 3 },
      { stage: MatchStage.SEMI_FINALS, displayOrder: 4 },
      { stage: MatchStage.FINAL, displayOrder: 5 },
    ];

    for (const control of stageControls) {
      const existing = await stageControlRepository.findByStage(control.stage);
      if (!existing) {
        await stageControlRepository.create({
          stage: control.stage,
          isOpen: false,
          openedAt: null,
          closedAt: null,
          allowPredictions: false,
          displayOrder: control.displayOrder,
        });
        console.log(`✅ Stage control created for ${control.stage}`);
      }
    }

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📝 You can now login with:');
    console.log('   Admin: admin@bolao.com / admin123');
    console.log('   Users: joao@bolao.com, maria@bolao.com, pedro@bolao.com / senha123');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
