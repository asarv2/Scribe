// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { Figure, TextbookProcessor } from "./textbook_processor.ts";
import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Parse-textbook function up and running!");

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

  const { class_id, textbook_id, handwritten } = await req.json();
  console.log("Request params:", { class_id, textbook_id, handwritten });

  try {
    console.log("Starting parse-textbook function...");

    await supabase
      .from("textbooks")
      .update({
        parse_status: "parsing",
        parse_error: null,
        last_parse_attempt: new Date().toISOString(),
      })
      .eq("id", textbook_id);

    const class_response = await supabase.from("classes").select("*").eq(
      "id",
      class_id,
    ).single();
    const class_title = class_response.data?.title;
    console.log("Class query response:", class_response);

    const textbook_response = await supabase.from("textbooks").select("*").eq(
      "id",
      textbook_id,
    ).single();
    const num_pages = textbook_response.data?.pages;
    console.log("Textbook query response:", textbook_response);

    const documents_response = await supabase.from("documents").select(
      "*",
    ).eq("textbook", textbook_id);
    const documents = documents_response.data;
    if (!documents) {
      throw new Error("No documents found");
    }

    // Filter out processed documents and update unprocessed ones
    const documents_to_process = documents.filter(doc => doc.processed === false);
    console.log("Documents to process:", documents_to_process);


    const google_api_key = Deno.env.get("GOOGLE_API_KEY") ?? "";
    // Create new instance of SlideProcessor
    const textbook_processor = new TextbookProcessor(
      class_title,
      handwritten,
      google_api_key,
    );
    console.log("TextbookProcessor created");

    // batch 20 documents at a time
    const batch_size = 20;
    const batch_results = [];
    for (let i = 0; i < documents_to_process.length; i += batch_size) {
      const batch = documents_to_process.slice(i, i + batch_size);
      console.log("Processing batch:", batch);

      // get images from supabase
      const images: ArrayBuffer[] = [];
      const figures: Figure[][] = [];
      try {
        for (const doc of batch) {
          const imagePath =
            `${class_id}/textbooks/${textbook_id}/images/${doc.page}.png`;
          console.log(`Trying to download: ${imagePath}`);

          const { data, error } = await supabase.storage.from("slides")
            .download(imagePath);

          if (error) {
            console.error(`Error downloading image ${doc.page}:`, error);
            continue;
          }

          if (!data) {
            console.error(`No data received for image ${doc.page}`);
            continue;
          }

          const image_data = await data.arrayBuffer();
          images.push(image_data);
          console.log(`Successfully downloaded image ${doc.page}`);

          // get figures from supabase
          const figures_response = await supabase.from("figures").select("*").eq("document", doc.id);
          const figures_data = figures_response.data;
          if (!figures_data) {
            console.error(`No figures found for document ${doc.id}`);
            continue;
          }
          const formatted_figures = figures_data.map((figure) => ({
            bbox: [Number(figure.x_min), Number(figure.y_min), Number(figure.x_max), Number(figure.y_max)],
            description: String(figure.description),
          }));
          figures.push(formatted_figures);
        }
      } catch (error) {
        console.error("Error in image download process:", error);
      }

      console.log("Total images downloaded:", images.length);
      console.log("Images query response:", images);

      const processed_documents = [];
      for (let i = 0; i < batch.length; i++) {
        processed_documents.push({
          page: batch[i].page,
          image: images[i],
          text: batch[i].text,
          imageBboxes: figures[i],
        });
      }
      console.log("Processed documents:", processed_documents);
      // Process the slides
      console.log("Starting textbook processing...");
      const results = await textbook_processor.processPages(
        class_title,
        num_pages,
        processed_documents,
        async (result) => {
          const document_id = documents.find(doc => doc.page === result.page)?.id;
          if (!document_id) {
            throw new Error(`Document not found for page ${result.page}`);
          }
          const { error } = await supabase.from("documents").update({
            latex: result.latex,
            description: result.description,
            processed: true,
          }).eq("id", document_id);
          if (error) {
            console.error("Error inserting document:", error);
          }
          // new figures
          await supabase.from("figures").insert(
            result.figures.map((figure) => ({
              x_min: figure.bbox[0],
              x_max: figure.bbox[2],
              y_min: figure.bbox[1],
              y_max: figure.bbox[3],
              description: figure.description,
              document: document_id,
            })),
          );
          console.log("Document inserted:", result.description);
        },
      );
      console.log("Textbook processing for batch complete, results:", results);
      batch_results.push(results);
    }
    console.log("Batch results:", batch_results);
    return new Response(
      JSON.stringify({ results: batch_results }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error in parse-textbook function:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    });
    // Ensure textbook status is updated on error
    await supabase
      .from("textbooks")
      .update({
        parse_status: "error",
        parse_error: error.message,
      })
      .eq("id", textbook_id);

    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
        name: error.name,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/parse-textbook' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
