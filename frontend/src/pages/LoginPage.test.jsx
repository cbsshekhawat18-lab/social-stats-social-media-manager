/**
 * The one-click demo logins (password "demo", incl. a superadmin) must only
 * render when the bundle is built with REACT_APP_SHOW_DEMO=true.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import LoginPage from './LoginPage';

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ login: jest.fn(), loginMfa: jest.fn() }),
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage demo logins', () => {
  const original = process.env.REACT_APP_SHOW_DEMO;

  afterEach(() => {
    if (original === undefined) delete process.env.REACT_APP_SHOW_DEMO;
    else process.env.REACT_APP_SHOW_DEMO = original;
  });

  it('are hidden by default', () => {
    delete process.env.REACT_APP_SHOW_DEMO;
    renderLogin();
    expect(screen.queryByTestId('demo-logins')).not.toBeInTheDocument();
    expect(screen.queryByText('admin@demo.local')).not.toBeInTheDocument();
  });

  it('stay hidden for any value other than "true"', () => {
    process.env.REACT_APP_SHOW_DEMO = '1';
    renderLogin();
    expect(screen.queryByTestId('demo-logins')).not.toBeInTheDocument();
  });

  it('render when REACT_APP_SHOW_DEMO=true', () => {
    process.env.REACT_APP_SHOW_DEMO = 'true';
    renderLogin();
    expect(screen.getByTestId('demo-logins')).toBeInTheDocument();
    expect(screen.getByText('admin@demo.local')).toBeInTheDocument();
  });
});
