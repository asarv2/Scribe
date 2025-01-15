// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import { Figure, Terms, TermsProcessor } from "./terms_processor.ts";
import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { GroupsProcessor, LectureMapping } from "./groups_processor.ts";

console.log("Batch-topics function up and running!");

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

  const { class_id, lecture_id } = await req.json();
  console.log("Request params:", { class_id, lecture_id });

  try {
    console.log("Starting batch-topics function...");

    // Update status to batching on success
    await supabase
      .from("lectures")
      .update({
        parse_status: "batching",
        parse_error: null,
      })
      .eq("id", lecture_id);

    const google_api_key = Deno.env.get("GOOGLE_API_KEY") ?? "";
    const class_response = await supabase.from("classes").select(
      "title, course_description, map",
    ).eq("id", class_id).single();
    console.log("Class response:", class_response);
    const class_title = class_response.data?.title;
    const class_description = class_response.data?.course_description;
    const class_map = class_response.data?.map;

    const lecture_name_response = await supabase.from("lectures").select("name")
      .eq("id", lecture_id).single();
    const lecture_name = lecture_name_response.data?.name;
    console.log("Lecture name:", lecture_name);

    const documents_response = await supabase.from("documents").select("*").eq(
      "lecture",
      lecture_id,
    );
    const documents = documents_response.data ?? [];
    console.log("Documents query response:", documents_response);
    console.log("Documents:", documents);

    const figures_response = await supabase.from("figures").select("*").in(
      "document",
      documents?.map((doc) => doc.id) ?? [],
    );
    console.log("Figures query response:", figures_response);
    const all_figures = figures_response.data ?? [];
    const figures_dict: { [key: string]: Figure[] } = {};
    for (let i = 0; i < all_figures.length; i++) {
      const figure = all_figures[i];
      const document = documents?.find((doc) => doc.id === figure.document);
      if (!figures_dict[document?.page]) {
        figures_dict[document?.page] = [];
      }
      figures_dict[document?.page].push(figure);
    }
    console.log("Figures dict:", figures_dict);

    const lectureContent = documents.map((doc) =>
      "SLIDE " + doc.page + "\n" + "<LATEX>" + doc.latex + "</LATEX>" + "\n" +
      (figures_dict[String(doc.page)] ?? []).map((figure) =>
        "<FIGURE [" +
        [figure.y_min, figure.x_min, figure.y_max, figure.x_max].join(", ") +
        "]> " + figure.description + "</FIGURE>"
      ).join("") + "\n" + "<DESCRIPTION>" + doc.description + "</DESCRIPTION>"
    ).join("\n\n");

    const lectures_processed = {
      [lecture_name]: {
        figures: figures_dict,
        content: lectureContent,
      },
    };

    // Create new instance of TermsProcessor
    const terms_processor = new TermsProcessor(
      google_api_key,
      class_title,
      lectures_processed,
    );
    console.log("TermsProcessor created");

    // Process the terms
    console.log("Starting terms processing...");
    const terms_results = await terms_processor.processTerms();
    console.log("Terms processing complete, results:", terms_results);

    const lectures_response = await supabase.from("lectures").select("*").eq(
      "class",
      class_id,
    );
    const lectures = lectures_response.data ?? [];
    const lectureMapping: LectureMapping = {};
    for (let i = 0; i < lectures.length; i++) {
      const lecture = lectures[i];
      lectureMapping[lecture.name] = {
        id: lecture.id,
      };
    }
    console.log("Lectures mapping:", lectureMapping);

    let previous_terms = [];
    if (class_map) {
      const previous_terms_response = await supabase.from("topics").select("*")
        .eq("map", class_map).neq("type", "group");
      previous_terms = previous_terms_response.data ?? [];
    }
    console.log("Previous terms:", previous_terms);
    const previous_terms_dict: Terms = previous_terms.reduce((acc, term) => {
      let type = "Key Terms";
      if (term.type === "term") {
        type = "Key Terms";
      } else if (term.type === "problem") {
        type = "Problem Types";
      } else if (term.type === "algorithm") {
        type = "Algorithm Solutions";
      }
      const mapped_lectures = (term.lectures as string[]).reduce(
        (acc, lectureId) => {
          const lecture = lectures.find((lecture) => lecture.id === lectureId);
          if (lecture) {
            acc[lecture.name] = Array.from({ length: lecture.pages }, (_, i) =>
              i + 1);
          }
          return acc;
        },
        {} as { [key: string]: number[] },
      );

      acc[term.title.toLowerCase()] = {
        term: term.title,
        definition: term.content,
        lectures: mapped_lectures,
        type: type,
        figures: term.figures,
      };
      return acc;
    }, {});
    console.log("Previous terms dict:", previous_terms_dict);
    console.log("Terms results:", terms_results);
    const all_terms = { ...previous_terms_dict, ...terms_results };
    console.log("All terms:", all_terms);

    // going to process the groups here.
    console.log("Starting groups processing...");
    const groups_processor = new GroupsProcessor(
      google_api_key,
      all_terms,
      class_title,
      class_description,
      null,
      1,
      1,
    );
    const groups_results = await groups_processor.processGroups();
    console.log("Groups processing complete, results:", groups_results);

    const topics = groups_processor.reformat_topics(
      lectureMapping,
      class_id,
    );
    console.log("Topics:", topics);

    // inserting the groups into the database
    const topics_response = await supabase.from("topics").insert(
      topics,
    ).select("map");
    const topics_inserted = topics_response.data ?? [];
    console.log("topics inserted:", topics_inserted);

    // setting root node in classes table
    const class_update_response = await supabase.from("classes").update({
      map: topics_inserted?.[0].map,
    }).eq("id", class_id);
    console.log("class update response:", class_update_response);

    // Update status to completed on success
    await supabase
      .from("lectures")
      .update({
        parse_status: "complete",
        parse_error: null,
      })
      .eq("id", lecture_id);

    return new Response(
      JSON.stringify({ topics }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error in batch-topics function:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    });
    // Ensure lecture status is updated on error
    await supabase
      .from("lectures")
      .update({
        parse_status: "error",
        parse_error: error.message,
      })
      .eq("id", lecture_id);

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

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/batch-topics' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
