/**
 * QuestionSolution.tsx
 * Will show the questions and solutions in a tab format.
 * @AshokSaravanan222
 * 11-16-2024
 */

import { Card, Tabs, FloatingIndicator, Box} from "@mantine/core"
import { useState } from "react";
import classes from "./Demo.module.css"
import { Question } from "@/types";

type QuestionSolutionProps = {
    questions: Question[]
}

export default function QuestionSolution({ questions }: QuestionSolutionProps) {

    const [rootRef, setRootRef] = useState<HTMLDivElement | null>(null);
    const [tabValue, setTabValue] = useState<string | null>('1');
    const [controlsRefs, setControlsRefs] = useState<Record<string, HTMLButtonElement | null>>({});
    const setControlRef = (val: string) => (node: HTMLButtonElement) => {
        controlsRefs[val] = node;
        setControlsRefs(controlsRefs);
    };


    return (
        <Card withBorder>
                <Tabs variant="none" value={tabValue} onChange={setTabValue}>
                    <Tabs.List ref={setRootRef}>
                        <Tabs.Tab value="1" ref={setControlRef('1')} className={classes.tab}>
                            Practice Questions
                        </Tabs.Tab>
                        <Tabs.Tab value="2" ref={setControlRef('2')} className={classes.tab}>
                            Solutions
                        </Tabs.Tab>
                        <FloatingIndicator
                            target={tabValue ? controlsRefs[tabValue] : null}
                            parent={rootRef}
                            className={classes.indicator}
                        />
                    </Tabs.List>

                    <Tabs.Panel value="1">{questions.map(
                        (question, index) => (
                            <Box key={index} p="md">
                                <h3>{question.question}</h3>
                            </Box>
                        )
                    )}</Tabs.Panel>
                    <Tabs.Panel value="2">{questions.map(
                        (question, index) => (
                            <Box key={index} p="md">
                                <h3>{question.solution}</h3>
                            </Box>
                        )
                    )}</Tabs.Panel>
                </Tabs>
        </Card>
    )

}