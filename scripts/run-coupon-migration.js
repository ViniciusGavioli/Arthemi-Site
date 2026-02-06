// ===========================================================
// Script: Executar migração de cupons
// ===========================================================
// Executa apenas a migration 20260128112725_add_coupons_table
// ATENÇÃO: Este script altera dados em PRODUÇÃO
// ===========================================================

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('🔐 Script de Execução de Migração de Cupons');
  console.log('==========================================\n');

  try {
    // 1. Verificar connection string
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.error('❌ DATABASE_URL não encontrada no .env');
      process.exit(1);
    }

    // Mostrar ambiente (sem expor credenciais)
    const isProduction = dbUrl.includes('amazonaws.com') || dbUrl.includes('railway.app') || dbUrl.includes('vercel.com');
    console.log('📊 Ambiente:', isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO');
    console.log('   Database:', dbUrl.split('@')[1]?.split('/')[0] || 'N/A');

    // 2. Ler arquivo de migração
    const migrationPath = path.join(__dirname, '../prisma/migrations/20260128112725_add_coupons_table/migration.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Arquivo de migração não encontrado: ${migrationPath}`);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    console.log(`\n📄 Arquivo de migração encontrado: ${migrationPath}`);
    console.log(`   Tamanho: ${migrationSQL.length} caracteres`);

    // 3. Verificar se tabela já existe
    console.log('\n🔍 Verificando estado atual do banco...');
    
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'coupons'
      );
    `;

    if (tableExists[0]?.exists) {
      console.log('⚠️  Tabela "coupons" já existe no banco.');
      
      const rowCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "coupons";
      `;
      console.log(`   Registros existentes: ${rowCount[0]?.count || 0}`);
      
      const autoConfirm = process.env.AUTO_CONFIRM === 'true';
      let confirmation;
      
      if (autoConfirm) {
        console.log('   ✅ Confirmação automática - continuando...');
        confirmation = 'SIM';
      } else {
        confirmation = await question('\n❓ Deseja continuar mesmo assim? (SIM para continuar): ');
      }
      
      if (confirmation.trim().toUpperCase() !== 'SIM') {
        console.log('\n❌ Operação cancelada pelo usuário.');
        process.exit(0);
      }
    } else {
      console.log('✅ Tabela "coupons" não existe. Prosseguindo com criação...');
    }

    // 4. Confirmar execução
    console.log('\n⚠️  ATENÇÃO: Esta operação irá:');
    console.log('   1. Criar tabela "coupons"');
    console.log('   2. Adicionar coluna "couponId" em "coupon_usages"');
    console.log('   3. Criar foreign key e índices');
    console.log('   4. Inserir 5 cupons iniciais');
    console.log('   Ambiente:', isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO');

    // Permitir confirmação via variável de ambiente (para execução não-interativa)
    const autoConfirm = process.env.AUTO_CONFIRM === 'true';
    
    let confirmation;
    if (autoConfirm) {
      console.log('\n✅ Confirmação automática via AUTO_CONFIRM=true');
      confirmation = 'EXECUTAR';
    } else {
      confirmation = await question('\n❓ Digite "EXECUTAR" para prosseguir: ');
    }

    if (confirmation.trim() !== 'EXECUTAR') {
      console.log('\n❌ Operação cancelada pelo usuário.');
      process.exit(0);
    }

    // 5. Executar migração usando cliente PostgreSQL direto
    // (Prisma não suporta múltiplos comandos em uma única chamada)
    console.log('\n🔄 Executando migração...');
    console.log('   Isso pode levar alguns segundos...\n');

    // Usar cliente PostgreSQL direto para executar SQL completo
    const client = new Client({
      connectionString: dbUrl,
    });

    await client.connect();
    console.log('   ✅ Conectado ao banco de dados');

    try {
      // Executar SQL completo
      await client.query(migrationSQL);
      console.log('   ✅ Migração SQL executada com sucesso!');
    } catch (error) {
      // Alguns erros são esperados (IF NOT EXISTS, ON CONFLICT)
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate') ||
          error.message.includes('ON CONFLICT') ||
          (error.message.includes('does not exist') && migrationSQL.includes('IF NOT EXISTS'))) {
        console.log(`   ⚠️  Aviso (esperado): ${error.message.substring(0, 100)}...`);
        console.log('   Continuando verificação...');
      } else {
        console.error(`   ❌ Erro ao executar migração: ${error.message}`);
        throw error;
      }
    } finally {
      await client.end();
    }

    // 6. Verificar resultado
    console.log('\n📊 Resultado da execução:');
    console.log('   ✅ Migração executada');

    // Verificar se tabela foi criada
    const tableExistsAfter = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'coupons'
      );
    `;

    if (tableExistsAfter[0]?.exists) {
      const rowCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "coupons";
      `;
      console.log(`\n✅ Tabela "coupons" criada com sucesso!`);
      console.log(`   Registros inseridos: ${rowCount[0]?.count || 0}`);

      // Listar cupons criados
      const coupons = await prisma.$queryRaw`
        SELECT "code", "discountType", "value", "isActive", "isDevCoupon" 
        FROM "coupons" 
        ORDER BY "code";
      `;
      
      console.log('\n📋 Cupons na tabela:');
      coupons.forEach(coupon => {
        console.log(`   - ${coupon.code}: ${coupon.discountType} ${coupon.value}${coupon.discountType === 'percent' ? '%' : ' centavos'} (${coupon.isActive ? 'ativo' : 'inativo'}, ${coupon.isDevCoupon ? 'DEV' : 'produção'})`);
      });
    } else {
      console.log('\n⚠️  Tabela "coupons" não foi criada. Verifique os erros acima.');
    }

    // Verificar foreign key
    const fkExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'coupon_usages_couponId_fkey'
      );
    `;

    if (fkExists[0]?.exists) {
      console.log('\n✅ Foreign key "coupon_usages_couponId_fkey" criada com sucesso!');
    } else {
      console.log('\n⚠️  Foreign key não encontrada. Pode já existir ou ter falhado.');
    }

    console.log('\n✅ Migração concluída!');

  } catch (error) {
    console.error('\n❌ Erro ao executar migração:');
    console.error('   Tipo:', error.constructor.name);
    console.error('   Mensagem:', error.message);
    
    if (error.code) {
      console.error('   Código:', error.code);
    }
    
    if (error.meta) {
      console.error('   Meta:', JSON.stringify(error.meta, null, 2));
    }
    
    console.error('\n📋 Stack trace:');
    console.error(error.stack);
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

// Executar script
main()
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
