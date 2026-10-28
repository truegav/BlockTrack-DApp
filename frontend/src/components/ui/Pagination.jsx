import { ChevronLeft, ChevronRight } from 'lucide-react';

function getPages(current, count) {
  if (count <= 7) {
    return Array.from({ length: count }, (_, index) => index + 1);
  }
  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(count - 1, current + 1);
  if (start > 2) pages.push('start-ellipsis');
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < count - 1) pages.push('end-ellipsis');
  pages.push(count);
  return pages;
}

export function Pagination({ page, pageCount, total, pageSize, onChange }) {
  if (!total) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pages = getPages(page, pageCount);

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination__info">
        Showing <span className="tabular">{from}</span>–
        <span className="tabular">{to}</span> of{' '}
        <span className="tabular">{total}</span>
      </span>
      <div className="pagination__pages">
        <button
          type="button"
          className="pagination__page"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>
        {pages.map((item) =>
          typeof item === 'number' ? (
            <button
              key={item}
              type="button"
              className="pagination__page"
              aria-current={item === page ? 'page' : undefined}
              aria-label={`Page ${item}`}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          ) : (
            <span key={item} className="pagination__page" aria-hidden="true">
              …
            </span>
          )
        )}
        <button
          type="button"
          className="pagination__page"
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </nav>
  );
}
