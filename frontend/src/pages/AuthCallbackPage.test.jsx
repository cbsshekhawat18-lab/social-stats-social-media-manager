/**
 * Social login hands the SPA a one-time ?code=, never the JWTs. The page
 * must clear it from the URL, exchange it exactly once, and load the user.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import AuthCallbackPage from './AuthCallbackPage';
import { authAPI } from '../services/api';

jest.mock('../services/api', () => ({
  authAPI: { socialExchange: jest.fn() },
}));

const mockRefreshAuth = jest.fn();
jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ refreshAuth: mockRefreshAuth }),
}));

function LoginStub() {
  const location = useLocation();
  return <div>login page {location.state?.mfaToken || ''}</div>;
}

function renderAt(search) {
  window.history.pushState({}, '', `/auth/callback${search}`);
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={['/auth/callback']}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/dashboard" element={<div>dashboard</div>} />
          <Route path="/login" element={<LoginStub />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('exchanges the code once, clears it from the URL and loads the user', async () => {
    authAPI.socialExchange.mockResolvedValue({ data: { access: 'acc', refresh: 'ref' } });
    mockRefreshAuth.mockResolvedValue({ role: 'client', client_id: 7, onboarding_complete: true });

    renderAt('?code=one-time-code');

    expect(window.location.search).toBe('');
    expect(await screen.findByText('dashboard')).toBeInTheDocument();
    expect(authAPI.socialExchange).toHaveBeenCalledTimes(1);   // despite StrictMode
    expect(authAPI.socialExchange).toHaveBeenCalledWith('one-time-code');
    expect(mockRefreshAuth).toHaveBeenCalledWith('acc', 'ref');
  });

  it('hands an MFA handshake to the login page', async () => {
    authAPI.socialExchange.mockResolvedValue({ data: { mfa_required: true, mfa_token: 'mfa-123' } });

    renderAt('?code=c');

    expect(await screen.findByText('login page mfa-123')).toBeInTheDocument();
    expect(mockRefreshAuth).not.toHaveBeenCalled();
  });

  it('shows an error when the exchange fails', async () => {
    authAPI.socialExchange.mockRejectedValue(new Error('400'));

    renderAt('?code=used-already');

    expect(await screen.findByText(/Authentication failed/)).toBeInTheDocument();
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  it('never reads tokens from the URL', async () => {
    renderAt('?access=leaked&refresh=leaked');

    expect(await screen.findByText(/Missing sign-in code/)).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe(''));
    expect(authAPI.socialExchange).not.toHaveBeenCalled();
    expect(localStorage.getItem('access_token')).toBeNull();
  });
});
