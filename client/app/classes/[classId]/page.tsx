/**
 * app/classes/[classId].tsx
 * Each class will have its own page
 * @AshokSaravanan222
 * 09.01.2024
 */
"use client"



export default function Class({ params }: { params: { classId: string } }) {

    const classId = params.classId;

    // const { data: lectures, isLoading: loadingLectures } = useQuery({
    //     queryKey: ["lectures", classId],
    //     queryFn: () => getLectures(client, classId),
    // });

    return (
        <div>
            Class
        </div>
    );
}