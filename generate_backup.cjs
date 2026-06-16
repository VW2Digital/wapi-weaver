const fs = require('fs');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

// 1. Carregar variáveis do arquivo .env
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
  console.error('Certifique-se de que as variáveis SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY estão configuradas.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Lista de todas as tabelas do schema público para exportação
const tables = [
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

// Helper para formatar valores para SQL Postgres
function formatSQLValue(val) {
  if (val === null || val === undefined) {
    return 'NULL';
  }
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false';
  }
  if (typeof val === 'number') {
    return val.toString();
  }
  if (Array.isArray(val)) {
    // Para arrays no Postgres, formata como ARRAY['val1', 'val2'] ou ARRAY[1, 2]
    const elements = val.map(el => formatSQLValue(el)).join(', ');
    return `ARRAY[${elements}]`;
  }
  if (typeof val === 'object') {
    // Para objetos JSONB
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  if (typeof val === 'string') {
    // Escapa aspas simples duplicando-as
    return `'${val.replace(/'/g, "''")}'`;
  }
  return `'${val.toString().replace(/'/g, "''")}'`;
}

// Interface interativa de leitura no terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function run() {
  console.log('====================================================');
  console.log('    SUPABASE DATABASE BACKUP EXPORTER (SQL DUMP)    ');
  console.log('====================================================');
  console.log(`URL do Projeto Origem: ${supabaseUrl}`);
  console.log('Como o banco de dados possui políticas de segurança (RLS),');
  console.log('você precisa se autenticar para ter acesso aos seus dados.');
  console.log('----------------------------------------------------');

  const email = await askQuestion('Digite seu e-mail do dashboard: ');
  const password = await askQuestion('Digite sua senha: ');
  rl.close();

  console.log('\nAutenticando...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.error('Erro de autenticação:', authError.message);
    process.exit(1);
  }

  console.log('Autenticado com sucesso! Iniciando extração dos dados...\n');

  let sqlDump = `-- ====================================================\n`;
  sqlDump += `-- BACKUP DO BANCO DE DADOS - WAPI WEAVER\n`;
  sqlDump += `-- Gerado em: ${new Date().toISOString()}\n`;
  sqlDump += `-- Usuário: ${email}\n`;
  sqlDump += `-- Projeto Supabase: ${supabaseUrl}\n`;
  sqlDump += `-- ====================================================\n\n`;
  sqlDump += `SET statement_timeout = 0;\n`;
  sqlDump += `SET lock_timeout = 0;\n`;
  sqlDump += `SET client_encoding = 'UTF8';\n`;
  sqlDump += `SET standard_conforming_strings = on;\n`;
  sqlDump += `SET check_function_bodies = false;\n`;
  sqlDump += `SET xmloption = content;\n`;
  sqlDump += `SET client_min_messages = warning;\n`;
  sqlDump += `SET row_security = off;\n\n`;

  // Desativa triggers temporariamente para evitar loops de triggers ao restaurar os dados
  sqlDump += `-- Desativando triggers durante a restauração\n`;
  sqlDump += `SET session_replication_role = 'replica';\n\n`;

  const pageSize = 1000;

  for (const table of tables) {
    process.stdout.write(`Extraindo tabela "${table}"... `);
    
    let allRows = [];
    let page = 0;
    let hasError = false;
    let errorMessage = '';

    try {
      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          hasError = true;
          errorMessage = error.message;
          break;
        }

        if (!data || data.length === 0) {
          break;
        }

        allRows = allRows.concat(data);
        
        if (data.length < pageSize) {
          break;
        }
        page++;
      }

      if (hasError) {
        console.log(`[ERRO: ${errorMessage} (Pode ser restrição de RLS ou tabela inexistente)]`);
        sqlDump += `-- Tabela public.${table} falhou ao exportar: ${errorMessage}\n\n`;
        continue;
      }

      console.log(`OK (${allRows.length} registros extraídos)`);

      if (allRows.length > 0) {
        sqlDump += `--\n-- Dados para a tabela public.${table}\n--\n`;
        sqlDump += `BEGIN;\n`;
        
        // Obter as chaves (colunas) da primeira linha
        const columns = Object.keys(allRows[0]);
        const columnsStr = columns.map(col => `"${col}"`).join(', ');

        for (const row of allRows) {
          const valuesStr = columns.map(col => formatSQLValue(row[col])).join(', ');
          sqlDump += `INSERT INTO public.${table} (${columnsStr}) VALUES (${valuesStr});\n`;
        }

        sqlDump += `COMMIT;\n\n`;
      } else {
        sqlDump += `-- Tabela public.${table} estava vazia\n\n`;
      }

    } catch (err) {
      console.log(`[EXCEÇÃO: ${err.message}]`);
      sqlDump += `-- Exceção ao exportar a tabela public.${table}: ${err.message}\n\n`;
    }
  }

  // Reabilita triggers normais
  sqlDump += `-- Reativando triggers\n`;
  sqlDump += `SET session_replication_role = 'origin';\n`;

  const outputFile = 'data_dump.sql';
  try {
    fs.writeFileSync(outputFile, sqlDump, 'utf-8');
    console.log('\n====================================================');
    console.log('    EXPORTAÇÃO CONCLUÍDA COM SUCESSO!               ');
    console.log('====================================================');
    console.log(`Arquivo gerado: ${outputFile}`);
    console.log(`Tamanho do arquivo: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB`);
    console.log('Os dados foram exportados em formato SQL compatível com Postgres.');
    console.log('====================================================');
  } catch (err) {
    console.error('\nErro ao salvar o arquivo de backup:', err.message);
  }
}

run().catch(err => {
  console.error('\nErro inesperado durante a execução:', err);
});
