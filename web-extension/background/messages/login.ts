import type { PlasmoMessaging } from "@plasmohq/messaging"
import type { User } from "@supabase/supabase-js"
import { getSupabaseClient } from '~utils/supabase/supabase-client'

interface LoginResponse {
  success: boolean
  error: string
  user: User | null
}

const handler: PlasmoMessaging.MessageHandler<
  { email: string; password: string },
  LoginResponse
> = async (req, res) => {
  try {
    console.log("Login attempt for:", req.body.email);
    const client = getSupabaseClient();
    
    const { data, error } = await client.auth.signInWithPassword({
      email: req.body.email,
      password: req.body.password
    });

    if (error) {
      console.error("Login error:", error.message);
      return res.send({
        success: false,
        error: error.message,
        user: null
      });
    }

    console.log("Login successful for:", req.body.email);
    res.send({
      success: true,
      error: "",
      user: data.user
    });
  } catch (error) {
    console.error("Unexpected error in login handler:", error);
    res.send({
      success: false,
      error: error.message || "An unexpected error occurred",
      user: null
    });
  }
}

export default handler;
