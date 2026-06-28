export const AppConfig = {
  simulation: {
    fixedStep: 1 / 60,
    maxDt: 1 / 20,
    initialTimeScale: 1
  },
  camera: {
    pixelsPerMeter: 34,
    minPixelsPerMeter: 10,
    maxPixelsPerMeter: 140
  },
  bodies: {
    defaultMass: 1,
    defaultVisual: {
      radius: 12,
      color: '#38bdf8',
      showPositionVector: true,
      showVelocityVector: true,
      showAccelerationVector: true,
      showForces: true,
      showTrajectory: true
    }
  },
  trajectory: {
    maxPoints: 900
  }
};
