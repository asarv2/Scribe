/**
 * Summary.tsx
 * Component for showing the bold summary of the lecture, with the different timestamps for the sections.
 * @AshokSaravanan222
 * 10-12-2024
 */

import { SummaryData } from "../types";

type SummaryProps = {
    data: SummaryData
}

export default function Summary({ data }: SummaryProps) {
    return (
        <div>
            {data.map((section, index) => (
                <div key={index}>
                    <h2>({section.timestamp}) {section.heading}</h2>
                    {section.children.map((subSection, index) => (
                        <div key={index}>
                            <h3>({subSection.timestamp}) {subSection.subheading}</h3>
                            {subSection.children.map((subSubSection, index) => (
                                <div key={index}>
                                    <p>({subSubSection.timestamp}) {subSubSection.text}</p>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}