// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { SlideProcessor } from "./slide_processor.ts";
import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders } from '../_shared/cors.ts'

console.log("Parse-lecture function up and running!")

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')!
  console.log("Auth header present:", !!authHeader);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { 
      global: { headers: { Authorization: authHeader } },
      db: { schema: 'prod' }
    }
  )
  console.log("Supabase client created");

  try {
    console.log("Starting parse-lecture function...");

    const { class_id, lecture_id, handwritten } = await req.json();
    console.log("Request params:", { class_id, lecture_id, handwritten });

    await supabase
    .from("lectures")
    .update({ 
      parse_status: 'parsing',
      parse_error: null,
      last_parse_attempt: new Date().toISOString()
    })
    .eq("id", lecture_id);

    const class_response = await supabase.from("classes").select("*").eq("id", class_id).single();
    const class_title = class_response.data?.title;
    console.log("Class query response:", class_response);

    const lecture_response = await supabase.from("lectures").select("*").eq("id", lecture_id).single();
    const num_pages = lecture_response.data?.pages;
    console.log("Lecture query response:", lecture_response);

    const documents_response = await supabase.from("documents").select("*").eq("lecture", lecture_id);
    const documents = documents_response.data;
    console.log("Documents query response:", documents_response);
    const documents_processed = documents?.length ?? 0;


    const google_api_key = Deno.env.get('GOOGLE_API_KEY') ?? '';
    // Create new instance of SlideProcessor
    const processor = new SlideProcessor(class_title, handwritten, google_api_key);
    console.log("SlideProcessor created");

    // get images from supabase
    const images: ArrayBuffer[] = [];
    try {
      for (let i = 1; i <= num_pages; i++) {
        const imagePath = `${class_id}/lectures/${lecture_id}/images/${i}.png`;
        console.log(`Trying to download: ${imagePath}`);
        
        const { data, error } = await supabase.storage.from("slides").download(imagePath);
        
        if (error) {
          console.error(`Error downloading image ${i}:`, error);
          continue;
        }

        if (!data) {
          console.error(`No data received for image ${i}`);
          continue;
        }

        const image_data = await data.arrayBuffer();
        images.push(image_data);
        console.log(`Successfully downloaded image ${i}`);
      }
    } catch (error) {
      console.error("Error in image download process:", error);
    }

    console.log("Total images downloaded:", images.length);
    console.log("Images query response:", images);
    
    // Process the slides
    console.log("Starting slide processing...");
    const results = await processor.processSlides(class_title, images, [], num_pages, [], documents_processed, async (result) => {
      await supabase.from("documents").insert({
        latex: result.latex,
        figures: result.figures,
        description: result.description,
        page: result.page,
        lecture: lecture_id,
      });
      console.log("Document inserted:", result.description);
    });
    console.log("Slide processing complete, results:", results);
    
    // Update status to completed on success
    await supabase
      .from("lectures")
      .update({ 
        parse_status: 'complete',
        parse_error: null
      })
      .eq("id", lecture_id);

    return new Response(
      JSON.stringify({ results }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      },
    );
    
  } catch (error) {
    console.error("Error in parse-lecture function:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });
    // Ensure lecture status is updated on error
    if (error.lecture_id) {
      await supabase
        .from("lectures")
        .update({ 
          parse_status: 'error',
          parse_error: error.message
        })
        .eq("id", error.lecture_id);
    }

    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        name: error.name 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/parse-lecture' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
