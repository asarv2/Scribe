/**
 * utils/services/storage.ts
 * Functions to perform storage related mutations.
 */
"use server"

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const uploadLectureImages = async (
    photoData: FormData,
    numPages: number,
    classId: string,
    slideId: string
): Promise<{ success: boolean; error: string }> => {
    const supabase = useSupabaseServer(cookies());

    for (let index = 0; index < numPages; index++) {
        try {
            const photo = photoData.get(`photo_${index}`) as File;
            if (!photo) {
                throw new Error('Invalid photo file');
            }

            const filePath = `${classId}/${slideId}/page_${index + 1}.png`;

            const { error: uploadError } = await supabase.storage.from('photos').upload(filePath, photo);

            if (uploadError) {
                throw new Error(uploadError.message);
            }
        } catch (error: any) {
            console.error('Error processing image:', error);
        }
    }

    return { success: true, error: "" };
};