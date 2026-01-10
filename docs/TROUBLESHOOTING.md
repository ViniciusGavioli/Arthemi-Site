# 🔧 Guia de Solução de Problemas - Arthemi Site

Este guia ajuda a resolver problemas comuns ao trabalhar com o projeto Arthemi no VS Code.

---

## ⚡ Solução Rápida para Autenticação Git

**Problema mais comum**: "Repository not found" ou "Authentication failed"

**Solução completa**:
```bash
# 1. Instale o GitHub CLI (se não tiver)
# Ubuntu/Debian: sudo apt install gh
# macOS: brew install gh
# Windows: winget install --id GitHub.cli

# 2. Faça login
gh auth login
# Escolha: GitHub.com > HTTPS > Login with a web browser
# Siga as instruções na tela

# 3. Verifique se funcionou
gh auth status

# 4. Agora você pode usar Git normalmente
git pull origin main
git push origin main
# Ou qualquer outro comando Git
```

Veja mais detalhes na [seção de Autenticação Git](#-problemas-de-autenticação-git).

---

## 🔌 Problemas de Conexão com VS Code

### Problema: "Erro ao conectar com VS Code"

#### Soluções:

1. **Instale as Extensões Recomendadas**
   ```
   - Abra o projeto no VS Code
   - Pressione Ctrl+Shift+P (Cmd+Shift+P no Mac)
   - Digite "Show Recommended Extensions"
   - Clique em "Install All"
   ```

2. **Verifique a Versão do VS Code**
   ```bash
   # Certifique-se que está usando a versão mais recente
   # Ajuda > Sobre (Windows/Linux)
   # Code > Sobre Visual Studio Code (Mac)
   ```

3. **Recarregue a Janela**
   ```
   Pressione Ctrl+Shift+P (Cmd+Shift+P no Mac)
   Digite "Reload Window"
   Pressione Enter
   ```

4. **Limpe o Cache do VS Code**
   ```bash
   # Feche o VS Code
   # No Linux/Mac:
   rm -rf ~/.vscode/extensions
   rm -rf ~/.config/Code/CachedData
   
   # No Windows:
   # Delete: %APPDATA%\Code\CachedData
   ```

---

## 🔐 Problemas de Autenticação Git

### Problema: "Repository not found" ou "Authentication failed"

#### Causa Comum:
Isso geralmente acontece quando:
- O repositório é privado e você não está autenticado
- Suas credenciais do GitHub expiraram
- Você está usando HTTPS em vez de SSH (ou vice-versa)

#### Soluções:

1. **Usar GitHub CLI (Recomendado - Mais Fácil)**
   
   O GitHub CLI é a maneira mais simples e moderna de autenticar:
   
   a. Instale o GitHub CLI:
   ```bash
   # Ubuntu/Debian
   sudo apt install gh
   
   # macOS
   brew install gh
   
   # Windows (via winget)
   winget install --id GitHub.cli
   
   # Ou baixe de: https://cli.github.com/
   ```
   
   b. Faça login:
   ```bash
   gh auth login
   ```
   
   Siga as instruções interativas:
   - Escolha "GitHub.com"
   - Escolha "HTTPS" (recomendado)
   - Escolha "Login with a web browser" (mais fácil)
   - Copie o código de 8 dígitos mostrado
   - Pressione Enter para abrir o navegador
   - Cole o código no navegador e autorize
   
   c. Verifique se está autenticado:
   ```bash
   gh auth status
   ```
   
   d. Teste com comandos Git:
   ```bash
   # Puxar mudanças do repositório
   git pull origin main
   
   # Fazer suas mudanças e commit
   git add .
   git commit -m "sua mensagem"
   
   # Enviar suas mudanças
   git push origin main
   ```
   
   ✅ Pronto! A autenticação está configurada e você pode usar Git normalmente.

2. **Configurar Autenticação com Personal Access Token (PAT)**
   
   a. Crie um Personal Access Token no GitHub:
   ```
   1. Vá para: GitHub.com > Settings > Developer settings > Personal access tokens
   2. Clique em "Generate new token (classic)"
   3. Dê permissões: repo, workflow, read:org
   4. Copie o token gerado
   ```
   
   b. Configure no Git:
   ```bash
   # Use o token como senha ao fazer git pull/push
   git pull
   # Usuário: seu_usuario_github
   # Senha: seu_token_copiado
   ```

3. **Usar SSH em vez de HTTPS**
   
   a. Gere uma chave SSH (se não tiver):
   ```bash
   ssh-keygen -t ed25519 -C "seu_email@exemplo.com"
   ```
   
   b. Adicione a chave ao GitHub:
   ```bash
   # Copie o conteúdo da chave pública
   cat ~/.ssh/id_ed25519.pub
   
   # Adicione em GitHub.com > Settings > SSH and GPG keys
   ```
   
   c. Mude o remote para SSH:
   ```bash
   git remote set-url origin git@github.com:ViniciusGavioli/Arthemi-Site.git
   ```

4. **Verificar URL do Remote**
   ```bash
   # Ver a URL atual
   git remote -v
   
   # Deve mostrar:
   # origin  https://github.com/ViniciusGavioli/Arthemi-Site (fetch)
   # origin  https://github.com/ViniciusGavioli/Arthemi-Site (push)
   
   # Se tiver uma barra "/" no final, corrija:
   git remote set-url origin https://github.com/ViniciusGavioli/Arthemi-Site
   ```

5. **Configurar Git Credential Helper**
   ```bash
   # Linux
   git config --global credential.helper cache
   git config --global credential.helper 'cache --timeout=3600'
   
   # Windows
   git config --global credential.helper wincred
   
   # Mac
   git config --global credential.helper osxkeychain
   ```

---

## 📦 Problemas de Dependências

### Problema: "Cannot find module" ou "Module not found"

```bash
# 1. Limpe tudo e reinstale
rm -rf node_modules package-lock.json
npm install

# 2. Limpe o cache do npm
npm cache clean --force
npm install

# 3. Verifique a versão do Node.js
node --version  # Deve ser 18+ (recomendado 20 LTS)
```

---

## 🔧 Problemas do TypeScript

### Problema: "Cannot find module '@/...'" ou erros de import

```bash
# 1. Regenere o Prisma Client
npm run generate

# 2. Reinicie o TypeScript Server no VS Code
# Ctrl+Shift+P > TypeScript: Restart TS Server

# 3. Verifique se está usando a versão do workspace
# Ctrl+Shift+P > TypeScript: Select TypeScript Version
# Escolha "Use Workspace Version"
```

### Problema: TypeScript muito lento

```bash
# Limpe arquivos de build
rm -rf .next node_modules/.cache

# Reinicie o VS Code
```

---

## 🎨 Problemas do ESLint/Prettier

### Problema: ESLint não está formatando ou mostrando erros

1. **Verifique se a extensão está instalada**
   ```
   Extensões > Procure "ESLint" by Microsoft
   ```

2. **Reinicie o ESLint Server**
   ```
   Ctrl+Shift+P > ESLint: Restart ESLint Server
   ```

3. **Verifique as configurações**
   ```json
   // .vscode/settings.json já tem isso, mas verifique:
   "editor.codeActionsOnSave": {
     "source.fixAll.eslint": "explicit"
   }
   ```

### Problema: Prettier não está formatando

1. **Configure como formatador padrão**
   ```
   Clique com botão direito no arquivo
   Formatar Documento Com...
   Escolha "Prettier - Code formatter"
   Marque "Configure Default Formatter"
   ```

2. **Verifique se está habilitado**
   ```json
   // .vscode/settings.json
   "editor.formatOnSave": true,
   "editor.defaultFormatter": "esbenp.prettier-vscode"
   ```

---

## 🗄️ Problemas do Prisma

### Problema: "PrismaClient is not configured"

```bash
# Gere o cliente novamente
npx prisma generate

# Verifique se o schema está correto
npx prisma validate
```

### Problema: Migrations falhando

```bash
# Reset completo do banco (CUIDADO: apaga todos os dados)
npx prisma migrate reset

# Ou aplique manualmente
npx prisma db push
```

### Problema: Prisma Studio não abre

```bash
# Verifique se o banco está rodando
docker-compose ps

# Inicie se necessário
docker-compose up -d

# Abra o Studio
npm run db:studio
```

---

## 🐳 Problemas do Docker

### Problema: "Cannot connect to Docker daemon"

```bash
# Verifique se o Docker está rodando
docker ps

# Inicie o Docker (depende do SO)
# No Linux com systemd:
sudo systemctl start docker

# No Windows/Mac: Inicie o Docker Desktop
```

### Problema: Porta 5432 já está em uso

```bash
# Veja o que está usando a porta
sudo lsof -i :5432
# ou
sudo netstat -tulpn | grep 5432

# Pare o serviço que está usando ou mude a porta no docker-compose.yml
```

---

## 🚀 Problemas ao Rodar o Projeto

### Problema: "Port 3000 is already in use"

```bash
# Encontre o processo usando a porta
lsof -i :3000
# ou
netstat -ano | findstr :3000

# Mate o processo
kill -9 <PID>

# Ou use outra porta
PORT=3001 npm run dev
```

### Problema: Build falha

```bash
# Limpe tudo
rm -rf .next node_modules
npm install
npm run build

# Verifique erros do TypeScript
npx tsc --noEmit
```

---

## 🧪 Problemas de Testes

### Problema: Testes Jest falhando

```bash
# Limpe o cache
npm test -- --clearCache

# Rode com mais informações
npm test -- --verbose

# Rode um teste específico
npm test -- nome-do-arquivo.test.ts
```

### Problema: Playwright não funciona

```bash
# Instale os browsers
npx playwright install

# Rode com UI para debug
npm run test:e2e:ui

# Verifique se o servidor está rodando
# Testes E2E precisam do servidor ativo
```

---

## 🔍 Debug Geral

### Ver logs detalhados no VS Code

1. **Output Panel**
   ```
   View > Output
   Escolha "TypeScript", "ESLint", "Prettier" no dropdown
   ```

2. **Developer Tools**
   ```
   Help > Toggle Developer Tools
   Console tab mostra erros do VS Code
   ```

3. **Extension Host Log**
   ```
   Ctrl+Shift+P > Developer: Show Logs
   Escolha Extension Host
   ```

---

## 📞 Ainda com Problemas?

### Checklist Final

- [ ] VS Code está atualizado?
- [ ] Node.js 18+ instalado?
- [ ] Dependências instaladas? (`npm install`)
- [ ] Banco de dados rodando? (`docker-compose ps`)
- [ ] Arquivo `.env` existe e está configurado?
- [ ] Prisma Client gerado? (`npm run generate`)
- [ ] Todas as extensões recomendadas instaladas?
- [ ] VS Code reiniciado depois das mudanças?

### Recursos

- [VS Code Documentation](https://code.visualstudio.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [GitHub Authentication Guide](https://docs.github.com/en/authentication)

---

**Boa sorte! 🚀**
