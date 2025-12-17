// ===========================================================
// Testes E2E: Home Page
// ===========================================================

import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('deve exibir título da página', async ({ page }) => {
    await expect(page).toHaveTitle(/Espaço Arthemi/);
  });

  test('deve exibir conteúdo principal', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Espaço Arthemi');
  });

  test('deve ter link para salas', async ({ page }) => {
    const salasLink = page.getByRole('link', { name: /Ver Salas|Reservar/i }).first();
    await expect(salasLink).toBeVisible();
  });

  test('deve ter navegação funcional para página de salas', async ({ page }) => {
    await page.getByRole('link', { name: /Ver Salas|Reservar/i }).first().click();
    await expect(page).toHaveURL(/\/salas/);
  });
});
