# takes a question, and converts it into text for prompting to the LLM
import os
from supabase import Client, ClientOptions, create_client
from dotenv import load_dotenv

class SummaryFormatter:
    def __init__(self, supabase: Client, summary_id: str):
        self.supabase = supabase
        self.summary_data = self.supabase.table("summaries").select("*").eq("id", summary_id).single().execute().data
        self.summary = [self.summary_data]  # Wrap single question in list for consistency
    
    def main(self) -> str:
        """Format summary into a single text string"""
        preamble = f"SUMMARY\n{self.summary_data.get('preamble')}"
        body = f"{self.summary_data.get('content')}"
        conclusion = f"{self.summary_data.get('conclusion')}"
        return preamble + "\n" + body + "\n" + conclusion

if __name__ == "__main__":

    load_dotenv()

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_private_key = os.getenv("SUPABASE_PRIVATE_KEY")
    opts = ClientOptions().replace(schema=os.getenv("SUPABASE_SCHEMA"))
    supabase: Client = create_client(supabase_url, supabase_private_key, options=opts)

    summary_formatter = SummaryFormatter(supabase, "04ce7659-9219-4e17-a042-c0ddaf0008ba")
    print(summary_formatter.main())