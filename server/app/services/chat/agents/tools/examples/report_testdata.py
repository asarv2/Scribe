"""
Reusable GOOD / BAD reports for unit tests.
"""

from app.services.chat.models.general import Report, Figure

GOOD_REPORTS = [
    Report(
        title="Mini report",
        content="Cool stuff [3]. Figure {1}",
        references=[3],
        figures=[Figure(title="fig", latex_code="LC", references=[], message="")],
        message="good report",
    ),
]

BAD_REPORTS = [
    # Empty content
    (
        Report(
            title="Empty content", content="", references=[], figures=[], message=""
        ),
        "content",
    ),
    # Figure with dangerous LaTeX
    (
        Report(
            title="Bad figure",
            content="see {1}",
            figures=[
                Figure(title="F", latex_code="\\write18{rm -rf /}", references=[])
            ],
            references=[],
            message="",
        ),
        "Shell-escape",
    ),
]
