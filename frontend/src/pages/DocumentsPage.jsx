import { useRef } from "react";
import Icon from "../components/Icon";
import LibraryShell, { useLibrary, PinButton } from "../components/LibraryShell";
import { useChat } from "../context/ChatContext";
import { useT } from "../i18n";
import { fmtBytes, timeAgo, fileExt } from "../utils";

/**
 * Every document in the library. The sidebar shows only the pinned few, so this
 * is where the rest are found, opened and pinned.
 */
export default function DocumentsPage() {
  const t = useT();
  const chat = useChat();
  const uploadRef = useRef(null);
  const { q, setQ, sort, setSort, shown } = useLibrary(
    chat.docs,
    (d) => d.title,
    (d) => d.upload_date
  );

  return (
    <LibraryShell
      title={t("docs.section")}
      q={q} setQ={setQ} sort={sort} setSort={setSort}
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
        <div className="lib-grid">
          {shown.map((d) => (
            <button key={d.document_id} className="lib-card" onClick={() => chat.setOpenDoc(d)}>
              <div className="lib-card-top">
                <span className="lib-card-name">{d.title}</span>
                <PinButton
                  pinned={!!d.pinned}
                  label={d.pinned ? t("common.unpin") : t("common.pin")}
                  onToggle={() => chat.pinDocument(d.document_id, !d.pinned)}
                />
              </div>
              <div className="lib-card-foot">
                {/* The facts a document is actually chosen by: what kind it is,
                    how big, and how much of it made it into the index. */}
                <span className="lib-meta">
                  {fileExt(d.file_type, d.original_filename).toUpperCase()}
                  {" · "}{fmtBytes(d.file_size)}
                  {d.processing_status === "done" && (
                    <>{" · "}{t("chat.chunks", { n: d.chunk_count })}</>
                  )}
                </span>
                <span className="lib-date">{timeAgo(d.upload_date)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </LibraryShell>
  );
}
