# 🔧 Configuração do VS Code para o Projeto Arthemi

Este guia ajuda você a configurar o Visual Studio Code para trabalhar no projeto Arthemi com máxima produtividade.

## 📋 Pré-requisitos

- Visual Studio Code (versão mais recente)
- Node.js 18+ instalado
- Git instalado

---

## 🚀 Início Rápido

### 1. Abrir o Projeto

```bash
# Clone o repositório (se ainda não clonou)
git clone https://github.com/ViniciusGavioli/Arthemi-Site.git
cd Arthemi-Site

# Abra no VS Code
code .
```

### 2. Instalar Extensões Recomendadas

Quando você abrir o projeto no VS Code pela primeira vez, verá uma notificação pedindo para instalar as extensões recomendadas. **Clique em "Instalar"**.

Alternativamente, você pode instalar manualmente:

1. Pressione `Ctrl+Shift+X` (ou `Cmd+Shift+X` no Mac)
2. Procure por "Show Recommended Extensions" na paleta de comandos (`Ctrl+Shift+P`)
3. Clique em "Install All" nas extensões do workspace

### 3. Configurar Ambiente

```bash
# Instalar dependências
npm install

# Copiar arquivo de ambiente
cp .env.example .env

# Edite o .env conforme necessário
code .env
```

---

## 🔌 Extensões Essenciais

As seguintes extensões serão sugeridas automaticamente:

### Desenvolvimento
- **ESLint**: Linting de JavaScript/TypeScript
- **Prettier**: Formatação automática de código
- **Tailwind CSS IntelliSense**: Autocomplete para classes Tailwind

### TypeScript
- **TypeScript Nightly**: Últimas features do TypeScript

### Banco de Dados
- **Prisma**: Syntax highlighting e autocomplete para schemas Prisma

### Git
- **GitLens**: Visualização avançada de histórico Git

### Testes
- **Jest**: Suporte para testes Jest
- **Playwright Test**: Suporte para testes E2E

### Utilidades
- **Path Intellisense**: Autocomplete de caminhos de arquivos
- **Auto Rename Tag**: Renomeia tags HTML/JSX automaticamente
- **Color Highlight**: Destaca cores no código
- **Error Lens**: Mostra erros inline
- **DotENV**: Syntax highlighting para arquivos .env

---

## ⚙️ Configurações do Workspace

O projeto inclui configurações otimizadas em `.vscode/settings.json`:

### Formatação Automática
- Código é formatado automaticamente ao salvar
- ESLint corrige problemas automaticamente ao salvar
- Usa Prettier como formatador padrão

### TypeScript
- Usa a versão do TypeScript do projeto (não a global)
- Import paths otimizados com alias `@/*`

### Exclusões
- `.next`, `node_modules`, `dist` são excluídos da busca e file watcher
- Melhora performance do VS Code

---

## 🐛 Debugging

### Debug do Next.js

Existem 3 configurações de debug disponíveis (pressione `F5` ou vá em Run > Start Debugging):

1. **Next.js: debug server-side**: Debug do código do servidor
2. **Next.js: debug client-side**: Debug do código do cliente (browser)
3. **Next.js: debug full stack**: Debug completo (servidor + cliente)

#### Como usar:
1. Coloque breakpoints no código clicando na margem esquerda do editor
2. Pressione `F5` e escolha a configuração de debug
3. O servidor será iniciado e o debugger será anexado

### Debug de Testes

#### Jest (Testes Unitários)
1. Abra o arquivo de teste que deseja debugar
2. Pressione `F5` e escolha "Jest: Debug Current Test"
3. O teste será executado em modo debug

#### Playwright (Testes E2E)
1. Pressione `F5` e escolha "Playwright: Debug Tests"
2. Os testes E2E serão executados em modo debug com UI do Playwright

---

## 📋 Tasks Disponíveis

Pressione `Ctrl+Shift+B` (ou `Cmd+Shift+B` no Mac) para ver todas as tasks disponíveis:

### Desenvolvimento
- **dev**: Inicia servidor de desenvolvimento (`npm run dev`)
- **build**: Build de produção
- **lint**: Executa ESLint

### Testes
- **test**: Executa testes unitários Jest
- **test:watch**: Executa Jest em modo watch
- **test:e2e**: Executa testes E2E Playwright

### Prisma
- **prisma:generate**: Gera Prisma Client
- **prisma:migrate**: Executa migrations
- **prisma:studio**: Abre Prisma Studio (interface visual do banco)
- **seed**: Popula banco com dados iniciais

### Docker
- **docker:up**: Inicia PostgreSQL com Docker Compose
- **docker:down**: Para serviços Docker

### Setup Completo
- **setup:dev**: Executa setup completo do ambiente (Docker + Prisma + Seed)

#### Como usar tasks:
1. Pressione `Ctrl+Shift+P` (ou `Cmd+Shift+P`)
2. Digite "Tasks: Run Task"
3. Escolha a task desejada

Ou use o atalho `Ctrl+Shift+B` para build tasks.

---

## 🔑 Atalhos Úteis

### Geral
- `Ctrl+P` / `Cmd+P`: Abrir arquivo rapidamente
- `Ctrl+Shift+P` / `Cmd+Shift+P`: Paleta de comandos
- `Ctrl+```: Abrir/fechar terminal
- `Ctrl+B` / `Cmd+B`: Mostrar/ocultar sidebar

### Navegação
- `F12`: Ir para definição
- `Alt+F12`: Peek definition (preview inline)
- `Shift+F12`: Encontrar todas as referências
- `Ctrl+T` / `Cmd+T`: Buscar símbolos no workspace

### Edição
- `Alt+Up/Down`: Mover linha para cima/baixo
- `Shift+Alt+Up/Down`: Duplicar linha
- `Ctrl+D` / `Cmd+D`: Selecionar próxima ocorrência
- `Ctrl+Shift+L` / `Cmd+Shift+L`: Selecionar todas as ocorrências
- `Ctrl+/` / `Cmd+/`: Comentar/descomentar linha

### Debug
- `F5`: Iniciar debugging
- `F9`: Toggle breakpoint
- `F10`: Step over
- `F11`: Step into
- `Shift+F11`: Step out

---

## 🔧 Solução de Problemas

### "TypeScript version mismatch"
```bash
# Pressione Ctrl+Shift+P e execute:
TypeScript: Select TypeScript Version... > Use Workspace Version
```

### "ESLint is not running"
```bash
# Pressione Ctrl+Shift+P e execute:
ESLint: Restart ESLint Server
```

### Imports não estão sendo resolvidos
```bash
# Regenere o Prisma Client
npm run generate

# Reinicie o TS Server
# Ctrl+Shift+P > TypeScript: Restart TS Server
```

### IntelliSense do Tailwind não funciona
1. Certifique-se que a extensão Tailwind CSS IntelliSense está instalada
2. Reinicie o VS Code

### "Cannot find module '@/...' "
1. Verifique se o `tsconfig.json` tem o path alias configurado
2. Execute `npm install` novamente
3. Reinicie o VS Code

---

## 📦 Primeiro Setup Completo

Siga estes passos para configurar o ambiente pela primeira vez:

```bash
# 1. Instalar dependências
npm install

# 2. Copiar e configurar .env
cp .env.example .env
# Edite o .env se necessário

# 3. Iniciar PostgreSQL (escolha uma opção)
docker-compose up -d
# OU use a task "docker:up"

# 4. Setup do banco de dados
npm run generate    # Gera Prisma Client
npm run migrate     # Cria tabelas
npm run seed        # Popula dados iniciais

# 5. Iniciar servidor de desenvolvimento
npm run dev
```

Ou use a task `setup:dev` que faz tudo automaticamente!

---

## 🎯 Produtividade

### Multi-cursor
- `Alt+Click`: Adicionar cursor
- `Ctrl+Alt+Up/Down`: Adicionar cursor acima/abaixo
- `Ctrl+Shift+L`: Cursor em todas as ocorrências selecionadas

### Snippets React/TypeScript
- `rafce`: React Arrow Function Component Export
- `useEffect`: Hook useEffect
- `useState`: Hook useState

### Zen Mode
- Pressione `Ctrl+K Z` para ativar modo Zen (tela cheia sem distrações)
- Pressione `Esc Esc` para sair

---

## 🌐 Recursos Adicionais

### Documentação Oficial
- [Next.js](https://nextjs.org/docs)
- [Prisma](https://www.prisma.io/docs)
- [TailwindCSS](https://tailwindcss.com/docs)
- [TypeScript](https://www.typescriptlang.org/docs)

### VS Code
- [VS Code Tips & Tricks](https://code.visualstudio.com/docs/getstarted/tips-and-tricks)
- [Debugging in VS Code](https://code.visualstudio.com/docs/editor/debugging)

---

## 💡 Dicas Finais

1. **Use o Terminal Integrado**: `Ctrl+`` abre o terminal dentro do VS Code
2. **GitLens**: Hover sobre linhas de código para ver histórico Git inline
3. **Error Lens**: Mostra erros diretamente na linha de código
4. **Auto Save**: Considere ativar em File > Auto Save
5. **Prettier**: Certifique-se que funciona bem com seu linter

---

## 🆘 Suporte

Se encontrar problemas:

1. Verifique se todas as extensões recomendadas estão instaladas
2. Reinicie o VS Code
3. Execute `npm install` novamente
4. Limpe o cache: Delete `.next`, `node_modules` e rode `npm install`
5. Verifique o arquivo `.env` está configurado corretamente

---

**Bom desenvolvimento! 🚀**
