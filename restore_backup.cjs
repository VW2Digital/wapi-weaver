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

if (!supabaseUrl) {
  console.error('Erro: Não foi possível carregar as credenciais do Supabase do arquivo .env.');
  console.error('Certifique-se de que a variável SUPABASE_URL está configurada.');
  process.exit(1);
}

// Lista de tabelas em ordem de dependência (chaves estrangeiras)
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

function parseValuesLine(valuesStr) {
  const values = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';
  let arrayDepth = 0;
  let jsonDepth = 0;
  
  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];
    
    if (inQuote) {
      if (char === quoteChar) {
        if (valuesStr[i + 1] === quoteChar) {
          current += quoteChar;
          i++; // Pular próxima aspa
        } else {
          inQuote = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === "'" || char === '"') {
        inQuote = true;
        quoteChar = char;
      } else if (char === '[') {
        arrayDepth++;
        current += char;
      } else if (char === ']') {
        arrayDepth--;
        current += char;
      } else if (char === '{') {
        jsonDepth++;
        current += char;
      } else if (char === '}') {
        jsonDepth--;
        current += char;
      } else if (char === ',' && arrayDepth === 0 && jsonDepth === 0) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  values.push(current.trim());
  return values.map(v => cleanValue(v));
}

function cleanValue(v) {
  if (v === 'NULL' || v === '') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  
  if (v.endsWith('::jsonb')) {
    const jsonStr = v.slice(0, -7);
    try {
      return JSON.parse(jsonStr);
    } catch {
      return jsonStr;
    }
  }
  
  if (v.startsWith('ARRAY[') && v.endsWith(']')) {
    const arrContent = v.slice(6, -1);
    return parseValuesLine(arrContent);
  }
  
  if (!isNaN(v) && v.trim() !== '') {
    return Number(v);
  }
  
  return v;
}

// Interface interativa
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function run() {
  console.log('====================================================');
  console.log('    SUPABASE DATABASE RESTORE UTILITY (SQL IMPORT)  ');
  console.log('====================================================');
  console.log(`URL do Projeto Destino: ${supabaseUrl}`);
  console.log('Para importar tabelas protegidas por RLS, é necessário');
  console.log('fornecer a Service Role Key do projeto de destino.');
  console.log('----------------------------------------------------');

  const keyInput = await askQuestion('Digite a Service Role Key (sk-...) ou pressione enter para usar do .env se houver: ');
  const serviceRoleKey = keyInput.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

  if (!serviceRoleKey) {
    console.error('\nErro: A Service Role Key é obrigatória para contornar restrições de RLS e realizar a restauração.');
    rl.close();
    process.exit(1);
  }

  const filePath = await askQuestion('Digite o caminho do arquivo SQL de backup (Padrão: data_dump.sql): ');
  const fileToRestore = filePath.trim() || 'data_dump.sql';
  rl.close();

  if (!fs.existsSync(fileToRestore)) {
    console.error(`\nErro: O arquivo de backup "${fileToRestore}" não foi encontrado.`);
    process.exit(1);
  }

  console.log(`\nLendo arquivo "${fileToRestore}"...`);
  const text = fs.readFileSync(fileToRestore, 'utf-8');
  const lines = text.split('\n');
  const rowsByTable = {};

  console.log('Processando linhas SQL e reconstituindo os registros...');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('INSERT INTO public.')) continue;

    const match = trimmed.match(/^INSERT INTO public\.(\w+)\s*\((.+)\)\s*VALUES\s*\((.+)\);$/);
    if (!match) continue;

    const tableName = match[1];
    const columnsStr = match[2];
    const valuesStr = match[3];

    const columns = columnsStr.split(',').map(c => c.trim().replace(/"/g, ''));
    const values = parseValuesLine(valuesStr);

    const row = {};
    columns.forEach((col, idx) => {
      row[col] = values[idx];
    });

    if (!rowsByTable[tableName]) {
      rowsByTable[tableName] = [];
    }
    rowsByTable[tableName].push(row);
  }

  console.log('Iniciando conexão de restauração com o Supabase...');
  const client = createClient(supabaseUrl, serviceRoleKey);

  console.log('\nRestaurando dados tabela por tabela (obedecendo restrições de chaves estrangeiras):\n');

  let successCount = 0;
  let failCount = 0;

  for (const table of TABLES_IN_ORDER) {
    const rows = rowsByTable[table];
    if (!rows || rows.length === 0) continue;

    process.stdout.write(`Importando tabela "${table}" (${rows.length} registros)... `);

    const batchSize = 100;
    let tableFailed = false;
    let tableErrorMsg = '';

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await client.from(table).upsert(batch);
      if (error) {
        tableFailed = true;
        tableErrorMsg = error.message;
        break;
      }
    }

    if (tableFailed) {
      console.log(`❌ ERRO: ${tableErrorMsg}`);
      failCount++;
    } else {
      console.log(`✅ OK`);
      successCount++;
    }
  }

  console.log('\n====================================================');
  console.log('    PROCESSO DE RESTAURAÇÃO FINALIZADO             ');
  console.log('====================================================');
  console.log(`Tabelas importadas com sucesso: ${successCount}`);
  console.log(`Tabelas com falhas de importação: ${failCount}`);
  console.log('====================================================');
}

run().catch(err => {
  console.error('\nErro inesperado durante a execução:', err);
});
