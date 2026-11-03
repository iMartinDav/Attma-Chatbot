import { fireEvent, render, screen } from '@testing-library/react';

import { TrustCard } from '../trust-card';

describe('TrustCard', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows a checking message, the nucleotide letters, and the review link', () => {
    render(<TrustCard />);
    expect(screen.getByText('Attma checks its own work')).toBeInTheDocument();
    expect(
      screen.getByText(/Every number in a report is checked/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute(
      'href',
      '/console',
    );
    expect(screen.getAllByText(/^[AGCT]$/).length).toBeGreaterThan(10);
  });

  it('stays dismissed after the close button is used', () => {
    render(<TrustCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss this card' }));
    expect(
      screen.queryByText('Attma checks its own work'),
    ).not.toBeInTheDocument();
    expect(window.localStorage.getItem('attma-trust-card-dismissed')).toBe('1');
  });
});
