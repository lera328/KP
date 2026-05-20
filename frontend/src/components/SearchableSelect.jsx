import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Универсальный выпадающий список с поиском.
 *
 * Props:
 *  - options: Array<{ value: string|number, label: string }>
 *  - value: string|number | ''  (текущее значение)
 *  - onChange(value)
 *  - placeholder: string
 *  - disabled: boolean
 *  - className: string (доп. классы для кнопки-триггера)
 *  - size: 'sm' | 'md' (размер контрола)
 *  - allowClear: boolean (показывать пункт "Все" с пустым value)
 *  - clearLabel: string (метка для allowClear, по умолчанию "Все")
 *  - style: React.CSSProperties (стили кнопки)
 */
export const SearchableSelect = ({
  options = [],
  value = '',
  onChange,
  placeholder = 'Выберите...',
  disabled = false,
  className = '',
  size = 'md',
  allowClear = false,
  clearLabel = 'Все',
  style = {},
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const norm = (s) => String(s || '').toLowerCase();

  const filtered = useMemo(() => {
    const q = norm(query).trim();
    if (!q) return options;
    return options.filter((opt) => norm(opt.label).includes(q));
  }, [options, query]);

  const current = useMemo(
    () => options.find((opt) => String(opt.value) === String(value)),
    [options, value],
  );

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const sizeCls = size === 'sm' ? 'form-control-sm' : '';
  const heightCls = size === 'sm' ? '' : '';

  const buttonText = current ? current.label : (value === '' && allowClear ? clearLabel : placeholder);

  const handleSelect = (val) => {
    onChange?.(val);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={wrapperRef} className={`position-relative ${className}`} style={{ minWidth: 0 }}>
      <button
        type="button"
        className={`form-select rounded-pill text-start ${sizeCls} ${heightCls}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        style={{
          background: '#fff',
          paddingRight: '2.25rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          ...style,
        }}
      >
        <span style={{ color: current ? '#111827' : '#6b7280' }}>{buttonText}</span>
      </button>
      {open && (
        <div
          className="position-absolute bg-white border rounded-3 shadow-sm"
          style={{
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1050,
            maxHeight: 320,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div className="p-2 border-bottom">
            <input
              ref={inputRef}
              type="text"
              className="form-control form-control-sm rounded-pill"
              placeholder="Поиск..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 260 }}>
            {allowClear && (
              <button
                type="button"
                className="btn btn-link text-decoration-none w-100 text-start px-3 py-2 small"
                style={{ color: value === '' ? '#111827' : '#374151', fontWeight: value === '' ? 600 : 500 }}
                onClick={() => handleSelect('')}
              >
                {clearLabel}
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-center text-muted small">Ничего не найдено</div>
            ) : (
              filtered.map((opt) => {
                const active = String(opt.value) === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className="btn btn-link text-decoration-none w-100 text-start px-3 py-2 small"
                    style={{
                      color: active ? '#111827' : '#374151',
                      background: active ? '#f8f9fb' : 'transparent',
                      fontWeight: active ? 600 : 500,
                      whiteSpace: 'normal',
                    }}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#f8f9fb'; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {opt.label}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
