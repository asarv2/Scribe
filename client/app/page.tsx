/**
 * app/page.tsx
 * The root page component for the app.
 * @AshokSaravanan222
 * 09.01.2024
 */
"use client"
import { Box, Button, Center, Container, Input, Space, Stack, Text, Flex, Group, Grid, Title, List, ThemeIcon, useMantineColorScheme } from "@mantine/core";
import Link from "next/link";
import { IconAt, IconCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useState } from "react";
import { joinWaitlist } from "../utils/services/waitlist";
import Image from "next/image";
import classes from "../components/Landing.module.css";
import { HomeLayout } from "@/components/Home/HomeLayout";

export default function Landing() {
  const [value, setValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      if (!value.endsWith("@purdue.edu")) {
        throw new Error("Please enter a valid Purdue email address");
      }

      const { success, error } = await joinWaitlist(value)
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
    <HomeLayout>
      <Container size="lg">
        <div className={classes.inner}>
          <div className={classes.content}>
            <Title className={classes.title}>
              Welcome to{' '}
              <span className={classes.highlight}>
                <span className={classes.x}>Scribe</span>
              </span>
            </Title>
            <Text c="dimmed" mt="md">
              Join the future of learning. An AI-powered chatbot that takes burden off professors and students.
            </Text>

            <List
              mt={30}
              spacing="sm"
              size="sm"
              icon={
                <ThemeIcon size={20} radius="xl">
                  <IconCheck size={12} stroke={1.5} />
                </ThemeIcon>
              }
            >
              <List.Item>
                <b>Transcribe Anything</b> - Automatically transcribe your lectures, textbooks, and homework files.
              </List.Item>
              <List.Item>
                <b>24/7 Availability</b> - Get help with your classes anytime, anywhere
              </List.Item>
              <List.Item>
                <b>Private and Secure</b> - Students must have a code provided by professors to use the service.
              </List.Item>
            </List>

            <Group mt={30}>
              <Input
                placeholder="Your Purdue email"
                leftSection={<IconAt size={16} />}
                value={value}
                onChange={(e) => setValue(e.currentTarget.value)}
                style={{ width: '300px' }}
              />
              <Button onClick={handleClick} loading={isLoading}>
                Join Waitlist
              </Button>
            </Group>
          </div>

          <Image
            src="/images/hero.png"
            alt="Scribe Hero"
            width={500}
            height={500}
            className={classes.heroImage}
            style={{
              borderRadius: "10px",
            }}
          />
        </div>
      </Container>
    </HomeLayout>
  );
}
