import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyText } from '../../lib/copy.js';

export function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  showLabel = false,
  className = '',
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!value) return null;

  const handleCopy = async () => {
    const ok = await copyText(value);
    if (!ok) return;
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      className={`copy-btn ${copied ? 'copy-btn--done' : ''} ${className}`.trim()}
      onClick={handleCopy}
      aria-label={copied ? copiedLabel : label}
      title={copied ? copiedLabel : label}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {showLabel ? <span>{copied ? copiedLabel : label}</span> : null}
    </button>
  );
}
