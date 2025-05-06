"""
Reusable GOOD / BAD summaries for unit tests.
"""

from app.services.chat.models.general import Summary, Figure

GOOD_SUMMARIES = [
    Summary(
        title="Tiny summary",
        preamble="Intro [1]",
        body="- point one\n- point two {1}",
        conclusion="done.",
        references=[1],
        figures=[Figure(title="F", latex_code="LC", references=[], message="")],
        message="good summary",
    ),
]

BAD_SUMMARIES = [
    # Missing body text
    (
        Summary(
            title="No body",
            preamble="just preamble",
            body="",
            conclusion="fin",
            references=[],
            figures=[],
            message="",
        ),
        "body",
    ),
    # Figure list supplied but latex_code empty
    (
        Summary(
            title="Bad fig",
            preamble="p",
            body="b {1}",
            conclusion="c",
            figures=[Figure(title="X", latex_code="", references=[], message="")],
            message="",
        ),
        "latex_code",
    ),
]
