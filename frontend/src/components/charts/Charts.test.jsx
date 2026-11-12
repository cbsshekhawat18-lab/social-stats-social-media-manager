/**
 * Render smoke test for the shared chart components against the installed
 * recharts major. jsdom has no layout, so ResponsiveContainer is replaced by
 * a fixed-size wrapper; everything else is the real library.
 */
import { render } from '@testing-library/react';

import MetricChart from '../ui/MetricChart';
import {
  EngagementChart, ImpressionsChart, PlatformCompareChart, VideoViewsChart,
} from './Charts';

jest.mock('recharts', () => {
  const React = require('react');
  const actual = jest.requireActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }) => React.cloneElement(children, { width: 640, height: 300 }),
  };
});

beforeAll(() => {
  if (typeof global.ResizeObserver === 'undefined') {
    global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  }
});

const daily = [
  { date: '2026-11-01', platform: 'facebook', impressions: 120, reach: 90, clicks: 4, likes: 12, video_views: 30, followers: 2 },
  { date: '2026-11-02', platform: 'facebook', impressions: 180, reach: 140, clicks: 6, likes: 20, video_views: 45, followers: 3 },
  { date: '2026-11-02', platform: 'instagram', impressions: 60, reach: 50, clicks: 1, likes: 9, video_views: 12, followers: 1 },
];

function expectChart(container) {
  expect(container.querySelector('svg.recharts-surface')).not.toBeNull();
}

describe('chart components render with the installed recharts', () => {
  it.each([
    ['ImpressionsChart', ImpressionsChart],
    ['EngagementChart', EngagementChart],
    ['VideoViewsChart', VideoViewsChart],
  ])('%s', (_name, Chart) => {
    const { container } = render(<Chart data={daily} platform="all" />);
    expectChart(container);
  });

  it('PlatformCompareChart draws one bar group per platform', () => {
    const { container } = render(
      <PlatformCompareChart byPlatform={[
        { platform: 'facebook', impressions: 300, clicks: 10, likes: 32 },
        { platform: 'instagram', impressions: 60, clicks: 1, likes: 9 },
      ]} />,
    );
    expectChart(container);
    expect(container.querySelectorAll('.recharts-bar').length).toBeGreaterThan(0);
  });

  it.each(['line', 'area', 'bar'])('MetricChart type=%s', (type) => {
    const { container } = render(
      <MetricChart
        type={type}
        showLegend
        data={[{ x: 'Mon', value: 3, other: 1 }, { x: 'Tue', value: 5, other: 2 }]}
        series={[{ key: 'value', name: 'Value' }, { key: 'other' }]}
      />,
    );
    expectChart(container);
  });
});
