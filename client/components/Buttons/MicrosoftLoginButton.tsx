import { Button } from "@mantine/core";
import { signInWithMicrosoft } from "@/utils/services/auth";
import { notifications } from "@mantine/notifications";
import MicrosoftIcon from "../Icons/MicrosoftIcon";
import { useState } from "react";
import { useRouter } from "next/navigation";
import classes from "./MicrosoftLoginButton.module.css";

export default function MicrosoftLoginButton({ text = "Student", professor = false, code = null }: { text?: string, professor?: boolean, code?: string | null }) {
    const [microsoftButtonLoading, setMicrosoftButtonLoading] = useState(false);
    const router = useRouter();
    
    const handleSignInWithMicrosoft = async () => {
        setMicrosoftButtonLoading(true);
        try {
            const redirectTo = code ? `${window.location.origin}/auth/callback?class_code=${code}` : `${window.location.origin}/auth/callback`;
            const { success, error, url } = await signInWithMicrosoft(redirectTo);
            if (success && url) {
                router.push(url);
            } else {
                throw new Error(error);
            }
        } catch (error: any) {
            notifications.show({
                title: "Error",
                message: error.message,
                color: "red",
            });
        }
    }
    return (
        <Button
            onClick={handleSignInWithMicrosoft}
            loading={microsoftButtonLoading}
            variant="outline"
            leftSection={
                <MicrosoftIcon />
            }
            className={classes.microsoftButton}
        >
            {professor ? "Professor" : text}
        </Button>
    )
}