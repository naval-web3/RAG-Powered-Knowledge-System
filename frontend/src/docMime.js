/**
 * What a stored document actually is, by extension.
 *
 * GET /api/documents/{id}/file is the DOWNLOAD endpoint: it answers with
 * application/octet-stream and an attachment disposition, which is right for
 * saving a file and useless for showing one -- an iframe handed an
 * octet-stream blob renders nothing at all, silently. Anything that wants to
 * SHOW a file therefore rebuilds the blob with the type the document says it
 * is. Two viewers need that, so the map lives here rather than in either.
 *
 * Do not "fix" this in the backend: a download must stay a download.
 */
export const MIME = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export default MIME;
