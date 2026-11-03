'use client';
export default function Sheet({ onClose, children }) {
  return (
    <div className="sheet" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div>{children}</div>
    </div>
  );
}
