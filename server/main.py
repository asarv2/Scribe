from lecture.condense.terms_processor import TermsProcessor
from lecture.condense.groups_processor import GroupsProcessor
from lecture.parse.slide_processor import SlideProcessor
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
    
    # slide_processor.save_notes_supabase()
    
    # slide_processor.process_slides(num_docs=5, num_slides=3)
    
    terms_processor = TermsProcessor(
        class_id=class_id,
        output_dir=output_dir,
        regenerate=False
    )
    # terms_processor.process_terms()
    
    # Initialize and process groups with automatic recursion
    groups_processor = GroupsProcessor(
        terms=terms_processor.terms,
        depth=1,
        max_depth=2,
        class_id=class_id,
        output_dir=output_dir,
        regenerate=False
    )
    # groups_processor.process_groups()
    groups_processor.save_groups_supabase()