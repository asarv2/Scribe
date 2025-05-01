import { NextResponse } from "next/server";
import useSupabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { updateProfile } from "@/utils/services/profile";
import { getClasses } from "@/utils/queries/get-classes";
import { upsertOneDrive } from "@/utils/services/microsoft";
import { getOneDrive } from "@/utils/queries/get-onedrive";
import { checkCode } from "@/utils/services/code";
import { getProfile } from "@/utils/queries/get-profile";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const classCode = searchParams.get("class_code");

    if (code) {
        const supabase = await useSupabaseServer(cookies());
        // Exchange the code for a session
        const { data, error } = await supabase.auth.exchangeCodeForSession(
            code,
        );
        const session = data.session;
        if (
            !error && session
        ) {
            // Retrieve the user information from the session
            const user = session.user;
            const name = user.user_metadata.full_name ?? "Full Name";
            const email = user.email;

            const splitNames = name.split(" ");
            const firstName = splitNames[0].toLowerCase();
            const formattedFirstName = firstName.charAt(0).toUpperCase() +
                firstName.slice(1);
            const lastName = splitNames[splitNames.length - 1]
                .toLowerCase();
            const formattedLastName = lastName.charAt(0).toUpperCase() +
                lastName.slice(1);

            // Verify the email domain
            if (!email?.endsWith("@purdue.edu")) {
                // Optionally, you could also sign out the user here.
                return NextResponse.redirect(`${origin}/auth/unauthorized`);
            }
            
            // Check directory for professor status
            const privateKey = process.env.PRIVATE_KEY;
            let directoryUser = null;
            try {
                const { data: directoryData, error: directoryError } = await supabase.functions.invoke(
                    "check-alias",
                    {
                        headers: {
                            "x-private-key": privateKey ?? "",
                        },
                        body: { alias: email.split("@")[0] },
                    },
                );
                
                if (!directoryError && directoryData) {
                    const users = directoryData as { name: string; alias: string | null; campus: string | null; title: string | null; }[];
                    directoryUser = users.find((u) => u.alias === email.split("@")[0]);
                }
            } catch (directoryCheckError) {
                console.error("Error checking directory:", directoryCheckError);
            }

            const classes = await getClasses(supabase);

            // professor status update - now includes directory check
            const isProfessorFromClasses = classes.some((c) => c.professors.includes(email));
            const isProfessorFromDirectory = directoryUser?.title !== null && 
                directoryUser?.title.toLowerCase().includes("professor");
            const isProfessor = isProfessorFromClasses || isProfessorFromDirectory;

            const filteredClasses = isProfessor
                ? classes.filter((c) => c.professors.includes(email))
                : classes.filter((c) => c.students.includes(email));

            let firstClassId = null;
            if (classCode) {
                try {
                    const { success, error: codeError, code: validatedCode } =
                        await checkCode(classCode);

                    if (success && validatedCode) {
                        firstClassId = validatedCode.class;
                    } else {
                        console.log("Invalid code") // no need to log error, since we just won't add the class to the user's classes
                    }
                } catch (codeCheckError) {
                    console.log(codeCheckError) // no need to log error, since we just won't add the class to the user's classes
                }
            }

            const profile = await getProfile(supabase, user.id);

            const allClasses = Array.from(new Set([firstClassId, ...filteredClasses.map((c) => c.id), ...profile.classes])).filter((c) => c !== null);

            if (!firstClassId) {
                const firstClass = allClasses[0];
                firstClassId = firstClass;
            }

            const { success, error } = await updateProfile(user.id, {
                professor: isProfessor || profile.professor,
                classes: allClasses,
                first_name: formattedFirstName,
                last_name: formattedLastName,
            });
            if (!success || error) {
                console.error(error);
            }

            const firstClassSuffix = isProfessor
                ? firstClassId
                : `${firstClassId}/chat/new`;

            // Redirect the user based on environment and headers
            const forwardedHost = request.headers.get("x-forwarded-host"); // original host before load balancer
            const isLocalEnv = process.env.NODE_ENV === "development";
            if (isLocalEnv) {
                return NextResponse.redirect(
                    `${origin}/class/${firstClassSuffix}`,
                );
            } else if (forwardedHost) {
                return NextResponse.redirect(
                    `https://${forwardedHost}/class/${firstClassSuffix}`,
                );
            } else {
                return NextResponse.redirect(
                    `${origin}/class/${firstClassSuffix}`,
                );
            }
        }
    }

    // Fallback error redirect
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
