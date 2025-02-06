import { User } from "@supabase/supabase-js"

export const isProfessor = (user: User | undefined, classId: string) => {
    if (!user) return false;
    if ((classId === "c770c9bb-4de1-44be-aacb-b4bea3efbacf") && user.email === "yipn@purdue.edu") return true;
    if (user.email === "asiladie@purdue.edu" || user.email === "sarava18@purdue.edu" || user.email === "mlumbera@purdue.edu") return true;
    return false;
}