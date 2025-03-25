// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { DOMParser, Element } from "jsr:@b-fuze/deno-dom";

// Import deno_dom for DOM manipulation (HTML parsing)

type User = {
  name: string;
  alias: string | null;
  campus: string | null;
  title: string | null;
};

// Configure CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // In production, replace with your extension ID
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-private-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("CORS preflight request");
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the secret key from the request header
    const clientSecret = req.headers.get('x-private-key');
    
    // Get the environment secret (your project's secret)
    const projectSecret = Deno.env.get('PRIVATE_KEY');
    
    // Check if the secret matches
    if (!clientSecret || clientSecret !== projectSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or missing secret' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { alias } = await req.json();
    
    if (!alias) {
      throw new Error("Alias is required");
    }
    const url = `https://www.purdue.edu/directory/Advanced?UsingParam=Search%20by%20Alias&SearchString=${encodeURIComponent(alias)}`;

    // Perform the HTTP request to fetch the HTML
    const res = await fetch(url);
    const html = await res.text();

    // Parse the HTML using deno_dom's DOMParser
    const doc = new DOMParser().parseFromString(html, "text/html");

    if (!doc) {
      throw new Error("Failed to parse HTML.");
    }

    // Find the list of students by locating `li` elements with `tabindex`
    const userList = doc.querySelectorAll("li[tabindex]");

    // Collect student data
    const users: User[] = [];

    (userList).forEach((user: Element) => {
      const nameElement = user.querySelector("h2.cn-name");
      if (!nameElement) return;

      const name = nameElement.textContent.trim();

      // Extract alias, campus, and title from the user entry
      let campus = null, title = null;

      user.querySelectorAll("tr").forEach((row: Element) => {
        const th = row.querySelector("th");
        const td = row.querySelector("td");

        if (th && td) {
          const label = th.textContent.toLowerCase();
          const value = td.textContent.trim();

          if (label.includes("campus")) campus = value;
          else if (label.includes("title")) title = value;
        }
      });

      users.push({
        name,
        alias,
        campus,
        title,
      });
    });

    // Return the student data as JSON
    return new Response(
      JSON.stringify(users),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/check-user' \
    --header 'Authorization: Bearer <YOUR_ACCESS_TOKEN>' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Ashok Saravanan"}'

*/
