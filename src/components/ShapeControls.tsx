import type { GridSettings, ShapeControl } from '../domain/types';
import { shapeRegistry } from '../shapes/registry';

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
          <label className="field" key={control.key}>
            <span>
              {control.label}
              {control.unit ? <b>{control.unit}</b> : null}
            </span>
            <input
              data-testid={`${control.key}-input`}
              type="number"
              min={control.min}
              max={control.max}
              step={control.step}
              value={Number(value)}
              onChange={(event) =>
                onChange({ [control.key]: Number(event.target.value) } as Partial<GridSettings>)
              }
            />
          </label>
        );
      })}
    </div>
  </section>
);
