// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import InsightLine from './InsightLine';
import { summariseMonth } from '../lib/spending';

const tx = (date, amount, category_name = 'Groceries') => ({ date, amount, category_name });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-20T12:00:00'));
});
afterEach(() => vi.useRealTimers());

describe('InsightLine', () => {
  it('describes the current month like for like, in a polite live region', () => {
    const summary = summariseMonth([tx('2026-11-04', '-300.00'), tx('2026-10-10', '-200.00'), tx('2026-10-25', '-400.00')], '2026-11');
    render(<InsightLine summary={summary} />);
    const line = screen.getByTestId('insight-line');
    expect(line).toHaveTextContent('Groceries: £300 so far this month, 50% more than by the same day last month.');
    expect(line).toHaveAttribute('aria-live', 'polite');
  });

  it('describes a finished month against the month before', () => {
    render(<InsightLine summary={summariseMonth([tx('2026-10-05', '-90.00'), tx('2026-09-05', '-100.00')], '2026-10')} />);
    expect(screen.getByTestId('insight-line')).toHaveTextContent('Groceries: £90 in October, 10% less than in September.');
  });

  it('handles a single category with nothing to compare against', () => {
    render(<InsightLine summary={summariseMonth([tx('2026-11-02', '-9.99', 'Subscriptions')], '2026-11')} />);
    expect(screen.getByTestId('insight-line')).toHaveTextContent(
      'Subscriptions is the largest spending category so far this month (£9.99). No spending was recorded by the same day last month.'
    );
  });

  it('renders nothing for a month with no spending, or no summary yet', () => {
    const { container, rerender } = render(<InsightLine summary={summariseMonth([tx('2026-11-01', '2100.00', 'Income')], '2026-11')} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<InsightLine summary={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('never contains advice or a value judgement', () => {
    const cases = [
      [tx('2026-11-05', '-900.00'), tx('2026-10-05', '-30.00')],
      [tx('2026-11-05', '-1.00'), tx('2026-10-05', '-900.00')],
    ];
    for (const list of cases) {
      const { unmount } = render(<InsightLine summary={summariseMonth(list, '2026-11')} />);
      expect(screen.getByTestId('insight-line').textContent)
        .not.toMatch(/\b(should|consider|try|save|budget|recommend|advice|cut back|nice|well done|great|warning)\b/i);
      unmount();
    }
  });
});
