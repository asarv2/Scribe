/**
 * AddLectureModal.tsx
 * Modal to add a lecture to the mindmap
 * @AshokSaravanan222
 * 11-15-2024
 */

import { Button } from "@mantine/core"
import { User } from "@supabase/supabase-js"
import { IconPlus } from "@tabler/icons-react"

type AddLectureModalProps = {
    isMobile: boolean
    user: User | undefined
}

export default function AddLectureModal({ isMobile, user }: AddLectureModalProps) {

    const isProfessor = (user: User | undefined) => {
        return user && user.email === "sarava18@purdue.edu"
    }

    return (
        <>
            {isProfessor(user) && <Button size={isMobile ? "compact-xs" : "sm"} leftSection={<IconPlus size={20} />} color="teal">Add Lecture</Button>}
            
        </>
    )
}