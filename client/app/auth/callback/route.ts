import { NextResponse } from "next/server";
import useSupabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { updateProfile } from "@/utils/services/profile";
import { getClasses } from "@/utils/queries/get-classes";

type DirectoryUser = {
    name: string;
    alias: string | null;
    campus: string | null;
    title: string | null;
};

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");

    if (code) {
        const supabase = await useSupabaseServer(cookies());
        // Exchange the code for a session
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            // Retrieve the user information from the session
            const { data: { user }, error: userError } = await supabase.auth
                .getUser();

            // Handle potential errors or missing user data
            if (userError || !user) {
                return NextResponse.redirect(`${origin}/auth/auth-code-error`);
            }

            const email = user.email;

            // Verify the email domain
            if (!email?.endsWith("@purdue.edu")) {
                // Optionally, you could also sign out the user here.
                return NextResponse.redirect(`${origin}/auth/unauthorized`);
            }

            const privateKey = process.env.PRIVATE_KEY;
            const { data, error } = await supabase.functions.invoke(
                "check-alias",
                {
                    headers: {
                        "x-private-key": privateKey ?? "",
                    },
                    body: { alias: email.split("@")[0] },
                },
            );

            if (error) {
                console.error(error);
            }

            const users = data as DirectoryUser[];
            const directoryUser = users.find((u) =>
                u.alias === email.split("@")[0]
            );

            const classes = await getClasses(supabase);

            if (directoryUser) {
                const splitNames = directoryUser.name.split(' ')
                const firstName = (splitNames[0]).toLowerCase()
                const formattedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1)
                const lastName = (splitNames[splitNames.length - 1]).toLowerCase()
                const formattedLastName = lastName.charAt(0).toUpperCase() + lastName.slice(1)
                // professor status update
                const isProfessor = (directoryUser.title !== null && directoryUser.title.toLowerCase().includes("professor")) || classes.some((c) => c.professors.includes(email));
                if (isProfessor) {
                    const filteredClasses = classes.filter((c) => c.professors.includes(email));
                    const { success, error } = await updateProfile(user.id, {
                        first_name: formattedFirstName,
                        last_name: formattedLastName,
                        professor: true,
                        classes: filteredClasses.map((c) => c.id),
                    });
                    if (!success || error) {
                        console.error(error);
                    }
                } else {
                    const filteredClasses = classes.filter((c) => c.students.includes(email));
                    const { success, error } = await updateProfile(user.id, {
                        first_name: formattedFirstName,
                        last_name: formattedLastName,
                        professor: false,
                        classes: filteredClasses.map((c) => c.id),
                    });
                    if (!success || error) {
                        console.error(error);
                    }

                }
            }

            // Redirect the user based on environment and headers
            const forwardedHost = request.headers.get("x-forwarded-host"); // original host before load balancer
            const isLocalEnv = process.env.NODE_ENV === "development";
            if (isLocalEnv) {
                return NextResponse.redirect(`${origin}/classes`);
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}/classes`);
            } else {
                return NextResponse.redirect(`${origin}/classes`);
            }
        }
    }

    // Fallback error redirect
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
