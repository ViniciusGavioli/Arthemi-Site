// ===========================================================
// Testes E2E: Página de Salas/Reserva
// ===========================================================

import { test, expect } from '@playwright/test';

test.describe('Salas Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/salas');
  });

  test('deve exibir lista de salas', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Salas');
    
    // Aguarda carregamento das salas
    await page.waitForSelector('[data-testid="room-card"]', { timeout: 5000 }).catch(() => {
      // Se não tiver data-testid, busca por conteúdo
    });
    
    // Verifica se tem cards de sala (por conteúdo)
    await expect(page.getByText('Sala A').first()).toBeVisible();
  });

  test('deve exibir informações das salas', async ({ page }) => {
    // Aguarda carregamento
    await page.waitForTimeout(1000);
    
    // Verifica se mostra preço
    await expect(page.getByText(/R\$/)).toBeVisible();
    
    // Verifica botão de reservar
    await expect(page.getByRole('button', { name: /Reservar/i }).first()).toBeVisible();
  });

  test('deve abrir modal ao clicar em reservar', async ({ page }) => {
    // Aguarda carregamento
    await page.waitForTimeout(1000);
    
    // Clica em reservar na primeira sala
    await page.getByRole('button', { name: /Reservar/i }).first().click();
    
    // Modal deve aparecer
    await expect(page.getByRole('dialog').or(page.locator('[role="dialog"]')).or(page.locator('.modal'))).toBeVisible();
  });

  test('modal deve ter campos de formulário', async ({ page }) => {
    // Aguarda carregamento
    await page.waitForTimeout(1000);
    
    // Clica em reservar
    await page.getByRole('button', { name: /Reservar/i }).first().click();
    
    // Aguarda modal
    await page.waitForTimeout(500);
    
    // Verifica campos
    await expect(page.getByLabel(/nome/i).or(page.getByPlaceholder(/nome/i))).toBeVisible();
  });
});

test.describe('Fluxo de Reserva Completo', () => {
  test('deve completar fluxo até pagamento mock', async ({ page }) => {
    // 1. Vai para salas
    await page.goto('/salas');
    await page.waitForTimeout(1000);
    
    // 2. Clica em reservar
    await page.getByRole('button', { name: /Reservar/i }).first().click();
    await page.waitForTimeout(500);
    
    // 3. Preenche formulário
    await page.getByLabel(/nome/i).or(page.getByPlaceholder(/nome/i)).fill('Teste E2E');
    await page.getByLabel(/telefone/i).or(page.getByPlaceholder(/telefone/i)).fill('11999999999');
    
    // 4. Seleciona data (próximo dia disponível)
    const dateInput = page.getByLabel(/data/i).or(page.locator('input[type="date"]'));
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await dateInput.fill(tomorrow.toISOString().split('T')[0]);
    
    // 5. Envia formulário
    await page.getByRole('button', { name: /Confirmar|Reservar|Continuar/i }).click();
    
    // 6. Deve redirecionar para pagamento ou sucesso
    await page.waitForURL(/(mock-payment|booking\/success|booking\/pending)/, { timeout: 10000 });
  });
});
