import { User } from "@supabase/supabase-js"

export const isProfessor = (user: User | undefined, classId: string) => {
    if (!user) return false;
    if (classId === "3236bffb-cfa4-47b8-a0a2-44427df57e3b" && user.email === "yipn@purdue.edu") return true;
    if (user.email === "asiladie@purdue.edu" || user.email === "sarava18@purdue.edu") return true;
    return false;
}