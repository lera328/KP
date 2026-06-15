import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

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
  // Позиция и размеры dropdown — вычисляются при открытии
  const [dropStyle, setDropStyle] = useState({});
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

  // Вычислить позицию dropdown относительно viewport (для портала)
  const calcDropStyle = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const maxH = 260;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;

    const style = {
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
      maxHeight: maxH,
      background: '#fff',
      border: '1px solid #dee2e6',
      borderRadius: '0.5rem',
      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    };

    if (spaceBelow >= Math.min(maxH, 150) || spaceBelow >= spaceAbove) {
      // Открываем вниз
      style.top = rect.bottom + 4;
    } else {
      // Открываем вверх
      style.bottom = window.innerHeight - rect.top + 4;
      style.top = 'auto';
    }

    setDropStyle(style);
  }, []);

  const handleOpen = () => {
    if (disabled) return;
    if (!open) {
      calcDropStyle();
      setOpen(true);
    } else {
      setOpen(false);
      setQuery('');
    }
  };

  useEffect(() => {
    if (!open) return undefined;

    const closeIfOutside = (e) => {
      const dropdown = document.getElementById('searchable-select-portal');
      const clickedInsideWrapper = wrapperRef.current?.contains(e.target);
      const clickedInsideDropdown = dropdown?.contains(e.target);
      if (!clickedInsideWrapper && !clickedInsideDropdown) {
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

    // Пересчёт позиции при скролле или ресайзе (в т.ч. появление клавиатуры на мобиле)
    const reCalc = () => calcDropStyle();

    document.addEventListener('mousedown', closeIfOutside);
    document.addEventListener('touchstart', closeIfOutside, { passive: true });
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', reCalc, true);
    window.addEventListener('resize', reCalc);

    return () => {
      document.removeEventListener('mousedown', closeIfOutside);
      document.removeEventListener('touchstart', closeIfOutside);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', reCalc, true);
      window.removeEventListener('resize', reCalc);
    };
  }, [open, calcDropStyle]);

  useEffect(() => {
    if (open && inputRef.current) {
      // Небольшая задержка — ждём рендер портала
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const sizeCls = size === 'sm' ? 'form-control-sm' : '';

  const buttonText = current ? current.label : (value === '' && allowClear ? clearLabel : placeholder);

  const handleSelect = (val) => {
    onChange?.(val);
    setOpen(false);
    setQuery('');
  };

  const dropdown = open ? (
    <div id="searchable-select-portal" style={dropStyle}>
      {/* Поле поиска */}
      <div style={{ padding: '8px 8px 4px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
        <input
          ref={inputRef}
          type="text"
          className="form-control form-control-sm rounded-pill"
          placeholder="Поиск..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          // Не даём touchstart закрыть список при тапе на input
          onTouchStart={(e) => e.stopPropagation()}
        />
      </div>
      {/* Список */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {allowClear && (
          <button
            type="button"
            className="btn btn-link text-decoration-none w-100 text-start px-3 small"
            style={{
              color: value === '' ? '#111827' : '#374151',
              fontWeight: value === '' ? 600 : 500,
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
            }}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={() => handleSelect('')}
          >
            {clearLabel}
          </button>
        )}
        {filtered.length === 0 ? (
          <div style={{ padding: '12px', textAlign: 'center', color: '#6b7280', fontSize: '0.85rem' }}>
            Ничего не найдено
          </div>
        ) : (
          filtered.map((opt) => {
            const active = String(opt.value) === String(value);
            return (
              <button
                key={opt.value}
                type="button"
                className="btn btn-link text-decoration-none w-100 text-start px-3 small"
                style={{
                  color: active ? '#111827' : '#374151',
                  background: active ? '#f8f9fb' : 'transparent',
                  fontWeight: active ? 600 : 500,
                  whiteSpace: 'normal',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onTouchStart={(e) => e.stopPropagation()}
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
  ) : null;

  return (
    <div ref={wrapperRef} className={`position-relative ${className}`} style={{ minWidth: 0 }}>
      <button
        type="button"
        className={`form-select rounded-pill text-start ${sizeCls}`}
        onClick={handleOpen}
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

      {/* Рендерим dropdown в document.body — он не будет обрезан никаким overflow */}
      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  );
};
