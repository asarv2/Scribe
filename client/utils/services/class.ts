/**
 * utils/services/class.ts
 * Functions to perform class related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const updateClassPrivacy = async (
    classId: string,
    privacyStatus: boolean,
) => {
    const supabase = await useSupabaseServer(cookies());
    const { error } = await supabase
        .from("classes")
        .update({ privacy: privacyStatus })
        .eq("id", classId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
};

export const updateClass = async (
    classId: string,
    title: string,
    class_code: string,
    course_description: string,
    syllabus: string | null,
) => {
    const supabase = await useSupabaseServer(cookies());
    const { error } = await supabase
        .from("classes")
        .update({
            saved: true,
            title,
            class_code,
            course_description,
            syllabus,
        })
        .eq("id", classId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
};

export const createClass = async (
    className: string,
    classCode: string,
    classDescription: string,
) => {
    const supabase = await useSupabaseServer(cookies());
    const { data, error } = await supabase
        .from("classes")
        .insert({
            title: className,
            class_code: classCode,
            course_description: classDescription,
        })
        .select("id");
    if (error) {
        return null;
    }
    return data[0].id;
};

export const deleteClass = async (classId: string) => {
    const supabase = await useSupabaseServer(cookies());
    const { error } = await supabase
        .from("classes")
        .update({
            deleted: true,
        })
        .eq("id", classId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
};

export const updateProfileClasses = async (
    profileId: string,
    newClasses: string[],
) => {
    const supabase = await useSupabaseServer(cookies());
    const { error } = await supabase
        .from("profiles")
        .update({
            classes: newClasses,
        })
        .eq("id", profileId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
};
