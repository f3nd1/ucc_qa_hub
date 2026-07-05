import type { ReactNode } from "react";

/** Simple modal overlay using the ported .modal-mask / .modal classes. */
export function Modal({
  title,
  wide,
  onClose,
  children,
}: {
  title: string;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="modal-mask open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={"modal" + (wide ? " wide" : "")}>
        <div className="m-head">
          {title}
          <button className="m-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="m-body">{children}</div>
      </div>
    </div>
  );
}
