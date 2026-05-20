/**
 * ParameterControls — Sliders/dropdowns/toggles with inline constraint violations
 */
import type { ParameterDefinition } from '../../types/generation.types';
import type { ConstraintViolation } from '../../types/constraintEngine.types';

interface ParameterControlsProps {
  parameters: ParameterDefinition[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  violations?: ConstraintViolation[];
  labels?: Record<string, string>;
  helpText?: Record<string, string>;
}

export function ParameterControls({
  parameters,
  values,
  onChange,
  violations = [],
  labels = {},
  helpText = {},
}: ParameterControlsProps) {
  const getViolationsForParam = (key: string) =>
    violations.filter(v => v.affectedParameters.includes(key));

  return (
    <div className="space-y-4">
      {parameters.map(param => {
        const paramViolations = getViolationsForParam(param.key);
        const label = labels[param.key] || param.label;
        const help = helpText[param.key];
        const value = values[param.key] ?? param.default;

        return (
          <div key={param.key} className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium" htmlFor={`param-${param.key}`}>
                {label}
                {param.unit && <span className="text-gray-400 ml-1">({param.unit})</span>}
              </label>
              {param.type === 'number' && (
                <span className="text-sm text-gray-500">{String(value)}</span>
              )}
            </div>

            {param.type === 'number' && (
              <input
                id={`param-${param.key}`}
                type="range"
                min={param.min}
                max={param.max}
                step={param.step}
                value={Number(value)}
                onChange={e => onChange(param.key, Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200"
              />
            )}

            {param.type === 'select' && param.options && (
              <select
                id={`param-${param.key}`}
                value={String(value)}
                onChange={e => onChange(param.key, e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                {param.options.map(opt => (
                  <option key={String(opt.value)} value={String(opt.value)}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            {param.type === 'boolean' && (
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(value)}
                onClick={() => onChange(param.key, !value)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  value ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    value ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            )}

            {help && <p className="text-xs text-gray-400">{help}</p>}

            {paramViolations.map(v => (
              <p
                key={v.constraintId}
                className={`text-xs ${
                  v.action === 'reject' ? 'text-red-600' : v.action === 'warn' ? 'text-amber-600' : 'text-blue-600'
                }`}
              >
                {v.reason}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
