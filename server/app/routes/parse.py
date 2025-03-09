from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import traceback
from app.extensions import supabase
from app.services.parse.lecture_processor import LectureProcessor
from app.services.parse.textbook_processor import TextbookProcessor
from app.services.parse.audio_processor import AudioProcessor
from datetime import datetime
from app.services.parse.homework_processor import HomeworkProcessor

router = APIRouter()

# Define request models
class ParseRequest(BaseModel):
    lecture_id: str | None = None
    textbook_id: str | None = None
    chapter_id: str | None = None
    homework_id: str | None = None

@router.post('/lecture')
async def parse_lecture(request: ParseRequest):
    """Parse a lecture and return the documents."""
    try:
        print("Starting parse-lecture function...")
        lecture_id = request.lecture_id
        print("Request params:", {"lecture_id": lecture_id})

        # Update lecture status to parsing
        supabase.table("lectures").update({
            "parse_status": "parsing",
            "parse_error": None,
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", lecture_id).execute()

        # Get lecture info
        lecture_response = supabase.table("lectures").select("*").eq("id", lecture_id).single().execute()
        num_pages = lecture_response.data.get('pages')
        class_id = lecture_response.data.get('class')
        has_audio = lecture_response.data.get('has_audio')
        print("Lecture query response:", lecture_response)

        # Get class title
        class_response = supabase.table("classes").select("*").eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')
        print("Class query response:", class_response)

        # Get existing documents
        documents_response = supabase.table("documents").select("*").eq("lecture", lecture_id).execute()
        documents = documents_response.data
        if not documents:
            raise HTTPException(status_code=404, detail="No documents found")

        # Filter out processed documents
        documents_to_process = [doc for doc in documents if not doc.get('processed', False)]
        # print("Documents to process:", documents_to_process)

        # Create new instance of LectureProcessor
        lecture_processor = LectureProcessor(class_title)
        print("LectureProcessor created")

        if has_audio:
            audio_processor = AudioProcessor()
            print("AudioProcessor created")

        # Process all documents at once with dynamic batching
        all_results = []
        
        # Get images and audio from supabase
        images = []
        text_contents = []
        
        try:
            for doc in documents_to_process:
                # Download image
                image_path = f"{class_id}/{lecture_id}/{doc['id']}.png"
                print(f"Trying to download: {image_path}")
                
                try:
                    response = supabase.storage.from_("lectures").download(image_path)
                except Exception as e:
                    print(f"Error downloading image {doc['page']}: {e}")
                    continue
                
                if not response:
                    print(f"No data received for image {doc['page']}")
                    continue

                images.append(response)
                print(f"Successfully downloaded image {doc['page']}")

                if has_audio:
                    # audio path
                    audio_path = f"{class_id}/{lecture_id}/{doc['id']}.wav"
                    print(f"Trying to download: {audio_path}")

                    try:
                        response = supabase.storage.from_("lectures").download(audio_path)
                    except Exception as e:
                        print(f"Error downloading audio {doc['page']}: {e}")
                        continue

                    if not response:
                        print(f"No data received for audio {doc['page']}")
                        continue

                    transcript = audio_processor.transcribe(response)
                    print(f"Transcript: {transcript}")
                    text_contents.append(transcript)
                    print(f"Successfully downloaded audio {doc['page']}")
                else:
                    text_contents.append(doc.get("text", ""))

        except Exception as error:
            print("Error in image download process:", error)
            raise error

        print("Total images downloaded:", len(images))

        # Prepare documents for processing
        processed_documents = [
            {
                "page": doc["page"],
                "image": img,
                "text": text_content,
            }
            for doc, img, text_content in zip(documents_to_process, images, text_contents)
        ]
        # print("Processed documents:", processed_documents)

        # Process all slides with dynamic batching
        print("Starting lecture processing with dynamic batching...")
        
        async def after_generate(result):
            # Find document ID
            document_id = next(
                (doc['id'] for doc in documents if doc['page'] == result.page),
                None
            )
            if not document_id:
                raise Exception(f"Document not found for page {result.page}")

            # Update document
            supabase.table("documents").update({
                "description": result.description,
                "processed": True
            }).eq("id", document_id).execute()
            
            print("Document inserted:", result.description)

        results = await lecture_processor.process_slides(
            class_title,
            num_pages,
            processed_documents,
            after_generate
        )
        print("Lecture processing complete, results:", results)

        # Convert CleanedResponse objects to dictionaries
        serializable_results = [
            {
                "page": result.page,
                "description": result.description,
            }
            for result in results
        ]
        all_results = serializable_results

        print("All results:", all_results)

        # Update lecture status to complete
        supabase.table("lectures").update({
            "parse_status": "complete",
            "parse_error": None
        }).eq("id", lecture_id).execute()

        return {"results": all_results}

    except Exception as error:
        print("Error in parse-lecture function:", {
            "name": type(error).__name__,
            "message": str(error),
            "stack": traceback.format_exc(),
        })
        
        # Update lecture status to error
        supabase.table("lectures").update({
            "parse_status": "error",
            "parse_error": str(error)
        }).eq("id", lecture_id).execute()

        raise HTTPException(status_code=500, detail={
            "error": str(error),
            "stack": traceback.format_exc(),
            "name": type(error).__name__
        })

@router.post('/textbook')
async def parse_textbook(request: ParseRequest):
    """Parse a textbook and return the documents."""
    try:
        print("Starting parse-textbook function...")
        textbook_id = request.textbook_id
        chapter_id = request.chapter_id
        print("Request params:", {"textbook_id": textbook_id, "chapter_id": chapter_id})

        # Update textbook status to parsing
        supabase.table("textbooks").update({
            "parse_status": "parsing",
            "parse_error": None,
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", textbook_id).execute()

        # Get textbook info
        textbook_response = supabase.table("textbooks").select("*").eq("id", textbook_id).single().execute()
        num_pages = textbook_response.data.get('pages')
        textbook_title = textbook_response.data.get('title')
        class_id = textbook_response.data.get('class')
        print("Textbook query response:", textbook_response)

        # get the chapter info
        chapter_title = "General"
        if chapter_id is not None:
            chapter_response = supabase.table("chapters").select("*").eq("id", chapter_id).single().execute()
            chapter_title = chapter_response.data.get('title')
            print("Chapter query response:", chapter_response)

        # Get class title
        class_response = supabase.table("classes").select("*").eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')
        print("Class query response:", class_response)

        if chapter_id is not None:
            # Get existing documents, for the chapter (required)
            documents_response = supabase.table("documents").select("*").eq("textbook", textbook_id).eq("chapter", chapter_id).execute()
            documents = documents_response.data
            if not documents:
                raise HTTPException(status_code=404, detail="No documents found")
        else:
            # Get existing documents, for the textbook (required)
            documents_response = supabase.table("documents").select("*").eq("textbook", textbook_id).execute()
            documents = documents_response.data
            if not documents:
                raise HTTPException(status_code=404, detail="No documents found")

        # Filter out processed documents
        documents_to_process = [doc for doc in documents if not doc.get('processed', False)]
        print("Documents to process:", documents_to_process)

        # Create new instance of TextbookProcessor
        textbook_processor = TextbookProcessor(class_title)
        print("TextbookProcessor created")

        # Process in batches
        batch_size = 15
        batch_results = []
        
        for i in range(0, len(documents_to_process), batch_size):
            batch = documents_to_process[i:i + batch_size]
            print("Processing batch:", batch)

            # Get images from supabase
            images = []
            
            try:
                for doc in batch:
                    # Download image - Updated path structure to match lectures
                    image_path = f"{class_id}/{textbook_id}/{doc['id']}.png"
                    print(f"Trying to download: {image_path}")
                    
                    try:
                        response = supabase.storage.from_("textbooks").download(image_path)
                    except Exception as e:
                        print(f"Error downloading image {doc['page']}: {e}")
                        continue
                    
                    if not response:
                        print(f"No data received for image {doc['page']}")
                        continue

                    images.append(response)
                    print(f"Successfully downloaded image {doc['page']}")

            except Exception as error:
                print("Error in image download process:", error)
                raise error

            print("Total images downloaded:", len(images))

            # Prepare documents for processing
            processed_documents = [
                {
                    "page": doc["page"],
                    "image": img,
                    "text": doc.get("text", ""),
                }
                for doc, img in zip(batch, images)
            ]
            # print("Processed documents:", processed_documents)

            # Process the batch
            print("Starting textbook processing...")
            
            async def after_generate(result):
                # Find document ID
                document_id = next(
                    (doc['id'] for doc in documents if doc['page'] == result.page),
                    None
                )
                if not document_id:
                    raise Exception(f"Document not found for page {result.page}")

                # Update document
                supabase.table("documents").update({
                    "description": result.description,
                    "processed": True
                }).eq("id", document_id).execute()

                
                print("Document inserted:", result.description)

            results = await textbook_processor.process_pages(
                textbook_title,
                chapter_title,
                num_pages,
                processed_documents,
                after_generate
            )
            print("Textbook processing for batch complete, results:", results)

            # Convert CleanedResponse objects to dictionaries (matching lecture format)
            serializable_results = [
                {
                    "page": result.page,
                    "description": result.description,
                }
                for result in results
            ]
            batch_results.append(serializable_results)

        print("Batch results:", batch_results)

        # Update textbook status to complete
        supabase.table("textbooks").update({
            "parse_status": "complete",
            "parse_error": None
        }).eq("id", textbook_id).execute()

        return {"results": batch_results}

    except Exception as error:
        print("Error in parse-textbook function:", {
            "name": type(error).__name__,
            "message": str(error),
            "stack": traceback.format_exc(),
        })
        
        # Update textbook status to error
        supabase.table("textbooks").update({
            "parse_status": "error",
            "parse_error": str(error)
        }).eq("id", textbook_id).execute()

        raise HTTPException(status_code=500, detail={
            "error": str(error),
            "stack": traceback.format_exc(),
            "name": type(error).__name__
        })
    
@router.post('/homework')
async def parse_homework(request: ParseRequest):
    """Parse a homework and return the documents."""
    try:
        print("Starting parse-homework function...")
        homework_id = request.homework_id
        print("Request params:", {"homework_id": homework_id})

        # Update homework status to parsing
        supabase.table("homeworks").update({
            "parse_status": "parsing",
            "parse_error": "",
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", homework_id).execute()

        # Get homework info
        homework_response = supabase.table("homeworks").select("*").eq("id", homework_id).single().execute()
        class_id = homework_response.data.get('class')
        print("Homework query response:", homework_response)

        # Get class title
        class_response = supabase.table("classes").select("*").eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')
        print("Class query response:", class_response)

        # Get existing exercises
        exercises_response = supabase.table("exercises").select("*").eq("homework", homework_id).execute()
        exercises = exercises_response.data
        # if not exercises:
        #     raise HTTPException(status_code=404, detail="No exercises found")
        

        # get unprocessed exercises, by checking if the description is not empty
        unprocessed_exercises = [exercise for exercise in exercises if exercise.get("description") is not None]
        print("Unprocessed exercises:", unprocessed_exercises)

        # Create new instance of HomeworkProcessor
        homework_processor = HomeworkProcessor(class_title)
        print("HomeworkProcessor created")

        # Process in batches
        batch_size = 15
        batch_results = []
        
        for i in range(0, len(unprocessed_exercises), batch_size):
            batch = unprocessed_exercises[i:i + batch_size]
            print("Processing batch:", batch)

            # Get images from supabase
            images = []
            text_contents = []
            
            try:
                for exercise in batch:
                    # Download image
                    if (exercise.get("chapter") is not None):
                        # find chapter in supabase
                        chapter_response = supabase.table("chapters").select("*").eq("id", exercise.get("chapter")).execute()
                        chapter = chapter_response.data[0]
                        image_path = f"{class_id}/{chapter.get('textbook')}/{exercise.get('id')}.png"
                        try:
                            response = supabase.storage.from_("textbooks").download(image_path)
                        except Exception as e:  
                            print(f"Error downloading image {exercise['title']}: {e}")
                            continue
                    else:
                        # we know this is a homework exercise
                        image_path = f"{class_id}/{exercise.get('id')}.png"
                        try:
                            response = supabase.storage.from_("exercises").download(image_path)
                        except Exception as e:  
                            print(f"Error downloading image {exercise['title']}: {e}")
                            continue
                    
                    print(f"Trying to download: {image_path}")
                    

                    
                    if not response:
                        print(f"No data received for image {exercise['title']}")
                        continue

                    images.append(response)
                    print(f"Successfully downloaded image {exercise['title']}")
                    exercise_title = exercise.get("title", "")
                    exercise_info = exercise.get("info", "")
                    exercise_given = exercise.get("given", "")
                    exercise_text = exercise.get("text", "")
                    full_text = f"TITLE: {exercise_title}\nINFO: {exercise_info}\nGIVEN: {exercise_given}\nTEXT: {exercise_text}"
                    text_contents.append(full_text)

            except Exception as error:
                print("Error in image download process:", error)
                raise error

            print("Total images downloaded:", len(images))

            # Prepare documents for processing
            processed_documents = [
                {
                    "exercise_id": exercise.get("id"),
                    "problem": str(exercise.get("problem_number", "")) + ". " + str(exercise.get("problem_part_number", "")),
                    "image": img,
                    "text": text_content,
                }
                for exercise, img, text_content in zip(batch, images, text_contents)
            ]
            # print("Processed documents:", processed_documents)

            # Process the batch
            print("Starting homework processing...")
            
            async def after_generate(result):

                # Update document
                supabase.table("exercises").update({
                    "description": result.description,
                }).eq("id", result.exercise_id).execute()
                
                print("Exercise updated:", result.description)

            results = await homework_processor.process_homework_problems(
                class_title,
                processed_documents,
                after_generate
            )
            print("Homework processing for batch complete, results:", results)

            # Convert CleanedResponse objects to dictionaries
            serializable_results = [
                {
                    "problem": result.problem,
                    "description": result.description,
                }
                for result in results
            ]
            batch_results.append(serializable_results)

        print("Batch results:", batch_results)

        # Update homework status to complete
        supabase.table("homeworks").update({
            "parse_status": "complete",
            "parse_error": ""
        }).eq("id", homework_id).execute()

        return {"results": batch_results}

    except Exception as error:
        print("Error in parse-homework function:", {
            "name": type(error).__name__,
            "message": str(error),
            "stack": traceback.format_exc(),
        })
        
        # Update homework status to error
        supabase.table("homeworks").update({
            "parse_status": "error",
            "parse_error": str(error)
        }).eq("id", homework_id).execute()

        raise HTTPException(status_code=500, detail={
            "error": str(error),
            "stack": traceback.format_exc(),
            "name": type(error).__name__
        })

