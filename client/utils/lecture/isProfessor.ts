import { User } from "@supabase/supabase-js"

export const isProfessor = (user: User | undefined, classId: string) => {
    if (!user) return false;
    if ((classId === "ef85b3e5-3a62-41a4-8db1-98e5f201779a" || classId === "15e71fef-c23e-4173-a883-f6d08834f858" || classId === "9f0fbba6-ac01-4d13-a7c8-58c08b09859f") && user.email === "yipn@purdue.edu") return true;
    if (user.email === "asiladie@purdue.edu" || user.email === "sarava18@purdue.edu") return true;
    return false;
}