interface Props {
  label: string;
  onClear: () => void;
}

export function FilterChip({ label, onClear }: Props) {
  return (
    <div className="pulse-chip" role="status">
      <span className="pulse-chip-dot" aria-hidden="true" />
      <span className="pulse-chip-label">{label}</span>
      <button
        type="button"
        className="pulse-chip-clear"
        onClick={onClear}
        aria-label="clear filter"
      >
        ×
      </button>
    </div>
  );
}
