import type { GridSettings, ShapeControl } from '../domain/types';
import { shapeRegistry } from '../shapes/registry';
import { NumericField } from './NumericField';

type ShapeControlsProps = {
  settings: GridSettings;
  onChange: (partial: Partial<GridSettings>) => void;
};

const getControlValue = (settings: GridSettings, control: ShapeControl) => settings[control.key];

export const ShapeControls = ({ settings, onChange }: ShapeControlsProps) => (
  <section className="controlSection" aria-labelledby="shape-heading">
    <div className="sectionHeading">
      <div>
        <h2 id="shape-heading">{shapeRegistry.parallelogram.label}</h2>
        <p>{shapeRegistry.parallelogram.description}</p>
      </div>
    </div>

    <div className="controlStack">
      {shapeRegistry.parallelogram.controls.map((control) => {
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
                onChange={(event) => onChange({ [control.key]: event.target.checked } as Partial<GridSettings>)}
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
            onCommit={(nextValue) =>
              onChange({ [control.key]: nextValue } as Partial<GridSettings>)
            }
          />
        );
      })}
    </div>
  </section>
);
