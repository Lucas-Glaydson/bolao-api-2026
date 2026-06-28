import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { UserRepository } from '../src/infrastructure/database/repositories';
import { UserRole } from '../src/domain/entities';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const userRepository = app.get(UserRepository);

  // Remove sample users created by seed
  const toRemove = ['joao@bolao.com', 'maria@bolao.com', 'pedro@bolao.com'];
  for (const email of toRemove) {
    const user = await userRepository.findByEmail(email);
    if (user) {
      await userRepository.delete(user.id);
      console.log(`🗑️  Removed: ${email}`);
    } else {
      console.log(`ℹ️  Not found: ${email}`);
    }
  }

  // Add new user
  const newEmail = 'vitinho.eve@bolao.com';
  const existing = await userRepository.findByEmail(newEmail);
  if (existing) {
    console.log(`ℹ️  User already exists: ${newEmail}`);
  } else {
    const passwordHash = await bcrypt.hash('367232', 10);
    await userRepository.create({
      name: 'Vitinho',
      email: newEmail,
      passwordHash,
      role: UserRole.USER,
      isActive: true,
      mustChangePassword: true,
    });
    console.log(`✅ Created: ${newEmail}`);
  }

  await app.close();
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
