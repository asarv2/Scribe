import { User } from "@supabase/supabase-js"

export const isProfessor = (user: User | undefined, classId: string) => {
    if (!user) return false;
    if (classId === "ce907bb8-f51e-4933-b9a2-d042c5b05e67" && user.email === "yipn@purdue.edu") return true;
    if (user.email === "asiladie@purdue.edu" || user.email === "sarava18@purdue.edu") return true;
    return false;
}