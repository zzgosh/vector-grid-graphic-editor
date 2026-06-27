import { useEffect, useState } from 'react';

type NumericFieldProps = {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
  testId?: string;
};

const isNumericDraft = (value: string): boolean => /^-?\d*\.?\d*$/.test(value);

export const NumericField = ({
  label,
  value,
  onCommit,
  min,
  max,
  step,
  unit,
  testId,
}: NumericFieldProps) => {
  const [draft, setDraft] = useState(`${value}`);

  useEffect(() => {
    setDraft(`${value}`);
  }, [value]);

  const commit = () => {
    if (draft.trim() === '' || draft === '-' || draft === '.') {
      setDraft(`${value}`);
      return;
    }
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(`${value}`);
      return;
    }
    onCommit(parsed);
  };

  return (
    <label className="field">
      <span>
        {label}
        {unit ? <b>{unit}</b> : null}
      </span>
      <input
        data-testid={testId}
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onBlur={commit}
        onChange={(event) => {
          if (isNumericDraft(event.target.value)) {
            setDraft(event.target.value);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
};
