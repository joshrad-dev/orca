import { expect, type Page } from '@stablyai/playwright-test'

export async function chooseOnboardingUseCase(
  page: Page,
  useCase: 'everyday' | 'code' = 'code'
): Promise<void> {
  await expect(
    page.getByRole('heading', { name: 'What do you want to use Orca for?', exact: true })
  ).toBeVisible({ timeout: 30_000 })
  const option = page.getByRole('radio', {
    name: useCase === 'everyday' ? /^Everyday work/ : /^Code/
  })
  await option.click()
  await expect(option).toHaveAttribute('aria-checked', 'true')
  await page
    .locator('footer')
    .getByRole('button', { name: /^Continue\b/ })
    .click()
}

export async function chooseOnboardingAgentSurface(
  page: Page,
  surface: 'chat' | 'terminal' = 'terminal'
): Promise<void> {
  await expect(
    page.getByRole('heading', { name: 'How do you want to work with agents?', exact: true })
  ).toBeVisible({ timeout: 30_000 })
  const option = page.getByRole('radio', {
    name: surface === 'chat' ? /^Chat UI/ : /^Terminal/
  })
  await option.click()
  await expect(option).toHaveAttribute('aria-checked', 'true')
  await page
    .locator('footer')
    .getByRole('button', { name: /^Continue\b/ })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Pick your default agent', exact: true })
  ).toBeVisible()
}
