import { test, expect } from '@playwright/test';

// Variáveis de ambiente para login automático na página /tests
const TEST_EMAIL = process.env.VITE_TEST_EMAIL;
const TEST_PASSWORD = process.env.VITE_TEST_PASSWORD;

// Helper: aguarda o resumo aparecer e extrai métricas
async function getSummaryText(page) {
  await page.getByText('Resumo').waitFor({ state: 'visible' });
  const card = await page.locator('text=Resumo').locator('..').locator('..');
  const summary = await card.locator('div:has-text("Total:")').first().innerText();
  return summary;
}

// Helper: aciona export JSON e captura o conteúdo do textarea do modal
async function exportJsonFromUI(page) {
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible();
  const jsonText = await textarea.inputValue();
  // fecha modal
  await page.getByRole('button', { name: 'Fechar' }).click();
  return jsonText;
}

// Teste único: executa a suíte /tests com autorun e concorrência 3, valida sem falhas, coleta artefatos
test('Executa /tests (autorun=1&c=3) e coleta artefatos', async ({ page }, testInfo) => {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'VITE_TEST_EMAIL e VITE_TEST_PASSWORD são obrigatórios para a suíte completa');

  await page.goto('/tests?autorun=1&c=3');

  // Aguarda conclusão: quando a tabela possuir 36 linhas PASS (ajuste se a contagem variar)
  await page.waitForFunction(() => {
    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    if (!rows.length) return false;
    const pass = rows.filter(r => r.textContent?.includes('PASS')).length;
    const fail = rows.filter(r => r.textContent?.includes('FAIL')).length;
    const running = document.querySelector('button:has-text("Parar")') !== null; // ainda executando
    return pass >= 1 && fail === 0 && !running; // condição flexível para finalizar
  }, { timeout: 240_000 });

  const summary = await getSummaryText(page);
  // Valida que não há FAIL no resumo
  expect(summary).toMatch(/Fail: 0/);

  // Exporta JSON por UI
  const jsonText = await exportJsonFromUI(page);
  await testInfo.attach('system-tests.json', { body: jsonText, contentType: 'application/json' });

  // Exporta CSV por UI (gera download); aceita o download e anexa
  const [ download ] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV' }).click(),
  ]);
  const csv = await download.createReadStream();
  if (csv) {
    const chunks: Uint8Array[] = [];
    for await (const chunk of csv) chunks.push(chunk as Uint8Array);
    const buffer = Buffer.concat(chunks);
    await testInfo.attach('system-tests.csv', { body: buffer, contentType: 'text/csv' });
  }
});