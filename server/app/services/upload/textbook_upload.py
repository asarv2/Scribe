import os
from typing import List, Dict
import google.generativeai as genai
from pypdf import PdfReader
import re
from dotenv import load_dotenv

load_dotenv()

class TOCExtractor:
    def __init__(self, api_key: str):
        """Initialize the TOC extractor with Gemini API key."""
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.0-flash-001')

    def extract_text_from_pdf(self, pdf_path: str, max_pages: int = 30) -> str:
        """Extract text from the first n pages of a PDF file."""
        try:
            reader = PdfReader(pdf_path)
            num_pages = min(max_pages, len(reader.pages))
            text = ""
            
            for page_num in range(num_pages):
                text += reader.pages[page_num].extract_text() + "\n\n"
            
            return text
        except Exception as e:
            raise Exception(f"Error reading PDF: {str(e)}")

    def process_toc_with_gemini(self, text: str) -> str:
        """Process the extracted text with Gemini API to identify TOC."""
        
        prompt = """
        Please analyze the following text and extract the table of contents in this exact format:
        1, Chapter Title - Page number
        1.1, Lesson Title - Page number
        1.2, Lesson Title - Page number
        2, Chapter Title - Page number
        
        Only include actual table of contents entries. If you find any end-of-chapter material or 
        special sections, format them as:
        (Material Name) - Page number
        
        Text to analyze:
        {text}
        """
        
        try:
            response = self.model.generate_content(prompt.format(text=text))
            print(response.text)
            return response.text
        except Exception as e:
            raise Exception(f"Error processing with Gemini: {str(e)}")

    def format_toc(self, toc_text: str) -> List[Dict]:
        """Format the TOC into a structured format."""
        entries = []
        lines = toc_text.strip().split('\n')
        
        for line in lines:
            if not line.strip():
                continue
                
            # Match the pattern: number, title - page
            match = re.match(r'([\d.]+)?,?\s*([^-]+)-\s*(\d+)', line)
            if match:
                number, title, page = match.groups()
                entries.append({
                    'number': number if number else '',
                    'title': title.strip(),
                    'page': int(page)
                })
            
            # Match special sections in parentheses
            match = re.match(r'\((.*?)\)\s*-\s*(\d+)', line)
            if match:
                title, page = match.groups()
                entries.append({
                    'number': '',
                    'title': f"({title.strip()})",
                    'page': int(page)
                })
        
        return entries

    def save_toc(self, entries: List[Dict], output_file: str):
        """
        Save formatted TOC as tuples with correct chapter ranges.
        Remove duplicates (title, section, start_page), keeping only the last occurrence.
        Then if a tuple's section is empty, fill it with the integer part of the most recent non-empty section.
        """
        import re

        # 1) Identify "chapter" entries and build a list of formatted entries.
        chapters = []
        formatted_entries = []
        for i, entry in enumerate(entries):
            if entry['number'] and re.match(r'^\d+$', entry['number'].strip(',')):
                chapters.append((i, entry))

        # 2) Format entries with correct ranges. Chapters end right before the next chapter.
        for i, entry in enumerate(entries):
            is_chapter = bool(entry['number'] and re.match(r'^\d+$', entry['number'].strip(',')))
            
            if is_chapter:
                chapter_pos = next(idx for idx, (_, e) in enumerate(chapters) if e == entry)
                if chapter_pos < len(chapters) - 1:
                    next_chapter_idx = chapters[chapter_pos + 1][0]
                    end_page = entries[next_chapter_idx]['page'] - 1
                else:
                    end_page = entries[-1]['page'] + 6
            else:
                if i == len(entries) - 1:
                    end_page = entry['page'] + 6
                else:
                    end_page = entries[i + 1]['page'] - 1
            
            title = entry['title'].strip()
            section = entry['number'].strip(',') if entry['number'] else ''
            formatted_entries.append((title, section, entry['page'], end_page))

        # 3) Remove duplicates (title, section, start_page) from the back
        seen_keys = set()
        deduped = []
        for item in reversed(formatted_entries):
            title, section, start_page, end_page = item
            key = (title, section, start_page)
            if key not in seen_keys:
                deduped.append(item)
                seen_keys.add(key)
        deduped.reverse()

        # 4) If a tuple has an empty section, fill it with the integer part of the last non-empty section
        updated = []
        last_chapter_num = ''
        for (title, section, s_page, e_page) in deduped:
            if section.strip():
                # Grab the integer portion before any decimal, e.g. "1" from "1.13"
                base_num = section.split('.', 1)[0] if '.' in section else section
                last_chapter_num = base_num
                updated.append((title, section, s_page, e_page))
            else:
                if last_chapter_num:
                    updated.append((title, last_chapter_num, s_page, e_page))
                else:
                    updated.append((title, '', s_page, e_page))

        # 5) Write results as tuples
        with open(output_file, 'w', encoding='utf-8') as f:
            for title, section, start_page, end_page in updated:
                f.write(f"({title}, {section}, {start_page}, {end_page})\n")

def main():
    # Replace with your Gemini API key
    API_KEY = os.getenv('GOOGLE_API_KEY')
    
    # Initialize the extractor
    extractor = TOCExtractor(API_KEY)
    
    # Define base directory and uploads path
    if not os.getenv('DOCKER_ENV'):
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    else:
        BASE_DIR = '/app'
    
    UPLOADS_DIR = os.path.join(BASE_DIR, 'uploads')
    
    # Get PDF path from uploads directory
    pdf_filename = 'V.pdf'  # Replace with your PDF filename
    pdf_path = os.path.join(UPLOADS_DIR, pdf_filename)
    
    try:
        # Check if file exists
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF file not found at {pdf_path}")
            
        # Extract text from PDF
        print("Extracting text from PDF...")
        text = extractor.extract_text_from_pdf(pdf_path)
        
        # Process with Gemini
        print("Processing with Gemini API...")
        toc_text = extractor.process_toc_with_gemini(text)
        
        # Format the TOC
        print("Formatting table of contents...")
        entries = extractor.format_toc(toc_text)
        
        # Save to file in uploads directory
        output_filename = "table_of_contents.txt"
        output_path = os.path.join(UPLOADS_DIR, output_filename)
        extractor.save_toc(entries, output_path)
        print(f"\nTable of contents has been saved to {output_path}")
        
    except Exception as e:
        print(f"An error occurred: {str(e)}")

if __name__ == "__main__":
    main()
