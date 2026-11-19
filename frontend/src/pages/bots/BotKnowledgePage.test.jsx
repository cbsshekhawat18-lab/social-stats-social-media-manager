/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import BotKnowledgePage from './BotKnowledgePage';
import { botKnowledgeAPI } from '../../services/api';

jest.mock('../../services/api', () => ({
  botKnowledgeAPI: {
    list: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), search: jest.fn(),
  },
}));
jest.mock('../../components/ui/toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

const DOC = { id: 1, title: 'Refund policy', content: 'Refunds within 15 days.', updated_at: '2026-11-19T10:00:00Z' };

describe('BotKnowledgePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    botKnowledgeAPI.list.mockResolvedValue({ data: { results: [DOC] } });
  });

  it('lists documents and adds a new one', async () => {
    botKnowledgeAPI.create.mockResolvedValue({ data: { id: 2 } });
    render(<BotKnowledgePage />);
    expect(await screen.findByText('Refund policy')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add document/i }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: ' Opening hours ' } });
    fireEvent.change(screen.getByLabelText('Content'), { target: { value: 'Open 10 to 7.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(botKnowledgeAPI.create).toHaveBeenCalledTimes(1));
    expect(botKnowledgeAPI.create.mock.calls[0][0]).toEqual({ title: 'Opening hours', content: 'Open 10 to 7.' });
    await waitFor(() => expect(botKnowledgeAPI.list).toHaveBeenCalledTimes(2));   // reloaded
  });

  it('previews what the AI would be given for a question', async () => {
    botKnowledgeAPI.search.mockResolvedValueOnce({
      data: { results: [{ doc_id: 1, title: 'Refund policy', text: 'Refunds within 15 days.', score: 2 }] },
    });
    render(<BotKnowledgePage />);
    await screen.findByText('Refund policy');
    fireEvent.change(screen.getByLabelText('Try a customer question'), { target: { value: 'refund?' } });
    fireEvent.click(screen.getByRole('button', { name: /see what the ai gets/i }));
    await waitFor(() => expect(botKnowledgeAPI.search).toHaveBeenCalledWith('refund?', undefined));
    // the document card plus the retrieved passage
    await waitFor(() => expect(screen.getAllByText('Refunds within 15 days.')).toHaveLength(2));

    botKnowledgeAPI.search.mockResolvedValueOnce({ data: { results: [] } });
    fireEvent.click(screen.getByRole('button', { name: /see what the ai gets/i }));
    expect(await screen.findByText(/Nothing matches/)).toBeInTheDocument();
  });
});
