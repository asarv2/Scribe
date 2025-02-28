// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

console.log("Hello from Functions!");

Deno.serve(async (req) => {
  const { evaluation_id, type } = await req.json();

  console.log("Evaluation ID:", evaluation_id);
  console.log("Type:", type);

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

  let data;
  if (type === "message") {
    const { data: message, error } = await supabase.from("messages")
      .select("response_url").eq("id", evaluation_id).single();

    if (error) {
      console.error("Error fetching message:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch message" }),
        { status: 500 },
      );
    }

    if (!message) {
      console.error("Message not found");
      return new Response(JSON.stringify({ error: "Message not found" }), {
        status: 404,
      });
    }

    const server_url = message.response_url;

    // call the server to evaluate the message
    const response = await fetch(`${server_url}/evaluate/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message_id: evaluation_id }),
    });

    data = await response.json();
  } else if (type === "lecture") {
    const { data: lecture, error } = await supabase.from("lectures").select(
      "response_url",
    ).eq("id", evaluation_id).single();

    if (error) {
      console.error("Error fetching lecture:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch lecture" }),
        { status: 500 },
      );
    }

    if (!lecture) {
      console.error("Lecture not found");
      return new Response(JSON.stringify({ error: "Lecture not found" }), {
        status: 404,
      });
    }

    const server_url = lecture.response_url;

    // call the server to evaluate the lecture
    const response = await fetch(`${server_url}/evaluate/lecture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lecture_id: evaluation_id }),
    });

    data = await response.json();
  } else if (type === "textbook") {
    const { data: textbook, error } = await supabase.from("textbooks").select(
      "response_url",
    ).eq("id", evaluation_id).single();

    if (error) {
      console.error("Error fetching textbook:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch textbook" }),
        { status: 500 },
      );
    }

    if (!textbook) {
      console.error("Textbook not found");
      return new Response(JSON.stringify({ error: "Textbook not found" }), {
        status: 404,
      });
    }

    const server_url = textbook.response_url;

    // call the server to evaluate the generation
    const response = await fetch(`${server_url}/evaluate/textbook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ textbook_id: evaluation_id }),
    });

    data = await response.json();
  } else if (type === "homework") {
    const { data: homework, error } = await supabase.from("homeworks").select(
      "response_url",
    ).eq("id", evaluation_id).single();

    if (error) {
      console.error("Error fetching homework:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch homework" }),
        { status: 500 },
      );
    }

    if (!homework) {
      console.error("Homework not found");
      return new Response(JSON.stringify({ error: "Homework not found" }), {
        status: 404,
      });
    }

    const server_url = homework.response_url;

    // call the server to evaluate the homework
    const response = await fetch(`${server_url}/evaluate/homework`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ homework_id: evaluation_id }),
    });

    data = await response.json();
  } else if (type === "chat") {
    const { data: chat, error } = await supabase.from("chats").select(
      "response_url",
    ).eq("id", evaluation_id).single();

    if (error) {
      console.error("Error fetching chat:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch chat" }), {
        status: 500,
      });
    }

    if (!chat) {
      console.error("Chat not found");
      return new Response(JSON.stringify({ error: "Chat not found" }), {
        status: 404,
      });
    }

    const server_url = chat.response_url;

    // call the server to evaluate the chat
    const response = await fetch(`${server_url}/evaluate/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chat_id: evaluation_id }),
    });

    data = await response.json();
  } else {
    console.error("Invalid type:", type);
    return new Response(JSON.stringify({ error: "Invalid type" }), {
      status: 400,
    });
  }

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
