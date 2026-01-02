// ===========================================================
// Testes E2E: Painel Admin
// ===========================================================

import { test, expect } from '@playwright/test';

test.describe('Admin Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
  });

  test('deve exibir título do painel', async ({ page }) => {
    await expect(page.getByText(/Painel Administrativo|Admin/i)).toBeVisible();
  });

  test('deve exibir calendário FullCalendar', async ({ page }) => {
    // Aguarda carregamento do FullCalendar
    await page.waitForTimeout(2000);
    
    // FullCalendar adiciona elementos com classe fc
    await expect(page.locator('.fc').first()).toBeVisible();
  });

  test('deve ter botão de atualizar', async ({ page }) => {
    await page.waitForTimeout(1000);
    const atualizarBtn = page.getByRole('button', { name: /Atualizar/i });
    await expect(atualizarBtn).toBeVisible();
  });

  test('deve exibir estatísticas', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Verifica cards de estatísticas
    await expect(page.getByText(/Total|Reservas/i)).toBeVisible();
    await expect(page.getByText(/Confirmad/i)).toBeVisible();
    await expect(page.getByText(/Pendente/i)).toBeVisible();
  });

  test('deve exibir filtros', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Filtro de consultório
    await expect(page.getByText('Consultório')).toBeVisible();
    
    // Filtro de status
    await expect(page.getByText('Status')).toBeVisible();
  });

  test('deve exibir legenda de cores', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    await expect(page.getByText('Legenda')).toBeVisible();
    await expect(page.getByText(/Confirmado/i)).toBeVisible();
    await expect(page.getByText(/Pendente/i)).toBeVisible();
    await expect(page.getByText(/Cancelado/i)).toBeVisible();
  });

  test('calendário deve ter navegação funcional', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Botões de navegação prev/next
    const prevBtn = page.locator('.fc-prev-button');
    const nextBtn = page.locator('.fc-next-button');
    
    await expect(prevBtn).toBeVisible();
    await expect(nextBtn).toBeVisible();
    
    // Clica em next
    await nextBtn.click();
    await page.waitForTimeout(500);
  });

  test('calendário deve permitir mudar view', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Botão de mês (dayGridMonth)
    const mesBtn = page.locator('.fc-dayGridMonth-button');
    if (await mesBtn.isVisible()) {
      await mesBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator('.fc-dayGridMonth-view')).toBeVisible();
    }
  });
});
