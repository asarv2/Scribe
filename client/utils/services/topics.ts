/**
 * utils/services/topics.ts
 * Will handle adding topics to the map.
 */
"use server"

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const createTopics = async (classId: string, topics: {title: string, content: string, mapParent: string | null, mapId: string, lectures: string[]}[]) => {
    const supabase = useSupabaseServer(cookies());
    const mappedTopics = topics.map(topic => {
        return {
            title: topic.title,
            class: classId,
            content: topic.content,
            map_parent: topic.mapParent,
            map_id: topic.mapId,
            lectures: topic.lectures,
        }
    });
    const { data, error } = await supabase
        .from('topics')
        .insert([...mappedTopics]);

    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}
