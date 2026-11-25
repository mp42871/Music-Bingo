export function ClaimPanel({ onClose }: { initial: number | null; onClose(): void }) {
  return <div role="dialog" aria-label="Check a card"><button type="button" onClick={onClose}>Close</button></div>;
}
