import { useState } from "react";
import Icon from "./Icon";
import { useT } from "../i18n";

/**
 * Starting a project, from wherever you started it.
 *
 * There were three ways in and three different shapes: an inline field in the
 * sidebar, another on the projects page, and a menu row that named the project
 * after whatever you had typed into a search box. All three now open this, so
 * the answer to "how do I make a project" is the same wherever it is asked.
 *
 * It asks two questions rather than one. A project is told apart from another
 * by what it is for, and the field for that was previously somewhere else
 * entirely -- you made a project, then went looking for its instructions. It
 * is optional: a name alone is still a project.
 */
export default function NewProjectDialog({ initialName = "", onClose, onCreate }) {
  const t = useT();
  const [name, setName] = useState(initialName);
  const [about, setAbout] = useState("");
  const [busy, setBusy] = useState(false);
  const clean = name.trim();

  async function submit() {
    if (!clean || busy) return;
    setBusy(true);
    try {
      await onCreate(clean, about.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="newproj-title"
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3 id="newproj-title">{t("projects.createTitle")}</h3>
          <button className="btn-icon" aria-label={t("common.close")} onClick={onClose}>
            <Icon name="x" className="icon-sm" />
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="newproj-name">{t("projects.nameQ")}</label>
            <input id="newproj-name" className="input" autoFocus value={name}
              placeholder={t("projects.namePlaceholder")}
              onChange={(e) => setName(e.target.value)}
              /* Enter submits from the name, because a project with only a
                 name is a complete answer to this dialog. */
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
          </div>
          <div className="field">
            <label htmlFor="newproj-about">{t("projects.aboutQ")}</label>
            <textarea id="newproj-about" className="input newproj-about" rows={4} value={about}
              placeholder={t("projects.aboutPlaceholder")}
              onChange={(e) => setAbout(e.target.value)} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn btn-primary" disabled={!clean || busy} onClick={submit}>
            {t("projects.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
