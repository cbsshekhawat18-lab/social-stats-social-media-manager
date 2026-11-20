/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { fireEvent, render, screen } from '@testing-library/react';

import ValidationPanel from './ValidationPanel';

const noop = () => {};

describe('ValidationPanel', () => {
  it('lists errors before warnings and focuses a node on request', () => {
    const onFocus = jest.fn();
    render(
      <ValidationPanel
        result={{
          ok: false,
          errors: [
            { node_id: 'w1', level: 'warning', message: 'This wait is longer than 24 hours.' },
            { node_id: 'b1', level: 'error', message: 'WhatsApp allows at most 3 buttons; this node has 4.' },
            { node_id: null, level: 'error', message: 'The flow needs a Start node.' },
          ],
        }}
        onClose={noop} onRecheck={noop} onFocus={onFocus}
      />,
    );
    expect(screen.getByText('2 problems to fix before publishing')).toBeInTheDocument();
    expect(screen.getByText('and 1 warning')).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(rows[0]).toContain('at most 3 buttons');
    expect(rows[2]).toContain('longer than 24 hours');
    // Flow-level issues have no node to show.
    const buttons = screen.getAllByRole('button', { name: 'Show node' });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    expect(onFocus).toHaveBeenCalledWith('b1');
  });

  it('shows warnings without blocking wording, and the all-clear state', () => {
    const { rerender } = render(
      <ValidationPanel
        result={{ ok: true, errors: [{ node_id: 'a', level: 'warning', message: 'Loop never waits.' }] }}
        onClose={noop} onRecheck={noop} onFocus={noop}
      />,
    );
    expect(screen.getByText('No blocking problems — 1 warning')).toBeInTheDocument();
    rerender(
      <ValidationPanel result={{ ok: true, errors: [], node_count: 4, edge_count: 3 }}
                       onClose={noop} onRecheck={noop} onFocus={noop} />,
    );
    expect(screen.getByText('Flow looks good — 4 nodes, 3 connections.')).toBeInTheDocument();
  });

  it('still renders the older string-only issue list', () => {
    render(<ValidationPanel result={{ ok: false, issues: ['flow needs a start node'] }}
                            onClose={noop} onRecheck={noop} onFocus={noop} />);
    expect(screen.getByText('flow needs a start node')).toBeInTheDocument();
  });
});
