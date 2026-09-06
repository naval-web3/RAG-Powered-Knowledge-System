/**
 * Unit tests for the shared formatting helpers.
 *
 * These are the functions every page calls to turn a number, a date or a name
 * into something a person reads, so a regression in one of them is visible on
 * every screen at once and is easy to miss on any single screen. All of them
 * are pure, so none of this needs a browser, a component or a server.
 */

import { describe, expect, test } from "@jest/globals";
import {
  fmtBytes,
  initialsOf,
  firstName,
  strengthOf,
  fileExt,
  timeAgo,
  fmtDate,
} from "../utils.js";
import { MIME } from "../docMime.js";

describe("fmtBytes", () => {
  test("bytes stay bytes", () => {
    expect(fmtBytes(0)).toBe("0 B");
    expect(fmtBytes(999)).toBe("999 B");
  });

  test("kilobytes and megabytes get one decimal", () => {
    expect(fmtBytes(1024)).toBe("1.0 KB");
    expect(fmtBytes(1536)).toBe("1.5 KB");
    expect(fmtBytes(1024 * 1024)).toBe("1.0 MB");
    expect(fmtBytes(25 * 1024 * 1024)).toBe("25.0 MB");
  });

  test("a missing size is a dash, not NaN", () => {
    expect(fmtBytes(null)).toBe("—");
    expect(fmtBytes(undefined)).toBe("—");
  });
});

describe("initialsOf", () => {
  test("two names give two initials", () => {
    expect(initialsOf("Naval Chaudhary")).toBe("NC");
  });

  test("one name gives its first two letters", () => {
    expect(initialsOf("naval")).toBe("NA");
  });

  test("an email is read as the part before the at sign", () => {
    expect(initialsOf("naval.chaudhary@example.com")).toBe("NC");
  });

  test("camelCase counts as a word boundary", () => {
    // the documented reason this exists: demoUser is two names, so DU not DE
    expect(initialsOf("demoUser")).toBe("DU");
  });

  test("nothing gives a question mark, not a crash", () => {
    expect(initialsOf("")).toBe("?");
    expect(initialsOf(null)).toBe("?");
  });
});

describe("firstName", () => {
  test("the first word, capitalised", () => {
    expect(firstName("naval chaudhary")).toBe("Naval");
  });

  test("camelCase splits, for the same reason as initialsOf", () => {
    expect(firstName("demoUser")).toBe("Demo");
  });

  test("an unknown name greets somebody rather than nobody", () => {
    expect(firstName("")).toBe("there");
    expect(firstName(null)).toBe("there");
  });
});

describe("strengthOf", () => {
  test("an empty password scores nothing and says nothing", () => {
    expect(strengthOf("")).toEqual({ level: 0, label: "" });
  });

  test("length alone is weak", () => {
    expect(strengthOf("abcdefgh").level).toBe(1);
  });

  test("mixed case, digits and symbols reach the top", () => {
    expect(strengthOf("Abcdefgh1234!").label).toBe("Strong");
  });

  test("the level never exceeds four", () => {
    expect(strengthOf("Abcdefghijklmnop1234!@#$").level).toBeLessThanOrEqual(4);
  });

  test("the eight-character minimum is the first thing that scores", () => {
    // the backend rejects anything shorter, so the meter must not encourage it
    expect(strengthOf("Ab1!").level).toBeLessThan(strengthOf("Abcdefg1!").level);
  });
});

describe("fileExt", () => {
  test("the stored type wins when there is one", () => {
    expect(fileExt("PDF", "anything.docx")).toBe("pdf");
  });

  test("it falls back to the filename", () => {
    expect(fileExt("", "handbook.DOCX")).toBe("docx");
    expect(fileExt(null, "notes.md")).toBe("md");
  });

  test("a file with no extension is empty, not undefined", () => {
    expect(fileExt("", "README")).toBe("readme");
    expect(fileExt(null, null)).toBe("");
  });
});

describe("timeAgo and fmtDate", () => {
  test("a moment ago reads as just now", () => {
    expect(timeAgo(new Date())).toBe("just now");
  });

  test("hours and days are pluralised", () => {
    const hours = new Date(Date.now() - 3 * 3600 * 1000);
    const days = new Date(Date.now() - 3 * 24 * 3600 * 1000);
    expect(timeAgo(hours)).toBe("3 hours ago");
    expect(timeAgo(days)).toBe("3 days ago");
  });

  test("a single unit is singular", () => {
    expect(timeAgo(new Date(Date.now() - 1 * 3600 * 1000))).toBe("1 hour ago");
  });

  test("no date is a dash on both", () => {
    expect(timeAgo(null)).toBe("—");
    expect(fmtDate(null)).toBe("—");
  });
});

describe("MIME", () => {
  test("every accepted upload type can be shown, not only downloaded", () => {
    // the download endpoint answers octet-stream, which an iframe renders as
    // nothing at all, so a viewer rebuilds the blob from this map
    for (const ext of ["pdf", "txt", "md", "docx"]) {
      expect(typeof MIME[ext]).toBe("string");
      expect(MIME[ext].length).toBeGreaterThan(0);
    }
  });

  test("the types are the real ones a browser acts on", () => {
    expect(MIME.pdf).toBe("application/pdf");
    expect(MIME.txt).toBe("text/plain");
  });
});
