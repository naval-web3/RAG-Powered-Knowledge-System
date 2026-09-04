import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import PortalMenu from "./PortalMenu";
import Tooltip from "./Tooltip";
import { useT } from "../i18n";

/**
 * Everything you can do to a project without opening it.
 *
 * Shared by the card on the projects page and the row in the sidebar, because
 * they are the same project and the same three things. Quiet until whatever
 * holds it is under the pointer; the caller decides what "hovered" means by
 * styling `.proj-menu button`.
 *
 * Archive is deliberately absent. There is no archived state in this app, and
 * a row that cannot do anything is worse than a row that is not there.
 */
export function ProjectMenu({ project, onPin, onEdit, onDelete, placement = "top" }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnRef = useRef(null);

  /* The menu is rendered into <body>, so it is NOT inside `ref` -- and every
     press on one of its own items therefore looked like a press outside it.
     mousedown closed the menu, the item unmounted, and the click that followed
     had nothing left to land on: Unpin, Edit details and Delete all did
     precisely nothing, from the sidebar row and from the card alike.
     Anything inside a .pop-menu is that menu's own business; its items close
     it themselves. Layout's row menus learned this when they moved into the
     portal, in the same words. */
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (e.target instanceof Element && e.target.closest(".pop-menu")) return;
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  /* Every item stops the click reaching whatever is underneath: choosing
     "Delete" from a menu is not asking to open the thing being deleted. */
  const pick = (fn) => (e) => {
    e.stopPropagation();
    setOpen(false);
    fn();
  };

  return (
    <span className="menu-anchor proj-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <Tooltip label={t("projects.options")} placement={placement}>
        <button ref={btnRef} className={open ? "on" : ""} aria-haspopup="true" aria-expanded={open}
          aria-label={t("projects.options")}
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
          <Icon name="more-v" className="icon-sm" />
        </button>
      </Tooltip>
      {/* Rendered into <body>. In the sidebar this menu's parent scrolls, and a
          scrolling parent clips what overflows it on both axes -- the list came
          out cut off at the bottom. Out there nothing crops it. */}
      {open && (
        <PortalMenu anchorRef={btnRef} align="right" className="proj-pop">
          <button className="pm-item" onClick={pick(onPin)}>
            <Icon name={project.pinned ? "pin-off" : "pin"} className="icon-sm" />
            {project.pinned ? t("common.unpin") : t("common.pin")}
          </button>
          <button className="pm-item" onClick={pick(onEdit)}>
            <Icon name="pencil" className="icon-sm" /> {t("projects.editDetails")}
          </button>
          <div className="pm-sep" />
          <button className="pm-item danger" onClick={pick(onDelete)}>
            <Icon name="trash" className="icon-sm" /> {t("common.delete")}
          </button>
        </PortalMenu>
      )}
    </span>
  );
}

/** The one thing a project is described by from a list: its name. */
export function EditProjectDialog({ project, onClose, onSave }) {
  const t = useT();
  const [name, setName] = useState(project.name);
  const clean = name.trim();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true"
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t("projects.editDetails")}</h3>
          <button className="btn-icon" aria-label={t("common.close")} onClick={onClose}>
            <Icon name="x" className="icon-sm" />
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="proj-rename">{t("sidebar.projectName")}</label>
            <input id="proj-rename" className="input" autoFocus value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && clean) onSave(clean); }} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn btn-primary" disabled={!clean} onClick={() => onSave(clean)}>
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
