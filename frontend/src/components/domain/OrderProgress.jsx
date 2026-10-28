import { Check } from 'lucide-react';
import { progressSteps } from '../../lib/status.js';

export function OrderProgress({ status, compact = false }) {
  const steps = progressSteps(status);
  return (
    <ol
      className="progress-rail"
      aria-label="Shipment progress"
      style={compact ? { maxWidth: 560 } : undefined}
    >
      {steps.map((step, index) => {
        const Icon = step.state === 'done' ? Check : step.icon;
        return (
          <li
            key={step.key}
            className={`progress-step progress-step--${step.state}`}
            aria-current={step.state === 'current' ? 'step' : undefined}
          >
            <div className="progress-step__track">
              <span className="progress-step__dot">
                <Icon size={12} aria-hidden="true" />
              </span>
              {index < steps.length - 1 ? (
                <span className="progress-step__bar" aria-hidden="true" />
              ) : null}
            </div>
            <span className="progress-step__label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
