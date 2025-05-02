import os
from dotenv import load_dotenv

load_dotenv()

from litellm import completion

if __name__ == "__main__":
    cache_name = "cachedContents/i15ur4cxuu90"

    response = completion(
        model="gemini/gemini-1.5-flash-002",
        api_key=os.getenv("GOOGLE_API_KEY"),
        messages=[{"role":"user","content":"Summarize this."}],
        cached_content=cache_name,    # LiteLLM will forward this verbatim
        temperature=0.0
    )
    print(response.choices[0].message.content)
