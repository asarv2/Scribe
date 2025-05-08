from __future__ import annotations


import pytest

# ────────────────────────────────────────────────────────────────────────────
# 1.  clean_figures ­­­———————————————————————————————————————————————
# ────────────────────────────────────────────────────────────────────────────
from app.services.chat.utils.figure_tools import clean_figures


@pytest.mark.parametrize(
    "src, by_index, exp",
    [
        # single substitution
        ("foo {1} bar", {1: "A"}, "foo <FIGURE>A</FIGURE> bar"),
        # multi-index with spaces and missing entry (index 3 is missing)
        (
            "see {1, 2,3}.",
            {1: "X", 2: "Y"},
            "see <FIGURE>X</FIGURE><FIGURE>Y</FIGURE>.",
        ),
        # duplicate placeholders appear intact
        ("{2} {2}", {2: "Z"}, "<FIGURE>Z</FIGURE> <FIGURE>Z</FIGURE>"),
        # placeholder collapses to empty when nothing matches
        ("{10} end", {1: "Q"}, " end"),
    ],
)
def test_clean_figures(src, by_index, exp):
    assert clean_figures(src, by_index) == exp
