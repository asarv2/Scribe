from lecture.condense.terms_processor import TermsProcessor
from lecture.condense.groups_processor import GroupsProcessor

if __name__ == "__main__":
    # Process terms first
    
    course_title = "Linear Programming"
    course_code = "MA421"
    notes_folder = "/Users/ashoksaravanan/Coding/ScribeLec/server/output/notes_MA421"
    output_dir = "/Users/ashoksaravanan/Coding/ScribeLec/server/output/summary_MA421"
    timestamp = "2024-12-12_16-45-37"
    
    terms_processor = TermsProcessor(
        course_title=course_title,
        course_code=course_code,
        notes_folder=notes_folder,
        output_dir=output_dir,
        timestamp=timestamp,
        regenerate_timestamp=False
    )
    # terms_processor.process_terms()
    
    # Initialize and process groups with automatic recursion
    groups_processor = GroupsProcessor(
        terms=terms_processor.terms,
        depth=1,
        max_depth=2,
        save_groups=True,
        course_title=course_title,
        course_code=course_code,
        output_dir=output_dir,
        timestamp=timestamp,
        regenerate_timestamp=True
    )
    
    groups_processor.process_groups()
    
    
