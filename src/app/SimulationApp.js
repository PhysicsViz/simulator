import { AnimationLoop } from '../animation/AnimationLoop.js';
import { PhysicsWorld } from '../core/physics/world/PhysicsWorld.js';
import { MouseController } from '../input/MouseController.js';
import { SelectionController } from '../input/SelectionController.js';
import { Camera2D } from '../rendering/camera/Camera2D.js';
import { CanvasRenderer } from '../rendering/canvas/CanvasRenderer.js';
import { createFreeFallScene } from '../scenes/createFreeFallScene.js';
import { createMRUScene } from '../scenes/createMRUScene.js';
import { createProjectileScene } from '../scenes/createProjectileScene.js';
import { GraphPanel } from '../ui/panels/GraphPanel.js';
import { InspectorController } from '../ui/controllers/InspectorController.js';
import { ObjectCreationController } from '../ui/controllers/ObjectCreationController.js';
import { SimulationControlsController } from '../ui/controllers/SimulationControlsController.js';
import { AppConfig } from './AppConfig.js';

/**
 * Application composition root.
 */
export class SimulationApp {
  constructor(documentRoot) {
    this.document = documentRoot;
    this.elements = this.collectElements();
    this.world = new PhysicsWorld();
    this.camera = new Camera2D(AppConfig.camera);
    this.selectionController = new SelectionController(this.world);
    this.renderer = new CanvasRenderer(this.elements.canvas, this.world, this.camera);
    this.graphPanel = new GraphPanel({
      elements: this.elements,
      world: this.world,
      selectionController: this.selectionController
    });

    this.animationLoop = new AnimationLoop({
      fixedStep: AppConfig.simulation.fixedStep,
      maxDt: AppConfig.simulation.maxDt,
      timeScale: AppConfig.simulation.initialTimeScale,
      onStep: (dt) => this.world.step(dt),
      onRender: () => this.render(),
      onStateChange: (isRunning) => this.handleRunningStateChange(isRunning)
    });

    this.controlsController = new SimulationControlsController({
      elements: this.elements,
      callbacks: {
        onTogglePlay: () => this.animationLoop.toggle(),
        onStepOnce: () => this.animationLoop.stepOnce(),
        onReset: () => this.reset(),
        onClear: () => this.clearScene(),
        onAddBody: () => this.objectCreationController.createDefaultBody(),
        onLoadMRU: () => this.loadScene(createMRUScene),
        onLoadFreeFall: () => this.loadScene(createFreeFallScene),
        onLoadProjectile: () => this.loadScene(createProjectileScene),
        onTimeScaleChange: (timeScale) => this.animationLoop.setTimeScale(timeScale),
        onUseForcesChange: (useForces) => {
          this.world.useForces = useForces;
          this.render();
        },
        onDisplaySettingsChange: () => this.render()
      }
    });

    this.objectCreationController = new ObjectCreationController({
      world: this.world,
      selectionController: this.selectionController,
      camera: this.camera,
      onChange: () => this.render()
    });

    this.inspectorController = new InspectorController({
      elements: this.elements,
      world: this.world,
      selectionController: this.selectionController,
      onChange: () => this.render()
    });

    this.mouseController = new MouseController({
      canvas: this.elements.canvas,
      camera: this.camera,
      world: this.world,
      selectionController: this.selectionController,
      animationLoop: this.animationLoop,
      onChange: () => this.render()
    });

    this.selectionController.onChange(() => {
      this.inspectorController.render();
      this.graphPanel.render();
      this.render();
    });

    this.resizeObserver = new ResizeObserver(() => {
      this.renderer.resize();
      this.render();
    });
    this.resizeObserver.observe(this.elements.canvas);
    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.render();
    });
  }

  start() {
    this.renderer.resize();
    this.loadScene(createProjectileScene);
    this.controlsController.updateRunningState(false);
  }

  collectElements() {
    const $ = (id) => {
      const element = this.document.getElementById(id);
      if (!element) {
        throw new Error(`Missing DOM element #${id}`);
      }
      return element;
    };

    return {
      canvas: $('simulationCanvas'),
      playPauseBtn: $('playPauseBtn'),
      stepBtn: $('stepBtn'),
      resetBtn: $('resetBtn'),
      clearBtn: $('clearBtn'),
      addBodyBtn: $('addBodyBtn'),
      loadMRUBtn: $('loadMRUBtn'),
      loadFreeFallBtn: $('loadFreeFallBtn'),
      loadProjectileBtn: $('loadProjectileBtn'),
      timeScaleInput: $('timeScaleInput'),
      timeScaleValue: $('timeScaleValue'),
      useForcesCheckbox: $('useForcesCheckbox'),
      showGridCheckbox: $('showGridCheckbox'),
      showVectorsCheckbox: $('showVectorsCheckbox'),
      showTrajectoriesCheckbox: $('showTrajectoriesCheckbox'),
      runStateBadge: $('runStateBadge'),
      dragHint: $('dragHint'),
      objectSelect: $('objectSelect'),
      noSelectionMessage: $('noSelectionMessage'),
      inspectorFields: $('inspectorFields'),
      bodyNameInput: $('bodyNameInput'),
      bodyMassInput: $('bodyMassInput'),
      bodyPositionXInput: $('bodyPositionXInput'),
      bodyPositionYInput: $('bodyPositionYInput'),
      bodyVelocityXInput: $('bodyVelocityXInput'),
      bodyVelocityYInput: $('bodyVelocityYInput'),
      bodyAccelerationXInput: $('bodyAccelerationXInput'),
      bodyAccelerationYInput: $('bodyAccelerationYInput'),
      bodyRadiusInput: $('bodyRadiusInput'),
      bodyColorInput: $('bodyColorInput'),
      deleteObjectBtn: $('deleteObjectBtn'),
      displayFields: $('displayFields'),
      showPositionVectorCheckbox: $('showPositionVectorCheckbox'),
      showVelocityVectorCheckbox: $('showVelocityVectorCheckbox'),
      showAccelerationVectorCheckbox: $('showAccelerationVectorCheckbox'),
      showForcesCheckbox: $('showForcesCheckbox'),
      showTrajectoryCheckbox: $('showTrajectoryCheckbox'),
      forceFields: $('forceFields'),
      forceEmptyState: $('forceEmptyState'),
      constantForceXInput: $('constantForceXInput'),
      constantForceYInput: $('constantForceYInput'),
      addConstantForceBtn: $('addConstantForceBtn'),
      addGravityForceBtn: $('addGravityForceBtn'),
      clearForcesBtn: $('clearForcesBtn'),
      forceSummary: $('forceSummary'),
      valueTime: $('valueTime'),
      valuePosition: $('valuePosition'),
      valueVelocity: $('valueVelocity'),
      valueAcceleration: $('valueAcceleration'),
      valueSpeed: $('valueSpeed'),
      valueAccelerationMagnitude: $('valueAccelerationMagnitude')
    };
  }

  loadScene(sceneFactory) {
    this.animationLoop.pause();
    const selectedBody = sceneFactory(this.world);
    this.controlsController.setUseForces(this.world.useForces);
    this.selectionController.selectBody(selectedBody);
    this.world.reset();
    this.inspectorController.render();
    this.render();
  }

  reset() {
    this.animationLoop.reset();
    this.world.reset();
    this.inspectorController.render();
    this.render();
  }

  clearScene() {
    this.animationLoop.pause();
    this.world.clear();
    this.selectionController.clear();
    this.inspectorController.render();
    this.render();
  }

  handleRunningStateChange(isRunning) {
    this.controlsController.updateRunningState(isRunning);
    this.elements.canvas.classList.toggle('running', isRunning);
    this.render();
  }

  render() {
    const selectedBody = this.selectionController.getSelectedBody();
    this.renderer.render({
      selectedBody,
      ...this.controlsController.getDisplaySettings(),
      isRunning: this.animationLoop.isRunning
    });
    this.graphPanel.render();
  }
}
