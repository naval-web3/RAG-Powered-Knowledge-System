/**
 * Chat page strings, kept in their own file so neither this nor the shell's
 * dictionary grows past reading length.
 *
 * Two keys hold LISTS, joined with "|" and split where they are used: the
 * rotating opening prompts, and the words shown while the model works. Twelve
 * separate keys for twelve single words would have been twelve times the
 * bookkeeping for no gain, and a translator wants to see the set together
 * anyway so the words stay varied.
 *
 * The four suggestion cards are translated and asked as translated: clicking
 * one sends the text you can read. Documents are usually in English, so a
 * question in another language leans on the embedding model to bridge the two.
 */

const en = {
  "chat.greeting.morning": "Good morning, {name}",
  "chat.greeting.afternoon": "Good afternoon, {name}",
  "chat.greeting.evening": "Good evening, {name}",
  "chat.prompts": "Where shall we start?|What’s on your mind?|What are we looking for?",
  "chat.private": "You’re private",

  "chat.suggest.summarize": "Summarize what my documents say.",
  "chat.suggest.subjects": "What subjects do my documents cover?",
  "chat.suggest.sections": "List the sections of my most recent upload.",
  "chat.suggest.whatsInside": "What’s in this knowledge base?",

  "chat.placeholder": "Ask your knowledge base",
  "chat.placeholder2": "Summarise a document for me",
  "chat.placeholder3": "What do my documents say?",
  "chat.messageAria": "Message",
  "chat.hint":
    "Retrieva answers only from your indexed documents. Check anything important against the document itself.",

  "chat.thinkingWords":
    "Thinking|Reading|Retrieving|Searching|Considering|Cross-referencing|Gathering|Weighing|Consulting|Sifting|Tracing|Piecing it together",
  "chat.thoughtFor": "Thought for {n}s",
  "chat.stopped": "Stopped",

  "chat.copy": "Copy",
  "chat.copied": "Copied",
  "chat.copyFailed": "Couldn’t copy",
  "chat.promptCopied": "Prompt copied",
  "chat.editResend": "Edit & resend",
  "chat.goodAnswer": "Good answer",
  "chat.needsWork": "Needs work",
  "chat.markedGood": "Marked as a good answer",
  "chat.markedNeedsWork": "Marked as needing work",

  "chat.dictate": "Dictate with your voice",
  "chat.dictateAria": "Dictate",
  "chat.listening": "Listening…",
  "chat.dictateAccept": "Done",
  "chat.dictationUnsupported": "Voice input isn’t supported in this browser",
  "chat.micBlocked": "Microphone is blocked. Allow it in the browser to dictate",
  "chat.stop": "Stop",
  "chat.stopGenerating": "Stop generating",
  "chat.send": "Send message",

  "chat.add": "Add",
  "chat.uploading": "Uploading…",
  "chat.uploadDoc": "Upload a document",
  "chat.uploadDocSub": "PDF, DOCX or TXT, indexed on arrival",
  "chat.browseLibrary": "Browse the library",
  "chat.docsIndexed": "{n} documents indexed",
  "chat.oneDocIndexed": "1 document indexed",

  "chat.allDocuments": "All documents",
  "chat.retrievalScope": "Retrieval scope",
  "chat.wholeCorpus": "search the whole corpus",
  "chat.noScopeDocs": "No indexed documents to scope to yet.",
  "chat.chunks": "{n} chunks",
  "chat.scopedTo": "Scoped to",
  "chat.clearScope": "Clear scope",

  "chat.modelSlow": "More accurate · slower on your GPU",
  "chat.modelFast": "Faster · may make mistakes",
  "chat.ollamaLocal": "Ollama · local",
  "chat.openaiCloud": "OpenAI · cloud",
  "chat.cloudInference": "cloud inference",
  "chat.addApiKey": "add API key",
  "chat.slow": "slow",
  "chat.modelSize": "Size",
  "chat.moreModels": "More models",
};

const fr = {
  "chat.greeting.morning": "Bonjour, {name}",
  "chat.greeting.afternoon": "Bon après-midi, {name}",
  "chat.greeting.evening": "Bonsoir, {name}",
  "chat.prompts": "Par où commençons-nous ?|À quoi pensez-vous ?|Que cherchons-nous ?",
  "chat.private": "Vous êtes en privé",

  "chat.suggest.summarize": "Résume ce que disent mes documents.",
  "chat.suggest.subjects": "Quels sujets couvrent mes documents ?",
  "chat.suggest.sections": "Liste les sections de mon dernier document ajouté.",
  "chat.suggest.whatsInside": "Que contient cette base de connaissances ?",

  "chat.placeholder": "Interrogez votre base de connaissances",
  "chat.placeholder2": "Résumez-moi un document",
  "chat.placeholder3": "Que disent mes documents ?",
  "chat.messageAria": "Message",
  "chat.hint":
    "Retrieva répond uniquement à partir de vos documents indexés. Vérifiez tout point important dans le document lui-même.",

  "chat.thinkingWords":
    "Réflexion|Lecture|Récupération|Recherche|Analyse|Recoupement|Collecte|Évaluation|Consultation|Tri|Repérage|Assemblage",
  "chat.thoughtFor": "Réfléchi pendant {n} s",
  "chat.stopped": "Arrêté",

  "chat.copy": "Copier",
  "chat.copied": "Copié",
  "chat.copyFailed": "Copie impossible",
  "chat.promptCopied": "Question copiée",
  "chat.editResend": "Modifier et renvoyer",
  "chat.goodAnswer": "Bonne réponse",
  "chat.needsWork": "À améliorer",
  "chat.markedGood": "Marquée comme bonne réponse",
  "chat.markedNeedsWork": "Marquée comme à améliorer",

  "chat.dictate": "Dicter à la voix",
  "chat.dictateAria": "Dicter",
  "chat.listening": "Écoute…",
  "chat.dictateAccept": "Terminé",
  "chat.dictationUnsupported": "La saisie vocale n’est pas prise en charge par ce navigateur",
  "chat.micBlocked": "Le micro est bloqué. Autorisez-le dans le navigateur pour dicter",
  "chat.stop": "Arrêter",
  "chat.stopGenerating": "Arrêter la génération",
  "chat.send": "Envoyer le message",

  "chat.add": "Ajouter",
  "chat.uploading": "Envoi…",
  "chat.uploadDoc": "Ajouter un document",
  "chat.uploadDocSub": "PDF, DOCX ou TXT, indexé à l’arrivée",
  "chat.browseLibrary": "Parcourir la bibliothèque",
  "chat.docsIndexed": "{n} documents indexés",
  "chat.oneDocIndexed": "1 document indexé",

  "chat.allDocuments": "Tous les documents",
  "chat.retrievalScope": "Portée de la recherche",
  "chat.wholeCorpus": "chercher dans tout le corpus",
  "chat.noScopeDocs": "Aucun document indexé sur lequel se restreindre.",
  "chat.chunks": "{n} fragments",
  "chat.scopedTo": "Limité à",
  "chat.clearScope": "Retirer la restriction",

  "chat.modelSlow": "Plus précis · plus lent sur votre GPU",
  "chat.modelFast": "Plus rapide · peut se tromper",
  "chat.ollamaLocal": "Ollama · local",
  "chat.openaiCloud": "OpenAI · cloud",
  "chat.cloudInference": "inférence dans le cloud",
  "chat.addApiKey": "ajouter une clé API",
  "chat.slow": "lent",
  "chat.modelSize": "Taille",
  "chat.moreModels": "Plus de modèles",
};

const de = {
  "chat.greeting.morning": "Guten Morgen, {name}",
  "chat.greeting.afternoon": "Guten Tag, {name}",
  "chat.greeting.evening": "Guten Abend, {name}",
  "chat.prompts": "Womit fangen wir an?|Woran denken Sie?|Wonach suchen wir?",
  "chat.private": "Sie sind privat",

  "chat.suggest.summarize": "Fasse zusammen, was in meinen Dokumenten steht.",
  "chat.suggest.subjects": "Welche Themen decken meine Dokumente ab?",
  "chat.suggest.sections": "Liste die Abschnitte meines zuletzt hochgeladenen Dokuments auf.",
  "chat.suggest.whatsInside": "Was steckt in dieser Wissensbasis?",

  "chat.placeholder": "Fragen Sie Ihre Wissensbasis",
  "chat.placeholder2": "Fassen Sie ein Dokument für mich zusammen",
  "chat.placeholder3": "Was sagen meine Dokumente?",
  "chat.messageAria": "Nachricht",
  "chat.hint":
    "Retrieva antwortet nur aus Ihren indexierten Dokumenten. Prüfen Sie Wichtiges im Dokument selbst nach.",

  "chat.thinkingWords":
    "Denken|Lesen|Abrufen|Suchen|Abwägen|Querlesen|Sammeln|Prüfen|Nachschlagen|Sichten|Verfolgen|Zusammensetzen",
  "chat.thoughtFor": "{n} s nachgedacht",
  "chat.stopped": "Angehalten",

  "chat.copy": "Kopieren",
  "chat.copied": "Kopiert",
  "chat.copyFailed": "Kopieren fehlgeschlagen",
  "chat.promptCopied": "Frage kopiert",
  "chat.editResend": "Bearbeiten & erneut senden",
  "chat.goodAnswer": "Gute Antwort",
  "chat.needsWork": "Verbesserungswürdig",
  "chat.markedGood": "Als gute Antwort markiert",
  "chat.markedNeedsWork": "Als verbesserungswürdig markiert",

  "chat.dictate": "Per Stimme diktieren",
  "chat.dictateAria": "Diktieren",
  "chat.listening": "Hört zu…",
  "chat.dictateAccept": "Fertig",
  "chat.dictationUnsupported": "Spracheingabe wird in diesem Browser nicht unterstützt",
  "chat.micBlocked": "Das Mikrofon ist blockiert. Erlauben Sie es im Browser zum Diktieren",
  "chat.stop": "Stopp",
  "chat.stopGenerating": "Erzeugung anhalten",
  "chat.send": "Nachricht senden",

  "chat.add": "Hinzufügen",
  "chat.uploading": "Wird hochgeladen…",
  "chat.uploadDoc": "Dokument hochladen",
  "chat.uploadDocSub": "PDF, DOCX oder TXT, beim Eintreffen indexiert",
  "chat.browseLibrary": "Bibliothek durchsehen",
  "chat.docsIndexed": "{n} Dokumente indexiert",
  "chat.oneDocIndexed": "1 Dokument indexiert",

  "chat.allDocuments": "Alle Dokumente",
  "chat.retrievalScope": "Suchbereich",
  "chat.wholeCorpus": "den gesamten Bestand durchsuchen",
  "chat.noScopeDocs": "Noch keine indexierten Dokumente zum Eingrenzen.",
  "chat.chunks": "{n} Abschnitte",
  "chat.scopedTo": "Eingegrenzt auf",
  "chat.clearScope": "Eingrenzung aufheben",

  "chat.modelSlow": "Genauer · langsamer auf Ihrer GPU",
  "chat.modelFast": "Schneller · kann Fehler machen",
  "chat.ollamaLocal": "Ollama · lokal",
  "chat.openaiCloud": "OpenAI · Cloud",
  "chat.cloudInference": "Inferenz in der Cloud",
  "chat.addApiKey": "API-Schlüssel hinterlegen",
  "chat.slow": "langsam",
  "chat.modelSize": "Größe",
  "chat.moreModels": "Weitere Modelle",
};

const hi = {
  "chat.greeting.morning": "सुप्रभात, {name}",
  "chat.greeting.afternoon": "शुभ दोपहर, {name}",
  "chat.greeting.evening": "शुभ संध्या, {name}",
  "chat.prompts": "कहाँ से शुरू करें?|आपके मन में क्या है?|हम क्या खोज रहे हैं?",
  "chat.private": "आप निजी मोड में हैं",

  "chat.suggest.summarize": "मेरे दस्तावेज़ों में जो कहा गया है, उसका सार बताइए।",
  "chat.suggest.subjects": "मेरे दस्तावेज़ किन विषयों को कवर करते हैं?",
  "chat.suggest.sections": "मेरे सबसे हाल के अपलोड के अनुभाग सूचीबद्ध कीजिए।",
  "chat.suggest.whatsInside": "इस नॉलेज बेस में क्या है?",

  "chat.placeholder": "अपने नॉलेज बेस से पूछें",
  "chat.placeholder2": "मेरे लिए एक दस्तावेज़ का सारांश दें",
  "chat.placeholder3": "मेरे दस्तावेज़ क्या कहते हैं?",
  "chat.messageAria": "संदेश",
  "chat.hint":
    "Retrieva केवल आपके इंडेक्स किए गए दस्तावेज़ों से उत्तर देता है। कोई भी महत्वपूर्ण बात दस्तावेज़ में स्वयं जाँच लें।",

  "chat.thinkingWords":
    "सोच रहे हैं|पढ़ रहे हैं|खोज रहे हैं|तलाश रहे हैं|विचार कर रहे हैं|मिलान कर रहे हैं|इकट्ठा कर रहे हैं|तौल रहे हैं|देख रहे हैं|छाँट रहे हैं|खोज लगा रहे हैं|जोड़ रहे हैं",
  "chat.thoughtFor": "{n} सेकंड सोचा",
  "chat.stopped": "रोक दिया गया",

  "chat.copy": "कॉपी करें",
  "chat.copied": "कॉपी हो गया",
  "chat.copyFailed": "कॉपी नहीं हो सका",
  "chat.promptCopied": "प्रश्न कॉपी हो गया",
  "chat.editResend": "संपादित करके फिर भेजें",
  "chat.goodAnswer": "अच्छा उत्तर",
  "chat.needsWork": "सुधार की ज़रूरत है",
  "chat.markedGood": "अच्छे उत्तर के रूप में चिह्नित",
  "chat.markedNeedsWork": "सुधार की ज़रूरत के रूप में चिह्नित",

  "chat.dictate": "आवाज़ से बोलकर लिखें",
  "chat.dictateAria": "बोलकर लिखें",
  "chat.listening": "सुन रहे हैं…",
  "chat.dictateAccept": "हो गया",
  "chat.dictationUnsupported": "इस ब्राउज़र में आवाज़ से इनपुट समर्थित नहीं है",
  "chat.micBlocked": "माइक्रोफ़ोन बंद है। बोलकर लिखने के लिए ब्राउज़र में इसकी अनुमति दें",
  "chat.stop": "रोकें",
  "chat.stopGenerating": "उत्तर बनाना रोकें",
  "chat.send": "संदेश भेजें",

  "chat.add": "जोड़ें",
  "chat.uploading": "अपलोड हो रहा है…",
  "chat.uploadDoc": "दस्तावेज़ अपलोड करें",
  "chat.uploadDocSub": "PDF, DOCX या TXT, आते ही इंडेक्स हो जाता है",
  "chat.browseLibrary": "लाइब्रेरी देखें",
  "chat.docsIndexed": "{n} दस्तावेज़ इंडेक्स किए गए",
  "chat.oneDocIndexed": "1 दस्तावेज़ इंडेक्स किया गया",

  "chat.allDocuments": "सभी दस्तावेज़",
  "chat.retrievalScope": "खोज का दायरा",
  "chat.wholeCorpus": "पूरे संग्रह में खोजें",
  "chat.noScopeDocs": "दायरा तय करने के लिए अभी कोई इंडेक्स किया दस्तावेज़ नहीं है।",
  "chat.chunks": "{n} खंड",
  "chat.scopedTo": "सीमित",
  "chat.clearScope": "दायरा हटाएं",

  "chat.modelSlow": "अधिक सटीक · आपके GPU पर धीमा",
  "chat.modelFast": "तेज़ · गलती कर सकता है",
  "chat.ollamaLocal": "Ollama · लोकल",
  "chat.openaiCloud": "OpenAI · क्लाउड",
  "chat.cloudInference": "क्लाउड पर इन्फ़रेंस",
  "chat.addApiKey": "API कुंजी जोड़ें",
  "chat.slow": "धीमा",
  "chat.modelSize": "आकार",
  "chat.moreModels": "और मॉडल",
};

const id = {
  "chat.greeting.morning": "Selamat pagi, {name}",
  "chat.greeting.afternoon": "Selamat siang, {name}",
  "chat.greeting.evening": "Selamat malam, {name}",
  "chat.prompts": "Mulai dari mana?|Apa yang Anda pikirkan?|Apa yang kita cari?",
  "chat.private": "Anda sedang pribadi",

  "chat.suggest.summarize": "Ringkas isi dokumen saya.",
  "chat.suggest.subjects": "Topik apa saja yang dibahas dokumen saya?",
  "chat.suggest.sections": "Sebutkan bagian-bagian dari unggahan terbaru saya.",
  "chat.suggest.whatsInside": "Apa isi basis pengetahuan ini?",

  "chat.placeholder": "Tanyakan pada basis pengetahuan Anda",
  "chat.placeholder2": "Ringkas sebuah dokumen untuk saya",
  "chat.placeholder3": "Apa kata dokumen saya?",
  "chat.messageAria": "Pesan",
  "chat.hint":
    "Retrieva hanya menjawab dari dokumen Anda yang terindeks. Periksa hal penting langsung pada dokumennya.",

  "chat.thinkingWords":
    "Berpikir|Membaca|Mengambil|Mencari|Menimbang|Membandingkan|Mengumpulkan|Menilai|Menelaah|Menyaring|Menelusuri|Menyusun",
  "chat.thoughtFor": "Berpikir {n} detik",
  "chat.stopped": "Dihentikan",

  "chat.copy": "Salin",
  "chat.copied": "Tersalin",
  "chat.copyFailed": "Gagal menyalin",
  "chat.promptCopied": "Pertanyaan tersalin",
  "chat.editResend": "Ubah & kirim ulang",
  "chat.goodAnswer": "Jawaban bagus",
  "chat.needsWork": "Perlu diperbaiki",
  "chat.markedGood": "Ditandai sebagai jawaban bagus",
  "chat.markedNeedsWork": "Ditandai perlu diperbaiki",

  "chat.dictate": "Dikte dengan suara",
  "chat.dictateAria": "Dikte",
  "chat.listening": "Mendengarkan…",
  "chat.dictateAccept": "Selesai",
  "chat.dictationUnsupported": "Masukan suara tidak didukung di peramban ini",
  "chat.micBlocked": "Mikrofon diblokir. Izinkan di peramban untuk berdikte",
  "chat.stop": "Berhenti",
  "chat.stopGenerating": "Hentikan pembuatan jawaban",
  "chat.send": "Kirim pesan",

  "chat.add": "Tambah",
  "chat.uploading": "Mengunggah…",
  "chat.uploadDoc": "Unggah dokumen",
  "chat.uploadDocSub": "PDF, DOCX atau TXT, diindeks saat tiba",
  "chat.browseLibrary": "Telusuri pustaka",
  "chat.docsIndexed": "{n} dokumen terindeks",
  "chat.oneDocIndexed": "1 dokumen terindeks",

  "chat.allDocuments": "Semua dokumen",
  "chat.retrievalScope": "Cakupan pencarian",
  "chat.wholeCorpus": "cari di seluruh koleksi",
  "chat.noScopeDocs": "Belum ada dokumen terindeks untuk dijadikan cakupan.",
  "chat.chunks": "{n} bagian",
  "chat.scopedTo": "Dibatasi pada",
  "chat.clearScope": "Hapus batasan",

  "chat.modelSlow": "Lebih akurat · lebih lambat di GPU Anda",
  "chat.modelFast": "Lebih cepat · bisa keliru",
  "chat.ollamaLocal": "Ollama · lokal",
  "chat.openaiCloud": "OpenAI · awan",
  "chat.cloudInference": "inferensi di awan",
  "chat.addApiKey": "tambahkan kunci API",
  "chat.slow": "lambat",
  "chat.modelSize": "Ukuran",
  "chat.moreModels": "Model lainnya",
};

const it = {
  "chat.greeting.morning": "Buongiorno, {name}",
  "chat.greeting.afternoon": "Buon pomeriggio, {name}",
  "chat.greeting.evening": "Buonasera, {name}",
  "chat.prompts": "Da dove cominciamo?|A cosa stai pensando?|Che cosa cerchiamo?",
  "chat.private": "Sei in privato",

  "chat.suggest.summarize": "Riassumi quello che dicono i miei documenti.",
  "chat.suggest.subjects": "Quali argomenti trattano i miei documenti?",
  "chat.suggest.sections": "Elenca le sezioni del mio caricamento più recente.",
  "chat.suggest.whatsInside": "Che cosa c’è in questa base di conoscenza?",

  "chat.placeholder": "Interroga la tua base di conoscenza",
  "chat.placeholder2": "Riassumimi un documento",
  "chat.placeholder3": "Cosa dicono i miei documenti?",
  "chat.messageAria": "Messaggio",
  "chat.hint":
    "Retrieva risponde solo dai tuoi documenti indicizzati. Verifica ogni punto importante sul documento stesso.",

  "chat.thinkingWords":
    "Sto pensando|Sto leggendo|Sto recuperando|Sto cercando|Sto valutando|Sto confrontando|Sto raccogliendo|Sto soppesando|Sto consultando|Sto filtrando|Sto seguendo|Sto mettendo insieme",
  "chat.thoughtFor": "Ha pensato per {n} s",
  "chat.stopped": "Interrotto",

  "chat.copy": "Copia",
  "chat.copied": "Copiato",
  "chat.copyFailed": "Copia non riuscita",
  "chat.promptCopied": "Domanda copiata",
  "chat.editResend": "Modifica e reinvia",
  "chat.goodAnswer": "Buona risposta",
  "chat.needsWork": "Da migliorare",
  "chat.markedGood": "Segnata come buona risposta",
  "chat.markedNeedsWork": "Segnata come da migliorare",

  "chat.dictate": "Detta con la voce",
  "chat.dictateAria": "Detta",
  "chat.listening": "In ascolto…",
  "chat.dictateAccept": "Fatto",
  "chat.dictationUnsupported": "L’input vocale non è supportato in questo browser",
  "chat.micBlocked": "Il microfono è bloccato. Consentilo nel browser per dettare",
  "chat.stop": "Ferma",
  "chat.stopGenerating": "Ferma la generazione",
  "chat.send": "Invia messaggio",

  "chat.add": "Aggiungi",
  "chat.uploading": "Caricamento…",
  "chat.uploadDoc": "Carica un documento",
  "chat.uploadDocSub": "PDF, DOCX o TXT, indicizzato all’arrivo",
  "chat.browseLibrary": "Sfoglia la libreria",
  "chat.docsIndexed": "{n} documenti indicizzati",
  "chat.oneDocIndexed": "1 documento indicizzato",

  "chat.allDocuments": "Tutti i documenti",
  "chat.retrievalScope": "Ambito della ricerca",
  "chat.wholeCorpus": "cerca in tutto il corpus",
  "chat.noScopeDocs": "Nessun documento indicizzato su cui restringere.",
  "chat.chunks": "{n} frammenti",
  "chat.scopedTo": "Limitato a",
  "chat.clearScope": "Togli il limite",

  "chat.modelSlow": "Più preciso · più lento sulla tua GPU",
  "chat.modelFast": "Più veloce · può sbagliare",
  "chat.ollamaLocal": "Ollama · locale",
  "chat.openaiCloud": "OpenAI · cloud",
  "chat.cloudInference": "inferenza nel cloud",
  "chat.addApiKey": "aggiungi una chiave API",
  "chat.slow": "lento",
  "chat.modelSize": "Dimensione",
  "chat.moreModels": "Altri modelli",
};

const ja = {
  "chat.greeting.morning": "おはようございます、{name}さん",
  "chat.greeting.afternoon": "こんにちは、{name}さん",
  "chat.greeting.evening": "こんばんは、{name}さん",
  "chat.prompts": "どこから始めましょうか？|何をお考えですか？|何を探しましょうか？",
  "chat.private": "プライベートモードです",

  "chat.suggest.summarize": "私のドキュメントの内容を要約してください。",
  "chat.suggest.subjects": "私のドキュメントはどんな分野を扱っていますか？",
  "chat.suggest.sections": "最後にアップロードした資料の章立てを挙げてください。",
  "chat.suggest.whatsInside": "このナレッジベースには何が入っていますか？",

  "chat.placeholder": "ナレッジベースに質問する",
  "chat.placeholder2": "ドキュメントを要約して",
  "chat.placeholder3": "資料には何と書かれている？",
  "chat.messageAria": "メッセージ",
  "chat.hint":
    "Retrieva はインデックス済みのドキュメントだけから答えます。重要な点は原典でご確認ください。",

  "chat.thinkingWords":
    "考えています|読んでいます|取り出しています|探しています|検討しています|照らし合わせています|集めています|見比べています|参照しています|選り分けています|たどっています|組み立てています",
  "chat.thoughtFor": "{n}秒 考えました",
  "chat.stopped": "停止しました",

  "chat.copy": "コピー",
  "chat.copied": "コピーしました",
  "chat.copyFailed": "コピーできませんでした",
  "chat.promptCopied": "質問をコピーしました",
  "chat.editResend": "編集して再送信",
  "chat.goodAnswer": "良い回答",
  "chat.needsWork": "要改善",
  "chat.markedGood": "良い回答として記録しました",
  "chat.markedNeedsWork": "要改善として記録しました",

  "chat.dictate": "音声で入力する",
  "chat.dictateAria": "音声入力",
  "chat.listening": "聞き取り中…",
  "chat.dictateAccept": "完了",
  "chat.dictationUnsupported": "このブラウザでは音声入力を利用できません",
  "chat.micBlocked": "マイクがブロックされています。ブラウザで許可してください",
  "chat.stop": "停止",
  "chat.stopGenerating": "生成を停止",
  "chat.send": "メッセージを送信",

  "chat.add": "追加",
  "chat.uploading": "アップロード中…",
  "chat.uploadDoc": "ドキュメントをアップロード",
  "chat.uploadDocSub": "PDF、DOCX、TXT。届いた時点でインデックスします",
  "chat.browseLibrary": "ライブラリを見る",
  "chat.docsIndexed": "{n} 件のドキュメントをインデックス済み",
  "chat.oneDocIndexed": "1 件のドキュメントをインデックス済み",

  "chat.allDocuments": "すべてのドキュメント",
  "chat.retrievalScope": "検索範囲",
  "chat.wholeCorpus": "すべての資料から探す",
  "chat.noScopeDocs": "範囲を絞れるインデックス済みドキュメントがまだありません。",
  "chat.chunks": "{n} チャンク",
  "chat.scopedTo": "範囲",
  "chat.clearScope": "範囲を解除",

  "chat.modelSlow": "より正確 · お使いの GPU では低速",
  "chat.modelFast": "高速 · 誤ることがあります",
  "chat.ollamaLocal": "Ollama · ローカル",
  "chat.openaiCloud": "OpenAI · クラウド",
  "chat.cloudInference": "クラウドで推論",
  "chat.addApiKey": "API キーを追加",
  "chat.slow": "低速",
  "chat.modelSize": "サイズ",
  "chat.moreModels": "その他のモデル",
};

const ko = {
  "chat.greeting.morning": "좋은 아침이에요, {name}님",
  "chat.greeting.afternoon": "안녕하세요, {name}님",
  "chat.greeting.evening": "좋은 저녁이에요, {name}님",
  "chat.prompts": "어디서부터 시작할까요?|무엇을 생각하고 계신가요?|무엇을 찾고 있나요?",
  "chat.private": "비공개 상태입니다",

  "chat.suggest.summarize": "내 문서의 내용을 요약해 주세요.",
  "chat.suggest.subjects": "내 문서는 어떤 주제를 다루고 있나요?",
  "chat.suggest.sections": "가장 최근에 올린 문서의 목차를 알려 주세요.",
  "chat.suggest.whatsInside": "이 지식 베이스에는 무엇이 들어 있나요?",

  "chat.placeholder": "지식 베이스에 질문하기",
  "chat.placeholder2": "문서를 요약해 줘",
  "chat.placeholder3": "내 문서에는 뭐라고 나와 있어?",
  "chat.messageAria": "메시지",
  "chat.hint":
    "Retrieva는 색인된 문서에서만 답합니다. 중요한 내용은 문서에서 직접 확인하세요.",

  "chat.thinkingWords":
    "생각 중|읽는 중|가져오는 중|찾는 중|살펴보는 중|대조하는 중|모으는 중|따져보는 중|참고하는 중|추리는 중|짚어보는 중|정리하는 중",
  "chat.thoughtFor": "{n}초 동안 생각함",
  "chat.stopped": "중지됨",

  "chat.copy": "복사",
  "chat.copied": "복사됨",
  "chat.copyFailed": "복사하지 못했습니다",
  "chat.promptCopied": "질문을 복사했습니다",
  "chat.editResend": "수정 후 다시 보내기",
  "chat.goodAnswer": "좋은 답변",
  "chat.needsWork": "개선 필요",
  "chat.markedGood": "좋은 답변으로 표시했습니다",
  "chat.markedNeedsWork": "개선이 필요하다고 표시했습니다",

  "chat.dictate": "음성으로 입력",
  "chat.dictateAria": "음성 입력",
  "chat.listening": "듣는 중…",
  "chat.dictateAccept": "완료",
  "chat.dictationUnsupported": "이 브라우저에서는 음성 입력을 지원하지 않습니다",
  "chat.micBlocked": "마이크가 차단되어 있습니다. 브라우저에서 허용해 주세요",
  "chat.stop": "중지",
  "chat.stopGenerating": "생성 중지",
  "chat.send": "메시지 보내기",

  "chat.add": "추가",
  "chat.uploading": "업로드 중…",
  "chat.uploadDoc": "문서 업로드",
  "chat.uploadDocSub": "PDF, DOCX 또는 TXT. 도착하는 대로 색인합니다",
  "chat.browseLibrary": "라이브러리 보기",
  "chat.docsIndexed": "문서 {n}개 색인됨",
  "chat.oneDocIndexed": "문서 1개 색인됨",

  "chat.allDocuments": "모든 문서",
  "chat.retrievalScope": "검색 범위",
  "chat.wholeCorpus": "전체 자료에서 검색",
  "chat.noScopeDocs": "범위를 좁힐 색인된 문서가 아직 없습니다.",
  "chat.chunks": "{n}개 조각",
  "chat.scopedTo": "범위",
  "chat.clearScope": "범위 해제",

  "chat.modelSlow": "더 정확함 · GPU에서 더 느림",
  "chat.modelFast": "더 빠름 · 틀릴 수 있음",
  "chat.ollamaLocal": "Ollama · 로컬",
  "chat.openaiCloud": "OpenAI · 클라우드",
  "chat.cloudInference": "클라우드 추론",
  "chat.addApiKey": "API 키 추가",
  "chat.slow": "느림",
  "chat.modelSize": "크기",
  "chat.moreModels": "다른 모델",
};

const pt = {
  "chat.greeting.morning": "Bom dia, {name}",
  "chat.greeting.afternoon": "Boa tarde, {name}",
  "chat.greeting.evening": "Boa noite, {name}",
  "chat.prompts": "Por onde começamos?|No que você está pensando?|O que estamos procurando?",
  "chat.private": "Você está no modo privado",

  "chat.suggest.summarize": "Resuma o que meus documentos dizem.",
  "chat.suggest.subjects": "Que assuntos meus documentos cobrem?",
  "chat.suggest.sections": "Liste as seções do meu envio mais recente.",
  "chat.suggest.whatsInside": "O que há nesta base de conhecimento?",

  "chat.placeholder": "Pergunte à sua base de conhecimento",
  "chat.placeholder2": "Resuma um documento para mim",
  "chat.placeholder3": "O que meus documentos dizem?",
  "chat.messageAria": "Mensagem",
  "chat.hint":
    "O Retrieva responde apenas a partir dos seus documentos indexados. Confira o que for importante no próprio documento.",

  "chat.thinkingWords":
    "Pensando|Lendo|Recuperando|Procurando|Considerando|Cruzando dados|Reunindo|Ponderando|Consultando|Filtrando|Rastreando|Juntando as peças",
  "chat.thoughtFor": "Pensou por {n} s",
  "chat.stopped": "Interrompido",

  "chat.copy": "Copiar",
  "chat.copied": "Copiado",
  "chat.copyFailed": "Não foi possível copiar",
  "chat.promptCopied": "Pergunta copiada",
  "chat.editResend": "Editar e reenviar",
  "chat.goodAnswer": "Boa resposta",
  "chat.needsWork": "Precisa melhorar",
  "chat.markedGood": "Marcada como boa resposta",
  "chat.markedNeedsWork": "Marcada como a melhorar",

  "chat.dictate": "Ditar com a voz",
  "chat.dictateAria": "Ditar",
  "chat.listening": "Ouvindo…",
  "chat.dictateAccept": "Concluído",
  "chat.dictationUnsupported": "A entrada por voz não é suportada neste navegador",
  "chat.micBlocked": "O microfone está bloqueado. Permita no navegador para ditar",
  "chat.stop": "Parar",
  "chat.stopGenerating": "Parar a geração",
  "chat.send": "Enviar mensagem",

  "chat.add": "Adicionar",
  "chat.uploading": "Enviando…",
  "chat.uploadDoc": "Enviar um documento",
  "chat.uploadDocSub": "PDF, DOCX ou TXT, indexado ao chegar",
  "chat.browseLibrary": "Ver a biblioteca",
  "chat.docsIndexed": "{n} documentos indexados",
  "chat.oneDocIndexed": "1 documento indexado",

  "chat.allDocuments": "Todos os documentos",
  "chat.retrievalScope": "Escopo da busca",
  "chat.wholeCorpus": "buscar em todo o acervo",
  "chat.noScopeDocs": "Ainda não há documentos indexados para restringir.",
  "chat.chunks": "{n} trechos",
  "chat.scopedTo": "Restrito a",
  "chat.clearScope": "Remover a restrição",

  "chat.modelSlow": "Mais preciso · mais lento na sua GPU",
  "chat.modelFast": "Mais rápido · pode errar",
  "chat.ollamaLocal": "Ollama · local",
  "chat.openaiCloud": "OpenAI · nuvem",
  "chat.cloudInference": "inferência na nuvem",
  "chat.addApiKey": "adicionar chave de API",
  "chat.slow": "lento",
  "chat.modelSize": "Tamanho",
  "chat.moreModels": "Mais modelos",
};

const es419 = {
  "chat.greeting.morning": "Buenos días, {name}",
  "chat.greeting.afternoon": "Buenas tardes, {name}",
  "chat.greeting.evening": "Buenas noches, {name}",
  "chat.prompts": "¿Por dónde empezamos?|¿En qué estás pensando?|¿Qué estamos buscando?",
  "chat.private": "Estás en privado",

  "chat.suggest.summarize": "Resume lo que dicen mis documentos.",
  "chat.suggest.subjects": "¿Qué temas cubren mis documentos?",
  "chat.suggest.sections": "Enumera las secciones de mi carga más reciente.",
  "chat.suggest.whatsInside": "¿Qué hay en esta base de conocimiento?",

  "chat.placeholder": "Pregúntale a tu base de conocimiento",
  "chat.placeholder2": "Resume un documento para mí",
  "chat.placeholder3": "¿Qué dicen mis documentos?",
  "chat.messageAria": "Mensaje",
  "chat.hint":
    "Retrieva responde solo a partir de tus documentos indexados. Verifica lo importante en el documento mismo.",

  "chat.thinkingWords":
    "Pensando|Leyendo|Recuperando|Buscando|Considerando|Contrastando|Reuniendo|Sopesando|Consultando|Filtrando|Rastreando|Armando las piezas",
  "chat.thoughtFor": "Pensó {n} s",
  "chat.stopped": "Detenido",

  "chat.copy": "Copiar",
  "chat.copied": "Copiado",
  "chat.copyFailed": "No se pudo copiar",
  "chat.promptCopied": "Pregunta copiada",
  "chat.editResend": "Editar y reenviar",
  "chat.goodAnswer": "Buena respuesta",
  "chat.needsWork": "Se puede mejorar",
  "chat.markedGood": "Marcada como buena respuesta",
  "chat.markedNeedsWork": "Marcada como mejorable",

  "chat.dictate": "Dictar con la voz",
  "chat.dictateAria": "Dictar",
  "chat.listening": "Escuchando…",
  "chat.dictateAccept": "Listo",
  "chat.dictationUnsupported": "Este navegador no admite la entrada por voz",
  "chat.micBlocked": "El micrófono está bloqueado. Permítelo en el navegador para dictar",
  "chat.stop": "Detener",
  "chat.stopGenerating": "Detener la generación",
  "chat.send": "Enviar mensaje",

  "chat.add": "Agregar",
  "chat.uploading": "Subiendo…",
  "chat.uploadDoc": "Subir un documento",
  "chat.uploadDocSub": "PDF, DOCX o TXT, indexado al llegar",
  "chat.browseLibrary": "Ver la biblioteca",
  "chat.docsIndexed": "{n} documentos indexados",
  "chat.oneDocIndexed": "1 documento indexado",

  "chat.allDocuments": "Todos los documentos",
  "chat.retrievalScope": "Alcance de la búsqueda",
  "chat.wholeCorpus": "buscar en todo el corpus",
  "chat.noScopeDocs": "Todavía no hay documentos indexados para acotar.",
  "chat.chunks": "{n} fragmentos",
  "chat.scopedTo": "Acotado a",
  "chat.clearScope": "Quitar el acotamiento",

  "chat.modelSlow": "Más preciso · más lento en tu GPU",
  "chat.modelFast": "Más rápido · puede equivocarse",
  "chat.ollamaLocal": "Ollama · local",
  "chat.openaiCloud": "OpenAI · nube",
  "chat.cloudInference": "inferencia en la nube",
  "chat.addApiKey": "agregar clave de API",
  "chat.slow": "lento",
  "chat.modelSize": "Tamaño",
  "chat.moreModels": "Más modelos",
};

const esES = {
  ...es419,
  "chat.add": "Añadir",
  "chat.uploadDoc": "Subir un documento",
  "chat.browseLibrary": "Explorar la biblioteca",
  "chat.addApiKey": "añadir una clave de API",
  "chat.clearScope": "Quitar la restricción",
  "chat.scopedTo": "Restringido a",
  "chat.retrievalScope": "Ámbito de la búsqueda",
};

const CHAT = {
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

export default CHAT;
