import type { GridSettings, ShapeControl } from '../domain/types';
import { shapeRegistry } from '../shapes/registry';
import { NumericField } from './NumericField';

type ShapeControlsProps = {
  settings: GridSettings;
  onChange: (partial: Partial<GridSettings>) => void;
};

const getControlValue = (settings: GridSettings, control: ShapeControl) => settings[control.key];

const dimensionControlKeys = new Set<keyof GridSettings>(['cellWidth', 'cellHeight']);
const gapControlKeys = new Set<keyof GridSettings>([
  'gapXEnabled',
  'gapX',
  'gapYEnabled',
  'gapY',
]);

export const ShapeControls = ({ settings, onChange }: ShapeControlsProps) => {
  const renderControl = (control: ShapeControl) => {
    const value = getControlValue(settings, control);

    if (control.kind === 'segmented') {
      return (
        <div className="field" key={control.key}>
          <span>{control.label}</span>
          <div className="segmented compact" role="group" aria-label={control.label}>
            {control.options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={value === option.value ? 'active' : ''}
                aria-pressed={value === option.value}
                onClick={() => onChange({ [control.key]: option.value } as Partial<GridSettings>)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (control.kind === 'toggle') {
      return (
        <label className="switchField" key={control.key}>
          <span>{control.label}</span>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) =>
              onChange({ [control.key]: event.target.checked } as Partial<GridSettings>)
            }
          />
        </label>
      );
    }

    return (
      <NumericField
        key={control.key}
        label={control.label}
        value={Number(value)}
        min={control.min}
        max={control.max}
        step={control.step}
        unit={control.unit}
        testId={`${control.key}-input`}
        onCommit={(nextValue) => onChange({ [control.key]: nextValue } as Partial<GridSettings>)}
      />
    );
  };

  const renderGapGroup = (
    toggleKey: 'gapXEnabled' | 'gapYEnabled',
    valueKey: 'gapX' | 'gapY',
    toggleLabel: string,
    inputLabel: string,
  ) => {
    const control = shapeRegistry.parallelogram.controls.find(
      (candidate) => candidate.key === valueKey && candidate.kind === 'number',
    );

    if (!control || control.kind !== 'number') {
      return null;
    }

    return (
      <div className="gapControlGroup" key={valueKey}>
        <label className="gapToggle">
          <input
            type="checkbox"
            checked={Boolean(settings[toggleKey])}
            onChange={(event) => onChange({ [toggleKey]: event.target.checked })}
          />
          <span>{toggleLabel}</span>
        </label>
        <NumericField
          label={inputLabel}
          value={Number(settings[valueKey])}
          min={control.min}
          max={control.max}
          step={control.step}
          unit={control.unit}
          testId={`${valueKey}-input`}
          onCommit={(nextValue) => onChange({ [valueKey]: nextValue })}
        />
      </div>
    );
  };

  const dimensionControls = shapeRegistry.parallelogram.controls.filter((control) =>
    dimensionControlKeys.has(control.key),
  );
  const remainingControls = shapeRegistry.parallelogram.controls.filter(
    (control) => !dimensionControlKeys.has(control.key) && !gapControlKeys.has(control.key),
  );

  return (
    <section className="controlSection" aria-labelledby="shape-heading">
      <div className="sectionHeading">
        <div>
          <h2 id="shape-heading">{shapeRegistry.parallelogram.label}</h2>
          <p>{shapeRegistry.parallelogram.description}</p>
        </div>
      </div>

      <div className="controlStack shapeControlStack">
        <div className="twoColumn">{dimensionControls.map(renderControl)}</div>
        {remainingControls.map(renderControl)}
        <div className="gapControlGrid">
          {renderGapGroup('gapXEnabled', 'gapX', 'Horizontal gap', 'Gap X')}
          {renderGapGroup('gapYEnabled', 'gapY', 'Vertical gap', 'Gap Y')}
        </div>
      </div>
    </section>
  );
};
