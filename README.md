# 🏥 Espaço Arthemi - Coworking de Saúde

MVP funcional para o site do Espaço Arthemi, um coworking especializado em profissionais de saúde.

## 📋 Índice

- [Funcionalidades](#-funcionalidades)
- [Stack Tecnológica](#-stack-tecnológica)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Rodando o Projeto](#-rodando-o-projeto)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [API Endpoints](#-api-endpoints)
- [Testes](#-testes)
- [Regras de Negócio](#-regras-de-negócio)

---

## ✨ Funcionalidades

### MVP Implementado

- ✅ **Listagem pública de 3 salas** (Sala A/B/C) com fotos e preços V3
- ✅ **Sistema de reservas** com validação de disponibilidade server-side
- ✅ **Frontend de reserva** com seletor de data/hora
- ✅ **Integração MercadoPago** (com modo mock para desenvolvimento)
- ✅ **Painel Admin** com calendário FullCalendar
- ✅ **Regras de negócio essenciais**:
  - Validade de pacotes (90/180 dias)
  - Turnos fixos (4 semanas)
  - Créditos por sublocação (50% do valor)
  - Limite de 1 crédito/mês
- ✅ **Seed com dados iniciais**
- ✅ **Testes unitários e E2E**
- ✅ **CI/CD com GitHub Actions**

---

## 🛠 Stack Tecnológica

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Next.js | 14 | Framework React (Pages Router) |
| TypeScript | 5.x | Tipagem estática |
| TailwindCSS | 3.4 | Estilização |
| Prisma | 6.x | ORM |
| PostgreSQL | 15+ | Banco de dados |
| MercadoPago | 2.x | Pagamentos |
| FullCalendar | 6.x | Calendário admin |
| Jest | 29.x | Testes unitários |
| Playwright | 1.x | Testes E2E |
| Zod | 3.x | Validação de schemas |

---

## 📦 Pré-requisitos

- Node.js 18+ (recomendado 20 LTS)
- npm ou yarn
- PostgreSQL 15+ **OU** Docker

---

## 🚀 Instalação

```bash
# Clonar repositório
git clone <repo-url>
cd arthemi-site

# Instalar dependências
npm install

# Copiar variáveis de ambiente
cp .env.example .env
```

---

## ⚙️ Configuração

### Variáveis de Ambiente (.env)

```env
# Banco de Dados
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/arthemi?schema=public"

# App
NEXT_PUBLIC_URL="http://localhost:3000"

# MercadoPago (opcional - funciona em modo mock sem isso)
MERCADOPAGO_ACCESS_TOKEN=""

# Modo de pagamento simulado (true para desenvolvimento)
MOCK_PAYMENTS="true"
```

---

## 🐘 Banco de Dados

### Opção 1: Docker Compose (Recomendado)

```bash
# Subir PostgreSQL com Docker Compose
docker-compose up -d

# Verificar se está rodando
docker-compose ps
```

### Opção 2: Docker direto

```bash
docker run --name arthemi-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=arthemi \
  -p 5432:5432 \
  -d postgres:15
```

### Opção 3: PostgreSQL local

Configure sua instalação local e atualize `DATABASE_URL` no `.env`

---

## ▶️ Rodando o Projeto

```bash
# 1. Gerar cliente Prisma
npx prisma generate

# 2. Rodar migrations
npm run migrate
# ou: npx prisma migrate dev

# 3. Popular banco com dados de teste
npm run seed

# 4. Iniciar servidor de desenvolvimento
npm run dev
```

Acesse:
- **Home**: http://localhost:3000
- **Salas**: http://localhost:3000/salas
- **Admin**: http://localhost:3000/admin

---

## 📁 Estrutura do Projeto

```
arthemi-site/
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions CI/CD
├── __tests__/                  # Testes unitários Jest
│   ├── business-rules.test.ts
│   ├── utils.test.ts
│   └── validations.test.ts
├── e2e/                        # Testes E2E Playwright
│   ├── admin.spec.ts
│   ├── home.spec.ts
│   └── reservar.spec.ts
├── prisma/
│   ├── schema.prisma           # Schema do banco
│   ├── seed.js                 # Dados iniciais (JS)
│   └── seed.ts                 # Dados iniciais (TS)
├── src/
│   ├── components/
│   │   ├── BookingModal.tsx    # Modal de reserva
│   │   └── RoomCard.tsx        # Card de sala
│   ├── lib/
│   │   ├── availability.ts     # Verificação de disponibilidade
│   │   ├── business-rules.ts   # Regras de negócio
│   │   ├── mercadopago.ts      # Cliente MercadoPago
│   │   ├── prisma.ts           # Cliente Prisma
│   │   ├── utils.ts            # Utilitários
│   │   └── validations.ts      # Schemas Zod
│   ├── pages/
│   │   ├── api/
│   │   │   ├── admin/
│   │   │   │   └── bookings/   # API admin
│   │   │   ├── bookings/       # CRUD reservas
│   │   │   ├── mock-payment.ts # Simular pagamento
│   │   │   └── payments/       # Integração pagamento
│   │   ├── admin/
│   │   │   └── index.tsx       # Painel admin
│   │   ├── booking/
│   │   │   ├── failure.tsx
│   │   │   ├── pending.tsx
│   │   │   └── success.tsx
│   │   ├── _app.tsx            # Root component
│   │   ├── index.tsx           # Home
│   │   ├── mock-payment.tsx    # Simulador de pagamento
│   │   └── salas.tsx           # Lista de salas
│   └── styles/
│       └── globals.css         # Estilos globais
├── .env.example
├── docker-compose.yml
├── jest.config.ts
├── package.json
├── playwright.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## 🔌 API Endpoints

### Salas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/rooms` | Lista todas as salas |

### Reservas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/bookings` | Lista reservas |
| POST | `/api/bookings` | Cria nova reserva |
| GET | `/api/bookings/[id]` | Detalhes de uma reserva |

### Pagamentos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/payments/create` | Cria preferência de pagamento |
| POST | `/api/payments/webhook` | Webhook MercadoPago |
| POST | `/api/mock-payment` | Processa pagamento mock |

### Admin

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/admin/bookings` | Lista reservas (admin) |
| PATCH | `/api/admin/bookings/[id]` | Atualiza status da reserva |

---

## 📝 Exemplo de Request

### Criar Reserva

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "sala-a-id-aqui",
    "userName": "Dr. João Silva",
    "userPhone": "11999999999",
    "userEmail": "joao@email.com",
    "startTime": "2025-12-20T10:00:00Z",
    "endTime": "2025-12-20T12:00:00Z",
    "productType": "HOURLY_RATE"
  }'
```

---

## 🧪 Testes

### Testes Unitários (Jest)

```bash
# Rodar todos os testes
npm test

# Modo watch
npm run test:watch

# Com cobertura
npm test -- --coverage
```

### Testes E2E (Playwright)

```bash
# Instalar browsers
npx playwright install

# Rodar testes E2E
npm run test:e2e

# Modo UI interativo
npm run test:e2e:ui
```

---

## 📊 Regras de Negócio

### Tabela de Preços V3 (Oficial)

#### Sala A - Grande (com maca)
| Produto | Preço | Horas |
|---------|-------|-------|
| Hora Avulsa | R$ 59,99 | 1h |
| Pacote 10h | R$ 559,90 | 10h |
| Pacote 20h | R$ 1.039,80 | 20h |
| Pacote 40h | R$ 1.959,60 | 40h |
| Turno Fixo Mensal | R$ 728,99 | 16h/mês |
| Diária | R$ 369,99 | 8h |
| Sábado Hora | R$ 64,99 | 1h |
| Sábado 5h | R$ 299,95 | 5h |

#### Sala B - Média (com maca)
| Produto | Preço | Horas |
|---------|-------|-------|
| Hora Avulsa | R$ 49,99 | 1h |
| Pacote 10h | R$ 459,90 | 10h |
| Pacote 20h | R$ 839,80 | 20h |
| Pacote 40h | R$ 1.559,60 | 40h |
| Turno Fixo Mensal | R$ 580,99 | 16h/mês |
| Diária | R$ 299,99 | 8h |
| Sábado Hora | R$ 53,99 | 1h |
| Sábado 5h | R$ 249,95 | 5h |

#### Sala C - Pequena (sem maca)
| Produto | Preço | Horas |
|---------|-------|-------|
| Hora Avulsa | R$ 39,99 | 1h |
| Pacote 10h | R$ 359,90 | 10h |
| Pacote 20h | R$ 659,80 | 20h |
| Pacote 40h | R$ 1.199,60 | 40h |
| Turno Fixo Mensal | R$ 446,99 | 16h/mês |
| Diária | R$ 229,99 | 8h |
| Sábado Hora | R$ 42,99 | 1h |
| Sábado 5h | R$ 199,95 | 5h |

### Créditos por Sublocação

- Profissional cede horário não usado → recebe 50% em crédito
- Limite: 1 crédito por mês por usuário
- Créditos expiram em 6 meses

### Cancelamento e Reagendamento

- Mínimo 24h de antecedência para cancelamento com reembolso
- Mínimo 24h de antecedência para reagendamento

---

## 🚀 Scripts Disponíveis

```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build de produção
npm run start        # Iniciar produção
npm run lint         # Executar ESLint
npm run migrate      # Migrations do Prisma
npm run seed         # Popular banco com dados
npm run db:studio    # Abrir Prisma Studio
npm test             # Testes unitários
npm run test:e2e     # Testes E2E
```

---

## 📄 Licença

Projeto privado - Espaço Arthemi © 2025
