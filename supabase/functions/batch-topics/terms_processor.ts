import { HumanMessage } from "npm:@langchain/core/messages";
import { BaseProcessor } from "../parse-lecture/base_processor.ts";

export interface Terms {
  [key: string]: {
    term: string;
    definition: string;
    lectures: {
      [key: string]: number[];
    };
    type: string;
    figures: string[];
  };
}

export interface Figure {
  id: string;
  document: string;
  y_min: number;
  x_min: number;
  y_max: number;
  x_max: number;
  description: string;
}

export class TermsProcessor extends BaseProcessor {
  private terms: Terms;
  private processedTerms: string[];
  private prompts: { [key: string]: string };
  private courseTitle: string;
  private lectures: { [key: string]: { figures: { [key: number]: Figure[] }, content: string } };

  constructor(
    apiKey: string,
    courseTitle: string,
    lectures: { [key: string]: { figures: { [key: number]: Figure[] }, content: string } }
  ) {
    super(apiKey);
    this.courseTitle = courseTitle;
    this.lectures = lectures;
    this.terms = {};
    this.processedTerms = [];
    // Initialize prompts
    this.prompts = {
      "Key Terms": `Extract the key terms from the following slides and provide a clear and concise definition for each one.
        
        WHAT YOU SHOULD DO:
        1. Your key terms should be specific to this lecture, but also make sense as a general topic in the context of ${this.courseTitle}. 
        2. Respond in the following format: <term>: <definition>. 
        3. Use LaTeX format when including any math symbols. 
        4. If you are citing a slide, include the slide number at the end of the term, with the format <SLIDE <slide number>>. 
        5. Make all terms concise as you can, try to avoid many-word terms. 
        6. Someone should be able to see how this term is specific to this course, and not just a vague scenario. 
        
        WHAT YOU SHOULD AVOID:
        1. Do not include any other text, like numbering, intermediate references, or general summaries before/after the term. 
        2. Do not add any modifiers around the key terms, like textbf'{}' or texttt'{}'. 
        3. Avoid using HTML tags or unicode. 
        4. Do not focus on generating Problem Types or Algorithm Solutions since this will be done in another section. 
        5. You should have a maximum of 5 key terms, so make sure they are the most important ones. 
        Here is a full example: 'Normal Equation: A closed-form solution for the least squares problem in linear regression. It's always solvable, even if the original system of equations is not.<SLIDE 12>'. If citing multiple slides, include the slide numbers at the end of the definition. Here is another example: 'Support Vectors: The data points closest to the hyperplane in an SVM. They are the most influential points in determining the hyperplane.<SLIDE 10><SLIDE 12><SLIDE 17>'.`,

        "Problem Types": `Extract the key types of problems discussed in the following slides and provide examples if possible. 
        
        WHAT YOU SHOULD DO:
        1. Your problem types should be specific to this lecture, but also make sense as a general problem in the context of ${this.courseTitle}. 
        2. Respond in the following format: <problem type>: <description>. 
        3. Use LaTeX format when including any math symbols. 
        4. If you are citing a slide, include the slide number at the end of the term, with the format <SLIDE <slide number>>. 
        5. Make all problem types concise as you can, try to avoid many-word terms. 
        6. Someone should be able to see how this problem type is specific to this course, and not just a vague scenario. 
        7. You should have a maximum of 5 problem types, so make sure they are the most important ones. 
        
        WHAT YOU SHOULD AVOID:
        1. Do not include any other text, like numbering, intermediate references, or general summaries before/after the problem type. 
        2. Do not add any modifiers around the key types of problems, like textbf'{}' or texttt'{}'. 
        3. Avoid using HTML tags or unicode. 
        4. Do not focus on generating Key Terms or Algorithm Solutions since this will be done in another section. 
        
        Here is an example: 'Verifying Optimality: A method for verifying the optimality of a solution is presented, involving checking the objective function value and the feasibility of the dual solution.<SLIDE 13>'. If citing multiple slides, include the slide numbers at the end of the description. Here is another example: 'Determining the existence of a non-negative solution to "Ax = b": This problem investigates whether there exists a vector "x" with non-negative components that satisfies the equation "Ax = b". Several equivalent conditions are presented using a vector "y". <SLIDE 2><SLIDE 3><SLIDE 4><SLIDE 5><SLIDE 6><SLIDE 7><SLIDE 8><SLIDE 9><SLIDE 10><SLIDE 11>'.`,
        "Algorithm Solutions": `Extract the key algorithms to solve the problems from the following slides, and explain their meaning briefly. 
        
        WHAT YOU SHOULD DO:
        1. Your algorithms should be specific to this lecture, but also make sense as a general algorithm solution in the context of ${this.courseTitle}. 
        2. Respond in the following format: <algorithm>: <formula and/or explanation>. Use LaTeX format when including any math symbols. 
        3. If you are citing a slide, include the slide number at the end of the term, with the format <SLIDE <slide number>>. 
        4. Make all algorithms concise as you can, try to avoid many-word terms. 
        5. Someone should be able to see how this algorithm is specific to this course, and not just a vague scenario. 
        6. You should have a maximum of 5 algorithms, so make sure they are the most important ones. 
        WHAT YOU SHOULD AVOID:
        1. Do not include any other text, like numbering, intermediate references, or general summaries before/after the algorithm. 
        2. Do not add any modifiers around the key algorithms, like textbf'{}' or texttt'{}'. 
        3. Avoid using HTML tags or unicode. 
        4. Do not focus on generating Key Terms or Problem Types since this will be done in another section. 
        
        Here is an example: 'Strong Duality: This theorem states that the optimal objective function values of the primal and dual problems are equal.<SLIDE 2>'. If citing multiple slides, include the slide numbers at the end of the term. Here is another example: 'Caratheodory's Theorem: This theorem states that any point in the convex hull of a set in Rm can be expressed as a convex combination of at most m+1 points. This significantly reduces the computational complexity of algorithms dealing with convex hulls, as it limits the number of points that need to be considered.<SLIDE 8><SLIDE 9>'.`,
    };

  }

  private async processBatch(
    lectureContent: string,
    category: string,
    batchIndex: number
  ): Promise<string> {
    console.log(`Processing batch ${batchIndex + 1} for ${category}`);
    const message = new HumanMessage({
      content: [
        { type: "text", text: this.prompts[category] },
        {
          type: "text",
          text: "The following terms have already been generated. Do not repeat them: " +
            Object.keys(this.terms).join(", "),
        },
        { type: "text", text: lectureContent },
      ],
    });
    return await this.robustGenerate(message);
  }

  private cleanResult(result: string, lectureName: string, category: string): void {
    const lines = result.split("\n");
    
    for (const line of lines) {
      if (!line.includes(":")) continue;

      try {
        const [formattedTerm, definitionWithSlides] = line.split(":", 2);
        let term = formattedTerm.trim().toLowerCase();
        // Remove content in parentheses
        term = term.replace(/\([^)]*\)/g, "").trim();

        // Extract slides and definition
        let definition: string;
        let slides: number[] = [];
        
        if (definitionWithSlides.includes("<SLIDE")) {
          definition = definitionWithSlides.split("<SLIDE")[0].trim();
          // Extract slide numbers using regex
          const slideMatches = definitionWithSlides.matchAll(/<SLIDE\s+(\d+)>/g);
          slides = Array.from(slideMatches, match => parseInt(match[1]));
        } else {
          definition = definitionWithSlides.trim();
        }

        // Find visuals based on slides
        const figures: string[] = [];
        for (const slide of slides) {
            const figuresForSlide = this.lectures[lectureName].figures[slide];
            if (figuresForSlide) {
                figures.push(...figuresForSlide.map((figure) => figure.id));
            }
        }

        // Update or create term
        if (term in this.terms) {
          const lectures = this.terms[term].lectures;
          if (lectureName in lectures) {
            lectures[lectureName] = Array.from(new Set([...lectures[lectureName], ...slides]));
          } else {
            lectures[lectureName] = slides;
          }
          console.log("Updating existing term:", term);
        } else {
          this.terms[term] = {
            term: formattedTerm,
            definition,
            lectures: {
              [lectureName]: slides
            },
            type: category,
            figures: figures
          };
          console.log("Added new term:", term);
        }
      } catch (error) {
        console.error(`Error processing line: '${line}'\nError: ${error.message}`);
      }
    }
  }

  public async processTerms(): Promise<Terms> {
    for (let i = 0; i < Object.keys(this.lectures).length; i++) {
        const lectureName = Object.keys(this.lectures)[i]
        const lectureContent = this.lectures[lectureName].content
      
      for (const category of Object.keys(this.prompts)) {
        const processKey = `${lectureName} - ${category}`;
        
        if (this.processedTerms.includes(processKey)) {
          console.log(`Skipping ${processKey} because it has already been processed`);
          continue;
        }

        try {
          const result = await this.processBatch(lectureContent, category, i);
          this.cleanResult(result, lectureName, category);
          this.processedTerms.push(processKey);
        } catch (error) {
          console.error(`Error processing batch ${i} for ${category}:`, error);
        }
      }
    }
    return this.terms;
  }

  public getTerms(): Terms {
    return this.terms;
  }

  public getProcessedTerms(): string[] {
    return this.processedTerms;
  }
}
