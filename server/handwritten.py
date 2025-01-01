from lecture.condense.terms_processor import TermsProcessor
from lecture.condense.groups_processor import GroupsProcessor
from lecture.parse.slide_processor import SlideProcessor
from lecture.questions.old.problems_processor import ProblemsProcessor
from lecture.questions.lecture_problems_processor import LectureProblemsProcessor
from lecture.questions.base_problems_processor import QuestionType
from lecture.questions.topic_problems_processor import TopicProblemsProcessor
from lecture.summary.lecture_summary_processor import LectureSummaryProcessor
if __name__ == "__main__":
    # Process terms first
    
    class_id = "3236bffb-cfa4-47b8-a0a2-44427df57e3b" # for Linear Programming
    notes_dir = "/Users/ashoksaravanan/Coding/ScribeLec/server/Notes/Notes_MA421"
    output_dir = "/Users/ashoksaravanan/Coding/ScribeLec/server/output"
    
    # slide_processor = SlideProcessor(
    #     notes_dir=notes_dir,
    #     handwritten=True,
    #     class_id=class_id,
    #     output_dir=output_dir,
    #     regenerate=False
    # )
    # slide_processor.save_figures_png(slide_processor.lectures_output_dir)
    
    # slide_processor.save_notes_pdf(slide_processor.lectures_output_dir)
    
    # slide_processor.save_notes_storage_supabase()
    
    # slide_processor.save_notes_supabase()
    
    # slide_processor.process_slides()
    
    # slide_processor.save_figures_storage_supabase()
    # slide_processor.save_notes_storage_supabase()
    # slide_processor.save_notes_supabase()
    
    # problems_processor = ProblemsProcessor(
    #     class_id=class_id,
    #     output_dir=output_dir,
    #     regenerate=False
    # )   
    
    # problems_processor.process_problems()
    # problems_processor.save_questions_text(problems_processor.lectures_output_dir)
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
    #     depth=1,
    #     max_depth=2,
    #     class_id=class_id,
    #     output_dir=output_dir,
    #     regenerate=False
    # )
    # groups_processor.process_groups()
    # groups_processor.save_groups_supabase()
    
    
    # lecture_problems_processor = LectureProblemsProcessor(
    #     question_type=QuestionType.MCQ,
    #     class_id=class_id,
    #     output_dir=output_dir,
    #     regenerate=False
    # )
    # lecture_problems_processor.save_questions_supabase()
    # lecture_problems_processor.process_problems(num_questions=10, single_multi_part_ratio=0.8, conceptual_computational_ratio=0.5)
    
    # topic_problems_processor = TopicProblemsProcessor(
    #     question_type=QuestionType.MCQ,
    #     class_id=class_id,
    #     output_dir=output_dir,
    #     regenerate=False
    # )
    # topic_problems_processor.save_questions_supabase()
    # topic_problems_processor.process_problems(num_questions=10, single_multi_part_ratio=0.8, conceptual_computational_ratio=0.5)
    
    summary_processor = LectureSummaryProcessor(
        class_id=class_id,
        output_dir=output_dir,
        regenerate=False
    )
    # summary_processor.process_summary()
    summary_processor.save_summary_supabase()