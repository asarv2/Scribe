import { Generation, Question, Summary, TypedSupabaseClient } from "../../types";

export async function getGenerationFigures(client: TypedSupabaseClient, summaries: Summary[], questions: Question[]) {
    const allFigures = [...summaries.map(summary => summary.figures), ...questions.map(question => question.figures)].flat();
    if (allFigures.length === 0) {
        return [];
    }
    const {data: figures, error: figuresError} = await client
        .from("figures")
        .select("*")
        .in("id", allFigures)
    if (figuresError) {
        throw new Error(figuresError.message);
    }

    return figures;
}
