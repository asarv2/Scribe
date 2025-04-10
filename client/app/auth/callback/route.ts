import { NextResponse } from "next/server";
import useSupabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { updateProfile } from "@/utils/services/profile";
import { getClasses } from "@/utils/queries/get-classes";
import { upsertOneDrive } from "@/utils/services/microsoft";
import { getOneDrive } from "@/utils/queries/get-onedrive";

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
        const { data, error } = await supabase.auth.exchangeCodeForSession(
            code,
        );
        const session = data.session;
        if (
            !error && session && session.provider_token &&
            session.provider_refresh_token && session.expires_at
        ) {
            // Retrieve the user information from the session
            const user = session.user;
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
                const splitNames = directoryUser.name.split(" ");
                const firstName = splitNames[0].toLowerCase();
                const formattedFirstName = firstName.charAt(0).toUpperCase() +
                    firstName.slice(1);
                const lastName = splitNames[splitNames.length - 1]
                    .toLowerCase();
                const formattedLastName = lastName.charAt(0).toUpperCase() +
                    lastName.slice(1);
                // professor status update
                const isProfessor = (directoryUser.title !== null &&
                    directoryUser.title.toLowerCase().includes(
                        "professor",
                    )) || classes.some((c) => c.professors.includes(email));

                // we need to add onedrive data if they are a professor
                if (isProfessor) {
                    // check if they already have onedrive data
                    const existingOneDrive = await getOneDrive(
                        supabase,
                        user.id,
                    );
                    const onedrive = await upsertOneDrive(
                        user.id,
                        session.provider_token,
                        session.provider_refresh_token,
                        new Date(session.expires_at).toISOString(),
                        existingOneDrive?.id,
                    );
                    if (!onedrive) {
                        console.error(onedrive);
                    }
                }

                const filteredClasses = isProfessor
                    ? classes.filter((c) => c.professors.includes(email))
                    : classes.filter((c) => c.students.includes(email));

                const { success, error } = await updateProfile(user.id, {
                    first_name: formattedFirstName,
                    last_name: formattedLastName,
                    professor: isProfessor,
                    classes: filteredClasses.map((c) => c.id),
                });
                if (!success || error) {
                    console.error(error);
                }
            }

            // Redirect the user based on environment and headers
            const forwardedHost = request.headers.get("x-forwarded-host"); // original host before load balancer
            const isLocalEnv = process.env.NODE_ENV === "development";
            if (isLocalEnv) {
                return NextResponse.redirect(`${origin}/classes`);
            } else if (forwardedHost) {
                return NextResponse.redirect(
                    `https://${forwardedHost}/classes`,
                );
            } else {
                return NextResponse.redirect(`${origin}/classes`);
            }
        }
    }

    // Fallback error redirect
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
