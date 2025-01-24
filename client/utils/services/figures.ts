/**
 * utils/services/figures.ts
 * Functions to perform figure related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const createFigures = async (figures: {
    y_min: number;
    y_max: number;
    x_min: number;
    x_max: number;
    description: string;
    document: string;
}[]) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("figures")
        .insert(figures)
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
};
