import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/renderApp';

describe('«Частые вопросы»', () => {
  it('are a part of the settings; a question opens its answer', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Настройки' }));
    const settings = screen.getByRole('group', { name: 'Настройки' });
    expect(within(within(settings).getByRole('navigation', { name: 'Разделы настроек' })).getByRole('button', { name: 'Частые вопросы' })).toBeInTheDocument();

    const faq = within(settings).getByRole('region', { name: 'Частые вопросы' });
    const question = within(faq).getByText('Почему ассистента не видно поверх игры?');
    const item = question.closest('details')!;
    expect(item).not.toHaveAttribute('open');
    await user.click(question);
    expect(item).toHaveAttribute('open');
    expect(item).toHaveTextContent('Оконный без рамки');
  });
});
