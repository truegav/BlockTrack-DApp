import { useId } from 'react';
import { AlertTriangle } from 'lucide-react';

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  optional,
  children,
  className = '',
}) {
  return (
    <div className={`field ${className}`.trim()}>
      {label ? (
        <label className="field__label" htmlFor={htmlFor}>
          <span>{label}</span>
          {required ? <span className="field__required">*</span> : null}
          {optional ? <span className="field__optional">Optional</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="field__error" id={`${htmlFor}-error`} role="alert">
          <AlertTriangle size={12} aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="field__hint" id={`${htmlFor}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className = '', invalid, ...props }) {
  return (
    <input
      className={`input ${className}`.trim()}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Textarea({ className = '', invalid, ...props }) {
  return (
    <textarea
      className={`textarea ${className}`.trim()}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Select({ className = '', invalid, children, ...props }) {
  return (
    <select
      className={`select ${className}`.trim()}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
}

export function TextField({
  id,
  label,
  error,
  hint,
  required,
  optional,
  className,
  inputClassName,
  ...props
}) {
  const generated = useId();
  const inputId = id || generated;
  const describedBy = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined;

  return (
    <Field
      label={label}
      htmlFor={inputId}
      hint={hint}
      error={error}
      required={required}
      optional={optional}
      className={className}
    >
      <Input
        id={inputId}
        className={inputClassName}
        invalid={Boolean(error)}
        required={required}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        {...props}
      />
    </Field>
  );
}

export function TextAreaField({
  id,
  label,
  error,
  hint,
  required,
  optional,
  className,
  ...props
}) {
  const generated = useId();
  const inputId = id || generated;
  const describedBy = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined;

  return (
    <Field
      label={label}
      htmlFor={inputId}
      hint={hint}
      error={error}
      required={required}
      optional={optional}
      className={className}
    >
      <Textarea
        id={inputId}
        invalid={Boolean(error)}
        required={required}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        {...props}
      />
    </Field>
  );
}

export function SelectField({
  id,
  label,
  error,
  hint,
  required,
  optional,
  className,
  children,
  ...props
}) {
  const generated = useId();
  const inputId = id || generated;
  const describedBy = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined;

  return (
    <Field
      label={label}
      htmlFor={inputId}
      hint={hint}
      error={error}
      required={required}
      optional={optional}
      className={className}
    >
      <Select
        id={inputId}
        invalid={Boolean(error)}
        required={required}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        {...props}
      >
        {children}
      </Select>
    </Field>
  );
}
