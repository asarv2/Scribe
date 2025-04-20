
/**
 * DraggableWrapper.tsx
 * Used to make the files and documents draggable
 * @AshokSaravanan222
 * 04/19/2025
 */
import { useDrag } from "react-dnd";

export default function DraggableWrapper({
    children,
    item,
    type,
    makeDraggable = false
}: {
    children: React.ReactNode;
    item: { id: string };
    type: 'file' | 'document';
    makeDraggable?: boolean;
}) {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: 'CONTEXT_ITEM',
        item: { id: item.id, type },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging(),
        }),
    }), [item.id, type]);

    if (!makeDraggable) {
        return <>{children}</>;
    }

    return (
        <div
            ref={(drag as unknown) as React.LegacyRef<HTMLDivElement>}
            style={{
                opacity: isDragging ? 0.5 : 1,
                cursor: 'move',
                position: 'relative'
            }}
        >
            {children}
        </div>
    );
}