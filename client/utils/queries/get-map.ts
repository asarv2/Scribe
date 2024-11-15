import { Topic, TypedSupabaseClient } from "../../types";
import { MapNode } from "../map/map-tree";

export async function getMap(client: TypedSupabaseClient, classId: string): Promise<MapNode | undefined> {
    const { data: topics, error } = await client
        .from("topics")
        .select("*")
        .eq("class", classId);

    if (error) {
        throw new Error(error.message);
    }
    if (!topics) {
        return undefined;
    }

    // Helper function to build the tree recursively
    function buildTree(topics: Topic[], nodeId: string): MapNode | undefined {
        const nodeData = topics.find(topic => topic.map_id === nodeId);
        if (!nodeData) {
            return undefined;
        }

        // Find child nodes of the current node
        const children = topics
            .filter(topic => topic.map_parent === nodeId)
            .map(child => buildTree(topics, child.map_id));

        return {
            id: nodeData.id,
            keyword: nodeData.title,
            description: nodeData.content,
            children: children.filter(child => child !== undefined) as MapNode[],
        };
    }

    // Start building the tree from the root topic
    const rootTopic = topics.find(topic => topic.map_parent === null);
    if (!rootTopic) {
        return undefined;
    }

    const rootNode: MapNode | undefined = buildTree(topics, rootTopic.map_id);
    return rootNode;
}
