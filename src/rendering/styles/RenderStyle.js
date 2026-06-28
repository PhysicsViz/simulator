export const RenderStyle = {
  colors: {
    canvasBackground: '#07111f',
    gridMinor: 'rgba(148, 163, 184, 0.09)',
    gridMajor: 'rgba(148, 163, 184, 0.18)',
    axis: 'rgba(226, 232, 240, 0.55)',
    axisLabel: 'rgba(226, 232, 240, 0.72)',
    positionVector: '#38bdf8',
    velocityVector: '#34d399',
    accelerationVector: '#fb7185',
    forceVector: '#c084fc',
    trajectory: 'rgba(56, 189, 248, 0.42)',
    selected: '#facc15',
    text: '#e5eefb',
    badgeBackground: 'rgba(15, 23, 42, 0.74)'
  },
  vectors: {
    velocityScale: 0.22,
    accelerationScale: 0.16,
    forceScale: 0.08,
    arrowHeadLength: 11,
    arrowHeadAngle: Math.PI / 7,
    lineWidth: 2.4,
    labelOffset: 12
  },
  grid: {
    minorStepMeters: 1,
    majorEvery: 5,
    axisWidth: 1.6
  },
  body: {
    outlineWidth: 2,
    selectedHaloWidth: 4
  },
  trajectory: {
    width: 2,
    maxAlpha: 0.55
  },
  typography: {
    font: '12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    labelFont: '600 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    badgeFont: '600 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  }
};
