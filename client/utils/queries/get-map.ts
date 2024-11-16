import { Topic, TypedSupabaseClient } from "../../types";
import { MapNode } from "../map/map-tree";

export async function getMap(client: TypedSupabaseClient, classId: string): Promise<MapNode | null> {
    const { data: topics, error } = await client
        .from("topics")
        .select("*")
        .eq("class", classId);

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
            .map(child => buildTree(topics, child.map_id));

        return {
            id: nodeData.id,
            keyword: nodeData.title,
            description: nodeData.content,
            lectures: nodeData.lectures,
            children: children.filter(child => child !== undefined) as MapNode[],
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
