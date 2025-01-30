import { TypedSupabaseClient } from "../../types";

export async function getGenerations(
    client: TypedSupabaseClient,
    classId: string,
    type: "summary" | "problem",
) {
    let data;
    if (type === "summary") {
        const { data: summaryData, error: summaryError } = await client
            .from("generations")
            .select("*")
            .eq("class", classId)
            .eq("deleted", false)
            .eq("num_questions", 0)
            .order("created_at", { ascending: false });

        if (summaryError) {
            throw new Error(summaryError.message);
        }
        data = summaryData;
    } else if (type === "problem") {
        const { data: problemData, error: problemError } = await client
            .from("generations")
            .select("*")
            .eq("class", classId)
            .eq("deleted", false)
            .order("created_at", { ascending: false });

        if (problemError) {
            throw new Error(problemError.message);
        }
        data = problemData;
    }
    return data;
}
