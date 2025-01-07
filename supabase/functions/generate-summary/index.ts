// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { Figure, SummaryContent } from "./base_summary_processor.ts";
import { LectureSummaryProcessor } from "./lecture_summary_processor.ts";
import { TopicSummaryProcessor } from "./topic_summary_processor.ts";

console.log("Generate-summary function up and running!");

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

  const { class_id, generation_id } = await req.json();
  console.log("Request params:", { class_id, generation_id });

  try {
    console.log("Starting generate-summary function...");

    // Update status to batching on success
    await supabase
      .from("generations")
      .update({
        generation_status: "generating",
        generation_error: null,
      })
      .eq("id", generation_id);

    const google_api_key = Deno.env.get("GOOGLE_API_KEY") ?? "";
    const class_response = await supabase.from("classes").select(
      "title, course_description, map",
    ).eq("id", class_id).single();
    console.log("Class response:", class_response);
    const class_title = class_response.data?.title;

    const generation_response = await supabase.from("generations").select("*")
      .eq("id", generation_id).single();
    console.log("Generation response:", generation_response);
    const generation_lectures = generation_response.data?.lectures as string[];
    const generation_topics = generation_response.data?.topics as string[];

    let lectures = generation_lectures;
    let names: string[] = [];
    if (generation_topics.length > 0) {
      const topics_response = await supabase.from("topics").select("*").in(
        "id",
        generation_topics,
      );
      const topics = topics_response.data ?? [];
      console.log("Topics:", topics);
      lectures = [...new Set(topics.map((topic) => topic.lectures).flat())];
      names = topics.map((topic) => topic.title);
    } else if (generation_lectures.length > 0) {
      const lectures_response = await supabase.from("lectures").select("*").in(
        "id",
        generation_lectures,
      );
      const lectures = lectures_response.data ?? [];
      console.log("Lectures:", lectures);
      names = lectures.map((lecture) => lecture.name);
    }

    const documents_response = await supabase.from("documents").select("*").in(
      "lecture",
      lectures,
    );
    const documents = documents_response.data ?? [];
    console.log("Documents query response:", documents_response);
    console.log("Documents:", documents);

    const figures_response = await supabase.from("figures").select("*").in(
      "document",
      documents.map((doc) => doc.id),
    );
    const figures = figures_response.data ?? [];
    console.log("Figures query response:", figures_response);
    console.log("Figures:", figures);

    const lectures_processed = lectures.reduce(
      (acc, lecture_id) => {
        const lecture_figures = figures.filter((figure) =>
          figure.document === lecture_id
        );
        const figures_dict: { [key: string]: Figure[] } = {};
        for (let i = 0; i < lecture_figures.length; i++) {
          const figure = lecture_figures[i];
          const document = documents?.find((doc) => doc.id === figure.document);
          if (!figures_dict[document?.page]) {
            figures_dict[document?.page] = [];
          }
          figures_dict[document?.page].push(figure);
        }

        const lectureContent = documents.map((doc) =>
          "SLIDE " + doc.page + "\n" + "<LATEX>" + doc.latex + "</LATEX>" +
          "\n" +
          (figures_dict[String(doc.page)] ?? []).map((figure) =>
            "<FIGURE [" +
            [figure.y_min, figure.x_min, figure.y_max, figure.x_max].join(
              ", ",
            ) +
            "]> " + figure.description + "</FIGURE>"
          ).join("") + "\n" + "<DESCRIPTION>" + doc.description +
          "</DESCRIPTION>"
        ).join("\n\n");

        acc[lecture_id] = {
          figures: figures_dict,
          content: lectureContent,
        };
        return acc;
      },
      {} as {
        [key: string]: {
          figures: { [key: string]: Figure[] };
          content: string;
        };
      },
    );

    const content = Object.values(lectures_processed).reduce((acc, lecture) => {
      if (!acc["figures"]) {
        acc["figures"] = {};
      }
      acc["figures"] = { ...acc["figures"], ...lecture.figures };
      if (!acc["content"]) {
        acc["content"] = "";
      }
      acc["content"] += lecture.content;
      return acc;
    }, {} as SummaryContent);

    let summary: string = "";
    if (generation_lectures.length > 0) {
      const lecture_summary_processor = new LectureSummaryProcessor(
        google_api_key,
        class_title,
        names,
        content,
      );
      console.log("Lecture summary processor created");
      summary = await lecture_summary_processor.processSummary();
      console.log("Lecture summary:", summary);
    } else if (generation_topics.length > 0) {
      const topic_summary_processor = new TopicSummaryProcessor(
        google_api_key,
        class_title,
        names,
        content,
      );
      console.log("Topic summary processor created");
      summary = await topic_summary_processor.processSummary();
      console.log("Topic summary:", summary);
    }
    if (summary === "") {
      throw new Error("No summary generated");
    }

    const figures_ids = figures.map((figure) => figure.id);
    // inserting summary into db
    const summary_response = await supabase.from("summaries").insert({
      content: summary,
      generation: generation_id,
      figures: figures_ids,
    });
    console.log("Summary response:", summary_response);

    // Update status to completed on success
    await supabase
      .from("generations")
      .update({
        generation_status: "complete",
        generation_error: null,
      })
      .eq("id", generation_id);

    return new Response(
      JSON.stringify({ summary: summary.slice(0, 1000) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error in generate-summary function:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    });
    // Ensure lecture status is updated on error
    await supabase
      .from("generations")
      .update({
        generation_status: "error",
        generation_error: error.message,
      })
      .eq("id", generation_id);

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
