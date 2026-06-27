import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vw2.chat',
  appName: 'VW2 Chat',
  webDir: 'dist',
  // Como o TanStack Start é um framework SSR (roda funções no servidor),
  // a forma recomendada para empacotar o APK é apontar diretamente para a URL onde seu sistema está publicado.
  // Substitua a URL abaixo pelo domínio real onde você hospedou a aplicação:
  server: {
    url: 'http://localhost:8080', // Altere para 'https://seu-dominio-publicado.com' em produção
    cleartext: true
  }
};

export default config;
