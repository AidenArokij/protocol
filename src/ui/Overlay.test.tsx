import { act, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/renderApp';

describe('overlay', () => {
  it('opens with the brand and the cursor in the search field', async () => {
    await renderApp();
    // Direction C: the head names the server.
    expect(screen.getByText('Тверской', { selector: '.brand' })).toBeInTheDocument();
    // The field takes the focus in an effect, which a loaded test machine may run a moment after the field appears.
    await vi.waitFor(() => expect(screen.getByRole('searchbox', { name: 'Поиск по законам' })).toHaveFocus());
  });

  it('puts the cursor back in the search field when the overlay is shown again', async () => {
    const { platform } = await renderApp();
    const search = screen.getByRole('searchbox', { name: 'Поиск по законам' });
    search.blur();
    expect(search).not.toHaveFocus();

    await act(() => platform.showOverlay());
    expect(search).toHaveFocus();
  });

  it('hides the overlay through the platform', async () => {
    const { platform, user } = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Скрыть оверлей' }));
    expect(platform.state.overlayVisible).toBe(false);
  });
});
