import type { PlasmoMessaging } from "@plasmohq/messaging"
import { getSupabaseClient } from '~utils/supabase/supabase-client'

interface MicrosoftLoginResponse {
  success: boolean
  error: string
  session: any | null
}

type DirectoryUser = {
    name: string;
    alias: string | null;
    campus: string | null;
    title: string | null;
};

const privateKey = process.env.PLASMO_PUBLIC_PRIVATE_KEY;

const handler: PlasmoMessaging.MessageHandler<
  { redirectTo: string },
  MicrosoftLoginResponse
> = async (req, res) => {
  try {
    console.log("Microsoft login attempt");
    const client = getSupabaseClient();
    
    const { data, error } = await client.auth.signInWithOAuth({
        provider: 'azure',
        options: {
            scopes: 'email',
            queryParams: {
                domain_hint: 'purdue.edu',
            },
            redirectTo: chrome.identity.getRedirectURL()
        },
    });

    if (error) {
      console.error("Login error:", error.message);
      return res.send({
        success: false,
        error: error.message,
        session: null
      });
    }
    
    console.log(`Microsoft login URL generated: ${data.url}`);
    
    chrome.identity.launchWebAuthFlow(
      {
        url: data.url,
        interactive: true
      },
      async (redirectUrl) => {
        if (chrome.runtime.lastError) {
          console.error("Auth flow error:", chrome.runtime.lastError);
          return res.send({
            success: false,
            error: chrome.runtime.lastError.message || "Authentication failed",
            session: null
          });
        }
        
        if (redirectUrl) {
          // Parse the URL hash to get the access token
          const hashParams = new URLSearchParams(
            redirectUrl.split('#')[1] // Get everything after the #
          );
          
          const accessToken = hashParams.get('access_token');
          if (!accessToken) {
            return res.send({
              success: false,
              error: "No access token received",
              session: null
            });
          }

          // Set the session with the received token
          const { data: sessionData, error: sessionError } = await client.auth.setSession({
            access_token: accessToken,
            refresh_token: hashParams.get('refresh_token') || ''
          });

          const email = sessionData.user.email;

            // Verify the email domain
            if (!email?.endsWith("@purdue.edu")) {
                // Optionally, you could also sign out the user here.
                return res.send({
                    success: false,
                    error: "Unauthorized email domain",
                    session: null
                });
            }
            const { data, error } = await client.functions.invoke(
                "check-alias",
                {
                    headers: {
                        "x-private-key": privateKey ?? "",
                    },
                    body: { alias: email.split("@")[0] },
                },
            );

            if (error || !data) {
                console.error(error);
            }

            const users = data as DirectoryUser[];
            const directoryUser = users.find((u) =>
                u.alias === email.split("@")[0]
            );

            const { data: classes, error: classesError } = await client
            .from('classes')
            .select('*')
            .eq('deleted', false)
            .eq('active', true)
            .order('created_at', { ascending: true });

            if (classesError) {
                console.error(classesError);
            }

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
                    const { error: updateError } = await client.from('profiles').update({
                        first_name: formattedFirstName,
                        last_name: formattedLastName,
                        professor: true,
                        classes: filteredClasses.map((c) => c.id),
                    }).eq('id', sessionData.user.id);
                    if (updateError) {
                        console.error(updateError);
                    }
                } else {
                    const filteredClasses = classes.filter((c) => c.students.includes(email));
                    const { error: updateError } = await client.from('profiles').update({
                        first_name: formattedFirstName,
                        last_name: formattedLastName,
                        professor: false,
                        classes: filteredClasses.map((c) => c.id),
                    }).eq('id', sessionData.user.id);
                    if (updateError) {
                        console.error(updateError);
                    }
                }
            }
          
          if (sessionError) {
            return res.send({
              success: false,
              error: sessionError.message,
              session: null
            });
          }
          
          return res.send({
            success: true,
            error: "",
            session: sessionData.session
          });
        }
      }
    );
  } catch (error) {
    console.error("Unexpected error in login handler:", error);
    res.send({
      success: false,
      error: error.message || "An unexpected error occurred",
      session: null
    });
  }
}

export default handler;
