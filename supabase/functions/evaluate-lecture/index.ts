// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

console.log("Hello from Functions!");

Deno.serve(async (req) => {
  const { lecture_id } = await req.json();
  console.log("Lecture ID:", lecture_id);

  const authHeader = req.headers.get("Authorization")!;
  console.log("Auth header present:", !!authHeader);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    {
      global: { headers: { Authorization: authHeader } },
      db: { schema: "prod" },
    },
  );
  console.log("Supabase client created");

  const { data: lecture, error } = await supabase.from("lectures").select("response_url").eq("id", lecture_id).single();

  if (error) {
    console.error("Error fetching generation:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch generation" }), { status: 500 });
  }

  if (!lecture) {
    console.error("Lecture not found");
    return new Response(JSON.stringify({ error: "Lecture not found" }), { status: 404 });
  }

  const server_url = lecture.response_url;

  // call the server to evaluate the generation
  const response = await fetch(`${server_url}/evaluate-lecture`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ lecture_id: lecture_id }),
  });

  const data = await response.json();

  return new Response(
    JSON.stringify(data),
    { headers: { "Content-Type": "application/json" } },
  );
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/evaluate-generation' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
