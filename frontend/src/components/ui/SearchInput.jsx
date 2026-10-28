import { useId } from 'react';
import { Search } from 'lucide-react';

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  label = 'Search',
  className = '',
  onKeyDown,
  ...props
}) {
  const id = useId();
  return (
    <div className={`search-box ${className}`.trim()}>
      <Search aria-hidden="true" />
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        type="search"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck="false"
        enterKeyHint="search"
        {...props}
      />
    </div>
  );
}
