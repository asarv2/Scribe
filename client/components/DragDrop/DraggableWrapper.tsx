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
                opacity: isDragging ? 0.6 : 1,
                cursor: isDragging ? 'grabbing' : 'grab',
                position: 'relative',
                transform: isDragging ? 'scale(0.98)' : 'scale(1)',
                transition: 'opacity 0.2s, transform 0.2s',
                boxShadow: isDragging ? '0 5px 15px rgba(0,0,0,0.1)' : 'none',
                zIndex: isDragging ? 1000 : 1,
            }}
        >
            {children}
        </div>
    );
}