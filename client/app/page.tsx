/**
 * app/page.tsx
 * The root page component for the app.
 * @AshokSaravanan222
 * 09.01.2024
 */
"use client"
import { Box, Button, Container, Stack, Text, Group, Avatar, useMantineColorScheme, Flex, Title, Paper, Card } from "@mantine/core";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import { getClasses } from "@/utils/queries/get-classes";
import { useMediaQuery } from "@mantine/hooks";
import { HomeLayout } from "@/components/Home/HomeLayout";
import { useRef, useEffect, useState } from "react";
import { TypeAnimation } from 'react-type-animation';
import { IconSchool, IconGraph, IconFileText, IconQuestionMark } from '@tabler/icons-react';

export default function Landing() {
  const supabase = useSupabaseBrowser();
  const { colorScheme } = useMantineColorScheme();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showUserQuery, setShowUserQuery] = useState(false);
  const [showAIResponse, setShowAIResponse] = useState(false);
  const [showLearn, setShowLearn] = useState(false);
  const [showHomework, setShowHomework] = useState(false);
  const [showTestPrep, setShowTestPrep] = useState(false);
  const [showButtons, setShowButtons] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => getUser(supabase),
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfile(supabase, user!.id),
    enabled: !!user?.id
  });

  const { data: classData } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getClasses(supabase),
  });

  const getFilteredClasses = () => {
    if (!profile || !classData) return [];
    return profile.admin ? classData : classData?.filter(classItem => profile.classes?.includes(classItem.id));
  };

  const firstClass = getFilteredClasses()?.[0];

  return (
    <HomeLayout>
      <Box style={{ 
        height: 'calc(100vh - 120px)', 
        width: '100%',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '20px',
      }}>
        {/* Two-column layout container */}
        <Flex
          style={{
            width: "100%",
            height: "100%",
            gap: "20px",
          }}
          direction={isMobile ? "column" : "row"}
        >
          {/* Left column - Chat interface (3/4 width) */}
          <Box
            style={{
              width: isMobile ? "100%" : "75%",
              height: "100%",
              overflowY: "auto",
              padding: isMobile ? "15px" : "30px",
            }}
          >
            {/* AI Welcome Message */}
            <Flex justify="flex-start" align="flex-start" mb="md">
              <Box style={{ maxWidth: "90%" }}>
                <Group spacing="xs" position="left" mb={4}>
                  <Avatar radius="xl" size="md">
                    <IconSchool size={24} />
                  </Avatar>
                  <Text size="lg" c="dimmed">AI Teacher</Text>
                </Group>
                <Box
                  style={{
                    backgroundColor: colorScheme === "dark" ? "#2C2E33" : "#f1f3f5",
                    padding: "16px 20px",
                    borderRadius: "2px 16px 16px 16px",
                    maxWidth: "100%",
                  }}
                >
                  <TypeAnimation
                    sequence={[
                      "Welcome to Scribe!",
                      1000,
                      () => setShowUserQuery(true)
                    ]}
                    wrapper="div"
                    speed={70}
                    style={{ fontSize: '1.4em', fontWeight: 400 }}
                    cursor={false}
                  />
                </Box>
              </Box>
            </Flex>

            {/* User Message */}
            {showUserQuery && (
              <Flex justify="flex-end" align="flex-start" mb="md">
                <Box style={{ maxWidth: "90%" }}>
                  <Group position="right" spacing="xs" mb={4}>
                    <Text size="lg" c="dimmed">Student</Text>
                    <Avatar radius="xl" size="md" color="blue" />
                  </Group>
                  <Box
                    style={{
                      backgroundColor: "#228be6",
                      color: "white",
                      padding: "16px 20px",
                      borderRadius: "16px 16px 2px 16px",
                      maxWidth: "100%",
                    }}
                  >
                    <TypeAnimation
                      sequence={[
                        "How can I succeed in my classes?",
                        1000,
                        () => setShowAIResponse(true)
                      ]}
                      wrapper="span"
                      speed={50}
                      style={{ fontSize: '1.4em', fontWeight: 400 }}
                      cursor={false}
                    />
                  </Box>
                </Box>
              </Flex>
            )}

            {/* AI Response */}
            {showAIResponse && (
              <Flex justify="flex-start" align="flex-start" mb="md">
                <Box style={{ maxWidth: "90%" }}>
                  <Group spacing="xs" position="left" mb={4}>
                    <Avatar radius="xl" size="md">
                      <IconSchool size={24} />
                    </Avatar>
                    <Text size="lg" fw={600} c="dimmed">AI Teacher</Text>
                  </Group>
                  <Box
                    style={{
                      backgroundColor: colorScheme === "dark" ? "#2C2E33" : "#f1f3f5",
                      padding: "16px 20px",
                      borderRadius: "2px 16px 16px 16px",
                      maxWidth: "100%",
                      fontSize: '1.2em'
                    }}
                  >
                    <Stack spacing="lg">
                      {/* Buttons with animation */}
                      <TypeAnimation
                        sequence={[
                          "",
                          500,
                          () => setShowButtons(true),
                          ""
                        ]}
                        wrapper="div"
                        cursor={false}
                      />
                      
                      {showButtons && (
                        <Group position="center" spacing="md" style={{ marginBottom: "20px" }}>
                          <Link href="/login">
                            <Button size="md" variant="filled">Log In</Button>
                          </Link>
                          <Text size="md" fw={500}>or</Text>
                          <Link href="/signup">
                            <Button size="md" variant="outline">Sign Up</Button>
                          </Link>
                          <TypeAnimation
                            sequence={[
                              "",
                              100,
                              "to find out how I can help you using your teacher's content",
                              1000,
                              () => setShowLearn(true)
                            ]}
                            wrapper="div"
                            speed={70}
                            cursor={false}
                          >
                            {(text) => <Text size="md" fw={400}>{text}</Text>}
                          </TypeAnimation>
                        </Group>
                      )}
                      
                      {/* Then the Learn point */}
                      {showLearn && (
                        <Box>
                          <TypeAnimation
                            sequence={[
                              "Learn: Conceptual and computational understanding along with visualization",
                              1000,
                              () => setShowHomework(true)
                            ]}
                            wrapper="div"
                            speed={70}
                            cursor={false}
                            style={{ display: 'inline' }}
                          >
                            {(text) => (
                              <>
                                <Text component="span" fw={700} size="lg">{text.split(":")[0]}: </Text>
                                {text.includes(":") && <Text component="span" size="lg">{text.split(":")[1]}</Text>}
                              </>
                            )}
                          </TypeAnimation>
                        </Box>
                      )}
                      
                      {/* Homework point */}
                      {showHomework && (
                        <Box>
                          <TypeAnimation
                            sequence={[
                              "Homework: Understand what your homework question is asking and how to solve it step by step",
                              1000,
                              () => setShowTestPrep(true) // Set test prep to true after homework animation
                            ]}
                            wrapper="div"
                            speed={70}
                            cursor={false}
                            style={{ display: 'inline' }}
                          >
                            {(text) => (
                              <>
                                <Text component="span" fw={700} size="lg">{text.split(":")[0]}: </Text>
                                {text.includes(":") && <Text component="span" size="lg">{text.split(":")[1]}</Text>}
                              </>
                            )}
                          </TypeAnimation>
                        </Box>
                      )}
                      
                      {/* Test-Prep point */}
                      {showTestPrep && (
                        <Box>
                          <TypeAnimation
                            sequence={[
                              "Test-Prep: Practice questions and customized review materials to help you ace your exams"
                            ]}
                            wrapper="div"
                            speed={70}
                            cursor={false}
                            style={{ display: 'inline' }}
                          >
                            {(text) => (
                              <>
                                <Text component="span" fw={700} size="lg">{text.split(":")[0]}: </Text>
                                {text.includes(":") && <Text component="span" size="lg">{text.split(":")[1]}</Text>}
                              </>
                            )}
                          </TypeAnimation>
                        </Box>
                      )}
                    </Stack>
                  </Box>
                </Box>
              </Flex>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Right column - Features (1/4 width) */}
          <Box
            style={{
              width: isMobile ? "100%" : "25%",
              height: "120%",
              overflowY: "auto",
              padding: isMobile ? "15px" : "20px",
              borderRadius: "8px",
            }}
          >
            
            <Card mb="lg" p="md" withBorder shadow="sm">
              <Group position="left" mb={10}>
                <IconGraph size={24} color="#228be6" />
                <Text fw={700}>Graph</Text>
              </Group>
              <Text size="sm" mb="md">The AI will create visualizations if applicable to help you understand and visualize your course material</Text>
              <Box 
                style={{ 
                  width: "100%", 
                  height: "120px", 
                  backgroundColor: colorScheme === "dark" ? "#25262b" : "#e9ecef",
                  borderRadius: "4px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  position: "relative",
                  overflow: "hidden"
                }}
              >
                {/* Simple graph visualization */}
                <Box 
                  style={{
                    position: "absolute",
                    width: "90%",
                    height: "80%",
                    display: "flex",
                    alignItems: "flex-end"
                  }}
                >
                  <Box style={{ width: "18%", height: "30%", backgroundColor: "#339af0", margin: "0 1%" }} />
                  <Box style={{ width: "18%", height: "50%", backgroundColor: "#339af0", margin: "0 1%" }} />
                  <Box style={{ width: "18%", height: "70%", backgroundColor: "#339af0", margin: "0 1%" }} />
                  <Box style={{ width: "18%", height: "40%", backgroundColor: "#339af0", margin: "0 1%" }} />
                  <Box style={{ width: "18%", height: "60%", backgroundColor: "#339af0", margin: "0 1%" }} />
                </Box>
              </Box>
            </Card>

            <Card mb="lg" p="md" withBorder shadow="sm">
              <Group position="left" mb={10}>
                <IconFileText size={24} color="#228be6" />
                <Text fw={700}>Summary</Text>
              </Group>
              <Text size="sm" mb="md">The AI will create a summary of relevant course material to help you study</Text>
              <Box 
                style={{ 
                  width: "100%", 
                  padding: "10px",
                  backgroundColor: colorScheme === "dark" ? "#25262b" : "#e9ecef",
                  borderRadius: "4px",
                  fontSize: "12px"
                }}
              >
                <Text size="xs" style={{ lineHeight: 1.4 }}>
                  Key concepts from Chapter 5:
                  - Conservation of energy
                  - Kinetic vs. potential energy
                  - Work-energy theorem
                  - Energy transformations
                </Text>
              </Box>
            </Card>

            <Card p="md" withBorder shadow="sm">
              <Group position="left" mb={10}>
                <IconQuestionMark size={24} color="#228be6" />
                <Text fw={700}>Questions</Text>
              </Group>
              <Text size="sm" mb="md">The AI will generate practice questions to help you prepare for exams</Text>
              <Box 
                style={{ 
                  width: "100%", 
                  padding: "10px",
                  backgroundColor: colorScheme === "dark" ? "#25262b" : "#e9ecef",
                  borderRadius: "4px",
                  fontSize: "12px"
                }}
              >
                <Text size="xs" fw={500} mb={5}>Practice Question:</Text>
                <Text size="xs" style={{ lineHeight: 1.4 }}>
                  A 2kg object falls from a height of 10m. Calculate its kinetic energy just before impact, assuming no air resistance.
                </Text>
              </Box>
            </Card>
          </Box>
        </Flex>
      </Box>
    </HomeLayout>
  );
}
