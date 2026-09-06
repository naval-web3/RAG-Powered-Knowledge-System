"""Unit tests for the text preparation that happens before embedding.

These functions decide what a chunk contains and what section a citation can
name, so a regression in any of them changes the quality of every later answer
without breaking anything visibly. No database, no model and no network: the
whole module under test is pure string handling.
"""

from app.services.document_processor import _clean, _is_heading, _split_sections


# ---------------------------------------------------------------- _clean

def test_clean_collapses_runs_of_whitespace():
    assert _clean("Casual   leave\n\n  is credited") == "Casual leave is credited"


def test_clean_keeps_the_words_it_is_given():
    text = "Section 4.2 — leave shall not be carried forward."
    assert _clean("  " + text + "  ") == text


def test_clean_of_only_whitespace_is_empty():
    # The pipeline drops empty pieces, so this is what makes a blank page
    # produce no chunks rather than a chunk of nothing.
    assert _clean("   \n\t  \n ") == ""


# ------------------------------------------------------------ _is_heading

def test_all_caps_line_is_a_heading():
    assert _is_heading("ASSESSMENT GUIDELINES FOR PROJECT EVALUATION")


def test_numbered_line_is_a_heading():
    assert _is_heading("4.2 Leave Entitlement")
    assert _is_heading("VII Assessment")


def test_short_title_case_line_is_a_heading():
    assert _is_heading("Assessment Criteria")


def test_a_sentence_is_not_a_heading():
    # It ends in a full stop, which is the cheapest signal that it is prose.
    assert not _is_heading("Casual leave is credited at the start of the year.")


def test_a_long_line_is_not_a_heading():
    assert not _is_heading(" ".join(["Word"] * 12))


def test_a_very_short_line_is_not_a_heading():
    assert not _is_heading("A")
    assert not _is_heading("42")


def test_a_line_of_digits_is_not_a_heading():
    # Fewer than three letters: a page number is not a section.
    assert not _is_heading("2026 -- 27")


# --------------------------------------------------------- _split_sections

def test_split_sections_attributes_each_body_to_the_heading_above_it():
    page = "\n".join([
        "LEAVE POLICY",
        "Casual leave is credited annually.",
        "4.2 Carry Forward",
        "Unused leave lapses at the year end.",
    ])
    sections = _split_sections(page)
    titles = [title for title, _ in sections]
    assert titles == ["LEAVE POLICY", "4.2 Carry Forward"]
    assert "Casual leave" in sections[0][1]
    assert "lapses" in sections[1][1]


def test_text_before_the_first_heading_keeps_a_null_title():
    page = "\n".join([
        "This page begins mid-sentence with no heading of its own.",
        "LEAVE POLICY",
        "Casual leave is credited annually.",
    ])
    sections = _split_sections(page)
    assert sections[0][0] is None
    assert sections[1][0] == "LEAVE POLICY"


def test_a_page_with_no_heading_is_one_untitled_section():
    page = "A paragraph of ordinary prose, and then another one."
    assert _split_sections(page) == [(None, page)]


def test_split_sections_never_returns_nothing():
    # A chunk with no section still has to be indexable, so the citation falls
    # back to a page number rather than the pipeline dropping the text.
    assert _split_sections("") == [(None, "")]
