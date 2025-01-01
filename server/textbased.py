from lecture.condense.terms_processor import TermsProcessor
from lecture.condense.groups_processor import GroupsProcessor
from lecture.parse.slide_processor import SlideProcessor
from lecture.questions.lecture_problems_processor import LectureProblemsProcessor
from lecture.questions.topic_problems_processor import TopicProblemsProcessor
from lecture.questions.base_problems_processor import QuestionType
if __name__ == "__main__":
    # Process terms first
    
    class_id = "c068ccf8-4892-45b3-8dab-04d5d3aa85ad" # for AI Basics
    notes_dir = "/Users/ashoksaravanan/Coding/ScribeLec/server/Notes/Notes_CS243"
    output_dir = "/Users/ashoksaravanan/Coding/ScribeLec/server/output"
    
    # slide_processor = SlideProcessor(
    #     notes_dir=notes_dir,
    #     handwritten=False,
    #     class_id=class_id,
    #     output_dir=output_dir,
    #     regenerate=False
    # )
    
    # slide_processor.save_figures_storage_supabase()
    # slide_processor.save_notes_storage_supabase()
    # slide_processor.save_notes_supabase()
    # slide_processor.save_notes_pdf(slide_processor.lectures_output_dir)
    
    # slide_processor.process_slides()
    
    # lecture_problems_processor = LectureProblemsProcessor(
    #     question_type=QuestionType.MCQ,
    #     class_id=class_id,
    #     output_dir=output_dir,
    #     regenerate=False
    # )
    # lecture_problems_processor.process_problems(num_docs=1, num_questions=10, single_multi_part_ratio=0.8, conceptual_computational_ratio=0.5)
    
    topic_problems_processor = TopicProblemsProcessor(
        question_type=QuestionType.MCQ,
        class_id=class_id,
        output_dir=output_dir,
        regenerate=False
    )
    topic_problems_processor.process_problems(num_docs=3, num_questions=10, single_multi_part_ratio=0.8, conceptual_computational_ratio=0.5)
    
    # problems_processor.save_questions_text(problems_processor.lectures_output_dir)
    # problems_processor.save_questions_pdf(problems_processor.lectures_output_dir)
    # problems_processor.save_questions_supabase()
    # problems_processor.save_questions_storage_supabase()
    
    # terms_processor = TermsProcessor(
    #     class_id=class_id,
    #     output_dir=output_dir,
    #     regenerate=False
    # )
    # terms_processor.process_terms()
    
    # Initialize and process groups with automatic recursion
    # groups_processor = GroupsProcessor(
    #     terms=terms_processor.terms,
    #     depth=2,
    #     max_depth=2,
    #     class_id=class_id,
    #     output_dir=output_dir,
    #     regenerate=False
    # )
    # groups_processor.process_groups()
    # groups_processor.save_groups_supabase()