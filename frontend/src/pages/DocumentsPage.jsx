import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import ConfirmModal from "../components/ConfirmModal";
import { DocCard, SelectionBar, useSelection } from "../components/DocSelect";
import Icon from "../components/Icon";
import LibraryShell, {
  useLibrary, PinButton, CardAction, byDateDesc, byName,
} from "../components/LibraryShell";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import { useT } from "../i18n";

/**
 * Every document in the library. The sidebar shows only the pinned few, so this
 * is where the rest are found, opened and pinned.
 */
export default function DocumentsPage() {
  const t = useT();
  const chat = useChat();
  const { toast } = useToast();
  const navigate = useNavigate();
  const uploadRef = useRef(null);
  const [confirming, setConfirming] = useState(false);
  /* A document carries one date -- the day it arrived -- so it is offered
     once, under its own name. "Last updated" beside "date added" would be two
     labels for the same column. */
  const sorts = useMemo(
    () => [
      { value: "added", label: t("docs.sortAdded"), nameOf: (d) => d.title, cmp: byDateDesc((d) => d.upload_date) },
      { value: "name", label: t("common.sortAlpha"), nameOf: (d) => d.title, cmp: byName((d) => d.title) },
    ],
    [t]
  );
  const { q, setQ, sort, setSort, shown } = useLibrary(chat.docs, sorts);
  const sel = useSelection(shown, (d) => d.document_id);

  /* One call per document: there is no bulk endpoint, and inventing one for
     this would move a decision the API has not made into the client. */
  async function removeSelected() {
    const ids = [...sel.picked];
    setConfirming(false);
    try {
      await Promise.all(ids.map((id) => client.delete(`/api/documents/${id}`)));
      sel.clear();
      chat.loadDocs();
      toast(ids.length === 1 ? t("docs.deleted") : t("docs.deletedMany", { n: ids.length }), "ok");
    } catch (err) {
      chat.loadDocs();
      toast(t("docs.deleteFailed"), "err", err?.response?.data?.detail || "");
    }
  }

  return (
    <LibraryShell
      title={t("docs.section")}
      q={q} setQ={setQ} sort={sort} setSort={setSort} sorts={sorts}
      searchLabel={t("docs.searchDocs")}
      action={
        <>
          <button className="btn btn-primary" disabled={chat.uploading}
            onClick={() => uploadRef.current?.click()}>
            <Icon name={chat.uploading ? "refresh" : "plus"} className="icon-sm" />
            {t("docs.upload")}
          </button>
          <input ref={uploadRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) chat.uploadFile(f);
              e.target.value = "";
            }} />
        </>
      }
    >
      {shown.length === 0 ? (
        <div className="lib-empty">
          {q.trim() ? t("sidebar.nothingMatches", { q: q.trim() }) : t("docs.empty")}
        </div>
      ) : (
        <>
          {sel.some && (
            <SelectionBar count={sel.count} all={sel.all}
              onToggleAll={sel.toggleAll} onClear={sel.clear}>
              <button className="btn btn-sm sel-danger" onClick={() => setConfirming(true)}>
                <Icon name="trash" className="icon-sm" /> {t("common.delete")}
              </button>
            </SelectionBar>
          )}
          <div className="doc-grid">
            {shown.map((d) => (
              <DocCard
                key={d.document_id}
                doc={d}
                selecting={sel.some}
                selected={sel.picked.has(d.document_id)}
                onToggle={sel.toggle}
                onOpen={() => chat.setOpenDoc(d)}
              >
                <div className="doc-card-acts">
                  {/* Only once there is something to retrieve. Scoping a chat
                      to a document that failed to index would narrow the search
                      to nothing and answer accordingly. */}
                  {d.processing_status === "done" && (
                    <CardAction
                      icon="target"
                      label={t("docs.scopeChat")}
                      onClick={() => { chat.scopeToDocument(d); navigate("/"); }}
                    />
                  )}
                  <PinButton
                    pinned={!!d.pinned}
                    label={d.pinned ? t("common.unpin") : t("common.pin")}
                    onToggle={() => chat.pinDocument(d.document_id, !d.pinned)}
                  />
                </div>
              </DocCard>
            ))}
          </div>
        </>
      )}

      {confirming && (
        <ConfirmModal
          title={t("docs.deleteManyTitle", { n: sel.count })}
          text={t("docs.deleteManyText")}
          okLabel={t("common.delete")}
          onCancel={() => setConfirming(false)}
          onConfirm={removeSelected}
        />
      )}
    </LibraryShell>
  );
}
