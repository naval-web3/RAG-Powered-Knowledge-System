import Icon from "./Icon";

/**
 * Simple confirm dialog matching the Retrieva modal styling.
 * <ConfirmModal title text okLabel danger onConfirm onCancel />
 */
export default function ConfirmModal({
  title = "Are you sure?",
  text,
  okLabel = "Confirm",
  danger = true,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn-icon" aria-label="Close" onClick={onCancel}>
            <Icon name="x" className="icon-sm" />
          </button>
        </div>
        <div className="modal-body"><p className="m-text">{text}</p></div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className={danger ? "btn btn-danger" : "btn btn-primary"} onClick={onConfirm}>
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
