const fs = require('fs');
const mysql = require('mysql2/promise');

async function run() {
  console.log("Starting schema comparison...");
  
  // 1. Connect to local database
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
    database: process.env.DB_NAME || "wapi_weaver",
  });

  // 2. Read schema_mysql.sql
  const schemaSql = fs.readFileSync('schema_mysql.sql', 'utf8');

  // Simple parser to extract CREATE TABLE statements
  const createTableRegex = /CREATE TABLE(?: IF NOT EXISTS)?\s+`?([a-zA-Z0-9_]+)`?\s*\(([\s\S]+?)\)\s*ENGINE/gi;
  let match;
  const schemaTables = {};

  while ((match = createTableRegex.exec(schemaSql)) !== null) {
    const tableName = match[1];
    const tableBody = match[2];
    
    // Parse columns
    const columns = [];
    const lines = tableBody.split('\n');
    for (let line of lines) {
      line = line.trim().replace(/,$/, '');
      if (!line) continue;
      if (line.startsWith('PRIMARY KEY') || line.startsWith('FOREIGN KEY') || line.startsWith('UNIQUE KEY') || line.startsWith('KEY') || line.startsWith('CONSTRAINT')) {
        continue;
      }
      const colMatch = line.match(/^`?([a-zA-Z0-9_]+)`?\s+([A-Za-z]+(?:\([0-9,]+\))?)/i);
      if (colMatch) {
        columns.push({
          name: colMatch[1],
          type: colMatch[2].toLowerCase(),
          definition: line
        });
      }
    }
    schemaTables[tableName] = columns;
  }

  // 3. Inspect database
  const [dbTablesResult] = await connection.query("SHOW TABLES");
  const dbTables = dbTablesResult.map(r => Object.values(r)[0]);
  
  console.log(`Database has ${dbTables.length} tables. Schema file has ${Object.keys(schemaTables).length} tables.`);

  const missingTables = [];
  const missingColumns = [];

  for (const tableName of Object.keys(schemaTables)) {
    if (!dbTables.includes(tableName)) {
      missingTables.push(tableName);
      continue;
    }

    // Inspect columns of this table
    const [dbColumnsResult] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
    const dbColumnNames = dbColumnsResult.map(c => c.Field);

    for (const schemaCol of schemaTables[tableName]) {
      if (!dbColumnNames.includes(schemaCol.name)) {
        missingColumns.push({
          table: tableName,
          column: schemaCol.name,
          definition: schemaCol.definition
        });
      }
    }
  }

  console.log("\n--- Comparison Results ---");
  if (missingTables.length === 0) {
    console.log("✅ No missing tables found!");
  } else {
    console.log("❌ Missing tables:", missingTables);
  }

  if (missingColumns.length === 0) {
    console.log("✅ No missing columns found!");
  } else {
    console.log("❌ Missing columns:");
    missingColumns.forEach(c => {
      console.log(`  - Table: ${c.table}, Column: ${c.column} (${c.definition})`);
    });
  }

  await connection.end();
}

run().catch(console.error);
