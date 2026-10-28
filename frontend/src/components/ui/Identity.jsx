import { shortAddress } from '../../lib/format.js';
import { Avatar } from './Avatar.jsx';
import { CopyButton } from './CopyButton.jsx';

export function AddressChip({ address, showCopy = true, className = '' }) {
  if (!address) return null;
  return (
    <span className={`addr ${className}`.trim()} translate="no">
      <span>{shortAddress(address)}</span>
      {showCopy ? <CopyButton value={address} label="Copy address" /> : null}
    </span>
  );
}

export function KeyValue({ label, children, className = '' }) {
  return (
    <div className={`kv ${className}`.trim()}>
      <span className="kv__label">{label}</span>
      <span className="kv__value">{children}</span>
    </div>
  );
}

export function HashLine({ label, value }) {
  if (!value) return null;
  return (
    <div className="kv">
      <span className="kv__label">{label}</span>
      <span className="kv__value">
        <span className="hash">{value}</span>
        <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
      </span>
    </div>
  );
}

export function Entity({ address, name, size, className = '' }) {
  return (
    <span className={`entity ${className}`.trim()}>
      <Avatar name={name || address} address={address} size={size} />
      <span className="entity__body">
        <span className="entity__name">{name || shortAddress(address)}</span>
        {name && address ? (
          <span className="entity__addr" translate="no">
            {shortAddress(address)}
          </span>
        ) : null}
      </span>
    </span>
  );
}
