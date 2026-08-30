/**
 * Document strings: the sidebar section and the viewer dialog.
 *
 * Documents moved into the sidebar, which is translated, so these had to be
 * translated with it. A row of English titles under a Hindi heading would have
 * looked like a bug rather than a boundary.
 */

const en = {
  "docs.section": "Documents",
  "docs.upload": "Upload a document",
  "docs.empty": "No documents yet. Upload one and it will be indexed on arrival.",
  "docs.options": "Document options",
  "docs.open": "Open",
  "docs.failed": "Failed",
  "docs.deleteTitle": "Delete document?",
  "docs.deleteText":
    "This removes the file and everything indexed from it. Chats that cited it keep their text.",
  "docs.deleted": "Document deleted",
  "docs.deleteFailed": "Couldn’t delete that document",
  "docs.renameFailed": "Couldn’t rename that document",

  "docs.reading": "Reading",
  "docs.readingView": "Read the extracted text",
  "docs.codeView": "Source",
  "docs.loading": "Reading the document…",
  "docs.loadFailed": "Couldn’t read this document.",
  "docs.page": "Page {n}",
  "docs.truncated": "The rest is not shown: this document is longer than the viewer will load.",

  "docs.scopeChat": "Ask about this document",
  "docs.scoped": "Questions are now scoped to {title}",
  "docs.download": "Download original",
  "docs.pageCount": "{n} pages",
  "docs.onePage": "1 page",
  "docs.copyText": "Copy text",
  "docs.copied": "Text copied",
  "docs.copyFailed": "Couldn’t copy",
};

const fr = {
  "docs.section": "Documents",
  "docs.upload": "Ajouter un document",
  "docs.empty": "Aucun document. Ajoutez-en un, il sera indexé à l’arrivée.",
  "docs.options": "Options du document",
  "docs.open": "Ouvrir",
  "docs.failed": "Échec",
  "docs.deleteTitle": "Supprimer le document ?",
  "docs.deleteText":
    "Cela supprime le fichier et tout ce qui en a été indexé. Les discussions qui le citaient gardent leur texte.",
  "docs.deleted": "Document supprimé",
  "docs.deleteFailed": "Suppression impossible",
  "docs.renameFailed": "Renommage impossible",

  "docs.reading": "Lecture",
  "docs.readingView": "Lire le texte extrait",
  "docs.codeView": "Source",
  "docs.loading": "Lecture du document…",
  "docs.loadFailed": "Impossible de lire ce document.",
  "docs.page": "Page {n}",
  "docs.truncated": "La suite n’est pas affichée : ce document dépasse ce que la visionneuse charge.",

  "docs.scopeChat": "Interroger ce document",
  "docs.scoped": "Les questions portent désormais sur {title}",
  "docs.download": "Télécharger l’original",
  "docs.pageCount": "{n} pages",
  "docs.onePage": "1 page",
  "docs.copyText": "Copier le texte",
  "docs.copied": "Texte copié",
  "docs.copyFailed": "Copie impossible",
};

const de = {
  "docs.section": "Dokumente",
  "docs.upload": "Dokument hochladen",
  "docs.empty": "Noch keine Dokumente. Laden Sie eines hoch, es wird beim Eintreffen indexiert.",
  "docs.options": "Dokumentoptionen",
  "docs.open": "Öffnen",
  "docs.failed": "Fehlgeschlagen",
  "docs.deleteTitle": "Dokument löschen?",
  "docs.deleteText":
    "Das entfernt die Datei und alles, was daraus indexiert wurde. Chats, die daraus zitiert haben, behalten ihren Text.",
  "docs.deleted": "Dokument gelöscht",
  "docs.deleteFailed": "Dokument konnte nicht gelöscht werden",
  "docs.renameFailed": "Dokument konnte nicht umbenannt werden",

  "docs.reading": "Lesen",
  "docs.readingView": "Den extrahierten Text lesen",
  "docs.codeView": "Quelltext",
  "docs.loading": "Dokument wird gelesen…",
  "docs.loadFailed": "Dieses Dokument konnte nicht gelesen werden.",
  "docs.page": "Seite {n}",
  "docs.truncated": "Der Rest wird nicht gezeigt: dieses Dokument ist länger, als die Ansicht lädt.",

  "docs.scopeChat": "Zu diesem Dokument fragen",
  "docs.scoped": "Fragen beziehen sich jetzt auf {title}",
  "docs.download": "Original herunterladen",
  "docs.pageCount": "{n} Seiten",
  "docs.onePage": "1 Seite",
  "docs.copyText": "Text kopieren",
  "docs.copied": "Text kopiert",
  "docs.copyFailed": "Kopieren fehlgeschlagen",
};

const hi = {
  "docs.section": "दस्तावेज़",
  "docs.upload": "दस्तावेज़ अपलोड करें",
  "docs.empty": "अभी कोई दस्तावेज़ नहीं है। एक अपलोड करें, वह आते ही इंडेक्स हो जाएगा।",
  "docs.options": "दस्तावेज़ विकल्प",
  "docs.open": "खोलें",
  "docs.failed": "विफल",
  "docs.deleteTitle": "दस्तावेज़ हटाएं?",
  "docs.deleteText":
    "इससे फ़ाइल और उससे इंडेक्स की गई हर चीज़ हट जाएगी। जिन चैट में इसका हवाला था, उनका पाठ बना रहेगा।",
  "docs.deleted": "दस्तावेज़ हटा दिया गया",
  "docs.deleteFailed": "दस्तावेज़ नहीं हटाया जा सका",
  "docs.renameFailed": "दस्तावेज़ का नाम नहीं बदला जा सका",

  "docs.reading": "पढ़ें",
  "docs.readingView": "निकाला गया पाठ पढ़ें",
  "docs.codeView": "सोर्स",
  "docs.loading": "दस्तावेज़ पढ़ा जा रहा है…",
  "docs.loadFailed": "यह दस्तावेज़ पढ़ा नहीं जा सका।",
  "docs.page": "पृष्ठ {n}",
  "docs.truncated": "बाकी हिस्सा नहीं दिखाया गया: यह दस्तावेज़ व्यूअर की सीमा से बड़ा है।",

  "docs.scopeChat": "इसी दस्तावेज़ से पूछें",
  "docs.scoped": "अब प्रश्न {title} तक सीमित हैं",
  "docs.download": "मूल फ़ाइल डाउनलोड करें",
  "docs.pageCount": "{n} पृष्ठ",
  "docs.onePage": "1 पृष्ठ",
  "docs.copyText": "पाठ कॉपी करें",
  "docs.copied": "पाठ कॉपी हो गया",
  "docs.copyFailed": "कॉपी नहीं हो सका",
};

const id = {
  "docs.section": "Dokumen",
  "docs.upload": "Unggah dokumen",
  "docs.empty": "Belum ada dokumen. Unggah satu dan akan diindeks saat tiba.",
  "docs.options": "Opsi dokumen",
  "docs.open": "Buka",
  "docs.failed": "Gagal",
  "docs.deleteTitle": "Hapus dokumen?",
  "docs.deleteText":
    "Ini menghapus berkas dan semua yang diindeks darinya. Obrolan yang mengutipnya tetap menyimpan teksnya.",
  "docs.deleted": "Dokumen dihapus",
  "docs.deleteFailed": "Dokumen gagal dihapus",
  "docs.renameFailed": "Dokumen gagal diganti namanya",

  "docs.reading": "Baca",
  "docs.readingView": "Baca teks hasil ekstraksi",
  "docs.codeView": "Sumber",
  "docs.loading": "Membaca dokumen…",
  "docs.loadFailed": "Dokumen ini tidak bisa dibaca.",
  "docs.page": "Halaman {n}",
  "docs.truncated": "Sisanya tidak ditampilkan: dokumen ini lebih panjang daripada yang dimuat penampil.",

  "docs.scopeChat": "Tanya tentang dokumen ini",
  "docs.scoped": "Pertanyaan kini dibatasi pada {title}",
  "docs.download": "Unduh berkas asli",
  "docs.pageCount": "{n} halaman",
  "docs.onePage": "1 halaman",
  "docs.copyText": "Salin teks",
  "docs.copied": "Teks tersalin",
  "docs.copyFailed": "Gagal menyalin",
};

const it = {
  "docs.section": "Documenti",
  "docs.upload": "Carica un documento",
  "docs.empty": "Ancora nessun documento. Caricane uno e verrà indicizzato all’arrivo.",
  "docs.options": "Opzioni del documento",
  "docs.open": "Apri",
  "docs.failed": "Non riuscito",
  "docs.deleteTitle": "Eliminare il documento?",
  "docs.deleteText":
    "Rimuove il file e tutto ciò che ne è stato indicizzato. Le chat che lo citavano conservano il loro testo.",
  "docs.deleted": "Documento eliminato",
  "docs.deleteFailed": "Impossibile eliminare il documento",
  "docs.renameFailed": "Impossibile rinominare il documento",

  "docs.reading": "Lettura",
  "docs.readingView": "Leggi il testo estratto",
  "docs.codeView": "Sorgente",
  "docs.loading": "Lettura del documento…",
  "docs.loadFailed": "Non è stato possibile leggere questo documento.",
  "docs.page": "Pagina {n}",
  "docs.truncated": "Il resto non è mostrato: questo documento è più lungo di quanto il visualizzatore carichi.",

  "docs.scopeChat": "Chiedi di questo documento",
  "docs.scoped": "Le domande ora riguardano {title}",
  "docs.download": "Scarica l’originale",
  "docs.pageCount": "{n} pagine",
  "docs.onePage": "1 pagina",
  "docs.copyText": "Copia il testo",
  "docs.copied": "Testo copiato",
  "docs.copyFailed": "Copia non riuscita",
};

const ja = {
  "docs.section": "ドキュメント",
  "docs.upload": "ドキュメントをアップロード",
  "docs.empty": "ドキュメントはまだありません。アップロードすると、その場でインデックスします。",
  "docs.options": "ドキュメントの操作",
  "docs.open": "開く",
  "docs.failed": "失敗",
  "docs.deleteTitle": "ドキュメントを削除しますか？",
  "docs.deleteText":
    "ファイルと、そこからインデックスしたものすべてを削除します。引用したチャットの本文は残ります。",
  "docs.deleted": "ドキュメントを削除しました",
  "docs.deleteFailed": "ドキュメントを削除できませんでした",
  "docs.renameFailed": "ドキュメントの名前を変更できませんでした",

  "docs.reading": "本文",
  "docs.readingView": "抽出したテキストを読む",
  "docs.codeView": "ソース",
  "docs.loading": "ドキュメントを読み込んでいます…",
  "docs.loadFailed": "このドキュメントを読み込めませんでした。",
  "docs.page": "{n} ページ",
  "docs.truncated": "残りは表示していません。このドキュメントはビューアが読み込む長さを超えています。",

  "docs.scopeChat": "このドキュメントに質問する",
  "docs.scoped": "質問の範囲を「{title}」にしました",
  "docs.download": "元のファイルをダウンロード",
  "docs.pageCount": "{n} ページ",
  "docs.onePage": "1 ページ",
  "docs.copyText": "テキストをコピー",
  "docs.copied": "テキストをコピーしました",
  "docs.copyFailed": "コピーできませんでした",
};

const ko = {
  "docs.section": "문서",
  "docs.upload": "문서 업로드",
  "docs.empty": "아직 문서가 없습니다. 업로드하면 도착하는 대로 색인합니다.",
  "docs.options": "문서 옵션",
  "docs.open": "열기",
  "docs.failed": "실패",
  "docs.deleteTitle": "문서를 삭제할까요?",
  "docs.deleteText":
    "파일과 거기서 색인된 모든 것을 제거합니다. 그것을 인용한 채팅의 본문은 그대로 남습니다.",
  "docs.deleted": "문서를 삭제했습니다",
  "docs.deleteFailed": "문서를 삭제하지 못했습니다",
  "docs.renameFailed": "문서 이름을 바꾸지 못했습니다",

  "docs.reading": "본문",
  "docs.readingView": "추출된 텍스트 읽기",
  "docs.codeView": "소스",
  "docs.loading": "문서를 읽는 중…",
  "docs.loadFailed": "이 문서를 읽지 못했습니다.",
  "docs.page": "{n}쪽",
  "docs.truncated": "나머지는 표시하지 않습니다. 이 문서는 뷰어가 불러오는 길이를 넘습니다.",

  "docs.scopeChat": "이 문서에 대해 묻기",
  "docs.scoped": "이제 질문 범위가 {title}입니다",
  "docs.download": "원본 내려받기",
  "docs.pageCount": "{n}쪽",
  "docs.onePage": "1쪽",
  "docs.copyText": "텍스트 복사",
  "docs.copied": "텍스트를 복사했습니다",
  "docs.copyFailed": "복사하지 못했습니다",
};

const pt = {
  "docs.section": "Documentos",
  "docs.upload": "Enviar um documento",
  "docs.empty": "Nenhum documento ainda. Envie um e ele será indexado ao chegar.",
  "docs.options": "Opções do documento",
  "docs.open": "Abrir",
  "docs.failed": "Falhou",
  "docs.deleteTitle": "Excluir documento?",
  "docs.deleteText":
    "Isso remove o arquivo e tudo que foi indexado dele. As conversas que o citaram mantêm seu texto.",
  "docs.deleted": "Documento excluído",
  "docs.deleteFailed": "Não foi possível excluir o documento",
  "docs.renameFailed": "Não foi possível renomear o documento",

  "docs.reading": "Leitura",
  "docs.readingView": "Ler o texto extraído",
  "docs.codeView": "Código-fonte",
  "docs.loading": "Lendo o documento…",
  "docs.loadFailed": "Não foi possível ler este documento.",
  "docs.page": "Página {n}",
  "docs.truncated": "O restante não é mostrado: este documento é maior do que o visualizador carrega.",

  "docs.scopeChat": "Perguntar sobre este documento",
  "docs.scoped": "As perguntas agora se limitam a {title}",
  "docs.download": "Baixar o original",
  "docs.pageCount": "{n} páginas",
  "docs.onePage": "1 página",
  "docs.copyText": "Copiar o texto",
  "docs.copied": "Texto copiado",
  "docs.copyFailed": "Não foi possível copiar",
};

const es419 = {
  "docs.section": "Documentos",
  "docs.upload": "Subir un documento",
  "docs.empty": "Aún no hay documentos. Sube uno y se indexará al llegar.",
  "docs.options": "Opciones del documento",
  "docs.open": "Abrir",
  "docs.failed": "Falló",
  "docs.deleteTitle": "¿Eliminar el documento?",
  "docs.deleteText":
    "Esto elimina el archivo y todo lo indexado a partir de él. Los chats que lo citaron conservan su texto.",
  "docs.deleted": "Documento eliminado",
  "docs.deleteFailed": "No se pudo eliminar el documento",
  "docs.renameFailed": "No se pudo renombrar el documento",

  "docs.reading": "Lectura",
  "docs.readingView": "Leer el texto extraído",
  "docs.codeView": "Código fuente",
  "docs.loading": "Leyendo el documento…",
  "docs.loadFailed": "No se pudo leer este documento.",
  "docs.page": "Página {n}",
  "docs.truncated": "El resto no se muestra: este documento es más largo de lo que carga el visor.",

  "docs.scopeChat": "Preguntar sobre este documento",
  "docs.scoped": "Las preguntas ahora se limitan a {title}",
  "docs.download": "Descargar el original",
  "docs.pageCount": "{n} páginas",
  "docs.onePage": "1 página",
  "docs.copyText": "Copiar el texto",
  "docs.copied": "Texto copiado",
  "docs.copyFailed": "No se pudo copiar",
};

const esES = {
  ...es419,
  "docs.upload": "Subir un documento",
  "docs.download": "Descargar el archivo original",
  "docs.scopeChat": "Preguntar por este documento",
};

const DOCS = {
  "en-US": en,
  "fr-FR": fr,
  "de-DE": de,
  "hi-IN": hi,
  "id-ID": id,
  "it-IT": it,
  "ja-JP": ja,
  "ko-KR": ko,
  "pt-BR": pt,
  "es-419": es419,
  "es-ES": esES,
};

export default DOCS;
