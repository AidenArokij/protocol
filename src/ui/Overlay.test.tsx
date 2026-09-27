import { act, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/renderApp';

describe('overlay', () => {
  it('opens with the brand and the cursor in the search field', async () => {
    await renderApp();
    expect(screen.getByText('ПРОТОКОЛ')).toBeInTheDocument();
    // The settings load at start one after another; under a loaded test run the field may get the cursor a tick
    // after it appears (backlog ticket 10), so the test waits for it rather than checking the very first frame.
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
