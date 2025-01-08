// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { Figure } from "../_shared/base_processor.ts";
import { ProblemsContent, Question } from "./base_problems_processor.ts";
import { LectureProblemsProcessor } from "./lecture_problems_processor.ts";
import { TopicProblemsProcessor } from "./topic_problems_processor.ts";

console.log("Generate-problems function up and running!");

interface ProblemRequest {
  class_id: string;
  generation_id: string;
}

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

  const {
    class_id,
    generation_id,
  } = await req.json();
  console.log("Request params:", {
    class_id,
    generation_id,
  });

  try {
    console.log("Starting generate-problems function...");

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
    const generation_questions = generation_response.data
      ?.num_questions as number;
    const generation_conceptual = generation_response.data?.conceptual as boolean;
    const generation_single = generation_response.data?.single as boolean;

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
    }, {} as ProblemsContent);

    let questions: Question[][] = [];
    if (generation_lectures.length > 0) {
      const lecture_problems_processor = new LectureProblemsProcessor(
        google_api_key,
        class_title,
        names,
        content,
      );
      console.log("Lecture problems processor created");
      questions = await lecture_problems_processor.processProblems(
        generation_questions,
        generation_conceptual ? 1 : 0,
        generation_single ? 1 : 0,
      );
      console.log("Lecture problems:", questions);
    } else if (generation_topics.length > 0) {
      const topic_problems_processor = new TopicProblemsProcessor(
        google_api_key,
        class_title,
        names,
        content,
      );
      console.log("Topic problems processor created");
      questions = await topic_problems_processor.processProblems(
        generation_questions,
        generation_conceptual ? 1 : 0,
        generation_single ? 1 : 0,
      );
      console.log("Topic problems:", questions);
    }
    if (Object.keys(questions).length === 0) {
      throw new Error("No problems generated");
    }

    const figures_ids = figures.map((figure) => figure.id);
    // inserting summary into db

    const problems_data = questions.map((questionGroup) => {
      let multi_part_uuid = null;
      if (questionGroup.length > 1) {
        multi_part_uuid = crypto.randomUUID();
      }
      return questionGroup.map((question) => {
        const correct_answer = Object.keys(question["answers"]).find((opt) =>
          question["answers"][opt]
        );
        const question_data = {
          "question": question["question"],
          "mcq": question["type"] === "mcq",
          "conceptual": question["tags"].includes("conceptual"),
          "option_a": question["options"]["A"],
          "option_b": question["options"]["B"],
          "option_c": question["options"]["C"],
          "option_d": question["options"]["D"],
          "option_e": question["options"]["E"],
          "solution": correct_answer,
          "explanation_a": question["explanations"]["A"],
          "explanation_b": question["explanations"]["B"],
          "explanation_c": question["explanations"]["C"],
          "explanation_d": question["explanations"]["D"],
          "explanation_e": question["explanations"]["E"],
          "generation": generation_id,
          "figures": figures_ids,
        } as { [key: string]: string | boolean | number | string[] };
        if (multi_part_uuid) {
          question_data["multipart"] = multi_part_uuid;
        }
        return question_data;
      });
    }).flat();
    console.log("Problems data:", problems_data);

    const problems_response = await supabase.from("questions").insert(
      problems_data,
    );

    console.log("Problems response:", problems_response);

    // Update status to completed on success
    await supabase
      .from("generations")
      .update({
        generation_status: "complete",
        generation_error: null,
      })
      .eq("id", generation_id);

    return new Response(
      JSON.stringify({ problems: questions }),
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
