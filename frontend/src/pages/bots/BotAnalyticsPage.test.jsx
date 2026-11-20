/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AdFunnel, NodeFunnel } from './BotAnalyticsPage';

jest.mock('../../services/api', () => ({ botAPI: {} }));
jest.mock('recharts', () => ({}));

describe('NodeFunnel', () => {
  it('shows entered / went on / waiting / dropped off per step', () => {
    render(<NodeFunnel rows={[
      { node_id: 'start', node_type: 'start', label: 'Start', summary: '', in_current_version: true,
        entered: 40, exited: 40, waiting: 0, dropped_off: 0, drop_off_rate: 0 },
      { node_id: 'ask', node_type: 'ask_question', label: 'Ask', summary: 'Your name?', in_current_version: true,
        entered: 40, exited: 25, waiting: 5, dropped_off: 10, drop_off_rate: 25 },
      { node_id: 'old', node_type: '', label: 'Removed node', summary: '', in_current_version: false,
        entered: 3, exited: 3, waiting: 0, dropped_off: 0, drop_off_rate: 0 },
    ]} />);
    const row = screen.getByText('Your name?').closest('tr');
    expect(within(row).getByText('Ask Question')).toBeInTheDocument();
    expect(within(row).getByText('25')).toBeInTheDocument();
    expect(within(row).getByText('5')).toBeInTheDocument();
    expect(within(row).getByText('10 · 25%')).toBeInTheDocument();
    expect(screen.getByText('older version')).toBeInTheDocument();
  });

  it('has an empty state', () => {
    render(<NodeFunnel rows={[{ node_id: 'start', node_type: 'start', in_current_version: true,
                                 entered: 0, exited: 0, waiting: 0, dropped_off: 0 }]} />);
    expect(screen.getByText('No conversations in this period yet.')).toBeInTheDocument();
  });
});

describe('AdFunnel', () => {
  const funnel = {
    campaigns: [{
      id: 7, name: 'Diwali offer', is_active: true, clicks: 50, conversations: 3, leads: 2, converted: 1,
      spent: 1000, click_to_conversation_rate: 6, conversation_to_lead_rate: 66.7, lead_to_converted_rate: 50,
      cost_per_lead: 500, cost_per_conversion: 1000,
    }],
    totals: { clicks: 50, conversations: 3, leads: 2, converted: 1, spent: 1000, cost_per_lead: 500 },
  };

  it('shows the funnel with cost per lead', () => {
    render(<MemoryRouter><AdFunnel funnel={funnel} /></MemoryRouter>);
    const row = screen.getByRole('link', { name: 'Diwali offer' }).closest('tr');
    expect(within(row).getByText('66.7%')).toBeInTheDocument();
    expect(within(row).getByText('₹500')).toBeInTheDocument();
    expect(within(row).getAllByText('₹1,000')).toHaveLength(2);   // spend and cost per conversion
    expect(screen.getByText('Cost per lead')).toBeInTheDocument();
  });

  it('shows a dash when there is nothing to divide by, and an empty state', () => {
    const none = { ...funnel, campaigns: [{ ...funnel.campaigns[0], leads: 0, cost_per_lead: null,
                                             conversation_to_lead_rate: null, lead_to_converted_rate: null,
                                             cost_per_conversion: null }] };
    const { rerender } = render(<MemoryRouter><AdFunnel funnel={none} /></MemoryRouter>);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
    rerender(<MemoryRouter><AdFunnel funnel={{ campaigns: [], totals: {} }} /></MemoryRouter>);
    expect(screen.getByText('No Click-to-WhatsApp campaign is linked to this flow.')).toBeInTheDocument();
  });
});
