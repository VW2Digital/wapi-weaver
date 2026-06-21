const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

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

const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const filename = `backup-mysql-${timestamp}.sql`;
const outputPath = path.join(process.cwd(), filename);

console.log("====================================================");
const modeText = "  BACKUP DE BANCO DE DADOS LOCAL (DOCKER MYSQL)  ";
console.log(modeText);
console.log("====================================================");
console.log(`Container MySQL: ${dbConfig.containerName}`);
console.log(`Database Name  : ${dbConfig.database}`);
console.log(`Database User  : ${dbConfig.user}`);
console.log(`Backup File    : ${filename}`);
console.log("----------------------------------------------------");

try {
  console.log("Gerando backup do banco de dados...");

  // Executa o mysqldump de forma segura direto de dentro do container Docker
  // Usamos -i para o docker exec e redirecionamos o stdout para salvar o arquivo de backup localmente
  const command = `docker exec -i ${dbConfig.containerName} mysqldump -u"${dbConfig.user}" -p"${dbConfig.password}" --databases "${dbConfig.database}"`;

  const backupData = execSync(command, { maxBuffer: 100 * 1024 * 1024 }); // 100MB buffer limit

  fs.writeFileSync(outputPath, backupData);

  console.log("\n====================================================");
  console.log("           BACKUP CONCLUÍDO COM SUCESSO!            ");
  console.log("====================================================");
  console.log(`Arquivo salvo em: ${outputPath}`);
  console.log(`Tamanho do backup: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
  console.log("====================================================");
} catch (err) {
  console.error("\n❌ Erro ao gerar o backup do MySQL:");
  console.error(err.message);
  console.log("\nCertifique-se de que o container Docker do banco de dados está rodando.");
  console.log("Você pode iniciá-lo usando: docker-compose up -d banco-mysql");
  process.exit(1);
}
