/**
 * app/page.tsx
 * The root page component for the app.
 * @AshokSaravanan222
 * 09.01.2024
 */
"use client"
import { HeaderSimple } from "../components/HeaderSimple";
import { Box, Button, Center, Container, Input, Space, Stack, Text } from "@mantine/core";
import Link from "next/link";
import { IconAt } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useState } from "react";
import { joinWaitlist } from "../utils/services/waitlist";

export default function Landing() {
  const [value, setValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      if (!value.endsWith("@purdue.edu")) {
        throw new Error("Please enter a valid Purdue email address");
      }

      const {success, error} = await joinWaitlist(value)
      if (!success) {
        if (error === "duplicate key value violates unique constraint \"waitlist_pkey\"") {
          throw new Error("You have already joined the waitlist");
        }
        throw new Error(error);
      }

      notifications.show({
        title: "Waitlist joined",
        message: "You have successfully joined the waitlist",
        color: "blue",
      });
    } catch (error: any) {
      console.error(error);
      notifications.show({
        title: "Failed to join waitlist",
        message: error.message,
        color: "red",
      });
    } finally {
      setIsLoading(false);
      setValue("");
    }
  }

  return (
    <>
      <HeaderSimple />
      <Container fluid style={{ marginTop: "30px" }}>
        <Center>
          <Space h={500} />
          <Stack>
            <Text size="xl" fw={700}>Scribe Waitlist</Text>
            <Input placeholder="Your Purdue email" leftSection={<IconAt size={16} />} value={value} onChange={(e) => {
              setValue(e.currentTarget.value);
            }}/>
            <Button onClick={handleClick} loading={isLoading}>Join</Button>
          </Stack>
        </Center>
      </Container>
    </>
  );
}
