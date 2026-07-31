import fs from 'fs';
import path from 'path';

const filesToRemove = [
  path.resolve('src/routes/_app/ai-agent.tsx'),
  path.resolve('src/lib/ai-agent.server.ts'),
  path.resolve('src/lib/ai-agent.functions.ts'),
];

for (const file of filesToRemove) {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log(`[Removed] ${file}`);
  } else {
    console.log(`[Not Found] ${file}`);
  }
}
