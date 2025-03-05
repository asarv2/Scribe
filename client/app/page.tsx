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
import { getUser } from "@/utils/queries/get-user";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getProfile } from "@/utils/queries/get-profile";
import { getClasses } from "@/utils/queries/get-classes";
import { useMediaQuery } from "@mantine/hooks";

export default function Landing() {
  const supabase = useSupabaseBrowser()
  const [value, setValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isMobile = useMediaQuery("(max-width: 768px)");

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

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => getUser(supabase),
  })

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfile(supabase, user!.id),
  })

  const { data: classData } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getClasses(supabase),
  })

  const getFilteredClasses = () => {
    if (!profile || !classData) return [];
    return profile.admin ? classData : classData?.filter(classItem => profile.classes?.includes(classItem.id));
  };

  const firstClass = getFilteredClasses()?.[0];

  return (
    <HomeLayout>
      <Container size="lg">
        <div className={classes.inner}>
          <div className={classes.content}>
            <Title className={classes.title} size="h1">
              Welcome to{' '}
              <span className={classes.highlight}>
                <span className={classes.x}>Scribe</span>
              </span>
            </Title>
            <Text c="dimmed" mt="md" size="lg">
              Join the future of learning. An AI-powered chatbot that takes burden off professors and students.
            </Text>

            <List
              mt={30}
              spacing="sm"
              size="md"
              icon={
                <ThemeIcon size={24} radius="xl">
                  <IconCheck size={16} stroke={1.5} />
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
            {!user && !profile ? (
              <Group mt={30}>
                <Link href="/login">
                  <Button>
                    Login
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button>
                    Sign Up
                  </Button>
                </Link>
              </Group>
            ) : (
              <>
                {(profile?.professor || profile?.admin) ? (
                  <Group mt={30}>
                    <Button component={Link} href={`/classes/c/${firstClass?.id}`}>
                      Home
                    </Button>
                  </Group>
                ) : (
                  <Group mt={30} gap="md" wrap="wrap">
                    {getFilteredClasses().map((classItem) => (
                      <Button key={classItem.id} component={Link} href={`/classes/c/${classItem.id}/chat/new`}>
                        {classItem.class_code} Chat
                      </Button>
                    ))}
                  </Group>
                )}
              </>
            )}
            {/* <Button component={Link} href="/signup">
              Sign Up
            </Button>
{/* 
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
            </Group> */}
          </div>

          <Image
            src="/images/hero.png"
            alt="Scribe Hero"
            width={500}
            height={500}
            className={classes.heroImage}
            style={{
              borderRadius: "10px",
              maxWidth: "100%",
              height: "auto"
            }}
          />
        </div>
      </Container>
    </HomeLayout>
  );
}
