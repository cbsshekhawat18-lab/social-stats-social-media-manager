/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import WhatsAppSettingsPage, { describeError } from './WhatsAppSettingsPage';
import { useWhatsAppAccount } from '../hooks/useWhatsApp';
import { whatsappAPI } from '../services/api';

jest.mock('../services/api', () => ({
  whatsappAPI: {
    providers: jest.fn(),
    account: {
      create: jest.fn(), update: jest.fn(), delete: jest.fn(),
      testConnection: jest.fn(), syncStatus: jest.fn(), rotateWebhookToken: jest.fn(),
    },
  },
}));
jest.mock('../hooks/useWhatsApp', () => ({ useWhatsAppAccount: jest.fn() }));
jest.mock('../components/layout/PageHeader', () => ({ title }) => <h1>{title}</h1>);

const PINBOT_ACCOUNT = {
  id: 7, provider: 'pinbot', provider_label: 'Pinbot',
  waba_id: 'W1', phone_number_id: 'PN1', phone_number: '+919800000001', display_name: 'Shop',
  api_base_url: '', auth_header: '', auth_scheme: '',
  has_api_key: true, has_app_secret: false,
  webhook_url: 'https://api.example.com/api/whatsapp/webhook/abc123/',
  webhook_auth: 'header', webhook_verify_token: 'tok-secret',
  quality_rating: 'GREEN', messaging_tier: 'TIER_1K', last_synced_at: null, updated_at: '2026-11-20T10:00:00Z',
};

const refetch = jest.fn();

function mount(account = null) {
  useWhatsAppAccount.mockReturnValue({ account, loading: false, refetch });
  return render(<WhatsAppSettingsPage />);
}

describe('WhatsAppSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    refetch.mockResolvedValue();
    whatsappAPI.providers.mockRejectedValue(new Error('offline'));   // built-in list is used
  });

  it('offers every provider and connects Meta Cloud API with its own fields', async () => {
    whatsappAPI.account.create.mockResolvedValue({ data: {} });
    mount();
    expect(screen.getByRole('radio', { name: /Meta WhatsApp Cloud API/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Pinbot/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Other provider/ })).toBeInTheDocument();
    expect(screen.queryByLabelText(/API base URL/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('WABA ID'), { target: { value: ' 111 ' } });
    fireEvent.change(screen.getByLabelText('Phone Number ID'), { target: { value: '222' } });
    fireEvent.change(screen.getByLabelText(/Access token/), { target: { value: 'EAAG' } });
    fireEvent.change(screen.getByLabelText(/App Secret/), { target: { value: 'shh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => expect(whatsappAPI.account.create).toHaveBeenCalledTimes(1));
    expect(whatsappAPI.account.create.mock.calls[0][0]).toEqual({
      provider: 'meta_cloud', waba_id: '111', phone_number_id: '222', phone_number: '', display_name: '',
      api_key: 'EAAG', app_secret: 'shh',
    });
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it('asks for a base URL and auth header for a custom provider', async () => {
    whatsappAPI.account.create.mockResolvedValue({ data: {} });
    mount();
    fireEvent.click(screen.getByRole('radio', { name: /Other provider/ }));
    fireEvent.change(screen.getByLabelText(/API base URL/), { target: { value: 'https://waba.example.com/v1' } });
    fireEvent.change(screen.getByLabelText(/Auth header/), { target: { value: 'X-API-Key' } });
    fireEvent.change(screen.getByLabelText(/Auth scheme/), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/API key \/ token/), { target: { value: 'c-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => expect(whatsappAPI.account.create).toHaveBeenCalledTimes(1));
    expect(whatsappAPI.account.create.mock.calls[0][0]).toMatchObject({
      provider: 'custom', api_base_url: 'https://waba.example.com/v1',
      auth_header: 'X-API-Key', auth_scheme: '', api_key: 'c-key',
    });
  });

  it('shows the workspace webhook and never sends a blank key on update', async () => {
    whatsappAPI.account.update.mockResolvedValue({ data: {} });
    mount(PINBOT_ACCOUNT);
    expect(await screen.findByDisplayValue('Shop')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Pinbot/ })).toBeChecked();
    expect(screen.getByLabelText('Callback URL')).toHaveValue(PINBOT_ACCOUNT.webhook_url);
    expect(screen.getByLabelText('Verify token')).toHaveAttribute('type', 'password');
    expect(screen.getByText('X-Webhook-Secret')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'New name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(whatsappAPI.account.update).toHaveBeenCalledTimes(1));
    const [id, payload] = whatsappAPI.account.update.mock.calls[0];
    expect(id).toBe(7);
    expect(payload).toMatchObject({ provider: 'pinbot', display_name: 'New name' });
    expect(payload).not.toHaveProperty('api_key');
    expect(payload).not.toHaveProperty('app_secret');
  });

  it('warns that the key must be re-entered when switching provider', async () => {
    mount(PINBOT_ACCOUNT);
    await screen.findByDisplayValue('Shop');
    expect(screen.queryByText(/Switching provider/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Meta WhatsApp Cloud API/ }));
    expect(screen.getByText(/Switching provider/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Test Connection' })).toBeDisabled();
  });

  it('shows server validation errors in plain words', async () => {
    whatsappAPI.account.create.mockRejectedValue({
      response: { data: { app_secret: ['Enter the App Secret of your Meta app.'] } },
    });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('App Secret: Enter the App Secret of your Meta app.');
  });

  it('describeError handles every response shape', () => {
    expect(describeError({ response: { data: { detail: 'Nope' } } })).toBe('Nope');
    expect(describeError({ response: { data: { api_key: ['Required.'], non_field_errors: ['Bad.'] } } }))
      .toBe('API key: Required.\nBad.');
    expect(describeError({ message: 'Network Error' })).toBe('Network Error');
  });
});
