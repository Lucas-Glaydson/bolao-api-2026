import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';

/**
 * Script para limpar TODOS os palpites antigos do banco
 * Use com cuidado! Esta ação é irreversível.
 */

async function cleanOldPredictions() {
  console.log('🧹 Iniciando limpeza de palpites antigos...\n');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    const predictionModel = app.get<Model<any>>(getModelToken('PredictionDocument'));
    const matchModel = app.get<Model<any>>(getModelToken('MatchDocument'));
    
    // Contar antes
    const predictionCount = await predictionModel.countDocuments();
    const matchCount = await matchModel.countDocuments();
    
    console.log(`📊 Estado atual:`);
    console.log(`   - Palpites: ${predictionCount}`);
    console.log(`   - Partidas: ${matchCount}\n`);
    
    if (predictionCount === 0 && matchCount === 0) {
      console.log('✅ Banco já está limpo!\n');
      return;
    }
    
    console.log('⚠️  ATENÇÃO: Você está prestes a DELETAR TUDO!');
    console.log('   Esta ação é IRREVERSÍVEL.\n');
    console.log('   Aguardando 5 segundos...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Deletar palpites
    console.log('🗑️  Deletando palpites...');
    const deletedPredictions = await predictionModel.deleteMany({});
    console.log(`   ✓ ${deletedPredictions.deletedCount} palpites deletados\n`);
    
    // Deletar partidas
    console.log('🗑️  Deletando partidas...');
    const deletedMatches = await matchModel.deleteMany({});
    console.log(`   ✓ ${deletedMatches.deletedCount} partidas deletadas\n`);
    
    console.log('='.repeat(60));
    console.log('✅ LIMPEZA CONCLUÍDA!');
    console.log('='.repeat(60));
    console.log(`📊 Palpites removidos: ${deletedPredictions.deletedCount}`);
    console.log(`📊 Partidas removidas: ${deletedMatches.deletedCount}`);
    console.log('='.repeat(60));
    console.log('\n💡 Agora você pode focar nas partidas de mata-mata.');
    console.log('   Execute scripts específicos para criar apenas');
    console.log('   as partidas de mata-mata que você precisa.\n');
    
  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
    throw error;
  } finally {
    await app.close();
  }
}

cleanOldPredictions();
