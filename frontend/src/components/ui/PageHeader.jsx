import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { usePageTitle } from '../../hooks/usePageTitle.js';

export function PageHeader({
  title,
  subtitle,
  actions,
  actionsClassName = '',
  backTo,
  backLabel = 'Back',
  eyebrow,
  meta,
  docTitle,
  className = '',
}) {
  usePageTitle(docTitle ?? title);

  return (
    <header className={`page-header ${className}`.trim()}>
      <div className="page-header__text">
        {backTo ? (
          <Link className="back-link" to={backTo}>
            <ArrowLeft size={13} aria-hidden="true" />
            <span>{backLabel}</span>
          </Link>
        ) : null}
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        {meta ? <div className="row row--wrap" style={{ marginTop: 10 }}>{meta}</div> : null}
      </div>
      {actions ? (
        <div className={`page-actions ${actionsClassName}`.trim()}>{actions}</div>
      ) : null}
    </header>
  );
}
