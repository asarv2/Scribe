/**
 * This file contains the functions for evaluating the generation
 */

import { Evaluation } from "@/types";

export const getEvaluationAsText = (evaluation: Evaluation, threshold: number = 9) => {
    const showAccuracy = evaluation.accuracy < threshold;
    const showAdherence = evaluation.adherence < threshold;
    const showCertainty = evaluation.certainty < threshold;
    const showClarity = evaluation.clarity < threshold;
    const showComplexity = evaluation.complexity < threshold;
    const showNovelty = evaluation.novelty < threshold;

    const accuracyText = `Accuracy Score: ${evaluation.accuracy}/10\nAccuracy Explanation (how well the instructions were followed): ${evaluation.accuracy_explanation}`;
    const adherenceText = `Adherence Score: ${evaluation.adherence}/10\nAdherence Explanation (how well the generation adheres to the specifications): ${evaluation.adherence_explanation}`;
    const certaintyText = `Certainty Score: ${evaluation.certainty}/10\nCertainty Explanation (ambiguous words contained in the generation): ${evaluation.certainty_explanation}`;
    const clarityText = `Clarity Score: ${evaluation.clarity}/10\nClarity Explanation (how clear the generation is): ${evaluation.clarity_explanation}`;
    const complexityText = `Complexity Score: ${evaluation.complexity}/10\nComplexity Explanation (how complex the generation is): ${evaluation.complexity_explanation}`;
    const noveltyText = `Novelty Score: ${evaluation.novelty}/10\nNovelty Explanation (how unique, but relevant, the generation is): ${evaluation.novelty_explanation}`;

    const evaluationText = `${showAccuracy ? accuracyText : ""}\n${showAdherence ? adherenceText : ""}\n${showCertainty ? certaintyText : ""}\n${showClarity ? clarityText : ""}\n${showComplexity ? complexityText : ""}\n${showNovelty ? noveltyText : ""}`;
    return evaluationText;
}