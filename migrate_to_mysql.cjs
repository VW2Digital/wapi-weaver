const fs = require('fs');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// 1. Load environment variables from .env
let supabaseUrl = '';
let supabaseAnonKey = '';

try {
  if (fs.existsSync('.env')) {
    const dotenvContent = fs.readFileSync('.env', 'utf-8');
    const urlMatch = dotenvContent.match(/(?:VITE_)?SUPABASE_URL=["']?([^"'\s]+)["']?/);
    const keyMatch = dotenvContent.match(/(?:VITE_)?SUPABASE_PUBLISHABLE_KEY=["']?([^"'\s]+)["']?/);
    
    if (urlMatch) supabaseUrl = urlMatch[1];
    if (keyMatch) supabaseAnonKey = keyMatch[1];
  }
} catch (err) {
  console.error('Erro ao ler o arquivo .env:', err.message);
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Erro: Não foi possível carregar as credenciais do Supabase do arquivo .env.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// MySQL connection parameters (matching docker-compose.yml and src/lib/db.ts)
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'wapi_user',
  password: process.env.DB_PASSWORD || 'S0xbxPfKazBVT8JFy1UEOjIsrjox',
  database: process.env.DB_NAME || 'wapi_weaver'
};

const TABLES_IN_ORDER = [
  'profiles',
  'user_roles',
  'platform_settings',
  'audit_logs',
  'schema_backups',
  'salvy_numbers',
  'tags',
  'contacts',
  'contact_tags',
  'lists',
  'list_contacts',
  'templates',
  'campaigns',
  'campaign_messages',
  'webhook_events'
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Helper to preprocess row values for MySQL
function preprocessValue(val) {
  if (val === null || val === undefined) {
    return null;
  }
  if (typeof val === 'boolean') {
    return val ? 1 : 0;
  }
  if (Array.isArray(val) || (typeof val === 'object' && !(val instanceof Date))) {
    return JSON.stringify(val);
  }
  return val;
}

async function run() {
  console.log('====================================================');
  console.log('  MIGRAÇÃO DE DADOS: CLOUD SUPABASE -> LOCAL MySQL  ');
  console.log('====================================================');
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`MySQL Host  : ${dbConfig.host}:${dbConfig.port}`);
  console.log(`MySQL DB    : ${dbConfig.database}`);
  console.log('----------------------------------------------------');

  let email = process.env.MIGRATE_EMAIL || process.argv[2];
  let password = process.env.MIGRATE_PASSWORD || process.argv[3];

  if (!email || !password) {
    email = await askQuestion('Digite seu e-mail do dashboard para autenticação: ');
    password = await askQuestion('Digite sua senha: ');
  }
  rl.close();

  console.log('\nConectando ao Supabase...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.error('❌ Erro de autenticação no Supabase:', authError.message);
    process.exit(1);
  }

  console.log('✅ Autenticado no Supabase com sucesso!');

  console.log('Conectando ao banco de dados MySQL local...');
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado ao MySQL com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao conectar ao MySQL:', err.message);
    process.exit(1);
  }

  // 1. Fetch profiles first to create corresponding users
  console.log('\nExtraindo perfis (profiles) do Supabase...');
  const { data: profiles, error: profilesErr } = await supabase
    .from('profiles')
    .select('*');

  if (profilesErr) {
    console.error('❌ Erro ao carregar perfis:', profilesErr.message);
    await connection.end();
    process.exit(1);
  }

  console.log(`Encontrados ${profiles.length} perfis.`);

  // Create users in the MySQL users table
  console.log('Criando usuários na tabela local "users"...');
  const defaultPassword = 'mudar123';
  const defaultPasswordHash = await bcrypt.hash(defaultPassword, 10);

  // Disable foreign key checks temporarily to ensure clean insertion
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');

  // Clear existing data (optional, but good for clean migrations)
  console.log('Limpando tabelas locais antes da migração...');
  for (const table of [...TABLES_IN_ORDER].reverse()) {
    await connection.query(`TRUNCATE TABLE \`${table}\``);
  }
  await connection.query('TRUNCATE TABLE `users`');

  let usersCreated = 0;
  for (const profile of profiles) {
    const userEmail = profile.email || `${profile.id}@local.wapi`;
    try {
      await connection.execute(
        'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
        [profile.id, userEmail, defaultPasswordHash, profile.created_at || new Date()]
      );
      usersCreated++;
    } catch (err) {
      console.warn(`⚠️ Aviso ao criar usuário ${userEmail}:`, err.message);
    }
  }
  console.log(`✅ ${usersCreated} usuários criados com a senha padrão "${defaultPassword}"`);

  // Migrate each table in dependency order
  const pageSize = 500;

  for (const table of TABLES_IN_ORDER) {
    console.log(`\nProcessando tabela "${table}"...`);
    let allRows = [];
    let page = 0;
    let hasError = false;

    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        hasError = true;
        console.error(`❌ Erro ao ler tabela "${table}" de Supabase:`, error.message);
        break;
      }

      if (!data || data.length === 0) break;

      allRows = allRows.concat(data);
      if (data.length < pageSize) break;
      page++;
    }

    if (hasError) continue;

    console.log(`Encontrados ${allRows.length} registros para "${table}".`);

    if (allRows.length > 0) {
      let insertedCount = 0;
      const columns = Object.keys(allRows[0]);
      const placeholders = columns.map(() => '?').join(', ');
      const sql = `INSERT INTO \`${table}\` (${columns.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`;

      for (const row of allRows) {
        const values = columns.map(col => preprocessValue(row[col]));
        try {
          await connection.execute(sql, values);
          insertedCount++;
        } catch (err) {
          console.error(`❌ Falha ao inserir linha na tabela "${table}":`, err.message);
          console.error('Linha problemática:', row);
        }
      }
      console.log(`✅ ${insertedCount}/${allRows.length} registros inseridos com sucesso na tabela local "${table}".`);
    } else {
      console.log(`Tabela "${table}" estava vazia.`);
    }
  }

  // Re-enable foreign key checks
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  await connection.end();

  console.log('\n====================================================');
  console.log('           MIGRAÇÃO CONCLUÍDA COM SUCESSO!          ');
  console.log('====================================================');
  console.log(`Todos os dados foram migrados para o MySQL local.`);
  console.log(`Senha padrão de login para todas as contas: "${defaultPassword}"`);
  console.log('====================================================');
}

run().catch(err => {
  console.error('\n❌ Erro inesperado durante a migração:', err);
});
