import { Box, Card, Stack, Text } from "@mantine/core";
import styles from "./PulseText.module.css";

export default function PulseText({ text, error }: { text: string, error?: boolean }) {
    return (
        <Stack gap="xs" style={{ width: "100%" }}>
            <Box style={{ maxWidth: "100%", overflow: "hidden" }}>
                <Text className={error ? styles.errorAnimation : styles.thinkingAnimation}>{text}</Text>
            </Box>
        </Stack>
    )
}