/**
 * utils/services/topics.ts
 * Will handle adding topics to the map.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const createTopics = async (
    classId: string,
    topics: {
        title: string;
        content: string;
        mapParent: string | null;
        mapId: string;
        lectures: string[];
        newNode: boolean;
    }[],
) => {
    const supabase = useSupabaseServer(cookies());

    const { data: currentTopics, error } = await supabase
        .from("topics")
        .select("*")
        .eq("class", classId);
    if (error) {
        return { success: false, error: error.message };
    }

    const mappedTopics = topics.filter((topic) => topic.newNode).map(
        (topic) => {
            const currentTopic = currentTopics.find((t) =>
                t.map_id === topic.mapId
            );
            if (!currentTopic) {
                return {
                    title: topic.title,
                    class: classId,
                    content: topic.content,
                    map_parent: topic.mapParent,
                    map_id: topic.mapId,
                    lectures: topic.lectures,
                };
            } else {
                return {
                    id: currentTopic.id,
                    title: topic.title,
                    class: classId,
                    content: topic.content,
                    map_parent: topic.mapParent,
                    map_id: topic.mapId,
                    lectures: topic.lectures,
                };
            }
        },
    );
    
    const { error: upsertError } = await supabase
        .from("topics")
        .upsert(mappedTopics);
    if (upsertError) {
        return { success: false, error: upsertError.message };
    }

    return { success: true, error: "" };
};
