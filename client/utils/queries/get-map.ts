import { Topic, TypedSupabaseClient } from "../../types";
import { MapNode } from "../map/map-tree";

export async function getMap(client: TypedSupabaseClient, classId: string): Promise<MapNode | null> {
    const { data: topics, error } = await client
        .from("topics")
        .select("*")
        .eq("class", classId)
        .neq("type", "problem")
        .neq("type", "algorithm");

    if (error) {
        throw new Error(error.message);
    }
    if (!topics) {
        return null;
    }

    // Helper function to build the tree recursively
    function buildTree(topics: Topic[], nodeId: string): MapNode | null {
        const nodeData = topics.find(topic => topic.map_id === nodeId);
        if (!nodeData) {
            return null;
        }

        // Find child nodes of the current node
        const children = topics
            .filter(topic => topic.map_parent === nodeId)
            .map(child => buildTree(topics, child.map_id))
            .filter(child => child !== null) as MapNode[];

        // Skip this node if it's a group with no children (unless it's a root node)

        // Combine lectures from all children if this is a group
        let combinedLectures = nodeData.lectures || [];
        if (nodeData.type === "group") {
            children.forEach(child => {
                if (child.lectures) {
                    combinedLectures = [...combinedLectures, ...child.lectures];
                }
            });
            // Remove duplicates
            combinedLectures = Array.from(new Set(combinedLectures));
        }

        return {
            id: nodeData.map_id,
            keyword: nodeData.title,
            description: nodeData.content,
            lectures: combinedLectures,
            visuals: nodeData.visuals,
            children: children,
            xPosition: nodeData.x ?? undefined,
            yPosition: nodeData.y ?? undefined,
            supabaseId: nodeData.id,
        };
    }

    // Start building the tree from the root topic
    // const rootTopics = topics.filter(topic => topic.map_parent == null)
    // console.log(rootTopics)
    const rootTopic = topics.find(topic => topic.map_parent === null);
    if (!rootTopic) {
        return null;
    }

    const rootNode: MapNode | null = buildTree(topics, rootTopic.map_id);
    return rootNode;
}
