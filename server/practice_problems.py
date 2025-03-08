import asyncio
import os
from app.services.chat.problems_processor import ProblemsProcessor

from dotenv import load_dotenv

load_dotenv()

if __name__ == "__main__":
    async def test_problems_processor():
        # Check if API key is set
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            print("ERROR: GOOGLE_API_KEY environment variable is not set!")
            print("Please set the API key before running this script.")
            return
        else:
            print(f"Using Google API key: {api_key[:5]}...{api_key[-5:]}")
        
        # Sample course content
        course_title = "Advanced Optimization Methods"
        print(f"Initializing test for course: {course_title}")
        
        # Sample lecture content
        lecture_content = {
            "lecture1": [
                "Linear Programming (LP) is a mathematical optimization technique used to find the best outcome in a mathematical model.",
                "The Simplex Method is an algorithm for solving linear programming problems.",
                "A Basic Feasible Solution (BFS) is a solution that satisfies all constraints and has exactly m basic variables.",
                "Degeneracy occurs when a basic variable has a value of zero.",
                "Cycling can occur in degenerate problems, where the algorithm revisits the same BFS."
            ]
        }
        print(f"Loaded lecture content with {len(lecture_content)} lectures")
        
        # Sample lectures metadata
        lectures = [
            {"id": "lecture1", "note_number": 1, "title": "Introduction to Linear Programming"}
        ]
        print(f"Loaded metadata for {len(lectures)} lectures")
        
        # Sample question prompts
        question_prompts = [
            {
                "id": "lecture1",
                "mcq": False,
                "multi_part": False,
                "computational": False,
                "additional_info": "Focus on the Simplex Method and degeneracy concepts."
            }
        ]
        print(f"Created {len(question_prompts)} question prompts")
        
        # Initialize the processor
        print("Initializing ProblemsProcessor...")
        processor = ProblemsProcessor(course_title, lecture_content)
        print("ProblemsProcessor initialized successfully")
        
        # Process the questions
        async def on_batch_complete(batch):
            print(f"Completed batch with {len(batch)} question groups")
            for i, group in enumerate(batch):
                print(f"  Group {i+1}: {len(group)} questions")
                for j, question in enumerate(group):
                    q_type = "MCQ" if "options" in question else "FRQ"
                    print(f"    Question {j+1}: {q_type} - Tags: {question['tags']}")
        
        print("Starting to process problems...")
        try:
            questions = await processor.process_problems(question_prompts, lectures, on_batch_complete)
            print("Successfully processed all problems")
            
            # Export to JSON
            print("Exporting results to JSON...")
            processor.export_to_json("generated_problems.json")
            print("Export complete")
            
            # Print a summary
            print("\nGenerated Questions Summary:")
            for question_id, question_groups in questions.items():
                print(f"\nQuestion ID: {question_id}")
                for i, group in enumerate(question_groups):
                    print(f"  Group {i+1}: {len(group)} questions")
                    for j, question in enumerate(group):
                        q_type = "MCQ" if "options" in question else "FRQ"
                        print(f"    Question {j+1}: {q_type} - Tags: {question['tags']}")
            
            print("\nFull JSON output saved to 'generated_problems.json'")
        except Exception as e:
            print(f"ERROR during processing: {str(e)}")
            import traceback
            traceback.print_exc()
    
    print("Starting test script...")
    asyncio.run(test_problems_processor())
    print("Test script completed")