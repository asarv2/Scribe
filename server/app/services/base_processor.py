# base_processor.py
from enum import Enum
import os
from typing import List, Union, Literal, Dict, TypeAlias, AsyncGenerator, TypedDict
import asyncio
from app.services.rate_limiter import rate_limiter
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold, File
from dataclasses import dataclass
import re


class Figure(TypedDict):
    id: str
    code: str
    lecture_references: List[str]
    chapter_references: List[str]
    chapter_exercise_references: List[str]
    homework_exercise_references: List[str]

class Summary(TypedDict):
    id: str
    preamble: str
    content: str
    conclusion: str
    lecture_references: List[str]
    chapter_references: List[str]
    chapter_exercise_references: List[str]
    homework_exercise_references: List[str]
    figures: List[str]

class MCQQuestion(TypedDict):
    id: str
    question: str
    question_type: Literal["mcq"]
    options: List[str]
    answers: List[str]
    explanations: List[str]
    tags: List[str]
    lecture_references: List[str]
    chapter_references: List[str]
    chapter_exercise_references: List[str]
    homework_exercise_references: List[str]
    figures: List[str]

class FRQQuestion(TypedDict):
    id: str
    question: str
    question_type: Literal["frq"]
    solution: str
    tags: List[str]
    lecture_references: List[str]
    chapter_references: List[str]
    chapter_exercise_references: List[str]
    homework_exercise_references: List[str]
    figures: List[str]

LiteralModel: TypeAlias = Literal["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.5-flash-8b"]
@dataclass
class Message:
    content: List[Dict[str, str]]

class CleanedResponse:
    def __init__(self, page: int, description: str, text: str):
        self.page = page
        self.description = description
        self.text = text

class CleanedHomeworkResponse:
    def __init__(self, exercise_id: str, problem: str, description: str, text: str):
        self.exercise_id = exercise_id
        self.problem = problem
        self.description = description
        self.text = text

class ContentType(Enum):
    LECTURE = "lecture"
    TOPIC = "topic"

class BaseProcessor:
    def __init__(self):
        """
        Initialize the BaseProcessor and create all the models.
        """
        # Configure the Gemini API
        genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
        
        # Configure safety settings
        self.safety_settings = {
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
        }

    async def get_model_instance(self, model: LiteralModel, system_instruction: str | None = None) -> genai.GenerativeModel:
        if system_instruction:
            model_configs = {
                "gemini-2.0-flash": genai.GenerativeModel(
                    model_name="gemini-2.0-flash-001",
                    generation_config={"temperature": 0},
                    safety_settings=self.safety_settings,
                    system_instruction=system_instruction
                ),
                "gemini-2.0-flash-lite": genai.GenerativeModel(
                    model_name="gemini-2.0-flash-lite-preview-02-05",
                    generation_config={"temperature": 0},
                    safety_settings=self.safety_settings,
                    system_instruction=system_instruction
                ),
                "gemini-1.5-pro": genai.GenerativeModel(
                    model_name="gemini-1.5-pro",
                    generation_config={"temperature": 0},
                    safety_settings=self.safety_settings,
                    system_instruction=system_instruction
                ),
                "gemini-1.5-flash": genai.GenerativeModel(
                    model_name="gemini-1.5-flash",
                    generation_config={"temperature": 0},
                    safety_settings=self.safety_settings,
                    system_instruction=system_instruction
                ),
                "gemini-1.5-flash-8b": genai.GenerativeModel(
                    model_name="gemini-1.5-flash-8b",
                    generation_config={"temperature": 0},
                    safety_settings=self.safety_settings,
                    system_instruction=system_instruction
                ),
            }
            return model_configs[model]
        else:
            model_configs = {
                "gemini-2.0-flash": genai.GenerativeModel(
                    model_name="gemini-2.0-flash-001",
                    generation_config={"temperature": 0},
                    safety_settings=self.safety_settings,
                ),
                "gemini-2.0-flash-lite": genai.GenerativeModel(
                    model_name="gemini-2.0-flash-lite-preview-02-05",
                    generation_config={"temperature": 0},
                    safety_settings=self.safety_settings,
                ),
                "gemini-1.5-pro": genai.GenerativeModel(
                    model_name="gemini-1.5-pro",
                    generation_config={"temperature": 0},
                    safety_settings=self.safety_settings,
                ),
                "gemini-1.5-flash": genai.GenerativeModel(
                    model_name="gemini-1.5-flash",
                    generation_config={"temperature": 0},
                    safety_settings=self.safety_settings,
                ),
                "gemini-1.5-flash-8b": genai.GenerativeModel(
                    model_name="gemini-1.5-flash-8b",
                    generation_config={"temperature": 0},
                    safety_settings=self.safety_settings,
                ),
            }
            return model_configs[model]
    async def prepare_conversation_history(
        self,
        messages: List[Message],
        max_tokens: int = 1048576
    ) -> List[Message]:
        """
        Trim conversation history to stay within token limits.
        Estimates token count for both text and images.
        """
        CHARS_PER_TOKEN = 4
        IMAGE_TOKEN_ESTIMATE = 1024  # Conservative estimate for image tokens
        token_count = 0
        trimmed_messages: List[Message] = []

        for message in reversed(messages):
            message_tokens = 0
            
            # Calculate tokens for each content part
            for part in message.content:
                if part["type"] == "text":
                    message_tokens += len(part["text"]) // CHARS_PER_TOKEN
                elif part["type"] == "image_url":
                    message_tokens += IMAGE_TOKEN_ESTIMATE

            if token_count + message_tokens > max_tokens:
                break

            token_count += message_tokens
            trimmed_messages.insert(0, message)

        print(
            f"\nTrimmed conversation history to {len(trimmed_messages)} messages from {len(messages)} messages"
        )
        print(f"Estimated total tokens: {token_count}")

        return trimmed_messages
    

    async def get_rpm(self, model: str) -> int:
        if model == "gemini-2.0-flash":
            return 15
        elif model == "gemini-2.0-flash-lite":
            return 30
        elif model == "gemini-1.5-pro":
            return 2
        elif model == "gemini-1.5-flash":   
            return 15
        elif model == "gemini-1.5-flash-8b":
            return 15
        else:
            raise ValueError(f"Invalid model: {model}")
    
    

    async def robust_generate(
        self,
        system_instruction: str | None,
        message: Message,
        model: LiteralModel = "gemini-2.0-flash",
        retries: int = 3,
        initial_wait: int = 5,
        additional_files: List[File] = []
    ) -> str:
        try:
            # Acquire rate limiter permission
            await rate_limiter.acquire(model)
            
            try:
                model_instance = await self.get_model_instance(model, system_instruction)
                
                # Extract content parts from the message
                content_parts = []
                # Add additional files to the content parts
                if additional_files:
                    content_parts.extend(additional_files)

                # Add the message content to the content parts
                for part in message.content:
                    if part["type"] == "text":
                        content_parts.append(part["text"])
                    elif part["type"] == "image_url":
                        # Use the correct key structure for inline_data
                        content_parts.append({
                            "inline_data": {  # Changed from inlineData to inline_data
                                "mime_type": "image/png",  # Changed from mimeType to mime_type
                                "data": part["image_url"].split(",")[1]  # Remove the "data:image/png;base64," prefix
                            }
                        })
                
                # Generate response
                response = model_instance.generate_content(
                    content_parts,
                    stream=False
                )
                
                return response.text
                
            finally:
                # Always release the rate limiter
                rate_limiter.release(model)
                
        except Exception as error:
            if retries > 0:
                await asyncio.sleep(initial_wait)
                return await self.robust_generate(
                    message,
                    model,
                    retries - 1,
                    initial_wait * 1.5
                )
            raise error
        

    async def robust_generate_stream(
        self,
        system_instruction: str,
        message: Message,
        model: LiteralModel = "gemini-2.0-flash",
        retries: int = 3,
        initial_wait: int = 5
    ) -> AsyncGenerator[str, None]:
        """
        A streaming version of robust_generate that yields chunks of the response.
        """
        try:
            # Acquire rate limiter permission
            await rate_limiter.acquire(model)
            
            try:
                model_instance = await self.get_model_instance(model, system_instruction)
                
                # Extract content parts from the message
                content_parts = []
                for part in message.content:
                    if part["type"] == "text":
                        content_parts.append(part["text"])
                    elif part["type"] == "image_url":
                        content_parts.append({
                            "inline_data": {
                                "mime_type": "image/png",
                                "data": part["image_url"].split(",")[1]
                            }
                        })
                
                # Generate response with streaming
                response = model_instance.generate_content(
                    content_parts,
                    stream=True
                )
                
                # Properly iterate over the chunks
                for chunk in response:
                    if chunk.text:
                        yield chunk.text
                
            finally:
                # Always release the rate limiter
                rate_limiter.release(model)
                
        except Exception as error:
            if retries > 0:
                await asyncio.sleep(initial_wait)
                async for chunk in self.robust_generate_stream(
                    system_instruction,
                    message,
                    model,
                    retries - 1,
                    initial_wait * 1.5
                ):
                    yield chunk
                return
            raise error
        
        # Common utility methods
    def format_url_for_latex(self, url: str) -> str:
        """
        Format URL for LaTeX hyperref package.
        """
        # Replace problematic characters in URLs
        url = url.replace('%', '\\%')
        url = url.replace('#', '\\#')
        url = url.replace('&', '\\&')
        url = url.replace('_', '\\_')
            
        return url
    
    def process_math_term(self, term: str) -> str:
        """Enhanced math term processing with better handling of nested expressions"""
        if not term:
            return ""

        # Remove HTML tags and escaped sequences that cause issues
        cleanup_replacements = {
            'textasciicircum{}': '^',
            'textbackslash{}': '',
            '\\\\': '\\',
            '\\_SAT': '_SAT'
        }
        
        for old, new in cleanup_replacements.items():
            term = term.replace(old, new)

        # Detect if term is already in math mode
        # Count occurrences of single $; if odd, it's partially in math mode.
        is_math_mode = (term.count('$') % 2 == 1)

        # Store and protect existing math blocks
        math_blocks = []
        # Use a non-greedy regex to ensure minimal capturing between $...$
        term = re.sub(r'\$(.*?)\$',
                      lambda m: self._store_math(m.group(1), math_blocks),
                      term, flags=re.DOTALL)

        # Special cases, longer patterns first
        special_cases = {
            # Basic math operations
            'log(1 + e^(-z))': r'\log(1 + e^{-z})',
            '(0, 0)': r'$(0, 0)$',
            '^T': r'^T',

            # Greek letters
            'alpha': r'$\alpha$',
            'beta': r'$\beta$',
            'gamma': r'$\gamma$',
            'delta': r'$\delta$',
            'epsilon': r'$\epsilon$',
            'theta': r'$\theta$',
            'lambda': r'$\lambda$',
            'mu': r'$\mu$',
            'sigma': r'$\sigma$',
            'omega': r'$\omega$',

            # Function notation
            'sigma(x)': r'$\sigma(x)$',
            'sigma(z)': r'$\sigma(z)$',
            "sigma'(z)": r'$\sigma\'(z)$',
            'f(x)': r'$f(x)$',
            'g(x)': r'$g(x)$',

            # Subscripts and superscripts
            'x_0': r'$x_0$',
            '-x_0': r'$-x_0$',
            'x_i': r'$x_i$',
            'y_i': r'$y_i$',
            '_i': r'$_i$',
            '_j': r'$_j$',
            '_n': r'$_n$',
            '_p': r'$_p$',

            # Matrix notation
            'c^T': r'$c^T$',
            'b^T': r'$b^T$',
            'A^T': r'$A^T$',
            '^{-1}': r'^{-1}',
            '^{T}': r'^{T}',

            # Special functions and operators
            'mathbb{1}': r'$\mathbb{1}$',
            'frac{': r'$\frac{',
            'sum_{': r'$\sum_{',
            'prod_{': r'$\prod_{',
            'int_{': r'$\int_{',

            # Logical operators
            'implies': r'$\implies$',
            'iff': r'$\iff$',
            'forall': r'$\forall$',
            'exists': r'$\exists$',
            'ne': r'$\ne$',

            # Arrows and symbols
            'leftarrow': r'$\leftarrow$',
            'rightarrow': r'$\rightarrow$',
            'leftrightarrow': r'$\leftrightarrow$',
            'Leftarrow': r'$\Leftarrow$',
            'Rightarrow': r'$\Rightarrow$',
            'cdot': r'$\cdot$',

            # Norms and spaces
            'L^1': r'$L^1$',
            'L^2': r'$L^2$',
            'L^infty': r'$L^\infty$',
            'L^∞': r'$L^\infty$',
            '||': r'$\|$',

            # HTML-style tags
            '<sup>': r'^{',
            '</sup>': r'}',
            '<sub>': r'_{',
            '</sub>': r'}',

            # Special characters
            '\\{': r'\{',
            '\\}': r'\}',
            'textbackslash': r'\textbackslash',

            # Additional math expressions
            'max{0, -z}': r'$\max\{0, -z\}$',
            'max{0, 1-z}': r'$\max\{0, 1-z\}$',
            'y(w^Tx)': r'$y(w^{T}x)$',
            'w^T': r'$w^{T}$',
            'e^(-z)': r'$e^{-z}$',
            # Already included in a transformed version above, but ensure unique
            'e^{-z}': r'$e^{-z}$'
        }

        # Process special cases longest first
        for case in sorted(special_cases.keys(), key=len, reverse=True):
            if case in term:
                replacement = special_cases[case]
                # If we are inside math mode and the replacement is also wrapped in $...$, remove extra $
                if is_math_mode and replacement.startswith('$') and replacement.endswith('$'):
                    replacement = replacement[1:-1]
                term = term.replace(case, replacement)

        # Clean up duplicate or empty math mode markers
        term = re.sub(r'\${2,}', '$', term)  # collapse multiple $$ to single $
        term = re.sub(r'(\$)\s*(\$)', r'\1\2', term)  # Remove spaces between $ $
        # Remove isolated $ pairs with no content
        term = re.sub(r'\$\$', '$', term)

        try:
            # Instead of '\\+\\', use a quantifier to mean multiple backslashes.
            # '\\+\{' means one or more backslashes followed by '{'
            # '\\+\}' means one or more backslashes followed by '}'
            # '\\{2,}' means two or more backslashes
            term = re.sub(r'\\+\{', '{', term)
            term = re.sub(r'\\+\}', '}', term)
            term = re.sub(r'\\{2,}', r'\\', term)
        except re.error as e:
            print(f"Regex error while cleaning braces and backslashes: {e}")
            # If needed, handle the error by logging, raising a different exception, or returning the unmodified term.
            return term

        # If not in math mode and term contains math-y chars, wrap in $
        if not is_math_mode and any(c in term for c in '_^\\{}'):
            if not term.strip().startswith('$'):
                term = f'${term}$'

        # Restore protected math blocks
        term = self._restore_math(term, math_blocks)

        # Final normalization of math mode delimiters
        # Ensure balanced math mode (if not balanced, we could try to fix it)
        if term.count('$') % 2 != 0:
            # Add a trailing $ if odd count
            term += '$'

        return term

    def sanitize_latex(self, text: str) -> str:
        """Enhanced sanitization for LaTeX output"""
        if not text:
            return ""
        
        math_blocks = []
        # Protect existing math
        text = re.sub(r'\$(.*?)\$',
                      lambda m: self._store_math(m.group(1), math_blocks),
                      text, flags=re.DOTALL)

        # Unicode math replacements
        unicode_math = {
            '\u2212': r'-',
            '∧': r'\wedge',
            '\u2228': r'\vee',
            '↔': r'\leftrightarrow',
            '¬': r'\neg',
            '⊗': r'\otimes',
            '⊕': r'\oplus',
            '∈': r'\in',
            '∉': r'\notin',
            '∀': r'\forall',
            '∃': r'\exists',
            '≤': r'\leq',
            '≥': r'\geq',
            '≠': r'\neq',
            '≈': r'\approx',
            '∞': r'\infty'
        }
        for symbol, replacement in unicode_math.items():
            # Insert in math mode
            text = text.replace(symbol, f'${replacement}$')

        # General replacements (outside math mode)
        # Note: We must be careful with $ and other chars that we already handled
        replacements = {
            '%': r'\%',
            '&': r'\&',
            '#': r'\#',
            '~': r'\textasciitilde{}',
            '^': r'\textasciicircum{}',
            '<': r'\textless{}',
            # unicode arrow replacements done above
            '→': r'$\rightarrow$',
            '←': r'$\leftarrow$',
            '≠': r'$\neq$',
            '∑': r'$\sum$',
            '⇒': r'$\implies$',
            '·': r'$\cdot$',
            '…': r'\ldots',
            # Smart quotes handling
            '"': '``',
            '"': "''",
            '"': "''",
            '\u2019': "'",
            '\u2018': "`",
            '—': '---'
        }

        for char, replacement in replacements.items():
            text = text.replace(char, replacement)

        # Restore math blocks
        text = self._restore_math(text, math_blocks)

        # Ensure balanced math mode after restoration
        if text.count('$') % 2 != 0:
            # Attempt simple fix by adding a trailing $
            text += '$'

        return text

    def sanitize_section_title(self, title: str) -> str:
        """Sanitize section titles specifically"""
        # Handle special characters in section titles
        title = title.replace('&', r'\&')
        title = title.replace('\\', '')  # Remove backslashes
        title = title.replace('{', r'\{')
        title = title.replace('}', r'\}')
        title = title.replace('_', r'\_')
        title = title.replace('^', r'\textasciicircum{}')
        title = title.replace('~', r'\textasciitilde{}')
        title = title.replace('<', r'\textless{}')
        title = title.replace('>', r'\textgreater{}')
        # Replace {-} with simple hyphen
        title = title.replace('{-}', '-')
        return title