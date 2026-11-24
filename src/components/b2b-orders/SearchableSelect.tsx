'use client';

/**
 * Searchable select (ARIA 1.2 combobox + listbox). Shows every option when
 * focused/opened and filters as the admin types (accent- and case-insensitive,
 * every typed word must match the option's label or keywords).
 *
 * Keyboard: ↓/↑ move, Enter selects, Escape closes (without closing the
 * surrounding modal), Tab leaves.
 *
 * Browser autofill / form-history suggestions are suppressed: autocomplete
 * off, a random non-semantic `name`, password-manager ignore hints, and the
 * descriptive help text kept out of the label/placeholder (Chrome's autofill
 * heuristics scan those for words like "email" or "empresa"). Only the first `maxVisible` matches are
 * rendered to keep large catalogs fast.
 */

import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { inputClass } from './B2bOrderUi';

export interface SearchableOption<T> {
  value: string;
  label: string;
  /** Extra text matched by the filter (email, NIF, SKU…). */
  keywords?: string;
  disabled?: boolean;
  data: T;
}

interface SearchableSelectProps<T> {
  id: string;
  label: string;
  /** Help text shown under the input (linked via aria-describedby). */
  hint?: string;
  options: SearchableOption<T>[];
  onSelect: (option: SearchableOption<T>) => void;
  renderOption: (option: SearchableOption<T>) => ReactNode;
  placeholder?: string;
  loading?: boolean;
  emptyMessage?: string;
  /** Keep the typed text after selecting (false = clear, e.g. to add several products). */
  keepQueryOnSelect?: boolean;
  maxVisible?: number;
}

export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function SearchableSelect<T>({
  id,
  label,
  hint,
  options,
  onSelect,
  renderOption,
  placeholder,
  loading = false,
  emptyMessage = 'Sin resultados',
  keepQueryOnSelect = false,
  maxVisible = 100,
}: SearchableSelectProps<T>) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const index = useMemo(
    () => options.map((o) => ({ option: o, haystack: normalizeSearch(`${o.label} ${o.keywords ?? ''}`) })),
    [options]
  );

  const { matches, total } = useMemo(() => {
    const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean);
    const all = tokens.length === 0 ? index : index.filter((e) => tokens.every((t) => e.haystack.includes(t)));
    return { matches: all.slice(0, maxVisible).map((e) => e.option), total: all.length };
  }, [index, query, maxVisible]);

  const scrollIntoView = (i: number) => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${i}"]`)?.scrollIntoView({ block: 'nearest' });
  };

  const move = (delta: number) => {
    if (matches.length === 0) return;
    let next = active;
    for (let step = 0; step < matches.length; step++) {
      next = (next + delta + matches.length) % matches.length;
      if (!matches[next].disabled) break;
    }
    setActive(next);
    scrollIntoView(next);
  };

  const choose = (option: SearchableOption<T> | undefined) => {
    if (!option || option.disabled) return;
    onSelect(option);
    setQuery(keepQueryOnSelect ? option.label : '');
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) setOpen(true);
        else move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) setOpen(true);
        else move(-1);
        break;
      case 'Enter':
        if (open) {
          e.preventDefault();
          choose(matches[active]);
        }
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
        }
        break;
    }
  };

  const activeId = open && matches[active] ? `${listId}-opt-${active}` : undefined;

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <label htmlFor={id} className="block text-xs text-text-secondary mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-describedby={hint ? `${listId}-hint` : undefined}
          name={`sel-${listId.replace(/[^a-zA-Z0-9]/g, '')}`}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          data-form-type="other"
          className={`${inputClass} pr-9`}
          placeholder={loading ? 'Cargando…' : placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? `Cerrar lista de ${label}` : `Abrir lista de ${label}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((v) => !v)}
          className="absolute inset-y-0 right-0 px-3 text-text-muted hover:text-text-primary"
        >
          <span aria-hidden="true">{open ? '▲' : '▼'}</span>
        </button>
      </div>

      {hint && (
        <p id={`${listId}-hint`} className="mt-1 text-xs text-text-muted">
          {hint}
        </p>
      )}

      {open && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          aria-label={label}
          className="absolute z-20 top-[4.25rem] mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-dark-borderStrong bg-dark-surface shadow-2xl divide-y divide-dark-border"
        >
          {loading && <li className="px-3 py-2 text-sm text-text-muted">Cargando…</li>}
          {!loading && matches.length === 0 && <li className="px-3 py-2 text-sm text-text-muted">{emptyMessage}</li>}
          {!loading &&
            matches.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={i === active}
                aria-disabled={o.disabled || undefined}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o)}
                className={`px-3 py-2 text-sm ${
                  o.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                } ${i === active ? 'bg-dark-surfaceHover' : ''}`}
              >
                {renderOption(o)}
              </li>
            ))}
          {!loading && total > matches.length && (
            <li className="px-3 py-2 text-xs text-text-muted">
              Mostrando {matches.length} de {total}. Escribe para afinar la búsqueda.
            </li>
          )}
        </ul>
      )}
      <span className="sr-only" aria-live="polite">
        {open && !loading ? `${total} resultado${total === 1 ? '' : 's'}` : ''}
      </span>
    </div>
  );
}
