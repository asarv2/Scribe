"""
Reusable samples for the question tool.

GOOD_QUESTIONS  -  two well-formed questions (MCQ & FRQ)
BAD_QUESTIONS   -  inputs that should *fail* inside create_questions
"""

from app.services.chat.models.general import Question

GOOD_QUESTIONS = [
    # ── simple MCQ ─────────────────────────────────────────────────────
    Question(
        title="Basic arithmetic",
        question_type="mcq",
        question="What is 2+2?",
        options=["4", "3", "22"],
        answer="4",
        explanations=["2 + 2 equals 4 because of elementary integer addition."],
        references=[],
        figures=[],
        message="added mcq",
    ),
    # ── simple FRQ ─────────────────────────────────────────────────────
    Question(
        title="Newton's 2nd law",
        question_type="frq",
        question="State Newton's second law of motion.",
        options=[],
        answer="Force equals mass times acceleration, F=m*a.",
        explanations=[],
        references=[],
        figures=[],
        message="added frq",
    ),
]

BAD_QUESTIONS = [
    # MCQ with **blank answer**
    (
        Question(
            title="No answer MCQ",
            question_type="mcq",
            question="Largest planet in the Solar System?",
            options=["Jupiter", "Mars"],
            answer="",  # ← missing
            explanations=[],
            references=[],
            figures=[],
            message="",
        ),
        "answer",  # phrase expected to appear in the error string
    )
]
