const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");
const readline = require("readline");

// 1. Load database configuration from .env
let dbConfig = {
  user: "wapi_user",
  password: "S0xbxPfKazBVT8JFy1UEOjIsrjox",
  database: "wapi_weaver",
  containerName: "wapi_weaver_mysql",
};

try {
  if (fs.existsSync(".env")) {
    const envContent = fs.readFileSync(".env", "utf-8");
    const userMatch = envContent.match(/DB_USER=["']?([^"'\s]+)["']?/);
    const passMatch = envContent.match(/DB_PASSWORD=["']?([^"'\s]+)["']?/);
    const nameMatch = envContent.match(/DB_NAME=["']?([^"'\s]+)["']?/);

    if (userMatch) dbConfig.user = userMatch[1];
    if (passMatch) dbConfig.password = passMatch[1];
    if (nameMatch) dbConfig.database = nameMatch[1];
  }
} catch (err) {
  console.warn("⚠️ Não foi possível ler o arquivo .env, usando padrões.");
}

console.log("====================================================");
console.log("  RESTAURAÇÃO DE BANCO DE DADOS LOCAL (DOCKER MYSQL) ");
console.log("====================================================");
console.log(`Container MySQL: ${dbConfig.containerName}`);
console.log(`Database Name  : ${dbConfig.database}`);
console.log(`Database User  : ${dbConfig.user}`);
console.log("----------------------------------------------------");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function run() {
  let backupFile = process.argv[2];

  if (!backupFile) {
    // Search for backup files in the current directory
    const files = fs
      .readdirSync(process.cwd())
      .filter((f) => f.startsWith("backup-mysql-") && f.endsWith(".sql"))
      .sort()
      .reverse(); // Newest first

    if (files.length === 0) {
      console.log(
        '❌ Nenhum arquivo de backup ("backup-mysql-*.sql") encontrado no diretório atual.',
      );
      console.log("Uso: node restore_mysql.cjs <caminho_do_arquivo.sql>");
      process.exit(1);
    }

    console.log("Arquivos de backup disponíveis:");
    files.forEach((f, idx) => {
      const stats = fs.statSync(f);
      console.log(`[${idx + 1}] ${f} (${(stats.size / 1024).toFixed(2)} KB)`);
    });

    const choiceStr = await askQuestion(
      "\nEscolha o número do backup para restaurar (ou digite o caminho de outro arquivo): ",
    );
    rl.close();

    const choiceIdx = parseInt(choiceStr, 10) - 1;
    if (choiceIdx >= 0 && choiceIdx < files.length) {
      backupFile = files[choiceIdx];
    } else if (fs.existsSync(choiceStr)) {
      backupFile = choiceStr;
    } else {
      console.error("❌ Opção ou arquivo inválido.");
      process.exit(1);
    }
  } else {
    rl.close();
  }

  const backupPath = path.resolve(backupFile);
  if (!fs.existsSync(backupPath)) {
    console.error(`❌ O arquivo de backup não foi encontrado: ${backupPath}`);
    process.exit(1);
  }

  try {
    console.log(`\nRestaurando o backup "${backupFile}" para o banco de dados...`);

    const sqlContent = fs.readFileSync(backupPath);

    // Executa a importação no MySQL do container via stdin
    const command = `docker exec -i ${dbConfig.containerName} mysql -u"${dbConfig.user}" -p"${dbConfig.password}" "${dbConfig.database}"`;

    execSync(command, { input: sqlContent, maxBuffer: 100 * 1024 * 1024 });

    console.log("\n====================================================");
    console.log("        RESTAURAÇÃO CONCLUÍDA COM SUCESSO!          ");
    console.log("====================================================");
    console.log(`Backup "${backupFile}" restaurado no container.`);
    console.log("====================================================");
  } catch (err) {
    console.error("\n❌ Erro ao restaurar o backup do MySQL:");
    console.error(err.message);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("\n❌ Erro inesperado durante a restauração:", err);
});
