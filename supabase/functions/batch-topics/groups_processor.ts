import { HumanMessage } from "npm:@langchain/core/messages";
import { BaseProcessor } from "../_shared/base_processor.ts";
import { Terms } from "./terms_processor.ts";

interface Group {
    group: string;
    definition: string;
    terms: Terms;
    subgroups?: Groups;
}

interface Groups {
    [key: string]: Group;
}

export interface LectureMapping {
    [key: string]: {
        id: string;
    };
}

interface Topic {
    title: string;
    content: string;
    class: string;
    map_parent: string | null;
    map_id: string;
    lectures: string[];
    figures: string[];
    type: string;
    map: string;
}

export class GroupsProcessor extends BaseProcessor {
    private apiKey: string;
    private terms: Terms;
    private group: string;
    private depth: number;
    private maxDepth: number;
    private groups: Groups;
    private courseTitle: string;
    private courseDescription: string;
    private createGroupsPrompt: string;
    private groupTermsPrompt: string;

    constructor(
        apiKey: string,
        terms: Terms,
        courseTitle: string,
        courseDescription: string,
        group: string | null = null,
        depth: number = 1,
        maxDepth: number = 2,
    ) {
        super(apiKey);
        this.apiKey = apiKey;
        this.terms = terms;
        this.courseTitle = courseTitle;
        this.courseDescription = courseDescription;
        this.group = group || courseTitle;

        if (depth > maxDepth) {
            throw new Error("Depth cannot be greater than max depth");
        }
        if (depth < 1 || maxDepth < 1) {
            throw new Error("Depth and max depth cannot be less than 1");
        }

        this.depth = depth;
        this.maxDepth = maxDepth;
        this.groups = {};

        this.createGroupsPrompt = `Your objective is to condense a large list of terms into a smaller list of groups, where each group is a more specific version of a term. You will also be given a hierarchy of what groups have already been created, so you do not recreate them. This is in the context of the course ${this.courseTitle}.
        
        WHAT YOU SHOULD DO:
        1. Your groups should not be the same as the terms in the original list.
        2. You have a maximum of 5 groups, but less is better.
        3. Each group should be broad enough to span at least 3 terms in a meaningful way, but not too broad that it becomes a catch-all.
        4. Your response should be in the following format: <group>: <definition>. Do not number the groups or add special modifiers -- just follow the format.
        
        WHAT YOU SHOULD NOT DO:
        1. Refrain from making vague groups titled 'Advanced Topic' or 'Advanced Concepts'.
        2. Refrain from making groups that are broad, like 'Fundamentals of [course name]' or '[course name] Basics'.
        3. Do not repeat the same group name that is in the hierarchy, a group should always be more specific than the parent group.
        
        Here is a full example to assist you: 
        TERMS: convex set, convex combination, convex hull, carathéodory theorem, farkas' lemma, feasibility of linear inequalities, convex hull representation, convex combination representation, separating polyhedra, carathéodory's theorem application, convex set definition, production planning, surplus, production change cost, risk aversion parameter, maximum weight matching, sales force planning, portfolio selection with absolute deviation, portfolio selection with variance, smallest enclosing ball, production change cost linearization, sales force planning linearization, portfolio selection with absolute deviation linearization, smallest enclosing ball quadratic program, maximum weight matching integer program, spanning tree, fair prices, reduced cost, entering arc, adjusted flow, finding fair prices, identifying profitable arcs, adjusting flows, finding an initial feasible solution, economic interpretation of reduced costs
        
        HIERARCHY:
        Linear Programming (YOU ARE HERE)
        
        OUTPUT: 
        Convex Geometry: Key concepts related to convexity in linear programming, including convex sets, convex combinations, convex hulls, and their mathematical representations and theorems like Carathéodory's theorem and Farkas' lemma.
        
        Optimization Models and Applications: Practical uses of linear programming models in various fields such as production planning, sales force planning, portfolio selection, and maximum weight matching, including model-specific considerations like risk aversion and production change costs.
        
        Algorithmic Methods and Feasibility: Techniques for determining feasibility, adjusting flows, finding initial feasible solutions, and solving optimization problems, including spanning trees, entering arcs, and adjusted flow methods.
        
        Duality and Economic Interpretation: Concepts like reduced cost, fair prices, identifying profitable arcs, and the economic interpretation of optimization results, emphasizing duality principles and cost analysis in linear programs.
        
        Now it's your turn. Extract the most important topics from the following terms and hierarchy. `;

        this.groupTermsPrompt = `Your objective is to decide which group each of the following Key Terms/Problem Types/Algorithm Solutions belong to, in the context of the course ${this.courseTitle}. If there is only one group that the term is a part of, respond in the following format: <key term>: <GROUP number>. Here is an example to assist you: 'GROUPS: [simplex method]-[GROUP 1]\n[linear programming applications]-[GROUP 2]\n[network flow]-[GROUP 3]\n\nTERMS: primal problem, dual problem, network, node, knapsack problem, maximum weight matching\n\nOUTPUT: <primal problem>: <GROUP 1>\n\n<dual problem>: <GROUP 2>\n\n<network>: <GROUP 3>\n\n<node>: <GROUP 3>\n\n<knapsack problem>: <GROUP 2>\n\n<maximum weight matching>: <GROUP 3>'. For terms that are a part of multiple groups, respond in the following format: <key term>: <GROUP number><GROUP number>. Here is another example to assist you: 'GROUPS: [duality]-[GROUP 1]\n[convexity]-[GROUP 2]\n[network applications]-[GROUP 3]\n\nTERMS: dual problem, weak duality theorem, convex hull, farkas lemma, bellmans equation, dummy node\n\nOUTPUT: <dual problem>: <GROUP 1><GROUP 3>\n\n<weak duality theorem>: <GROUP 1><GROUP 2>\n\n<convex hull>: <GROUP 2>\n\n<farkas lemma>: <GROUP 1>\n\n<bellmans equation>: <GROUP 1>\n\n<dummy node>: <GROUP 1><GROUP 3>'.`;
    }

    private generateHierarchy(pointerGroup: string | null = null): string {
        const buildHierarchy = (groups: Groups, level = 0): string[] => {
            const result: string[] = [];
            const indent = "  ".repeat(level);

            for (const [groupName, groupData] of Object.entries(groups)) {
                const groupTitle = groupData.group || groupName;
                const pointer = groupName === pointerGroup
                    ? " (YOU ARE HERE)"
                    : "";
                result.push(`${indent}${groupTitle}${pointer}`);

                if (groupData.subgroups) {
                    result.push(
                        ...buildHierarchy(groupData.subgroups, level + 1),
                    );
                }
            }

            return result;
        };

        const pointer = this.courseTitle === pointerGroup
            ? " (YOU ARE HERE)"
            : "";
        const hierarchy = [`${this.courseTitle}${pointer}`];
        hierarchy.push(...buildHierarchy(this.groups, 1));

        return hierarchy.join("\n");
    }

    private async generateGroups(): Promise<string[]> {
        const terms = Object.keys(this.terms);
        if (terms.length < 3) return [];

        const termsStr = "TERMS: " + terms.join(", ");
        const hierarchyStr = "HIERARCHY:\n" +
            this.generateHierarchy(this.group);
        const prompt = this.createGroupsPrompt + "\n\n" + termsStr + "\n\n" +
            hierarchyStr + "\nOUTPUT: ";

        try {
            const message = new HumanMessage({ content: prompt });
            const result = await this.robustGenerate(message);
            return result.split("\n").filter((line) => line.trim());
        } catch (error) {
            console.error("Error generating groups:", error);
            return [];
        }
    }

    private cleanGeneratedGroups(
        generatedGroups: string[],
    ): [string[], string[], string[]] {
        const groups: string[] = [];
        const formattedGroups: string[] = [];
        const definitions: string[] = [];

        for (const line of generatedGroups) {
            if (line.includes(":")) {
                const [formattedGroup, definition] = line.split(":", 2);
                let group = formattedGroup.trim().toLowerCase();
                group = group.replace(/\([^)]*\)/g, "").trim();

                if (!groups.includes(group)) {
                    groups.push(group);
                    formattedGroups.push(formattedGroup.trim());
                    definitions.push(definition.trim());
                } else {
                    console.log(`Pruning group: ${group}`);
                }
            }
        }

        return [groups, formattedGroups, definitions];
    }

    private async processBatch(
        terms: string[],
        groups: string[],
        batchIndex: number,
    ): Promise<string> {
        console.log(`Processing batch ${batchIndex + 1}`);

        const groupsPrompt = groups
            .map((group, idx) => `[${group}]-[GROUP ${idx + 1}]`)
            .join("\n");

        const message = new HumanMessage({
            content: [
                { type: "text", text: this.groupTermsPrompt },
                {
                    type: "text",
                    text:
                        `Use the following groups to decide which group each of the following terms belong to:\nGROUPS: ${groupsPrompt}\n\nTERMS: ${
                            terms.join(", ")
                        }\nOUTPUT: `,
                },
            ],
        });

        return await this.robustGenerate(message);
    }

    public async processGroups(): Promise<Groups> {
        if (Object.keys(this.terms).length < 3) {
            return {};
        }

        console.log(`Processing groups at depth ${this.depth}`);

        // Generate and process initial groups
        const rawGeneratedGroups = await this.generateGroups();
        const [generatedGroups, formattedGroups, definitions] = this
            .cleanGeneratedGroups(rawGeneratedGroups);

        console.log("Generated groups:", generatedGroups);

        const terms = Object.keys(this.terms);
        const result = await this.processBatch(terms, generatedGroups, 0);

        // Process the results and update this.groups
        this.cleanResult(
            result,
            terms,
            generatedGroups,
            formattedGroups,
            definitions,
        );

        // Process subgroups recursively
        await this.processRecursiveGroups();

        return this.groups;
    }

    private cleanResult(
        result: string,
        terms: string[],
        allGroups: string[],
        formattedGroups: string[],
        definitions: string[],
    ): void {
        const groupedTerms: string[] = [];

        for (const line of result.split("\n")) {
            try {
                const termMatch = line.match(/<([^>]+)>/);
                if (!termMatch) continue;

                const term = termMatch[1].trim();
                const groupMatches = line.match(/<GROUP\s*(\d+)>/i);
                if (!groupMatches) continue;

                const groupIdx = parseInt(groupMatches[1]) - 1;
                if (groupIdx >= 0 && groupIdx < allGroups.length) {
                    const group = allGroups[groupIdx];
                    const formattedGroup = formattedGroups[groupIdx];
                    const definition = definitions[groupIdx];
                    const completeTerm = this.terms[term];

                    if (group in this.groups) {
                        if (!(term in this.groups[group].terms)) {
                            this.groups[group].terms[term] = completeTerm;
                            groupedTerms.push(term);
                        }
                    } else {
                        this.groups[group] = {
                            group: formattedGroup,
                            definition: definition,
                            terms: { [term]: completeTerm },
                        };
                        groupedTerms.push(term);
                    }
                }
            } catch (error) {
                console.error(`Error processing line: ${line}`, error);
            }
        }

        const ungroupedTerms = terms.filter((term) =>
            !groupedTerms.includes(term)
        );
        console.log("Ungrouped terms:", ungroupedTerms);
    }

    private async processRecursiveGroups(): Promise<void> {
        if (this.depth >= this.maxDepth) return;

        for (const [groupName, groupData] of Object.entries(this.groups)) {
            if (Object.keys(groupData.terms).length >= 3) {
                console.log(
                    `Processing subgroup ${groupName} at depth ${
                        this.depth + 1
                    }`,
                );

                const subgroupProcessor = new GroupsProcessor(
                    this.apiKey,
                    groupData.terms,
                    this.courseTitle,
                    this.courseDescription,
                    groupName,
                    this.depth + 1,
                    this.maxDepth,
                );

                const groupSubgroups = await subgroupProcessor.processGroups();

                if (Object.keys(groupSubgroups).length > 0) {
                    const termsInSubgroups = new Set(
                        Object.values(groupSubgroups)
                            .flatMap((subgroup) => Object.keys(subgroup.terms)),
                    );

                    // Remove terms that were grouped in subgroups from the parent group
                    groupData.terms = Object.fromEntries(
                        Object.entries(groupData.terms)
                            .filter(([term]) => !termsInSubgroups.has(term)),
                    );

                    // Add the subgroups to the current group
                    this.groups[groupName].subgroups = groupSubgroups;
                }
            }
        }
    }

    public reformat_topics(lectureMapping: LectureMapping, classId: string): Topic[] {
        const map = crypto.randomUUID();
        const createTopicEntry = (
            title: string,
            content: string,
            map: string,
            parentId: string | null = null,
            lectures: string[] = [],
            figures: string[] = [],
            topicType: string = "group",
        ): Topic => {
            return {
                title,
                content,
                class: classId,
                map_parent: parentId,
                map_id: crypto.randomUUID(),
                lectures,
                figures,
                type: topicType,
                map: map
            };
        };

        const processGroup = (
            groupName: string,
            groupData: Group,
            parentId: string | null = null,
        ): Topic[] => {
            const topics: Topic[] = [];
            
            // Early return if groupData is undefined
            if (!groupData) {
                console.warn(`Group data is undefined for group: ${groupName}`);
                return topics;
            }

            // Create entry for the group itself
            const groupEntry = createTopicEntry(
                groupData.group || groupName,
                groupData.definition || "",
                map,
                parentId,
                [],
                [],
                "group",
            );
            topics.push(groupEntry);

            // Process all terms in this group
        if (groupData.terms) {
            for (const termData of Object.values(groupData.terms)) {
                if (!termData) continue;
                // Convert lecture names to ids using the mapping
                const lectureNames = Object.keys(termData.lectures);
                const lectureIds = lectureNames.map((name) => lectureMapping[name].id);

                // Get the term type from the term data
                let termType = termData.type || "term";
                if (termType === "Key Terms") termType = "term";
                else if (termType === "Problem Types") termType = "problem";
                else if (termType === "Algorithm Solutions") {
                    termType = "algorithm";
                }

                const termEntry = createTopicEntry(
                    termData.term || "",
                    termData.definition || "",
                    map,
                    groupEntry.map_id,
                    lectureIds,
                    termData.figures || [],
                    termType,
                );
                topics.push(termEntry);
            }
        }

            // Recursively process subgroups
            if (groupData.subgroups) {
                for (
                    const [subgroupName, subgroupData] of Object.entries(
                        groupData.subgroups,
                    )
                ) {
                    if (!subgroupData) continue;
                    const subgroupTopics = processGroup(
                        subgroupName,
                        subgroupData,
                        groupEntry.map_id,
                    );
                    topics.push(...subgroupTopics);
                }
            }

            return topics;
        };

        // Create root node for course
        const rootId = crypto.randomUUID();
        const rootNode: Topic = {
            title: this.courseTitle,
            content: this.courseDescription,
            map: map,
            class: classId,
            map_parent: null,
            map_id: rootId,
            lectures: Object.keys(lectureMapping).map((name) => lectureMapping[name].id), // all lecture ids
            figures: [],
            type: "group",
        };

        // Process all groups and collect topics
        const allTopics = [rootNode];
        for (const [groupName, groupData] of Object.entries(this.groups)) {
            if (!groupData) continue;
            allTopics.push(...processGroup(groupName, groupData, rootId));
        }

        return allTopics;
    }
}
