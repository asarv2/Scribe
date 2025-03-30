import { Button } from "@mantine/core";
import { signInWithMicrosoft, signInWithMicrosoftProfessor } from "@/utils/services/auth";
import { notifications } from "@mantine/notifications";
import MicrosoftIcon from "../Icons/MicrosoftIcon";
import { useState } from "react";
import { useRouter } from "next/navigation";
import classes from "./MicrosoftLoginButton.module.css";

export default function MicrosoftLoginButton({ text = "Student", professor = false }: { text?: string, professor?: boolean }) {
    const [microsoftButtonLoading, setMicrosoftButtonLoading] = useState(false);
    const router = useRouter();
    
    const handleSignInWithMicrosoft = async () => {
        setMicrosoftButtonLoading(true);
        try {
            // const { success, error, url } = await (professor ? signInWithMicrosoftProfessor(`${window.location.origin}/auth/callback`) : signInWithMicrosoft(`${window.location.origin}/auth/callback`));
            // temporary fix for professor login
            const { success, error, url } = await signInWithMicrosoft(`${window.location.origin}/auth/callback`);
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